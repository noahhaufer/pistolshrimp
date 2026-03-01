import { Transaction, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import {
  PolicyConfig,
  PolicyValidationResult,
  PolicyViolation,
  DecodedInstruction,
  TransactionIntent,
  SecurityLogEntry,
  DrainPattern,
  Token2022ExtensionWarning,
  DEFAULT_THREAT_INTEL,
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
  'BPFLoaderUpgradeab1e11111111111111111111111': {
    name: 'BPF Upgradeable Loader',
    category: 'system',
    trusted: false, // Upgrade instructions are always flagged
  },
};

// Known swap program IDs
const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
const ORCA_WHIRLPOOL = 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc';
const BPF_LOADER_UPGRADEABLE = 'BPFLoaderUpgradeab1e11111111111111111111111';
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

// Token-2022 dangerous extension types
const TOKEN_2022_DANGEROUS_EXTENSIONS: Record<number, { name: string; severity: 'critical' | 'high'; description: string }> = {
  35: {
    name: 'PermanentDelegate',
    severity: 'critical',
    description: 'PermanentDelegate allows an authority to transfer/burn tokens from ANY holder without consent',
  },
  36: {
    name: 'TransferHook',
    severity: 'critical',
    description: 'TransferHook executes arbitrary code on every transfer — can be used for hidden drains',
  },
  37: {
    name: 'ConfidentialTransfer',
    severity: 'high',
    description: 'ConfidentialTransfer hides amounts, making it impossible to verify transaction values',
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

        // Decode Token Program / Token-2022 approve: extract raw amount bytes for u64::MAX detection
        const isTokenProgram = programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          || programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        if (isTokenProgram && ix.data[0] === 4 && ix.data.length >= 9) {
          const amountBytes = ix.data.slice(1, 9);
          decoded.params._rawAmountBytes = new Uint8Array(amountBytes);
          // Best-effort numeric decode (loses precision for u64::MAX)
          try {
            decoded.params.amount = Number(ix.data.readBigUInt64LE(1));
          } catch {
            decoded.params.amount = Infinity;
          }
        }

        // Store raw instruction data for Token-2022 extension and swap slippage checks
        if (programId === TOKEN_2022_PROGRAM || programId === JUPITER_V6 || programId === ORCA_WHIRLPOOL) {
          decoded.params._rawInstructionData = new Uint8Array(ix.data);
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
        const data = Buffer.from(ix.data);

        const decoded: DecodedInstruction = {
          programId,
          programName: programInfo?.name,
          method: decodeMethodFromInstruction(programId, data),
          params: {},
          accounts: ix.accountKeyIndexes.map((keyIdx, idx) => ({
            name: `account_${idx}`,
            pubkey: staticKeys[keyIdx].toBase58(),
            isSigner: typeof message.isAccountSigner === 'function' ? message.isAccountSigner(keyIdx) : false,
            isWritable: typeof message.isAccountWritable === 'function' ? message.isAccountWritable(keyIdx) : false,
          })),
        };

        // Decode transfer amount for System Program
        if (programId === SystemProgram.programId.toBase58() && data.length >= 12) {
          const instructionType = data.readUInt32LE(0);
          if (instructionType === 2) {
            const lamports = data.readBigUInt64LE(4);
            decoded.transferAmount = Number(lamports) / 1e9;
            decoded.method = 'transfer';
          }
        }

        // Decode Token Program / Token-2022 approve
        const isTokenProgram = programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
          || programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
        if (isTokenProgram && data[0] === 4 && data.length >= 9) {
          const amountBytes = data.slice(1, 9);
          decoded.params._rawAmountBytes = new Uint8Array(amountBytes);
          try {
            decoded.params.amount = Number(data.readBigUInt64LE(1));
          } catch {
            decoded.params.amount = Infinity;
          }
        }

        // Store raw instruction data for Token-2022 extension and swap slippage checks
        if (programId === TOKEN_2022_PROGRAM || programId === JUPITER_V6 || programId === ORCA_WHIRLPOOL) {
          decoded.params._rawInstructionData = new Uint8Array(data);
        }

        instructions.push(decoded);
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

  // Token Program / Token-2022 discriminator (first byte, same layout)
  if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
    || programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
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
  // Maximum bounds frozen at construction — updateConfig can never exceed these
  private readonly maxBounds: {
    dailyLimitSol: number;
    transactionLimitSol: number;
    autoSignThresholdSol: number;
  };
  // Per-wallet daily spend tracking (keyed by wallet address, '_global' as fallback)
  private walletDailySpend: Map<string, number> = new Map();
  private lastResetDate: string = new Date().toDateString();
  private logs: SecurityLogEntry[] = [];
  private transactionHistory: { timestamp: number; amount: number; program: string; wallet?: string }[] = [];

  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
    // Freeze the initial limits as hard ceilings — runtime updates cannot exceed them
    this.maxBounds = Object.freeze({
      dailyLimitSol: this.config.dailyLimitSol,
      transactionLimitSol: this.config.transactionLimitSol,
      autoSignThresholdSol: this.config.autoSignThresholdSol,
    });
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
    let drainPattern: DrainPattern | undefined;
    let token2022Warnings: Token2022ExtensionWarning[] | undefined;
    let swapSlippage: { bps: number; program: string } | undefined;

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

    // =====================================================================
    // NEW CHECK: BPF Upgrade Detection (P0 — Feature #4)
    // =====================================================================
    for (const decoded of allDecodedInstructions) {
      if (decoded.programId === BPF_LOADER_UPGRADEABLE) {
        violations.push({
          rule: 'bpf_upgrade_detected',
          severity: 'critical',
          message: `Transaction targets BPF Upgradeable Loader — program upgrade/authority change detected. This is extremely dangerous.`,
          value: decoded.method,
        });
      }
    }

    // 1. Check if ANY program in the transaction is blocked
    const allPrograms = allDecodedInstructions.length > 0
      ? allDecodedInstructions.map(ix => ix.programId)
      : [intent.program];

    // =====================================================================
    // NEW CHECK: Destination Address Reputation (P0 — Feature #3)
    // =====================================================================
    const drainerAddresses = DEFAULT_THREAT_INTEL.knownDrainerAddresses;
    for (const decoded of allDecodedInstructions) {
      for (const account of decoded.accounts) {
        if (account.isWritable && !account.isSigner && drainerAddresses.includes(account.pubkey)) {
          violations.push({
            rule: 'known_drainer_address',
            severity: 'critical',
            message: `Recipient ${account.pubkey} is a known drainer/scam address`,
            value: account.pubkey,
          });
        }
      }
    }

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

    // =====================================================================
    // NEW CHECK: Token-2022 Dangerous Extension Detection (P0 — Feature #2)
    // =====================================================================
    if (this.config.enableToken2022Checks) {
      const t2022Result = this.checkToken2022Extensions(allDecodedInstructions);
      if (t2022Result.length > 0) {
        token2022Warnings = t2022Result;
        for (const warning of t2022Result) {
          violations.push({
            rule: 'token2022_dangerous_extension',
            severity: warning.severity,
            message: `Token-2022 ${warning.extensionName}: ${warning.description}`,
            value: warning.extensionType,
          });
          if (warning.severity === 'critical') {
            requiresConfirmation = true;
          }
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
        severity: 'critical',
        message: `Transaction amount ${amount} SOL exceeds limit of ${this.config.transactionLimitSol} SOL`,
        value: amount,
        threshold: this.config.transactionLimitSol,
      });
    }

    if (dailySpend + amount > this.config.dailyLimitSol) {
      violations.push({
        rule: 'daily_limit_exceeded',
        severity: 'critical',
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
        // Flag unlimited or excessively large approvals
        // u64::MAX (18446744073709551615) loses precision as Number, so check multiple ways:
        // - Exceeds any reasonable approval amount (>1e12 tokens)
        // - Equals MAX_SAFE_INTEGER (common JS stand-in for unlimited)
        // - Raw amount param is undefined/NaN (failed decode = suspicious)
        const isUnlimited = approvalAmount === Number.MAX_SAFE_INTEGER
          || approvalAmount > 1e12
          || (approvalAmount !== undefined && !Number.isFinite(approvalAmount));

        // Also check raw instruction data for u64::MAX bytes (ff ff ff ff ff ff ff ff)
        const rawApprovalMax = decoded.params._rawAmountBytes as Uint8Array | undefined;
        const isRawMax = rawApprovalMax && rawApprovalMax.length === 8
          && rawApprovalMax.every(b => b === 0xff);

        if (isUnlimited || isRawMax) {
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

    // =====================================================================
    // NEW CHECK: Multi-Asset Drain Pattern Detection (P0 — Feature #1)
    // =====================================================================
    if (this.config.enableDrainDetection) {
      drainPattern = this.checkDrainPattern(allDecodedInstructions);
      if (drainPattern.detected) {
        violations.push({
          rule: 'drain_pattern_detected',
          severity: 'critical',
          message: `Drain pattern: ${drainPattern.distinctRecipients} distinct recipients detected in single transaction (${drainPattern.recipientAddresses.join(', ')})`,
          value: drainPattern.distinctRecipients,
          threshold: 3,
        });
      }
    }

    // =====================================================================
    // NEW CHECK: Jupiter/Orca Swap Slippage Validation (P2 — Feature #7)
    // =====================================================================
    const slippageResult = this.checkSwapSlippage(allDecodedInstructions);
    if (slippageResult) {
      swapSlippage = slippageResult;
      if (slippageResult.bps > 1000) {
        violations.push({
          rule: 'excessive_slippage',
          severity: 'critical',
          message: `Swap slippage ${slippageResult.bps} bps (${(slippageResult.bps / 100).toFixed(1)}%) on ${slippageResult.program} exceeds maximum of 10%. Transaction blocked.`,
          value: slippageResult.bps,
          threshold: 1000,
        });
      } else if (slippageResult.bps > this.config.maxSlippageBps) {
        violations.push({
          rule: 'high_slippage',
          severity: 'high',
          message: `Swap slippage ${slippageResult.bps} bps (${(slippageResult.bps / 100).toFixed(1)}%) on ${slippageResult.program} exceeds recommended maximum of ${this.config.maxSlippageBps} bps (${(this.config.maxSlippageBps / 100).toFixed(1)}%)`,
          value: slippageResult.bps,
          threshold: this.config.maxSlippageBps,
        });
        requiresConfirmation = true;
      }
    }

    // =====================================================================
    // NEW CHECK: MEV/Sandwich Attack Awareness (P2 — Feature #8)
    // =====================================================================
    const isSwap = allDecodedInstructions.some(ix =>
      ix.programId === JUPITER_V6 || ix.programId === ORCA_WHIRLPOOL
    );
    if (isSwap && amount >= this.config.mevWarningThresholdSol) {
      violations.push({
        rule: 'mev_exposure_warning',
        severity: 'medium',
        message: `Swap of ${amount} SOL (≥${this.config.mevWarningThresholdSol} SOL) is exposed to MEV/sandwich attacks. Consider using Jupiter's MEV-protected RPC or reducing transaction size.`,
        value: amount,
        threshold: this.config.mevWarningThresholdSol,
      });
      requiresConfirmation = true;
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
      requiresConfirmation,
      violations,
      decodedInstruction,
      descriptionMismatch,
      drainPattern,
      token2022Warnings,
      swapSlippage,
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

  // Check Token-2022 instructions for dangerous extension types
  private checkToken2022Extensions(instructions: DecodedInstruction[]): Token2022ExtensionWarning[] {
    const warnings: Token2022ExtensionWarning[] = [];

    for (const ix of instructions) {
      if (ix.programId !== TOKEN_2022_PROGRAM) continue;

      // Token-2022 extension instructions use a 2-byte layout:
      // byte 0 = base instruction type, byte 1+ = extension data
      // Extension-related instructions often have instruction type bytes that
      // can contain extension type identifiers in their data payload.
      // We scan the full instruction data for extension type markers.
      const rawData = ix.params._rawInstructionData as Uint8Array | undefined;
      if (!rawData || rawData.length < 2) continue;

      for (const [extType, info] of Object.entries(TOKEN_2022_DANGEROUS_EXTENSIONS)) {
        const extByte = Number(extType);
        // Check if the extension type byte appears in the instruction data
        // Extension configuration instructions typically have the extension type
        // as a discriminator in their data
        if (rawData.includes(extByte)) {
          warnings.push({
            extensionType: extByte,
            extensionName: info.name,
            severity: info.severity,
            description: info.description,
          });
        }
      }
    }

    return warnings;
  }

  // Detect multi-asset drain patterns: 3+ distinct recipients in one tx
  private checkDrainPattern(instructions: DecodedInstruction[]): DrainPattern {
    const recipients = new Set<string>();

    for (const ix of instructions) {
      // For transfers, the recipient is typically the second account (index 1)
      if (ix.method === 'transfer' && ix.accounts.length >= 2) {
        const recipient = ix.accounts[1].pubkey;
        // Exclude the fee payer / signer (they're sending, not receiving)
        if (!ix.accounts[1].isSigner) {
          recipients.add(recipient);
        }
      }
    }

    const recipientAddresses = Array.from(recipients);
    return {
      detected: recipientAddresses.length >= 3,
      distinctRecipients: recipientAddresses.length,
      recipientAddresses,
    };
  }

  // Check swap slippage on Jupiter v6 and Orca Whirlpool instructions
  private checkSwapSlippage(instructions: DecodedInstruction[]): { bps: number; program: string } | null {
    for (const ix of instructions) {
      if (ix.programId === JUPITER_V6) {
        // Jupiter v6 route instruction layout:
        // bytes 0-7: Anchor discriminator (8 bytes)
        // bytes 8-9: slippage bps (u16 LE)
        const rawData = ix.params._rawInstructionData as Uint8Array | undefined;
        if (rawData && rawData.length >= 10) {
          const slippageBps = rawData[8] | (rawData[9] << 8);
          if (slippageBps > 0) {
            return { bps: slippageBps, program: 'Jupiter v6' };
          }
        }
      }

      if (ix.programId === ORCA_WHIRLPOOL) {
        // Orca Whirlpool swap instruction:
        // bytes 0-7: Anchor discriminator (8 bytes)
        // bytes 8-15: amount (u64 LE)
        // bytes 16-23: other_amount_threshold (u64 LE)
        // bytes 24-25: sqrt_price_limit or similar — slippage encoded differently
        // For Orca, we check if the instruction has a slippage field
        const rawData = ix.params._rawInstructionData as Uint8Array | undefined;
        if (rawData && rawData.length >= 10) {
          const slippageBps = rawData[8] | (rawData[9] << 8);
          if (slippageBps > 0 && slippageBps <= 10000) {
            return { bps: slippageBps, program: 'Orca Whirlpool' };
          }
        }
      }
    }

    return null;
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

    // Check if amount is anomalous (>3 standard deviations, or large deviation when all history is identical)
    if (stdDev === 0 && amount !== avgAmount && Math.abs(amount - avgAmount) > avgAmount * 10) {
      return {
        isAnomaly: true,
        score: Math.min(1, Math.abs(amount - avgAmount) / (avgAmount || 1) / 100),
        reason: `Unusual transaction amount: ${amount} SOL (all recent tx were ${avgAmount.toFixed(4)} SOL)`,
      };
    }
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

  // Update config — spending limits are clamped to construction-time maximums
  updateConfig(updates: Partial<PolicyConfig>): void {
    this.config = { ...this.config, ...updates };
    // Clamp spending limits to frozen maximums so runtime updates can never exceed initial bounds
    this.config.dailyLimitSol = Math.min(this.config.dailyLimitSol, this.maxBounds.dailyLimitSol);
    this.config.transactionLimitSol = Math.min(this.config.transactionLimitSol, this.maxBounds.transactionLimitSol);
    this.config.autoSignThresholdSol = Math.min(this.config.autoSignThresholdSol, this.maxBounds.autoSignThresholdSol);
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
