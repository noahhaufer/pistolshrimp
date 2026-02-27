import { Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  IntentQueueConfig,
  TransactionIntent,
  IntentStatus,
  RateLimitState,
  SecurityLogEntry,
} from './types';
import { DEFAULT_INTENT_QUEUE_CONFIG } from './config';

// ============================================================================
// Intent Queue Manager
// ============================================================================

export class IntentQueue {
  private intents: Map<string, TransactionIntent> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();
  private config: IntentQueueConfig;
  private logs: SecurityLogEntry[] = [];

  constructor(config: Partial<IntentQueueConfig> = {}) {
    this.config = { ...DEFAULT_INTENT_QUEUE_CONFIG, ...config };
  }

  // Generate unique intent ID
  private generateIntentId(): string {
    return `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Get or create rate limit state for an agent
  private getRateLimitState(agentId: string): RateLimitState {
    let state = this.rateLimits.get(agentId);
    if (!state) {
      state = {
        agentId,
        intentsInWindow: 0,
        windowStart: Date.now(),
        consecutiveRejections: 0,
        cooldownUntil: null,
        lastSubmission: 0,
      };
      this.rateLimits.set(agentId, state);
    }
    return state;
  }

  // Check if agent is within rate limits
  checkRateLimit(agentId: string): { allowed: boolean; reason?: string; waitMs?: number } {
    const state = this.getRateLimitState(agentId);
    const now = Date.now();

    // Check cooldown
    if (state.cooldownUntil && now < state.cooldownUntil) {
      const waitMs = state.cooldownUntil - now;
      return {
        allowed: false,
        reason: `Agent in cooldown after ${state.consecutiveRejections} consecutive rejections`,
        waitMs,
      };
    }

    // Reset window if expired
    if (now - state.windowStart > this.config.windowDurationMs) {
      state.windowStart = now;
      state.intentsInWindow = 0;
    }

    // Check window limit
    if (state.intentsInWindow >= this.config.maxIntentsPerWindow) {
      const waitMs = state.windowStart + this.config.windowDurationMs - now;
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${state.intentsInWindow}/${this.config.maxIntentsPerWindow} intents in window`,
        waitMs,
      };
    }

    // Check queue depth
    if (this.intents.size >= this.config.maxQueueDepth) {
      return {
        allowed: false,
        reason: `Queue depth exceeded: ${this.intents.size}/${this.config.maxQueueDepth} pending intents`,
      };
    }

    return { allowed: true };
  }

  // Detect burst behavior
  detectBurst(agentId: string): { isBurst: boolean; rate: number; baselineRate: number } {
    const state = this.getRateLimitState(agentId);
    const now = Date.now();
    const windowDuration = (now - state.windowStart) / 1000 / 60; // minutes
    const currentRate = windowDuration > 0 ? state.intentsInWindow / windowDuration : 0;
    
    // Simple baseline: average 2 intents per hour = 0.033 per minute
    const baselineRate = 0.5; // intents per minute
    const burstThreshold = 5; // 5x baseline triggers burst detection
    
    return {
      isBurst: currentRate > baselineRate * burstThreshold,
      rate: currentRate,
      baselineRate,
    };
  }

  // Submit a new intent to the queue
  submitIntent(
    agentId: string,
    description: string,
    program: string,
    method: string,
    params: Record<string, unknown>,
    options?: {
      amount?: number;
      recipient?: string;
      rawInstruction?: string;
      transaction?: Transaction | VersionedTransaction;
      metadata?: TransactionIntent['metadata'];
    }
  ): { success: boolean; intent?: TransactionIntent; error?: string } {
    // Check rate limit
    const rateLimitCheck = this.checkRateLimit(agentId);
    if (!rateLimitCheck.allowed) {
      this.log('warn', `Rate limit blocked intent from ${agentId}: ${rateLimitCheck.reason}`);
      return { success: false, error: rateLimitCheck.reason };
    }

    // Check for burst
    const burstCheck = this.detectBurst(agentId);
    if (burstCheck.isBurst) {
      this.log('warn', `Burst detected from ${agentId}: ${burstCheck.rate.toFixed(2)} intents/min vs baseline ${burstCheck.baselineRate}`);
      // Don't block, but flag for review
    }

    // Create intent
    const intent: TransactionIntent = {
      id: this.generateIntentId(),
      agentId,
      description,
      program,
      method,
      params,
      amount: options?.amount,
      recipient: options?.recipient,
      rawInstruction: options?.rawInstruction,
      transaction: options?.transaction,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.intentTtlMs,
      metadata: options?.metadata,
    };

    // Update rate limit state
    const state = this.getRateLimitState(agentId);
    state.intentsInWindow++;
    state.lastSubmission = Date.now();

    // Add to queue
    this.intents.set(intent.id, intent);
    this.log('info', `Intent ${intent.id} submitted by ${agentId}: ${description}`, { intentId: intent.id });

    return { success: true, intent };
  }

  // Update intent status
  updateIntentStatus(intentId: string, status: IntentStatus): boolean {
    const intent = this.intents.get(intentId);
    if (!intent) return false;

    const oldStatus = intent.status;
    intent.status = status;

    // Track rejections for cooldown
    if (status === 'rejected') {
      const state = this.getRateLimitState(intent.agentId);
      state.consecutiveRejections++;
      
      if (state.consecutiveRejections >= this.config.maxConsecutiveRejections) {
        // Apply exponential backoff cooldown
        const backoffMultiplier = Math.pow(2, state.consecutiveRejections - this.config.maxConsecutiveRejections);
        state.cooldownUntil = Date.now() + this.config.cooldownMs * backoffMultiplier;
        this.log('warn', `Agent ${intent.agentId} entered cooldown until ${new Date(state.cooldownUntil).toISOString()}`);
      }
    } else if (status === 'executed' || status === 'approved') {
      // Reset consecutive rejections on success
      const state = this.getRateLimitState(intent.agentId);
      state.consecutiveRejections = 0;
      state.cooldownUntil = null;
    }

    this.log('info', `Intent ${intentId} status: ${oldStatus} -> ${status}`, { intentId });
    return true;
  }

  // Get pending intents
  getPendingIntents(): TransactionIntent[] {
    const now = Date.now();
    return Array.from(this.intents.values())
      .filter(intent => {
        // Remove expired intents
        if (intent.expiresAt < now) {
          intent.status = 'expired';
          return false;
        }
        return intent.status === 'pending' || intent.status === 'requires_confirmation';
      })
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  // Get intent by ID
  getIntent(intentId: string): TransactionIntent | undefined {
    return this.intents.get(intentId);
  }

  // Get all intents for an agent
  getAgentIntents(agentId: string): TransactionIntent[] {
    return Array.from(this.intents.values())
      .filter(intent => intent.agentId === agentId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  // Remove intent from queue
  removeIntent(intentId: string): boolean {
    return this.intents.delete(intentId);
  }

  // Clear expired intents
  cleanupExpiredIntents(): number {
    const now = Date.now();
    let removed = 0;
    
    for (const [id, intent] of this.intents) {
      if (intent.expiresAt < now) {
        this.intents.delete(id);
        removed++;
      }
    }
    
    if (removed > 0) {
      this.log('info', `Cleaned up ${removed} expired intents`);
    }
    
    return removed;
  }

  // Get queue statistics
  getStats(): {
    totalPending: number;
    totalProcessed: number;
    queueDepth: number;
    oldestPendingAge: number | null;
  } {
    const pending = this.getPendingIntents();
    const processed = Array.from(this.intents.values()).filter(
      i => i.status === 'executed' || i.status === 'rejected'
    );
    
    return {
      totalPending: pending.length,
      totalProcessed: processed.length,
      queueDepth: this.intents.size,
      oldestPendingAge: pending.length > 0 ? Date.now() - pending[0].createdAt : null,
    };
  }

  // Logging helper
  private log(level: SecurityLogEntry['level'], message: string, details?: Record<string, unknown>) {
    this.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      level,
      message,
      details,
    });

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }
  }

  // Get logs
  getLogs(limit = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }

  // Get rate limit state
  getRateLimitStates(): Map<string, RateLimitState> {
    return new Map(this.rateLimits);
  }
}

// Singleton instance for global access
let globalQueue: IntentQueue | null = null;

export function getIntentQueue(config?: Partial<IntentQueueConfig>): IntentQueue {
  if (!globalQueue) {
    globalQueue = new IntentQueue(config);
  }
  return globalQueue;
}

export function resetIntentQueue(): void {
  globalQueue = null;
}
