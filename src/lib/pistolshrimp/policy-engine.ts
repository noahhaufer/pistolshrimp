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

const STORAGE_KEY_DAILY_SPEND = 'pistolshrimp_daily_spend';
const STORAGE_KEY_SPEND_DATE = 'pistolshrimp_spend_date';
const STORAGE_KEY_TX_HISTORY = 'pistolshrimp_tx_history';

export class PolicyEngine {
  private config: PolicyConfig;
  // Per-wallet daily spend tracking (keyed by wallet address, '_global' as fallback)
  private walletDailySpend: Map<string, number> = new Map();
  private lastResetDate: string = new Date().toDateString();
  private logs: SecurityLogEntry[] = [];
  private transactionHistory: { timestamp: number; amount: number; program: string; wallet?: string }[] = [];

  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
    this.restorePersistedState();
  }

  // Get daily spend for a specific wallet
  private getWalletSpend(wallet?: string): number {
    return this.walletDailySpend.get(wallet || '_global') || 0;
  }

  // Set daily spend for a specific wallet
  private setWalletSpend(wallet: string | undefined, amount: number): void {
    this.walletDailySpend.set(wallet || '_global', amount);
  }

  // Restore spend tracking from localStorage
  private restorePersistedState(): void {
    try {
      const storedDate = localStorage.getItem(STORAGE_KEY_SPEND_DATE);
      const today = new Date().toDateString();

      if (storedDate === today) {
        const storedSpend = localStorage.getItem(STORAGE_KEY_DAILY_SPEND);
        if (storedSpend) {
          const parsed = JSON.parse(storedSpend);
          if (typeof parsed === 'object' && parsed !== null) {
            // New format: per-wallet map
            for (const [key, val] of Object.entries(parsed)) {
              this.walletDailySpend.set(key, val as number);
            }
          } else if (typeof parsed === 'number') {
            // Legacy format: single number → migrate to _global
            this.walletDailySpend.set('_global', parsed);
          }
        }
      } else {
        // New day — clear stored spend
        localStorage.removeItem(STORAGE_KEY_DAILY_SPEND);
        localStorage.setItem(STORAGE_KEY_SPEND_DATE, today);
      }

      const storedHistory = localStorage.getItem(STORAGE_KEY_TX_HISTORY);
      if (storedHistory) {
        this.transactionHistory = JSON.parse(storedHistory);
        const cutoff = Date.now() - 24 * 60 * 60 * 1000;
        this.transactionHistory = this.transactionHistory.filter(t => t.timestamp > cutoff);
      }
    } catch {
      // localStorage unavailable (SSR, private browsing) — fall back to in-memory
    }
  }

  // Persist spend state to localStorage
  private persistState(): void {
    try {
      const spendObj = Object.fromEntries(this.walletDailySpend);
      localStorage.setItem(STORAGE_KEY_DAILY_SPEND, JSON.stringify(spendObj));
      localStorage.setItem(STORAGE_KEY_SPEND_DATE, this.lastResetDate);
      localStorage.setItem(STORAGE_KEY_TX_HISTORY, JSON.stringify(this.transactionHistory.slice(-100)));
    } catch {
      // localStorage unavailable — silent fallback
    }
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
      this.walletDailySpend.clear();
      this.lastResetDate = today;
    }

    const walletKey = intent.ownerWallet;
    const dailySpend = this.getWalletSpend(walletKey);

    // Decode transaction if available — validate ALL instructions
    let allDecodedInstructions: DecodedInstruction[] = [];
    if (intent.transaction) {
      allDecodedInstructions = decodeTransaction(intent.transaction);
      if (allDecodedInstructions.length > 0) {
        decodedInstruction = allDecodedInstructions[0]; // Primary instruction for reporting

        // Check ALL instructions for description mismatch
        for (const decoded of allDecodedInstructions) {
          const mismatch = this.checkDescriptionMismatch(intent.description, decoded);
          if (mismatch) {
            descriptionMismatch = true;
            violations.push({
              rule: 'description_mismatch',
              severity: 'critical',
              message: `Transaction description doesn't match decoded instruction: "${intent.description}" vs actual method "${decoded.method}" (program: ${decoded.programName || decoded.programId})`,
              value: intent.description,
              threshold: decoded.method,
            });
          }
        }
      }
    }

    // 1. Check if ANY program in the transaction is blocked
    const allPrograms = allDecodedInstructions.length > 0
      ? allDecodedInstructions.map(ix => ix.programId)
      : [intent.program];

    for (const program of allPrograms) {
      if (this.config.blockedAddresses.includes(program)) {
        violations.push({
          rule: 'blocked_program',
          severity: 'critical',
          message: `Program ${program} is on blocklist`,
          value: program,
        });
      }
    }

    // 2. Check if ALL programs are allowed
    for (const program of allPrograms) {
      const isAllowedProgram = this.config.allowedPrograms.includes(program);
      const programInfo = KNOWN_PROGRAMS[program];

      if (!isAllowedProgram) {
        if (this.config.blockUnknownPrograms) {
          violations.push({
            rule: 'unknown_program',
            severity: 'high',
            message: `Program ${program} is not on allowlist`,
            value: program,
          });
        } else if (this.config.requireConfirmationForNewPrograms) {
          requiresConfirmation = true;
          this.log('info', `New program requires confirmation: ${program}`);
        }
      }
    }

    // 3. Check transaction amount limits (sum across ALL instructions)
    const totalAmount = allDecodedInstructions.reduce(
      (sum, ix) => sum + (ix.transferAmount || 0), 0
    ) || intent.amount || 0;
    const amount = totalAmount;

    if (amount > this.config.transactionLimitSol) {
      violations.push({
        rule: 'transaction_limit_exceeded',
        severity: 'high',
        message: `Transaction amount ${amount} SOL exceeds limit of ${this.config.transactionLimitSol} SOL`,
        value: amount,
        threshold: this.config.transactionLimitSol,
      });
    }

    if (dailySpend + amount > this.config.dailyLimitSol) {
      violations.push({
        rule: 'daily_limit_exceeded',
        severity: 'high',
        message: `Transaction would exceed daily limit. Current: ${dailySpend.toFixed(4)} SOL, Transaction: ${amount} SOL, Limit: ${this.config.dailyLimitSol} SOL`,
        value: dailySpend + amount,
        threshold: this.config.dailyLimitSol,
      });
    }

    // 4. Check if requires human confirmation due to amount
    if (amount > this.config.autoSignThresholdSol && this.config.requireConfirmationForLargeTransactions) {
      requiresConfirmation = true;
    }

    // 5. Check ALL instructions for unlimited approvals (common attack vector)
    for (const decoded of allDecodedInstructions) {
      if (decoded.method === 'approve') {
        const approvalAmount = decoded.params.amount as number;
        // Check for u64::MAX and other common unlimited values
        if (approvalAmount === Number.MAX_SAFE_INTEGER || approvalAmount > 1e15 || approvalAmount === 18446744073709551615) {
          violations.push({
            rule: 'unlimited_approval',
            severity: 'critical',
            message: `Detected unlimited token approval on program ${decoded.programName || decoded.programId} - common attack vector`,
            value: approvalAmount,
          });
        }
      }

      // Also flag dangerous methods hidden in multi-instruction transactions
      const dangerousMethods = ['set_authority', 'close_account', 'approve'];
      if (allDecodedInstructions.length > 1 && dangerousMethods.includes(decoded.method)) {
        requiresConfirmation = true;
        this.log('warn', `Dangerous method "${decoded.method}" found in multi-instruction transaction`);
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

    // 1. Explicit mismatch pairs: description claims X but method is Y
    const mismatchPatterns: [string[], string[]][] = [
      // Description says safe action → actual method is dangerous
      [['swap', 'exchange', 'trade'], ['approve', 'set_authority', 'close_account']],
      [['transfer', 'send'], ['approve', 'mint_to', 'set_authority']],
      [['stake', 'deposit', 'lock'], ['approve', 'close_account', 'set_authority', 'transfer']],
      [['mint', 'create', 'nft'], ['close_account', 'transfer', 'set_authority']],
      [['claim', 'reward', 'airdrop'], ['approve', 'set_authority', 'transfer']],
      [['view', 'check', 'read', 'balance'], ['transfer', 'approve', 'set_authority', 'close_account']],
      [['revoke', 'remove'], ['approve', 'mint_to']],
    ];

    for (const [descPatterns, methodPatterns] of mismatchPatterns) {
      const descMatches = descPatterns.some(p => descLower.includes(p));
      const methodMatches = methodPatterns.some(p => method.includes(p));
      if (descMatches && methodMatches) {
        return true;
      }
    }

    // 2. Generic check: description doesn't mention the actual dangerous method at all
    const dangerousMethods = ['approve', 'set_authority', 'close_account'];
    if (dangerousMethods.includes(method)) {
      // If the description doesn't contain any reference to what's actually happening, flag it
      const methodKeywords: Record<string, string[]> = {
        'approve': ['approve', 'approval', 'allowance', 'permission', 'authorize'],
        'set_authority': ['authority', 'owner', 'ownership', 'admin', 'set_authority'],
        'close_account': ['close', 'closing', 'delete', 'remove account'],
      };
      const keywords = methodKeywords[method] || [];
      const descMentionsMethod = keywords.some(k => descLower.includes(k));
      if (!descMentionsMethod) {
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

  // Record a completed transaction (wallet-scoped)
  recordTransaction(amount: number, program: string, walletAddress?: string): void {
    const current = this.getWalletSpend(walletAddress);
    this.setWalletSpend(walletAddress, current + amount);
    this.transactionHistory.push({
      timestamp: Date.now(),
      amount,
      program,
      wallet: walletAddress,
    });

    // Keep only last 100 transactions
    if (this.transactionHistory.length > 100) {
      this.transactionHistory = this.transactionHistory.slice(-100);
    }

    this.persistState();
  }

  // Get current daily spend (wallet-scoped)
  getDailySpend(walletAddress?: string): number {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.walletDailySpend.clear();
      this.lastResetDate = today;
      this.persistState();
    }
    return this.getWalletSpend(walletAddress);
  }

  // Get remaining daily limit (wallet-scoped)
  getRemainingLimit(walletAddress?: string): number {
    return Math.max(0, this.config.dailyLimitSol - this.getDailySpend(walletAddress));
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
