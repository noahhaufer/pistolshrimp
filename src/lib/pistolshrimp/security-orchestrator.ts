import { Transaction, VersionedTransaction, Connection, PublicKey } from '@solana/web3.js';
import { WalletContextState } from '@solana/wallet-adapter-react';
import {
  PistolShrimpConfig,
  PistolShrimpState,
  TransactionIntent,
  SecurityReport,
  GateResult,
  SecureTransactionResult,
  SecurityLogEntry,
} from './types';
import { createConfig } from './config';
import { IntentQueue, getIntentQueue } from './intent-queue';
import { PolicyEngine, getPolicyEngine } from './policy-engine';
import { SkillScanner, getSkillScanner } from './skill-scanner';
import { PromptFirewall, getPromptFirewall } from './prompt-firewall';

// ============================================================================
// Security Orchestrator - Main Entry Point
// ============================================================================

export class SecurityOrchestrator {
  private config: PistolShrimpConfig;
  private intentQueue: IntentQueue;
  private policyEngine: PolicyEngine;
  private skillScanner: SkillScanner;
  private promptFirewall: PromptFirewall;
  private logs: SecurityLogEntry[] = [];
  private isInitialized: boolean = false;

  // Callbacks for external handling
  private onConfirmationRequired?: (intent: TransactionIntent) => Promise<boolean>;
  private onTransactionExecuted?: (intent: TransactionIntent, signature: string) => void;
  private onTransactionBlocked?: (intent: TransactionIntent, report: SecurityReport) => void;

  // Gate flags locked at construction time — cannot be changed at runtime
  private readonly gateFlags: { gate1: boolean; gate2: boolean; gate3: boolean; autoExecute: boolean };

  constructor(config?: Partial<PistolShrimpConfig>) {
    this.config = createConfig(config);
    this.gateFlags = Object.freeze({
      gate1: this.config.enableGate1,
      gate2: this.config.enableGate2,
      gate3: this.config.enableGate3,
      autoExecute: this.config.autoExecuteBelowThreshold,
    });
    this.intentQueue = getIntentQueue(this.config.intentQueue);
    this.policyEngine = getPolicyEngine(this.config.policy);
    this.skillScanner = getSkillScanner();
    this.promptFirewall = getPromptFirewall();
    this.isInitialized = true;
  }

  // ============================================================================
  // Main Transaction Flow
  // ============================================================================

  /**
   * Submit a transaction for secure processing
   * This is the main entry point for the "no keys above the line" pattern
   */
  async submitTransaction(
    agentId: string,
    description: string,
    transaction: Transaction | VersionedTransaction,
    options?: {
      program?: string;
      method?: string;
      params?: Record<string, unknown>;
      amount?: number;
      recipient?: string;
      skillName?: string;
      promptContext?: string;
      walletAddress?: string;
    }
  ): Promise<SecureTransactionResult> {
    this.log('info', `Transaction submitted by agent ${agentId}: ${description}`);

    // GATE 1: Skill Scanner (if skill context provided)
    if (this.gateFlags.gate1 && options?.skillName) {
      const skillContent = options.promptContext || description;
      const skillResult = this.skillScanner.scanSkill(
        options.skillName,
        options.skillName,
        agentId,
        skillContent,
        agentId
      );

      if (!skillResult.passed) {
        const report = this.createSecurityReport('gate1_blocked', [
          {
            gate: 1,
            name: 'Skill Scanner',
            status: 'fail',
            message: `Skill quarantined: ${skillResult.threats.length} threats detected (risk: ${skillResult.riskScore})`,
            details: { threats: skillResult.threats, riskScore: skillResult.riskScore },
            timestamp: Date.now(),
          },
        ]);

        return {
          success: false,
          intentId: 'blocked_gate1',
          status: 'rejected',
          error: 'Transaction blocked by skill scanner',
          securityReport: report,
        };
      }
    }

    // GATE 2: Prompt Firewall — scan both description and prompt context
    if (this.gateFlags.gate2) {
      // Always scan the description — it's shown in the confirmation UI and is an injection vector
      const descResult = this.promptFirewall.scanInput(
        description,
        agentId,
        undefined,
        { source: 'transaction_description' }
      );

      if (!descResult.passed) {
        const report = this.createSecurityReport('gate2_blocked', [
          {
            gate: 2,
            name: 'Prompt Firewall',
            status: 'fail',
            message: `Injection detected in transaction description: ${descResult.injectionAttempts.length} attempts`,
            details: { injections: descResult.injectionAttempts },
            timestamp: Date.now(),
          },
        ]);

        return {
          success: false,
          intentId: 'blocked_gate2',
          status: 'rejected',
          error: 'Transaction blocked by prompt firewall (description injection)',
          securityReport: report,
        };
      }

      // Also scan prompt context if provided
      if (options?.promptContext) {
        const promptResult = this.promptFirewall.scanInput(
          options.promptContext,
          agentId,
          undefined,
          { source: 'transaction_context' }
        );

        if (!promptResult.passed) {
          const report = this.createSecurityReport('gate2_blocked', [
            {
              gate: 2,
              name: 'Prompt Firewall',
              status: 'fail',
              message: `Prompt injection detected: ${promptResult.injectionAttempts.length} attempts`,
              details: { injections: promptResult.injectionAttempts },
              timestamp: Date.now(),
            },
          ]);

          return {
            success: false,
            intentId: 'blocked_gate2',
            status: 'rejected',
            error: 'Transaction blocked by prompt firewall',
            securityReport: report,
          };
        }
      }
    }

    // Determine program from transaction if not provided
    let program = options?.program || '';
    let method = options?.method || 'unknown';

    if (!program && transaction) {
      if (transaction instanceof Transaction && transaction.instructions.length > 0) {
        program = transaction.instructions[0].programId.toBase58();
      } else if (transaction instanceof VersionedTransaction) {
        const staticKeys = transaction.message.staticAccountKeys;
        const firstInstruction = transaction.message.compiledInstructions[0];
        if (firstInstruction) {
          program = staticKeys[firstInstruction.programIdIndex].toBase58();
        }
      }
    }

    // Snapshot transaction bytes at submission time to detect later mutation
    let transactionSnapshot: Uint8Array | undefined;
    if (transaction) {
      try {
        transactionSnapshot = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      } catch {
        // VersionedTransaction.serialize() doesn't take options
        transactionSnapshot = transaction.serialize();
      }
    }

    // Submit to intent queue
    const submitResult = this.intentQueue.submitIntent(
      agentId,
      description,
      program,
      method,
      options?.params || {},
      {
        amount: options?.amount,
        recipient: options?.recipient,
        transaction,
        walletAddress: options?.walletAddress,
        metadata: {
          skillName: options?.skillName,
          transactionSnapshot: transactionSnapshot ? Array.from(transactionSnapshot) : undefined,
        },
      }
    );

    if (!submitResult.success || !submitResult.intent) {
      return {
        success: false,
        intentId: 'rate_limited',
        status: 'rejected',
        error: submitResult.error || 'Failed to submit intent',
      };
    }

    const intent = submitResult.intent;

    // Set owner wallet for authorization checks
    if (options?.walletAddress) {
      intent.ownerWallet = options.walletAddress;
    }

    // Process the intent through remaining gates
    return this.processIntent(intent);
  }

  /**
   * Process an intent through Gate 3 (Policy Engine)
   */
  private async processIntent(intent: TransactionIntent): Promise<SecureTransactionResult> {
    this.intentQueue.updateIntentStatus(intent.id, 'validating');

    const gateResults: GateResult[] = [];

    // GATE 3: Policy Engine
    if (this.gateFlags.gate3) {
      const policyResult = this.policyEngine.validateIntent(intent);

      gateResults.push({
        gate: 3,
        name: 'Policy Engine',
        status: policyResult.passed ? (policyResult.requiresConfirmation ? 'pending' : 'pass') : 'fail',
        message: policyResult.passed
          ? policyResult.requiresConfirmation
            ? 'Requires human confirmation'
            : 'All policy checks passed'
          : `Policy violations: ${policyResult.violations.map(v => v.rule).join(', ')}`,
        details: {
          violations: policyResult.violations,
          decodedInstruction: policyResult.decodedInstruction,
          descriptionMismatch: policyResult.descriptionMismatch,
        },
        timestamp: Date.now(),
      });

      if (!policyResult.passed) {
        this.intentQueue.updateIntentStatus(intent.id, 'rejected');
        const report = this.createSecurityReport(intent.id, gateResults, 'blocked');
        intent.securityReport = report;

        this.onTransactionBlocked?.(intent, report);

        return {
          success: false,
          intentId: intent.id,
          status: 'rejected',
          error: `Policy violation: ${policyResult.violations[0]?.message}`,
          securityReport: report,
        };
      }

      // Requires human confirmation
      if (policyResult.requiresConfirmation) {
        this.intentQueue.updateIntentStatus(intent.id, 'requires_confirmation');
        const report = this.createSecurityReport(intent.id, gateResults, 'requires_confirmation');
        intent.securityReport = report;

        return {
          success: true,
          intentId: intent.id,
          status: 'requires_confirmation',
          securityReport: report,
        };
      }
    }

    // Auto-sign if configured and below threshold
    if (this.gateFlags.autoExecute) {
      this.intentQueue.updateIntentStatus(intent.id, 'approved');
      const report = this.createSecurityReport(intent.id, gateResults, 'approved');
      intent.securityReport = report;

      return {
        success: true,
        intentId: intent.id,
        status: 'approved',
        securityReport: report,
      };
    }

    // Default to requiring confirmation
    this.intentQueue.updateIntentStatus(intent.id, 'requires_confirmation');
    const report = this.createSecurityReport(intent.id, gateResults, 'requires_confirmation');
    intent.securityReport = report;

    return {
      success: true,
      intentId: intent.id,
      status: 'requires_confirmation',
      securityReport: report,
    };
  }

  /**
   * Execute an approved/confirmed transaction
   */
  async executeTransaction(
    intentId: string,
    wallet: WalletContextState,
    connection: Connection
  ): Promise<SecureTransactionResult> {
    const intent = this.intentQueue.getIntent(intentId);

    if (!intent) {
      return {
        success: false,
        intentId,
        status: 'rejected',
        error: 'Intent not found',
      };
    }

    if (intent.status !== 'approved' && intent.status !== 'confirmed') {
      return {
        success: false,
        intentId,
        status: intent.status,
        error: `Intent status is ${intent.status}, expected approved or confirmed`,
      };
    }

    // Ownership check: wallet executing must match the intent owner
    const executorWallet = wallet.publicKey?.toBase58();
    if (intent.ownerWallet && executorWallet && intent.ownerWallet !== executorWallet) {
      this.log('error', `Unauthorized execution attempt for ${intentId}: wallet ${executorWallet} != owner ${intent.ownerWallet}`);
      return {
        success: false,
        intentId,
        status: 'rejected',
        error: 'Wallet does not own this intent',
      };
    }

    if (!intent.transaction) {
      return {
        success: false,
        intentId,
        status: 'rejected',
        error: 'No transaction attached to intent',
      };
    }

    if (!wallet.signTransaction) {
      return {
        success: false,
        intentId,
        status: 'rejected',
        error: 'Wallet does not support signing',
      };
    }

    // Re-validate: compare current transaction bytes against snapshot taken at approval time
    const snapshot = intent.metadata?.transactionSnapshot as number[] | undefined;
    if (snapshot) {
      let currentBytes: Uint8Array;
      try {
        currentBytes = intent.transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
      } catch {
        currentBytes = intent.transaction.serialize();
      }

      const snapshotBytes = new Uint8Array(snapshot);
      if (currentBytes.length !== snapshotBytes.length ||
          !currentBytes.every((byte, i) => byte === snapshotBytes[i])) {
        this.log('error', `Transaction mutation detected for intent ${intentId}! Blocking execution.`);
        this.intentQueue.updateIntentStatus(intentId, 'rejected');
        return {
          success: false,
          intentId,
          status: 'rejected',
          error: 'Transaction was mutated after approval — execution blocked',
          securityReport: intent.securityReport,
        };
      }
    }

    try {
      // Simulate transaction before signing to catch CPI attacks and unexpected failures
      try {
        const simResult = intent.transaction instanceof Transaction
          ? await connection.simulateTransaction(intent.transaction)
          : await connection.simulateTransaction(intent.transaction);

        if (simResult.value.err) {
          this.log('error', `Transaction simulation failed for ${intentId}`, { error: simResult.value.err });
          this.intentQueue.updateIntentStatus(intentId, 'rejected');
          return {
            success: false,
            intentId,
            status: 'rejected',
            error: `Transaction simulation failed: ${JSON.stringify(simResult.value.err)}`,
            securityReport: intent.securityReport,
          };
        }
        this.log('info', `Transaction simulation passed for ${intentId}`);
      } catch (simError) {
        const simMsg = simError instanceof Error ? simError.message : 'unknown';
        if (this.config.blockOnSimulationFailure) {
          this.log('error', `Transaction simulation failed for ${intentId}, blocking: ${simMsg}`);
          this.intentQueue.updateIntentStatus(intentId, 'rejected');
          return {
            success: false,
            intentId,
            status: 'rejected',
            error: `Transaction simulation unavailable — blocked for safety: ${simMsg}`,
            securityReport: intent.securityReport,
          };
        }
        this.log('warn', `Transaction simulation unavailable for ${intentId} (non-blocking): ${simMsg}`);
      }

      // Sign transaction (ephemeral signer pattern - single use)
      const signedTx = await wallet.signTransaction(intent.transaction);

      // Send transaction
      let signature: string;
      if (signedTx instanceof Transaction) {
        signature = await connection.sendRawTransaction(signedTx.serialize());
      } else {
        signature = await connection.sendRawTransaction(signedTx.serialize());
      }

      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');

      // Update state
      this.intentQueue.updateIntentStatus(intentId, 'executed');
      this.policyEngine.recordTransaction(intent.amount || 0, intent.program, intent.ownerWallet);

      this.log('info', `Transaction executed: ${signature}`, { intentId, signature });
      this.onTransactionExecuted?.(intent, signature);

      return {
        success: true,
        intentId,
        status: 'executed',
        signature,
        securityReport: intent.securityReport,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('error', `Transaction execution failed: ${errorMessage}`, { intentId });

      return {
        success: false,
        intentId,
        status: 'rejected',
        error: errorMessage,
        securityReport: intent.securityReport,
      };
    }
  }

  /**
   * Confirm a transaction that requires human approval
   * @param walletAddress - The wallet address of the confirming user (for ownership verification)
   */
  confirmTransaction(intentId: string, walletAddress?: string): boolean {
    const intent = this.intentQueue.getIntent(intentId);
    if (!intent || intent.status !== 'requires_confirmation') {
      return false;
    }

    // Ownership check: if intent has an owner, confirmer must match
    if (intent.ownerWallet && walletAddress && intent.ownerWallet !== walletAddress) {
      this.log('error', `Unauthorized confirmation attempt for ${intentId}: wallet ${walletAddress} != owner ${intent.ownerWallet}`);
      return false;
    }

    this.intentQueue.updateIntentStatus(intentId, 'confirmed');
    this.log('info', `Transaction confirmed by human: ${intentId}`);
    return true;
  }

  /**
   * Reject a transaction that requires human approval
   * @param walletAddress - The wallet address of the rejecting user (for ownership verification)
   */
  rejectTransaction(intentId: string, reason?: string, walletAddress?: string): boolean {
    const intent = this.intentQueue.getIntent(intentId);
    if (!intent) {
      return false;
    }

    // Ownership check: if intent has an owner, rejector must match
    if (intent.ownerWallet && walletAddress && intent.ownerWallet !== walletAddress) {
      this.log('error', `Unauthorized rejection attempt for ${intentId}: wallet ${walletAddress} != owner ${intent.ownerWallet}`);
      return false;
    }

    this.intentQueue.updateIntentStatus(intentId, 'rejected');
    this.log('info', `Transaction rejected by human: ${intentId}`, { reason });
    return true;
  }

  // ============================================================================
  // Skill Scanning (Gate 1)
  // ============================================================================

  /**
   * Scan a skill before allowing it to run
   */
  scanSkill(
    skillId: string,
    skillName: string,
    source: string,
    content: string,
    authorId?: string
  ) {
    if (!this.gateFlags.gate1) {
      return { passed: true, skipped: true };
    }

    return this.skillScanner.scanSkill(skillId, skillName, source, content, authorId);
  }

  /**
   * Check if a skill is quarantined
   */
  isSkillQuarantined(skillId: string): boolean {
    return this.skillScanner.isQuarantined(skillId);
  }

  // ============================================================================
  // State & Configuration
  // ============================================================================

  /**
   * Get current security state
   */
  getState(): PistolShrimpState {
    return {
      isInitialized: this.isInitialized,
      pendingIntents: this.intentQueue.getPendingIntents(),
      securityLogs: this.getLogs(),
      rateLimitStates: this.intentQueue.getRateLimitStates(),
      quarantinedSkills: new Set(this.skillScanner.getQuarantinedSkills()),
      dailySpend: this.policyEngine.getDailySpend(),
      lastResetTimestamp: Date.now(),
    };
  }

  /**
   * Get intent by ID
   */
  getIntent(intentId: string): TransactionIntent | undefined {
    return this.intentQueue.getIntent(intentId);
  }

  /**
   * Get pending intents
   */
  getPendingIntents(): TransactionIntent[] {
    return this.intentQueue.getPendingIntents();
  }

  /**
   * Get configuration
   */
  getConfig(): PistolShrimpConfig {
    return { ...this.config };
  }

  /**
   * Update policy configuration
   * Note: Gate enable/disable flags and autoExecuteBelowThreshold cannot be changed at runtime.
   */
  updatePolicyConfig(updates: Partial<PistolShrimpConfig['policy']>): void {
    this.policyEngine.updateConfig(updates);
    this.config.policy = { ...this.config.policy, ...updates };
  }

  /**
   * Gate flags are immutable after construction to prevent runtime bypass.
   * Returns current gate status for inspection only.
   */
  getGateStatus(): { gate1: boolean; gate2: boolean; gate3: boolean } {
    return {
      gate1: this.gateFlags.gate1,
      gate2: this.gateFlags.gate2,
      gate3: this.gateFlags.gate3,
    };
  }

  // ============================================================================
  // Callbacks
  // ============================================================================

  setOnConfirmationRequired(callback: (intent: TransactionIntent) => Promise<boolean>): void {
    this.onConfirmationRequired = callback;
  }

  setOnTransactionExecuted(callback: (intent: TransactionIntent, signature: string) => void): void {
    this.onTransactionExecuted = callback;
  }

  setOnTransactionBlocked(callback: (intent: TransactionIntent, report: SecurityReport) => void): void {
    this.onTransactionBlocked = callback;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private createSecurityReport(
    intentId: string,
    gates: GateResult[],
    status?: SecurityReport['overallStatus']
  ): SecurityReport {
    const hasFailure = gates.some(g => g.status === 'fail');
    const requiresConfirmation = gates.some(g => g.status === 'pending');

    const overallStatus = status ||
      (hasFailure ? 'blocked' : requiresConfirmation ? 'requires_confirmation' : 'approved');

    // Calculate risk score from gate results
    const riskScore = gates.reduce((score, gate) => {
      if (gate.status === 'fail') return score + 40;
      if (gate.status === 'pending') return score + 20;
      return score;
    }, 0);

    return {
      intentId,
      gates,
      overallStatus,
      riskScore: Math.min(100, riskScore),
      timestamp: Date.now(),
    };
  }

  private log(level: SecurityLogEntry['level'], message: string, details?: Record<string, unknown>) {
    const entry: SecurityLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      level,
      message,
      details,
    };

    this.logs.push(entry);
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }

    if (this.config.logLevel === 'debug' || 
        (this.config.logLevel === 'info' && level !== 'debug') ||
        (this.config.logLevel === 'warn' && (level === 'warn' || level === 'error')) ||
        (this.config.logLevel === 'error' && level === 'error')) {
      console.log(`[PistolShrimp] ${level.toUpperCase()}: ${message}`, details || '');
    }
  }

  getLogs(limit = 100): SecurityLogEntry[] {
    const allLogs = [
      ...this.logs,
      ...this.intentQueue.getLogs(limit),
      ...this.policyEngine.getLogs(limit),
      ...this.skillScanner.getLogs(limit),
      ...this.promptFirewall.getLogs(limit),
    ].sort((a, b) => b.timestamp - a.timestamp);

    return allLogs.slice(0, limit);
  }

  // Cleanup
  cleanup(): void {
    this.intentQueue.cleanupExpiredIntents();
    this.promptFirewall.cleanupSessions();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalOrchestrator: SecurityOrchestrator | null = null;

export function getSecurityOrchestrator(config?: Partial<PistolShrimpConfig>): SecurityOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new SecurityOrchestrator(config);
  }
  return globalOrchestrator;
}

export function resetSecurityOrchestrator(): void {
  globalOrchestrator = null;
}
