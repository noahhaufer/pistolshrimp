import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

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
// Known Threat Intelligence
// ============================================================================

export interface ThreatIntelligence {
  knownC2Ips: string[];
  knownMaliciousSkills: string[];
  knownMaliciousAuthors: string[];
  malwareSignatures: string[];
  suspiciousDomains: string[];
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
  lastUpdated: Date.now(),
};
