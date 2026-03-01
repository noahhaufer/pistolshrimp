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

- [x] **10. Rate limiting is per-agentId, not per-wallet**
  Attacker can create multiple agent IDs to bypass rate limits. `agentId` is unauthenticated.
  File: `intent-queue.ts:31-45`

- [x] **11. Singleton state shared across contexts**
  Global singletons mean multiple wallets/agents share security state (daily spend, quarantine, etc).

- [x] **12. No transaction simulation**
  System never calls `connection.simulateTransaction()`. On-chain simulation would catch CPI attacks and flash loan setups.

- [x] **13. Description mismatch detection is shallow**
  Only 3 hardcoded pattern pairs. Misses obvious cases like "mint NFT" hiding `close_account`.
  File: `policy-engine.ts:349-363`

- [x] **14. Potential ReDoS in regex patterns**
  Nested alternation + quantifiers could cause exponential backtracking with crafted inputs.

## Low - Nice to Have

- [x] **15. `Math.random()` for ID generation**
  Intent IDs are guessable. Combined with #4, attacker could guess and confirm other intents.
  Files: `intent-queue.ts:27`, `security-orchestrator.ts:477`

- [x] **16. Unbounded token approval check too narrow**
  Only checks `MAX_SAFE_INTEGER` and `>1e15`. Real unlimited approvals use `u64::MAX`.
  File: `policy-engine.ts:297-306`

## v2 Security Enhancements (9 New Features)

### P0 — Critical

- [x] **17. Multi-Asset Drain Pattern Detection**
  Attacker bundles 3+ token transfers to different wallets in one tx, draining the wallet.
  **Fix:** Count distinct destination wallets across all instructions. If >= 3 different recipients, flag as drain pattern.
  File: `policy-engine.ts` — `checkDrainPattern()`

- [x] **18. Token-2022 Dangerous Extension Detection**
  Token-2022 extensions like `PermanentDelegate` (type 35) let an authority transfer/burn tokens from any holder. `TransferHook` (type 36) can execute arbitrary code on transfer.
  **Fix:** Inspect Token-2022 instruction data for extension type bytes 35/36/37. Flag as critical/high severity.
  File: `policy-engine.ts` — `checkToken2022Extensions()`

- [x] **19. Destination Address Reputation**
  Known scam/drainer addresses receive funds with no check.
  **Fix:** Maintain a blocklist of 20 known drainer contract addresses. Check all recipient accounts against the blocklist. Critical severity.
  File: `policy-engine.ts`, `types.ts` — `knownDrainerAddresses` in `ThreatIntelligence`

- [x] **20. On-Chain Program Upgrade Detection**
  Allowed program gets compromised/upgraded. SDK trusts it because it's on the allowlist but the code changed.
  **Fix:** Detect transactions targeting `BPFLoaderUpgradeab1e11111111111111111111111`. Any upgrade instruction is critical severity.
  File: `policy-engine.ts` — BPF Loader in `KNOWN_PROGRAMS`

### P1 — High

- [x] **21. CPI Depth Analysis**
  A program on the allowlist CPI-calls into an unknown malicious program. Transaction looks safe at the top level.
  **Fix:** After `simulateTransaction()`, inspect `simResult.value.innerInstructions` to extract all CPI-invoked programs. Check each against the allowlist. Block if untrusted CPI found.
  File: `security-orchestrator.ts` — `analyzeCpiPrograms()`

- [x] **22. TOCTOU Enhancement**
  Current TOCTOU protection only compares serialized bytes. Doesn't catch instruction-level mutations or stale snapshots.
  **Fix:** Hash instruction data separately from full bytes. Store `instructionHash` + `snapshotTimestamp`. Verify both on execution. Reject if snapshot older than 5 minutes.
  File: `security-orchestrator.ts` — `computeInstructionHash()`, freshness check

### P2 — Medium

- [x] **23. Jupiter/Orca Swap Slippage Validation**
  Agent submits swap with 50% slippage tolerance. MEV bot sandwiches it.
  **Fix:** Parse Jupiter v6 route instruction data for slippage bps. Flag >300 bps (3%) as high risk. Block >1000 bps (10%). Configurable via `maxSlippageBps`.
  File: `policy-engine.ts` — `checkSwapSlippage()`

- [x] **24. MEV/Sandwich Attack Awareness**
  Large swap transactions are sandwich attack targets with no warning.
  **Fix:** For swap transactions above `mevWarningThresholdSol` (default: 1 SOL), add warning about MEV exposure. Require confirmation.
  File: `policy-engine.ts` — MEV exposure check

### P3 — Nice to Have

- [x] **25. Mobile Wallet Adapter (MWA) Handling**
  `executeTransaction()` tightly coupled to `WalletContextState`.
  **Fix:** Define `TransactionSigner` interface. Update `executeTransaction()` to accept both `TransactionSigner` and `WalletContextState`. Backward compatible.
  File: `types.ts` — `TransactionSigner`, `security-orchestrator.ts` — updated signature
