import { IntentQueueConfig, PistolShrimpConfig, PolicyConfig } from './types';

export const DEFAULT_INTENT_QUEUE_CONFIG: IntentQueueConfig = {
  maxIntentsPerWindow: 20,
  windowDurationMs: 5 * 60 * 1000, // 5 minutes
  maxQueueDepth: 50,
  cooldownMs: 60 * 1000, // 1 minute base cooldown
  maxConsecutiveRejections: 3,
  intentTtlMs: 30 * 60 * 1000, // 30 minutes
};

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  // Spending limits
  autoSignThresholdSol: 0.1, // Auto-sign below 0.1 SOL
  dailyLimitSol: 10, // 10 SOL daily limit
  transactionLimitSol: 5, // 5 SOL per transaction max
  
  // Allowlists - Common Solana programs
  allowedPrograms: [
    '11111111111111111111111111111111', // System Program
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token Program
    'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
    'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL', // Associated Token
    'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter v6
    'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
    'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s', // Metaplex Token Metadata
  ],
  allowedTokenMints: [
    'So11111111111111111111111111111111111111112', // Wrapped SOL
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  ],
  blockedAddresses: [],
  
  // Behavior
  requireConfirmationForNewPrograms: true,
  requireConfirmationForLargeTransactions: true,
  blockUnknownPrograms: false,
  
  // Anomaly detection
  enableAnomalyDetection: true,
  anomalyThreshold: 0.7,
};

export const DEFAULT_PISTOL_SHRIMP_CONFIG: PistolShrimpConfig = {
  intentQueue: DEFAULT_INTENT_QUEUE_CONFIG,
  policy: DEFAULT_POLICY_CONFIG,
  enableGate1: true,
  enableGate2: true,
  enableGate3: true,
  autoExecuteBelowThreshold: true,
  logLevel: 'info',
};

export function createConfig(overrides?: Partial<PistolShrimpConfig>): PistolShrimpConfig {
  return {
    ...DEFAULT_PISTOL_SHRIMP_CONFIG,
    ...overrides,
    intentQueue: {
      ...DEFAULT_INTENT_QUEUE_CONFIG,
      ...overrides?.intentQueue,
    },
    policy: {
      ...DEFAULT_POLICY_CONFIG,
      ...overrides?.policy,
    },
  };
}
