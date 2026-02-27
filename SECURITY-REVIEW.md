# PistolShrimp Security Review

Review based on [Claude Code Security](https://www.anthropic.com/news/claude-code-security) principles.

## Critical - Must Fix

- [x] **1. Gate 1 (Skill Scanner) not wired into transaction flow**
  `submitTransaction()` runs Gate 2 + 3 but never calls Gate 1. Malicious skills submitting transactions are never scanned.
  File: `security-orchestrator.ts:53-146`

- [x] **2. Policy engine only inspects first instruction**
  `decoded[0]` ignores subsequent instructions. Multi-instruction transactions can hide malicious ops after a benign first instruction.
  File: `policy-engine.ts:223-224`

- [x] **3. No re-validation before signing**
  `executeTransaction()` signs whatever `intent.transaction` references. JS pass-by-reference means the transaction can be mutated between approval and execution.
  File: `security-orchestrator.ts:281-288`

- [x] **4. No intent ownership / authorization check**
  `confirmTransaction()` and `executeTransaction()` only check intentId — any caller can confirm/execute any intent.
  File: `security-orchestrator.ts:327-336`

## High - Should Fix

- [x] **5. Daily spend tracking is in-memory only**
  `dailySpend` resets to 0 on page refresh, allowing unlimited spending across sessions.
  File: `policy-engine.ts:197`

- [x] **6. Weak hash for scan cache keys**
  DJB2 (32-bit) is trivially collision-prone. Attacker can poison scan cache with clean results for malicious content.
  Files: `skill-scanner.ts:396-404`, `prompt-firewall.ts:453-461`

- [x] **7. All gates can be disabled via exposed config**
  `enableGate1/2/3` flags exposed through React context `usePolicyConfig()`. An agent calling this can disable all gates.
  Files: `security-orchestrator.ts:422-426`, `PistolShrimpProvider.tsx`

- [x] **8. Client-side only security layer**
  Entire system runs in browser. DevTools can bypass all protections. **Documented as known architectural limitation** — production deployment requires server-side enforcement layer.

- [x] **9. Regex-only injection detection is bypassable**
  Pattern matching misses unicode substitution, string concatenation, semantic rephrasing, and multilingual attacks. **Mitigated** with NFKC normalization + homoglyph mapping + normalization diff detection. Semantic rephrasing remains an inherent limitation of regex-based approaches.

## Medium - Recommend Fix

- [ ] **10. Rate limiting is per-agentId, not per-wallet**
  Attacker can create multiple agent IDs to bypass rate limits. `agentId` is unauthenticated.
  File: `intent-queue.ts:31-45`

- [ ] **11. Singleton state shared across contexts**
  Global singletons mean multiple wallets/agents share security state (daily spend, quarantine, etc).

- [ ] **12. No transaction simulation**
  System never calls `connection.simulateTransaction()`. On-chain simulation would catch CPI attacks and flash loan setups.

- [ ] **13. Description mismatch detection is shallow**
  Only 3 hardcoded pattern pairs. Misses obvious cases like "mint NFT" hiding `close_account`.
  File: `policy-engine.ts:349-363`

- [ ] **14. Potential ReDoS in regex patterns**
  Nested alternation + quantifiers could cause exponential backtracking with crafted inputs.

## Low - Nice to Have

- [ ] **15. `Math.random()` for ID generation**
  Intent IDs are guessable. Combined with #4, attacker could guess and confirm other intents.
  Files: `intent-queue.ts:27`, `security-orchestrator.ts:477`

- [ ] **16. Unbounded token approval check too narrow**
  Only checks `MAX_SAFE_INTEGER` and `>1e15`. Real unlimited approvals use `u64::MAX`.
  File: `policy-engine.ts:297-306`
