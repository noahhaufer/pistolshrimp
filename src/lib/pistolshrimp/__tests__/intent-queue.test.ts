import { describe, it, expect, beforeEach } from 'vitest';
import { IntentQueue } from '../intent-queue';

describe('IntentQueue', () => {
  let queue: IntentQueue;

  beforeEach(() => {
    queue = new IntentQueue();
  });

  // =========================================================================
  // Basic submission
  // =========================================================================

  describe('intent submission', () => {
    it('submits and returns an intent', () => {
      const result = queue.submitIntent('agent-1', 'Transfer 1 SOL', 'system', 'transfer', {});
      expect(result.success).toBe(true);
      expect(result.intent).toBeDefined();
      expect(result.intent!.status).toBe('pending');
      expect(result.intent!.agentId).toBe('agent-1');
    });

    it('generates cryptographic intent IDs', () => {
      const r1 = queue.submitIntent('agent-1', 'Test 1', 'system', 'transfer', {});
      const r2 = queue.submitIntent('agent-1', 'Test 2', 'system', 'transfer', {});
      expect(r1.intent!.id).not.toBe(r2.intent!.id);
      // Should contain hex from crypto.getRandomValues
      expect(r1.intent!.id).toMatch(/^intent_\d+_[0-9a-f]{32}$/);
    });

    it('sets intent expiry based on TTL', () => {
      const result = queue.submitIntent('agent-1', 'Test', 'system', 'transfer', {});
      const intent = result.intent!;
      // Default TTL is 30 minutes
      expect(intent.expiresAt - intent.createdAt).toBe(30 * 60 * 1000);
    });

    it('stores wallet address on intent', () => {
      const result = queue.submitIntent('agent-1', 'Test', 'system', 'transfer', {}, {
        walletAddress: 'wallet123',
      });
      expect(result.intent!.ownerWallet).toBe('wallet123');
    });
  });

  // =========================================================================
  // Rate limiting — per agent
  // =========================================================================

  describe('rate limiting — per agent', () => {
    it('allows intents within window limit', () => {
      for (let i = 0; i < 20; i++) {
        const result = queue.submitIntent('agent-1', `Intent ${i}`, 'system', 'transfer', {});
        expect(result.success).toBe(true);
      }
    });

    it('blocks after exceeding window limit', () => {
      for (let i = 0; i < 20; i++) {
        queue.submitIntent('agent-1', `Intent ${i}`, 'system', 'transfer', {});
      }
      const result = queue.submitIntent('agent-1', 'One too many', 'system', 'transfer', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('allows different agents independently', () => {
      for (let i = 0; i < 20; i++) {
        queue.submitIntent('agent-1', `Intent ${i}`, 'system', 'transfer', {});
      }
      // agent-2 should still have its own quota
      const result = queue.submitIntent('agent-2', 'Agent 2 intent', 'system', 'transfer', {});
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // Rate limiting — per wallet (catches multi-agent abuse)
  // =========================================================================

  describe('rate limiting — per wallet', () => {
    it('blocks when same wallet exceeds limit across multiple agents', () => {
      // Fill up the per-wallet limit across two agents
      for (let i = 0; i < 10; i++) {
        queue.submitIntent('agent-1', `Intent ${i}`, 'system', 'transfer', {}, { walletAddress: 'walletX' });
      }
      for (let i = 0; i < 10; i++) {
        queue.submitIntent('agent-2', `Intent ${i}`, 'system', 'transfer', {}, { walletAddress: 'walletX' });
      }
      // Both agents maxed out the wallet-level limit
      const result = queue.submitIntent('agent-3', 'Another agent', 'system', 'transfer', {}, { walletAddress: 'walletX' });
      expect(result.success).toBe(false);
    });
  });

  // =========================================================================
  // Queue depth
  // =========================================================================

  describe('queue depth', () => {
    it('blocks when queue is full', () => {
      const q = new IntentQueue({ maxQueueDepth: 5 });
      for (let i = 0; i < 5; i++) {
        q.submitIntent(`agent-${i}`, `Intent ${i}`, 'system', 'transfer', {});
      }
      const result = q.submitIntent('agent-overflow', 'Overflow', 'system', 'transfer', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Queue depth');
    });
  });

  // =========================================================================
  // Cooldown on consecutive rejections
  // =========================================================================

  describe('cooldown', () => {
    it('enters cooldown after max consecutive rejections', () => {
      const q = new IntentQueue({ maxConsecutiveRejections: 2, cooldownMs: 60000 });

      // Submit 2 intents and reject them
      const r1 = q.submitIntent('agent-1', 'Intent 1', 'system', 'transfer', {});
      q.updateIntentStatus(r1.intent!.id, 'rejected');
      const r2 = q.submitIntent('agent-1', 'Intent 2', 'system', 'transfer', {});
      q.updateIntentStatus(r2.intent!.id, 'rejected');

      // Next submission should be blocked by cooldown
      const r3 = q.submitIntent('agent-1', 'Intent 3', 'system', 'transfer', {});
      expect(r3.success).toBe(false);
      expect(r3.error).toContain('cooldown');
    });

    it('resets cooldown on successful execution', () => {
      const q = new IntentQueue({ maxConsecutiveRejections: 2, cooldownMs: 1 });

      const r1 = q.submitIntent('agent-1', 'Intent 1', 'system', 'transfer', {});
      q.updateIntentStatus(r1.intent!.id, 'rejected');
      const r2 = q.submitIntent('agent-1', 'Intent 2', 'system', 'transfer', {});
      q.updateIntentStatus(r2.intent!.id, 'rejected');

      // Wait for 1ms cooldown to expire
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const r3 = q.submitIntent('agent-1', 'Intent 3', 'system', 'transfer', {});
          expect(r3.success).toBe(true);
          q.updateIntentStatus(r3.intent!.id, 'executed');

          // After successful execution, consecutiveRejections resets
          const state = q.getRateLimitStates();
          const agentState = Array.from(state.values()).find(s => s.agentId === 'agent-1');
          expect(agentState!.consecutiveRejections).toBe(0);
          expect(agentState!.cooldownUntil).toBe(null);
          resolve();
        }, 10);
      });
    });
  });

  // =========================================================================
  // Burst detection
  // =========================================================================

  describe('burst detection', () => {
    it('detects burst behavior', () => {
      // detectBurst calculates rate = intentsInWindow / (elapsed minutes).
      // When elapsed is 0, rate = 0 (guarded). We need a small delay for non-zero duration.
      return new Promise<void>(resolve => {
        // Submit 1 intent to initialize the window start
        queue.submitIntent('agent-1', 'Intent 0', 'system', 'transfer', {});
        setTimeout(() => {
          // Submit many more after a small delay so elapsed > 0
          for (let i = 1; i < 18; i++) {
            queue.submitIntent('agent-1', `Intent ${i}`, 'system', 'transfer', {});
          }
          const burst = queue.detectBurst('agent-1');
          expect(burst.rate).toBeGreaterThan(0);
          expect(burst.isBurst).toBe(true);
          resolve();
        }, 20); // 20ms gives measurable elapsed time
      });
    });
  });

  // =========================================================================
  // Intent lifecycle
  // =========================================================================

  describe('intent lifecycle', () => {
    it('transitions through statuses correctly', () => {
      const result = queue.submitIntent('agent-1', 'Test', 'system', 'transfer', {});
      const id = result.intent!.id;

      expect(queue.getIntent(id)!.status).toBe('pending');

      queue.updateIntentStatus(id, 'validating');
      expect(queue.getIntent(id)!.status).toBe('validating');

      queue.updateIntentStatus(id, 'requires_confirmation');
      expect(queue.getIntent(id)!.status).toBe('requires_confirmation');

      queue.updateIntentStatus(id, 'confirmed');
      expect(queue.getIntent(id)!.status).toBe('confirmed');

      queue.updateIntentStatus(id, 'executed');
      expect(queue.getIntent(id)!.status).toBe('executed');
    });

    it('retrieves intents by agent', () => {
      queue.submitIntent('agent-1', 'A1 Intent', 'system', 'transfer', {});
      queue.submitIntent('agent-2', 'A2 Intent', 'system', 'transfer', {});
      queue.submitIntent('agent-1', 'A1 Intent 2', 'system', 'transfer', {});

      const agentIntents = queue.getAgentIntents('agent-1');
      expect(agentIntents.length).toBe(2);
      expect(agentIntents.every(i => i.agentId === 'agent-1')).toBe(true);
    });
  });

  // =========================================================================
  // Expiry cleanup
  // =========================================================================

  describe('expiry', () => {
    it('filters expired intents from pending list', () => {
      const q = new IntentQueue({ intentTtlMs: 1 }); // 1ms TTL
      q.submitIntent('agent-1', 'Expiring', 'system', 'transfer', {});

      // Wait a tick for it to expire
      return new Promise<void>(resolve => {
        setTimeout(() => {
          const pending = q.getPendingIntents();
          expect(pending.length).toBe(0);
          resolve();
        }, 10);
      });
    });

    it('cleanupExpiredIntents removes old intents', () => {
      const q = new IntentQueue({ intentTtlMs: 1 });
      q.submitIntent('agent-1', 'Expiring', 'system', 'transfer', {});

      return new Promise<void>(resolve => {
        setTimeout(() => {
          const removed = q.cleanupExpiredIntents();
          expect(removed).toBe(1);
          resolve();
        }, 10);
      });
    });
  });

  // =========================================================================
  // Statistics
  // =========================================================================

  describe('statistics', () => {
    it('reports correct queue stats', () => {
      queue.submitIntent('agent-1', 'Intent 1', 'system', 'transfer', {});
      queue.submitIntent('agent-1', 'Intent 2', 'system', 'transfer', {});
      const r3 = queue.submitIntent('agent-1', 'Intent 3', 'system', 'transfer', {});
      queue.updateIntentStatus(r3.intent!.id, 'executed');

      const stats = queue.getStats();
      expect(stats.totalPending).toBe(2);
      expect(stats.totalProcessed).toBe(1);
      expect(stats.queueDepth).toBe(3);
    });
  });
});
