<p align="center">
  <img src="assets/logo.png" width="200" alt="Pistol Shrimp" />
</p>

<h1 align="center">Pistol Shrimp</h1>

<p align="center">
  Security middleware for AI agents with Solana wallet access.<br/>
  Scans, sandboxes, and policy-gates agent actions <strong>before they touch your wallet</strong>.
</p>

Named after the crustacean that stuns threats before they can act.

> Built for the NoahAI x Superteam Sprint (Feb 2026)

## The Problem

AI agents on NoahAI have become onchain economic actors with direct Solana wallet access. Meanwhile:

- **1,184+** malicious skills identified on ClawHub
- **~20%** of the ClawHub registry was malware
- **91%** of malicious skills included prompt injection
- **CVE-2026-25253** — one-click RCE via cross-site WebSocket hijacking (CVSS 8.8)
- **30,000+** exposed OpenClaw instances without authentication

Agents now inherit the entire ClawHavoc attack surface. A compromised skill can drain wallets, exfiltrate credentials, and establish reverse shells — all through the agent's existing permissions.

## Architecture

Pistol Shrimp enforces a **"No Keys Above The Line"** pattern. The agent never has direct signing authority. It can only propose transaction intents, which must pass through a multi-gate security pipeline before reaching the wallet.

```
┌─────────────────────────────────────────────────┐
│                  AGENT ZONE                      │
│           (no wallet keys, no signing)           │
│                                                  │
│  ┌──────────────┐    ┌───────────────────────┐   │
│  │  GATE 1       │    │  GATE 2               │   │
│  │  Skill Scanner│    │  Prompt Firewall      │   │
│  │               │    │                       │   │
│  │  - Malware    │    │  - Injection detect   │   │
│  │  - C2 infra   │    │  - Context isolation  │   │
│  │  - Cred theft │    │  - Behavioral drift   │   │
│  │  - Rev shells │    │  - Encoding attacks   │   │
│  └──────────────┘    └───────────────────────┘   │
│                                                  │
│  Agent writes tx intent ──►  Intent Queue        │
├──────────────────────────────────────────────────┤
│  ╔══════════════════════════════════════════════╗ │
│  ║   NO WALLET ACCESS ABOVE THIS LINE          ║ │
│  ╚══════════════════════════════════════════════╝ │
├──────────────────────────────────────────────────┤
│                VALIDATION ZONE                   │
│          (human/policy required)                 │
│                                                  │
│  ┌────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │  GATE 3     │ │  GATE 4      │ │  GATE 5     │  │
│  │  Policy     │ │  Human       │ │  Ephemeral  │  │
│  │  Engine     │ │  Confirm     │ │  Signer     │  │
│  │             │ │              │ │             │  │
│  │  - IDL      │ │  - Decoded   │ │  - Per-tx   │  │
│  │    decode   │ │    params    │ │    authority│  │
│  │  - Limits   │ │  - Not agent │ │  - Revoked  │  │
│  │  - Anomaly  │ │    desc      │ │    after use│  │
│  └────────────┘ └─────────────┘ └────────────┘  │
│                                                  │
│  Transaction signed ──► Solana                   │
└─────────────────────────────────────────────────┘
```

## Gates

### Gate 1 — Skill Scanner (Quarantine)

Scans skill code before allowing it to interact with the agent. Detects:

- Malware signatures from the ClawHavoc campaign
- C2 infrastructure (known IPs, tunnels like ngrok/bore.pub)
- Credential theft (`.env`, seed phrases, private keys, SSH keys)
- Reverse shell patterns (netcat, bash, socat, python)
- Embedded prompt injection
- Social engineering (urgency manipulation, copy-paste terminal injection)
- Obfuscated code (eval, base64, hex encoding)
- Unauthorized MCP server endpoints

Includes a threat intelligence database with known malicious authors and IOCs.

### Gate 2 — Prompt Firewall (Context Isolation)

Detects prompt injection and context manipulation attempts:

- Instruction override patterns ("ignore previous instructions")
- System prompt leak attempts
- Role hijacking and jailbreak patterns
- Data exfiltration commands
- Encoding attacks (zero-width characters, Unicode homoglyphs, base64-wrapped injections)
- Context boundary violations (structured data breakout)
- Behavioral drift monitoring (sudden access pattern changes)
- NFKC normalization + homoglyph mapping to defeat Unicode evasion

### Gate 3 — Policy Engine (Transaction Validation)

Validates the **actual decoded instruction**, not the agent's description:

- Program allowlist/blocklist enforcement (System Program, Token Program, Jupiter, Orca, Raydium, Metaplex)
- Per-transaction and daily spending limits (default: 5 SOL/tx, 10 SOL/day)
- Auto-sign threshold for low-value transactions (default: 0.1 SOL)
- Description-to-instruction mismatch detection (catches "swap" descriptions hiding `approve(MAX)`)
- Unlimited token approval detection (u64::MAX via raw byte inspection)
- Statistical anomaly detection (3-sigma deviation from baseline)
- ALL instructions validated, not just the first (prevents multi-instruction hiding)
- Transaction simulation via `simulateTransaction()` before signing
- Per-wallet spend tracking persisted to localStorage

### Gate 4 — Human Confirmation

Transactions above the auto-sign threshold require explicit human approval. The confirmation UI shows:

- Decoded instruction parameters (not the agent's description)
- Risk score and severity badge
- Security gate results
- Policy violation warnings

### Gate 5 — Ephemeral Signer

Per-transaction signing authority. The wallet signs a single transaction and authority is revoked immediately after use. The agent never holds signing keys.

Additional protections:
- Transaction bytes are snapshotted at approval time; any mutation before signing is blocked
- Wallet ownership verified on confirm/reject/execute (agents can't approve their own intents)

## Quick Start

```bash
git clone https://github.com/noahhaufer/pistolshrimp.git
cd pistolshrimp
npm install
npm run dev
```

Open `http://localhost:5173` for the landing page, or `http://localhost:5173/demo` for the interactive demo.

### Demo Features

- **Transaction Demo** — Submit SOL transfers through the full security pipeline with a connected Phantom wallet (Devnet)
- **Skill Scanner Demo** — Test against pre-built malicious skill examples (credential stealer, prompt injection, C2 connection)
- **Injection Test Demo** — Test prompt injection patterns (instruction override, system prompt leak, hidden commands, zero-width bypass)

## Usage

### React Provider

```tsx
import { PistolShrimpProvider } from './components/PistolShrimpProvider';

function App() {
  return (
    <PistolShrimpProvider config={{
      policy: {
        autoSignThresholdSol: 0.1,
        dailyLimitSol: 10,
        transactionLimitSol: 5,
      }
    }}>
      <YourApp />
    </PistolShrimpProvider>
  );
}
```

### Hooks

```tsx
import {
  usePistolShrimp,
  useSecureTransaction,
  useSkillScanner,
  useSecurityMonitor,
  usePolicyConfig,
} from './components/PistolShrimpProvider';

// Submit a transaction through the security pipeline
const { submitTransaction, confirmTransaction } = useSecureTransaction();

const result = await submitTransaction(
  'agent-1',
  'Swap 5 SOL for USDC on Jupiter',
  transaction,
  {
    program: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    amount: 5,
    walletAddress: wallet.publicKey.toBase58(),
    skillName: 'jupiter-swap',
    promptContext: agentPrompt,
  }
);

if (result.status === 'requires_confirmation') {
  // Show confirmation modal to user
}

// Scan a skill before allowing it to run
const { scanSkill } = useSkillScanner();
const scanResult = scanSkill('skill-id', 'My Skill', 'clawhub', skillCode);

if (scanResult.quarantined) {
  // Block the skill
}
```

### Direct API (without React)

```ts
import { SecurityOrchestrator } from './lib/pistolshrimp';

const orchestrator = new SecurityOrchestrator({
  policy: {
    dailyLimitSol: 5,
    autoSignThresholdSol: 0.05,
  }
});

// Scan a skill
const scanResult = orchestrator.scanSkill(
  'skill-123', 'Token Swap', 'clawhub', skillSourceCode
);

// Submit a transaction
const result = await orchestrator.submitTransaction(
  'agent-1',
  'Transfer 1 SOL',
  transaction,
  { amount: 1, walletAddress: 'abc...xyz' }
);

// Execute after confirmation
if (result.status === 'approved') {
  await orchestrator.executeTransaction(result.intentId, wallet, connection);
}
```

## Configuration

### Default Policy

| Parameter | Default | Description |
|-----------|---------|-------------|
| `autoSignThresholdSol` | 0.1 | Auto-approve transactions below this amount |
| `dailyLimitSol` | 10 | Maximum SOL spent per day per wallet |
| `transactionLimitSol` | 5 | Maximum SOL per single transaction |
| `blockUnknownPrograms` | false | Block programs not on the allowlist |
| `requireConfirmationForNewPrograms` | true | Require human approval for unfamiliar programs |
| `enableAnomalyDetection` | true | Statistical outlier detection |

### Default Rate Limits

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxIntentsPerWindow` | 20 | Max intents per 5-minute window |
| `maxQueueDepth` | 50 | Max pending intents in queue |
| `maxConsecutiveRejections` | 3 | Rejections before cooldown |
| `cooldownMs` | 60,000 | Base cooldown (exponential backoff) |
| `intentTtlMs` | 1,800,000 | Intent expiry (30 minutes) |

### Allowed Programs (Default)

- System Program
- Token Program / Token-2022
- Associated Token Account
- Jupiter v6
- Orca Whirlpool
- Metaplex Token Metadata

## Threat Model

### Protected

| Threat | How |
|--------|-----|
| Malicious skill drains wallet | Agent never has signing authority; intent queue + policy engine |
| Supply chain attack via ClawHub | Gate 1 quarantines known malware patterns and IOCs |
| Misleading tx description tricks approver | Policy engine + human review use decoded instructions, not descriptions |
| Compromised agent floods queue (DoS) | Rate limiting, burst detection, queue depth caps, exponential backoff |
| Unlimited token approval | Raw byte inspection for u64::MAX + broad threshold detection |
| Transaction mutation after approval | Byte snapshot at approval time, blocked if changed before signing |

### Partial / Expected

| Threat | Limitation |
|--------|------------|
| Prompt injection exfiltrates non-wallet data | Context isolation helps, but requires agent-runtime fixes beyond middleware scope |
| Novel zero-day injection bypasses Gate 2 | Expected — architecture ensures Gates 3-5 protect wallets independently |

### Out of Scope

| Threat | Why |
|--------|-----|
| Compromised agent manipulates non-tx actions | Pistol Shrimp gates wallet operations only |
| OpenClaw core vulnerabilities | Requires fixes from OpenClaw team |
| Client-side bypass via DevTools | Runs in browser; production deployment needs server-side enforcement |

## Project Structure

```
src/
├── lib/pistolshrimp/
│   ├── index.ts                 # Barrel exports
│   ├── types.ts                 # All type definitions
│   ├── config.ts                # Default configuration
│   ├── skill-scanner.ts         # Gate 1 — Skill quarantine
│   ├── prompt-firewall.ts       # Gate 2 — Injection detection
│   ├── policy-engine.ts         # Gate 3 — Transaction validation
│   ├── intent-queue.ts          # Rate-limited intent queue
│   ├── security-orchestrator.ts # Main entry point
│   └── __tests__/               # Unit + integration tests
├── components/
│   ├── PistolShrimpProvider.tsx  # React context + hooks
│   ├── SecurityMonitor.tsx      # Real-time security dashboard
│   └── TransactionConfirmModal.tsx # Human confirmation UI
├── pages/
│   ├── Landing.tsx              # Marketing / educational page
│   └── Index.tsx                # Interactive demo
└── App.tsx                      # Router + wallet adapter setup
```

## Testing

```bash
# Unit tests (165 tests, no network, ~600ms)
npm test

# Integration tests (19 tests, hits Solana devnet, ~5s)
# Requires .env with DEVNET_PRIVATE_KEY and DEVNET_PUBLIC_KEY
npm run test:integration
```

Unit tests cover all five SDK modules (skill scanner, prompt firewall, policy engine, intent queue, orchestrator). Integration tests verify transaction decoding, simulation, policy enforcement, mutation detection, and signing round-trips against a real devnet RPC node.

## Tech Stack

- **React 18** + TypeScript + Vite
- **Solana Web3.js** + Wallet Adapter (Phantom, Devnet)
- **Tailwind CSS** + shadcn/ui (Radix)
- **Framer Motion** for animations

## Security Review

All 16 findings from the initial security audit have been resolved. See [SECURITY-REVIEW.md](./SECURITY-REVIEW.md) for the full checklist.

| Severity | Resolved |
|----------|----------|
| Critical | 4/4 |
| High | 5/5 |
| Medium | 5/5 |
| Low | 2/2 |

## License

MIT
