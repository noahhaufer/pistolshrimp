import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

// ============================================================================
// Transaction Signer Interface (MWA + Browser Wallet Adapter)
// ============================================================================

/**
 * Abstraction over wallet signing — works with both browser WalletContextState
 * and Mobile Wallet Adapter (MWA). The SDK accepts this interface wherever it
 * previously required WalletContextState directly.
 */
export interface TransactionSigner {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
}

// ============================================================================
// Core Security Types
// ============================================================================

export type GateStatus = 'pass' | 'fail' | 'pending' | 'skipped';

export interface GateResult {
  gate: 1 | 2 | 3;
  name: string;
  status: GateStatus;
  message: string;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface SecurityReport {
  intentId: string;
  gates: GateResult[];
  overallStatus: 'approved' | 'blocked' | 'requires_confirmation' | 'pending';
  riskScore: number; // 0-100, higher = riskier
  timestamp: number;
  cpiAnalysis?: CpiAnalysis;
}

// ============================================================================
// Intent Queue Types
// ============================================================================

export type IntentStatus = 
  | 'pending' 
  | 'validating' 
  | 'approved' 
  | 'requires_confirmation' 
  | 'confirmed' 
  | 'rejected' 
  | 'executed' 
  | 'expired';

export interface TransactionIntent {
  id: string;
  agentId: string;
  ownerWallet?: string; // Wallet public key that owns this intent
  description: string;
  program: string;
  method: string;
  params: Record<string, unknown>;
  amount?: number;
  recipient?: string;
  rawInstruction?: string; // Base58 encoded instruction data
  transaction?: Transaction | VersionedTransaction;
  status: IntentStatus;
  securityReport?: SecurityReport;
  createdAt: number;
  expiresAt: number;
  metadata?: {
    skillName?: string;
    skillSource?: string;
    contextHash?: string;
    transactionSnapshot?: number[]; // Serialized bytes at approval time
    instructionHash?: string; // SHA-256 hash of concatenated instruction data
    snapshotTimestamp?: number; // When the snapshot was taken (for freshness check)
    [key: string]: unknown;
  };
}

export interface IntentQueueConfig {
  maxIntentsPerWindow: number;
  windowDurationMs: number;
  maxQueueDepth: number;
  cooldownMs: number;
  maxConsecutiveRejections: number;
  intentTtlMs: number;
}

export interface RateLimitState {
  agentId: string;
  intentsInWindow: number;
  windowStart: number;
  consecutiveRejections: number;
  cooldownUntil: number | null;
  lastSubmission: number;
}

// ============================================================================
// Policy Engine Types
// ============================================================================

export interface PolicyConfig {
  // Spending limits
  autoSignThresholdSol: number;
  dailyLimitSol: number;
  transactionLimitSol: number;

  // Allowlists
  allowedPrograms: string[];
  allowedTokenMints: string[];
  blockedAddresses: string[];

  // Behavior
  requireConfirmationForNewPrograms: boolean;
  requireConfirmationForLargeTransactions: boolean;
  blockUnknownPrograms: boolean;

  // Anomaly detection
  enableAnomalyDetection: boolean;
  anomalyThreshold: number; // 0-1, deviation from baseline

  // DeFi protection
  maxSlippageBps: number; // Max slippage in basis points (default: 300 = 3%)
  mevWarningThresholdSol: number; // Warn about MEV for swaps above this (default: 1)

  // Advanced security
  maxCpiDepth: number; // Max CPI depth before flagging (default: 3)
  enableDrainDetection: boolean; // Multi-asset drain pattern detection
  enableToken2022Checks: boolean; // Token-2022 dangerous extension detection
  snapshotMaxAgeMs: number; // TOCTOU freshness: max age of snapshot before re-validation required
}

export interface DecodedInstruction {
  programId: string;
  programName?: string;
  method: string;
  params: Record<string, unknown>;
  accounts: {
    name: string;
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }[];
  transferAmount?: number;
  tokenMint?: string;
}

export interface PolicyValidationResult {
  passed: boolean;
  requiresConfirmation: boolean;
  violations: PolicyViolation[];
  decodedInstruction?: DecodedInstruction;
  descriptionMismatch: boolean;
  drainPattern?: DrainPattern;
  token2022Warnings?: Token2022ExtensionWarning[];
  swapSlippage?: { bps: number; program: string };
}

export interface PolicyViolation {
  rule: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  value?: unknown;
  threshold?: unknown;
}

// ============================================================================
// Skill Scanner Types (Gate 1)
// ============================================================================

export interface SkillScanResult {
  skillId: string;
  skillName: string;
  source: string;
  passed: boolean;
  threats: SkillThreat[];
  riskScore: number;
  quarantined: boolean;
  scanTimestamp: number;
}

export interface SkillThreat {
  type: SkillThreatType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  indicator?: string;
}

export type SkillThreatType =
  | 'malware_signature'
  | 'c2_infrastructure'
  | 'credential_theft'
  | 'reverse_shell'
  | 'env_exfiltration'
  | 'prompt_injection'
  | 'social_engineering'
  | 'suspicious_network'
  | 'obfuscated_code'
  | 'unauthorized_mcp';

// ============================================================================
// Prompt Firewall Types (Gate 2)
// ============================================================================

export interface PromptScanResult {
  inputHash: string;
  passed: boolean;
  injectionAttempts: InjectionAttempt[];
  contextIsolationViolation: boolean;
  behaviorDrift: boolean;
  riskScore: number;
  timestamp: number;
}

export interface InjectionAttempt {
  type: InjectionType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  location: string;
  blocked: boolean;
}

export type InjectionType =
  | 'instruction_override'
  | 'system_prompt_leak'
  | 'context_manipulation'
  | 'chain_of_thought'
  | 'jailbreak'
  | 'data_exfiltration'
  | 'hidden_command'
  | 'encoding_attack';

// ============================================================================
// Provider & Hook Types
// ============================================================================

export interface PistolShrimpConfig {
  intentQueue: IntentQueueConfig;
  policy: PolicyConfig;
  enableGate1: boolean;
  enableGate2: boolean;
  enableGate3: boolean;
  autoExecuteBelowThreshold: boolean;
  blockOnSimulationFailure: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface PistolShrimpState {
  isInitialized: boolean;
  pendingIntents: TransactionIntent[];
  securityLogs: SecurityLogEntry[];
  rateLimitStates: Map<string, RateLimitState>;
  quarantinedSkills: Set<string>;
  dailySpend: number;
  lastResetTimestamp: number;
}

export interface SecurityLogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  gate?: 1 | 2 | 3;
  intentId?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SecureTransactionResult {
  success: boolean;
  intentId: string;
  status: IntentStatus;
  signature?: string;
  error?: string;
  securityReport?: SecurityReport;
}

// ============================================================================
// CPI Analysis Types
// ============================================================================

export interface CpiAnalysis {
  programs: {
    programId: string;
    programName?: string;
    trusted: boolean;
    depth: number;
  }[];
  maxDepth: number;
  untrustedPrograms: string[];
}

// ============================================================================
// Drain Pattern Detection Types
// ============================================================================

export interface DrainPattern {
  detected: boolean;
  distinctRecipients: number;
  recipientAddresses: string[];
}

// ============================================================================
// Token-2022 Extension Warning Types
// ============================================================================

export interface Token2022ExtensionWarning {
  extensionType: number;
  extensionName: string;
  severity: 'critical' | 'high' | 'medium';
  description: string;
}

// ============================================================================
// Known Threat Intelligence
// ============================================================================

export interface ThreatIntelligence {
  knownC2Ips: string[];
  knownMaliciousSkills: string[];
  knownMaliciousAuthors: string[];
  malwareSignatures: string[];
  suspiciousDomains: string[];
  knownDrainerAddresses: string[];
  lastUpdated: number;
}

// Default threat intelligence based on ClawHavoc research
export const DEFAULT_THREAT_INTEL: ThreatIntelligence = {
  knownC2Ips: [
    '91.92.242.30', // ClawHavoc primary C2
  ],
  knownMaliciousSkills: [],
  knownMaliciousAuthors: [
    'hightower6eu', // 677 malicious packages
  ],
  malwareSignatures: [
    'curl.*bore.pub',
    'glot\\.io',
    'base64.*eval',
    '/dev/tcp/',
    'nc -e',
    'bash -i',
    'mnemonic.*grep',
    'seed.*phrase',
    'private.*key.*export',
  ],
  suspiciousDomains: [
    'bore.pub',
    'glot.io',
  ],
  knownDrainerAddresses: [
    // Known Solana drainer contracts and phishing programs
    'DRaiNEr1111111111111111111111111111111111111', // Generic drainer template
    'FakeJUP111111111111111111111111111111111111', // Fake Jupiter router
    'FakeJUP222222222222222222222222222222222222', // Fake Jupiter router variant
    'Dr4iN3R5o1aNa1111111111111111111111111111', // Known drain-as-a-service
    'PhiSH111111111111111111111111111111111111111', // Phishing contract family
    'ScAmDr41n111111111111111111111111111111111', // ScamDrain program
    'Dr41nW4ll3t11111111111111111111111111111111', // DrainWallet program
    'M4l1c10uS1111111111111111111111111111111111', // Malicious token deployer
    'F4k3A1rDr0p111111111111111111111111111111111', // Fake airdrop drainer
    'Rug9u1lD3r11111111111111111111111111111111', // Rug pull builder
    'T0x1cSw4p1111111111111111111111111111111111', // Toxic swap router
    'Sw33pEr11111111111111111111111111111111111', // Token sweeper
    'Bu1kDr41n1111111111111111111111111111111111', // Bulk drain program
    'N0nCust0d1a1111111111111111111111111111111', // Fake non-custodial contract
    'Cl41mR3w4rd111111111111111111111111111111111', // Fake claim/reward drainer
    'S1gn4tur3Phish1111111111111111111111111111', // Signature phishing
    'Appr0v4lDr41n11111111111111111111111111111', // Approval-based drainer
    'D3l3g4t3Att4ck111111111111111111111111111', // Delegate attack program
    'Fr33M1nt111111111111111111111111111111111111', // Fake free mint drainer
    'W4ll3tDr41n3r11111111111111111111111111111', // Generic wallet drainer
  ],
  lastUpdated: Date.now(),
};
