import { Transaction, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import {
  PolicyConfig,
  PolicyValidationResult,
  PolicyViolation,
  DecodedInstruction,
  TransactionIntent,
  SecurityLogEntry,
} from './types';
import { DEFAULT_POLICY_CONFIG } from './config';

// ============================================================================
// Known Program IDL Registry
// ============================================================================

interface ProgramInfo {
  name: string;
  category: 'system' | 'token' | 'defi' | 'nft' | 'other';
  trusted: boolean;
}

const KNOWN_PROGRAMS: Record<string, ProgramInfo> = {
  '11111111111111111111111111111111': {
    name: 'System Program',
    category: 'system',
    trusted: true,
  },
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA': {
    name: 'Token Program',
    category: 'token',
    trusted: true,
  },
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb': {
    name: 'Token-2022',
    category: 'token',
    trusted: true,
  },
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL': {
    name: 'Associated Token Account',
    category: 'token',
    trusted: true,
  },
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4': {
    name: 'Jupiter v6',
    category: 'defi',
    trusted: true,
  },
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc': {
    name: 'Orca Whirlpool',
    category: 'defi',
    trusted: true,
  },
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK': {
    name: 'Raydium CLMM',
    category: 'defi',
    trusted: true,
  },
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8': {
    name: 'Raydium AMM v4',
    category: 'defi',
    trusted: true,
  },
  'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s': {
    name: 'Metaplex Token Metadata',
    category: 'nft',
    trusted: true,
  },
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d': {
    name: 'Metaplex Core',
    category: 'nft',
    trusted: true,
  },
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P': {
    name: 'Pump.fun',
    category: 'defi',
    trusted: true,
  },
};

// ============================================================================
// Transaction Decoder
// ============================================================================

export function decodeTransaction(
  transaction: Transaction | VersionedTransaction
): DecodedInstruction[] {
  const instructions: DecodedInstruction[] = [];

  try {
    if (transaction instanceof Transaction) {
      for (const ix of transaction.instructions) {
        const programId = ix.programId.toBase58();
        const programInfo = KNOWN_PROGRAMS[programId];

        const decoded: DecodedInstruction = {
          programId,
          programName: programInfo?.name,
          method: decodeMethodFromInstruction(programId, ix.data),
          params: {},
          accounts: ix.keys.map((key, idx) => ({
            name: `account_${idx}`,
            pubkey: key.pubkey.toBase58(),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          })),
        };

        // Decode transfer amount for System Program
        if (programId === SystemProgram.programId.toBase58() && ix.data.length >= 12) {
          const instructionType = ix.data.readUInt32LE(0);
          if (instructionType === 2) { // Transfer
            const lamports = ix.data.readBigUInt64LE(4);
            decoded.transferAmount = Number(lamports) / 1e9; // Convert to SOL
            decoded.method = 'transfer';
          }
        }

        instructions.push(decoded);
      }
    } else {
      // VersionedTransaction handling
      const message = transaction.message;
      const staticKeys = message.staticAccountKeys;
      
      for (const ix of message.compiledInstructions) {
        const programId = staticKeys[ix.programIdIndex].toBase58();
        const programInfo = KNOWN_PROGRAMS[programId];

        instructions.push({
          programId,
          programName: programInfo?.name,
          method: decodeMethodFromInstruction(programId, Buffer.from(ix.data)),
          params: {},
          accounts: ix.accountKeyIndexes.map((keyIdx, idx) => ({
            name: `account_${idx}`,
            pubkey: staticKeys[keyIdx].toBase58(),
            isSigner: false, // Would need more context
            isWritable: false,
          })),
        });
      }
    }
  } catch (error) {
    console.error('Failed to decode transaction:', error);
  }

  return instructions;
}

function decodeMethodFromInstruction(programId: string, data: Buffer): string {
  // System Program
  if (programId === '11111111111111111111111111111111') {
    const type = data.readUInt32LE(0);
    switch (type) {
      case 0: return 'create_account';
      case 1: return 'assign';
      case 2: return 'transfer';
      case 3: return 'create_account_with_seed';
      case 4: return 'advance_nonce_account';
      case 5: return 'withdraw_nonce_account';
      case 6: return 'initialize_nonce_account';
      case 7: return 'authorize_nonce_account';
      case 8: return 'allocate';
      case 9: return 'allocate_with_seed';
      case 10: return 'assign_with_seed';
      case 11: return 'transfer_with_seed';
      default: return 'unknown';
    }
  }

  // Token Program discriminator (first byte)
  if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
    const type = data[0];
    switch (type) {
      case 0: return 'initialize_mint';
      case 1: return 'initialize_account';
      case 3: return 'transfer';
      case 4: return 'approve';
      case 5: return 'revoke';
      case 6: return 'set_authority';
      case 7: return 'mint_to';
      case 8: return 'burn';
      case 9: return 'close_account';
      default: return 'unknown_token_op';
    }
  }

  return 'unknown';
}

// ============================================================================
// Policy Engine
// ============================================================================

export class PolicyEngine {
  private config: PolicyConfig;
  private dailySpend: number = 0;
  private lastResetDate: string = new Date().toDateString();
  private logs: SecurityLogEntry[] = [];
  private transactionHistory: { timestamp: number; amount: number; program: string }[] = [];

  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
  }

  // Validate an intent against all policies
  validateIntent(intent: TransactionIntent): PolicyValidationResult {
    const violations: PolicyViolation[] = [];
    let requiresConfirmation = false;
    let decodedInstruction: DecodedInstruction | undefined;
    let descriptionMismatch = false;

    // Reset daily spend if new day
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = today;
    }

    // Decode transaction if available
    if (intent.transaction) {
      const decoded = decodeTransaction(intent.transaction);
      if (decoded.length > 0) {
        decodedInstruction = decoded[0]; // Primary instruction
        
        // Check for description mismatch
        descriptionMismatch = this.checkDescriptionMismatch(intent.description, decodedInstruction);
        if (descriptionMismatch) {
          violations.push({
            rule: 'description_mismatch',
            severity: 'critical',
            message: `Transaction description doesn't match decoded instruction: "${intent.description}" vs actual method "${decodedInstruction.method}"`,
            value: intent.description,
            threshold: decodedInstruction.method,
          });
        }
      }
    }

    // 1. Check if program is blocked
    if (this.config.blockedAddresses.includes(intent.program)) {
      violations.push({
        rule: 'blocked_program',
        severity: 'critical',
        message: `Program ${intent.program} is on blocklist`,
        value: intent.program,
      });
    }

    // 2. Check if program is allowed
    const isAllowedProgram = this.config.allowedPrograms.includes(intent.program);
    const programInfo = KNOWN_PROGRAMS[intent.program];

    if (!isAllowedProgram) {
      if (this.config.blockUnknownPrograms) {
        violations.push({
          rule: 'unknown_program',
          severity: 'high',
          message: `Program ${intent.program} is not on allowlist`,
          value: intent.program,
        });
      } else if (this.config.requireConfirmationForNewPrograms) {
        requiresConfirmation = true;
        this.log('info', `New program requires confirmation: ${intent.program}`);
      }
    }

    // 3. Check transaction amount limits
    const amount = intent.amount || decodedInstruction?.transferAmount || 0;
    
    if (amount > this.config.transactionLimitSol) {
      violations.push({
        rule: 'transaction_limit_exceeded',
        severity: 'high',
        message: `Transaction amount ${amount} SOL exceeds limit of ${this.config.transactionLimitSol} SOL`,
        value: amount,
        threshold: this.config.transactionLimitSol,
      });
    }

    if (this.dailySpend + amount > this.config.dailyLimitSol) {
      violations.push({
        rule: 'daily_limit_exceeded',
        severity: 'high',
        message: `Transaction would exceed daily limit. Current: ${this.dailySpend.toFixed(4)} SOL, Transaction: ${amount} SOL, Limit: ${this.config.dailyLimitSol} SOL`,
        value: this.dailySpend + amount,
        threshold: this.config.dailyLimitSol,
      });
    }

    // 4. Check if requires human confirmation due to amount
    if (amount > this.config.autoSignThresholdSol && this.config.requireConfirmationForLargeTransactions) {
      requiresConfirmation = true;
    }

    // 5. Check for unlimited approvals (common attack vector)
    if (decodedInstruction?.method === 'approve') {
      const approvalAmount = decodedInstruction.params.amount as number;
      if (approvalAmount === Number.MAX_SAFE_INTEGER || approvalAmount > 1e15) {
        violations.push({
          rule: 'unlimited_approval',
          severity: 'critical',
          message: 'Detected unlimited token approval - common attack vector',
          value: approvalAmount,
        });
      }
    }

    // 6. Anomaly detection
    if (this.config.enableAnomalyDetection) {
      const anomaly = this.detectAnomaly(intent, amount);
      if (anomaly.isAnomaly) {
        violations.push({
          rule: 'anomaly_detected',
          severity: 'medium',
          message: anomaly.reason,
          value: anomaly.score,
          threshold: this.config.anomalyThreshold,
        });
        requiresConfirmation = true;
      }
    }

    // Calculate result
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const passed = criticalViolations.length === 0;

    this.log(
      passed ? 'info' : 'warn',
      `Policy validation for ${intent.id}: ${passed ? 'PASSED' : 'FAILED'} (${violations.length} violations)`,
      { intentId: intent.id, violations: violations.length }
    );

    return {
      passed,
      requiresConfirmation: passed && requiresConfirmation,
      violations,
      decodedInstruction,
      descriptionMismatch,
    };
  }

  // Check if description matches decoded instruction
  private checkDescriptionMismatch(description: string, decoded: DecodedInstruction): boolean {
    const descLower = description.toLowerCase();
    const method = decoded.method.toLowerCase();

    // Common mismatches to detect
    const mismatchPatterns: [string[], string[]][] = [
      [['swap', 'exchange', 'trade'], ['approve', 'set_authority']],
      [['transfer', 'send'], ['approve', 'mint_to']],
      [['stake', 'deposit'], ['approve', 'close_account']],
    ];

    for (const [descPatterns, methodPatterns] of mismatchPatterns) {
      const descMatches = descPatterns.some(p => descLower.includes(p));
      const methodMatches = methodPatterns.some(p => method.includes(p));
      if (descMatches && methodMatches) {
        return true;
      }
    }

    return false;
  }

  // Simple anomaly detection based on transaction patterns
  private detectAnomaly(
    intent: TransactionIntent,
    amount: number
  ): { isAnomaly: boolean; score: number; reason: string } {
    // Calculate baseline from recent transactions
    const recentTx = this.transactionHistory.filter(
      t => Date.now() - t.timestamp < 24 * 60 * 60 * 1000 // Last 24 hours
    );

    if (recentTx.length < 3) {
      // Not enough history
      return { isAnomaly: false, score: 0, reason: '' };
    }

    const avgAmount = recentTx.reduce((sum, t) => sum + t.amount, 0) / recentTx.length;
    const stdDev = Math.sqrt(
      recentTx.reduce((sum, t) => sum + Math.pow(t.amount - avgAmount, 2), 0) / recentTx.length
    );

    // Check if amount is anomalous (>3 standard deviations)
    if (stdDev > 0 && Math.abs(amount - avgAmount) > 3 * stdDev) {
      return {
        isAnomaly: true,
        score: Math.abs(amount - avgAmount) / stdDev / 5, // Normalize to 0-1
        reason: `Unusual transaction amount: ${amount} SOL (avg: ${avgAmount.toFixed(4)}, stddev: ${stdDev.toFixed(4)})`,
      };
    }

    // Check if new program not seen before
    const seenPrograms = new Set(recentTx.map(t => t.program));
    if (!seenPrograms.has(intent.program) && !KNOWN_PROGRAMS[intent.program]?.trusted) {
      return {
        isAnomaly: true,
        score: 0.6,
        reason: `First time interacting with program: ${intent.program}`,
      };
    }

    return { isAnomaly: false, score: 0, reason: '' };
  }

  // Record a completed transaction
  recordTransaction(amount: number, program: string): void {
    this.dailySpend += amount;
    this.transactionHistory.push({
      timestamp: Date.now(),
      amount,
      program,
    });

    // Keep only last 100 transactions
    if (this.transactionHistory.length > 100) {
      this.transactionHistory = this.transactionHistory.slice(-100);
    }
  }

  // Get current daily spend
  getDailySpend(): number {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.dailySpend = 0;
      this.lastResetDate = today;
    }
    return this.dailySpend;
  }

  // Get remaining daily limit
  getRemainingLimit(): number {
    return Math.max(0, this.config.dailyLimitSol - this.getDailySpend());
  }

  // Update config
  updateConfig(updates: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  // Get current config
  getConfig(): PolicyConfig {
    return { ...this.config };
  }

  // Add program to allowlist
  addAllowedProgram(programId: string): void {
    if (!this.config.allowedPrograms.includes(programId)) {
      this.config.allowedPrograms.push(programId);
    }
  }

  // Remove program from allowlist
  removeAllowedProgram(programId: string): void {
    this.config.allowedPrograms = this.config.allowedPrograms.filter(p => p !== programId);
  }

  // Add address to blocklist
  blockAddress(address: string): void {
    if (!this.config.blockedAddresses.includes(address)) {
      this.config.blockedAddresses.push(address);
    }
  }

  // Logging helper
  private log(level: SecurityLogEntry['level'], message: string, details?: Record<string, unknown>) {
    this.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      level,
      gate: 3,
      message,
      details,
    });
  }

  // Get logs
  getLogs(limit = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }

  // Get program info
  getProgramInfo(programId: string): ProgramInfo | undefined {
    return KNOWN_PROGRAMS[programId];
  }
}

// Singleton instance
let globalPolicyEngine: PolicyEngine | null = null;

export function getPolicyEngine(config?: Partial<PolicyConfig>): PolicyEngine {
  if (!globalPolicyEngine) {
    globalPolicyEngine = new PolicyEngine(config);
  }
  return globalPolicyEngine;
}

export function resetPolicyEngine(): void {
  globalPolicyEngine = null;
}
