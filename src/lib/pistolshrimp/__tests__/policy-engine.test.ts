import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Transaction,
  VersionedTransaction,
  VersionedMessage,
  MessageV0,
  SystemProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  Keypair,
} from '@solana/web3.js';
import { PolicyEngine, decodeTransaction } from '../policy-engine';
import { TransactionIntent, PolicyConfig } from '../types';
import { DEFAULT_POLICY_CONFIG } from '../config';

// ============================================================================
// Helpers
// ============================================================================

// Mock localStorage for node environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const UNKNOWN_PROGRAM = 'UnknownProgram1111111111111111111111111111';

function makePayer(): PublicKey {
  return Keypair.generate().publicKey;
}

function makeTransferTx(lamports: number): Transaction {
  const from = makePayer();
  const to = makePayer();
  const tx = new Transaction();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports,
    })
  );
  tx.feePayer = from;
  tx.recentBlockhash = PublicKey.default.toBase58();
  return tx;
}

function makeTokenApproveTx(programId: string, amount: bigint): Transaction {
  const data = Buffer.alloc(9);
  data[0] = 4; // approve discriminator
  data.writeBigUInt64LE(amount, 1);

  const tx = new Transaction();
  const owner = makePayer();
  tx.add(
    new TransactionInstruction({
      programId: new PublicKey(programId),
      keys: [
        { pubkey: makePayer(), isSigner: false, isWritable: true },
        { pubkey: makePayer(), isSigner: false, isWritable: false },
        { pubkey: owner, isSigner: true, isWritable: false },
      ],
      data,
    })
  );
  tx.feePayer = owner;
  tx.recentBlockhash = PublicKey.default.toBase58();
  return tx;
}

function makeIntent(overrides: Partial<TransactionIntent> = {}): TransactionIntent {
  return {
    id: 'intent_test_1',
    agentId: 'agent-1',
    description: 'Transfer 1 SOL',
    program: SYSTEM_PROGRAM,
    method: 'transfer',
    params: {},
    amount: 1,
    status: 'pending',
    createdAt: Date.now(),
    expiresAt: Date.now() + 1800000,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PolicyEngine (Gate 3)', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    localStorageMock.clear();
    engine = new PolicyEngine();
  });

  // =========================================================================
  // Transaction decoding — Legacy Transaction
  // =========================================================================

  describe('decodeTransaction — legacy', () => {
    it('decodes System Program transfer amount', () => {
      const tx = makeTransferTx(2_000_000_000); // 2 SOL
      const decoded = decodeTransaction(tx);
      expect(decoded.length).toBe(1);
      expect(decoded[0].method).toBe('transfer');
      expect(decoded[0].transferAmount).toBeCloseTo(2.0, 5);
      expect(decoded[0].programName).toBe('System Program');
    });

    it('decodes Token Program approve', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 1000000n);
      const decoded = decodeTransaction(tx);
      expect(decoded[0].method).toBe('approve');
      expect(decoded[0].params.amount).toBe(1000000);
      expect(decoded[0].params._rawAmountBytes).toBeDefined();
    });

    it('decodes Token-2022 approve', () => {
      const tx = makeTokenApproveTx(TOKEN_2022, 500000n);
      const decoded = decodeTransaction(tx);
      expect(decoded[0].method).toBe('approve');
      expect(decoded[0].params.amount).toBe(500000);
    });

    it('detects u64::MAX in raw approve bytes', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 0xFFFFFFFFFFFFFFFFn);
      const decoded = decodeTransaction(tx);
      const raw = decoded[0].params._rawAmountBytes as Uint8Array;
      expect(raw).toBeDefined();
      expect(raw.every(b => b === 0xff)).toBe(true);
    });

    it('decodes multi-instruction transactions', () => {
      const from = makePayer();
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 1e9 }),
        SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 2e9 }),
      );
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const decoded = decodeTransaction(tx);
      expect(decoded.length).toBe(2);
      expect(decoded[0].transferAmount).toBeCloseTo(1.0, 5);
      expect(decoded[1].transferAmount).toBeCloseTo(2.0, 5);
    });
  });

  // =========================================================================
  // Transaction decoding — VersionedTransaction
  // =========================================================================

  describe('decodeTransaction — versioned', () => {
    it('decodes System Program transfer from versioned tx', () => {
      const from = Keypair.generate();
      const to = makePayer();

      const msg = new TransactionMessage({
        payerKey: from.publicKey,
        recentBlockhash: PublicKey.default.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: from.publicKey,
            toPubkey: to,
            lamports: 3_000_000_000,
          }),
        ],
      }).compileToV0Message();

      const vtx = new VersionedTransaction(msg);
      const decoded = decodeTransaction(vtx);

      expect(decoded.length).toBe(1);
      expect(decoded[0].method).toBe('transfer');
      expect(decoded[0].transferAmount).toBeCloseTo(3.0, 5);
      expect(decoded[0].programName).toBe('System Program');
    });

    it('decodes Token-2022 approve from versioned tx', () => {
      const owner = Keypair.generate();
      const data = Buffer.alloc(9);
      data[0] = 4; // approve
      data.writeBigUInt64LE(0xFFFFFFFFFFFFFFFFn, 1);

      const msg = new TransactionMessage({
        payerKey: owner.publicKey,
        recentBlockhash: PublicKey.default.toBase58(),
        instructions: [
          new TransactionInstruction({
            programId: new PublicKey(TOKEN_2022),
            keys: [
              { pubkey: makePayer(), isSigner: false, isWritable: true },
              { pubkey: makePayer(), isSigner: false, isWritable: false },
              { pubkey: owner.publicKey, isSigner: true, isWritable: false },
            ],
            data,
          }),
        ],
      }).compileToV0Message();

      const vtx = new VersionedTransaction(msg);
      const decoded = decodeTransaction(vtx);

      expect(decoded[0].method).toBe('approve');
      const raw = decoded[0].params._rawAmountBytes as Uint8Array;
      expect(raw).toBeDefined();
      expect(raw.every(b => b === 0xff)).toBe(true);
    });
  });

  // =========================================================================
  // Policy validation — spending limits
  // =========================================================================

  describe('spending limits', () => {
    it('blocks transaction exceeding per-tx limit', () => {
      const tx = makeTransferTx(6_000_000_000); // 6 SOL > 5 SOL limit
      const intent = makeIntent({ amount: 6, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.rule === 'transaction_limit_exceeded')).toBe(true);
    });

    it('blocks transaction exceeding daily limit', () => {
      // Record 9 SOL of prior spend
      engine.recordTransaction(9, SYSTEM_PROGRAM, 'walletA');
      const tx = makeTransferTx(2_000_000_000); // 2 SOL, total would be 11 > 10
      const intent = makeIntent({ amount: 2, transaction: tx, ownerWallet: 'walletA' });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'daily_limit_exceeded')).toBe(true);
    });

    it('allows transaction within limits', () => {
      const tx = makeTransferTx(500_000_000); // 0.5 SOL
      const intent = makeIntent({ amount: 0.5, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.passed).toBe(true);
    });

    it('requires confirmation above auto-sign threshold', () => {
      const tx = makeTransferTx(500_000_000); // 0.5 SOL > 0.1 threshold
      const intent = makeIntent({ amount: 0.5, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('does not require confirmation below auto-sign threshold', () => {
      const tx = makeTransferTx(50_000_000); // 0.05 SOL < 0.1 threshold
      const intent = makeIntent({ amount: 0.05, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.requiresConfirmation).toBe(false);
    });

    it('tracks daily spend per wallet', () => {
      engine.recordTransaction(3, SYSTEM_PROGRAM, 'walletA');
      engine.recordTransaction(5, SYSTEM_PROGRAM, 'walletB');
      expect(engine.getDailySpend('walletA')).toBe(3);
      expect(engine.getDailySpend('walletB')).toBe(5);
    });
  });

  // =========================================================================
  // Program allowlist/blocklist
  // =========================================================================

  describe('program lists', () => {
    it('blocks programs on blocklist', () => {
      engine.blockAddress('EvilProgram111111111111111111111111111111');
      const intent = makeIntent({ program: 'EvilProgram111111111111111111111111111111' });
      const result = engine.validateIntent(intent);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.rule === 'blocked_program')).toBe(true);
    });

    it('requires confirmation for unknown programs', () => {
      const intent = makeIntent({ program: UNKNOWN_PROGRAM });
      const result = engine.validateIntent(intent);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('blocks unknown programs when blockUnknownPrograms is true', () => {
      const strictEngine = new PolicyEngine({ blockUnknownPrograms: true });
      const intent = makeIntent({ program: UNKNOWN_PROGRAM });
      const result = strictEngine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'unknown_program')).toBe(true);
    });

    it('allows known programs', () => {
      const intent = makeIntent({ program: SYSTEM_PROGRAM });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'unknown_program').length).toBe(0);
      expect(result.violations.filter(v => v.rule === 'blocked_program').length).toBe(0);
    });
  });

  // =========================================================================
  // Unlimited approval detection
  // =========================================================================

  describe('unlimited approval detection', () => {
    it('detects u64::MAX approval via raw bytes', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 0xFFFFFFFFFFFFFFFFn);
      const intent = makeIntent({
        description: 'Approve unlimited tokens',
        program: TOKEN_PROGRAM,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'unlimited_approval')).toBe(true);
    });

    it('detects u64::MAX approval on Token-2022', () => {
      const tx = makeTokenApproveTx(TOKEN_2022, 0xFFFFFFFFFFFFFFFFn);
      const intent = makeIntent({
        description: 'Approve unlimited tokens',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'unlimited_approval')).toBe(true);
    });

    it('detects very large approval (>1e12)', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, BigInt(2e12));
      const intent = makeIntent({
        description: 'Approve large amount',
        program: TOKEN_PROGRAM,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'unlimited_approval')).toBe(true);
    });

    it('allows reasonable approval amounts', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 1000000n); // 1 USDC
      const intent = makeIntent({
        description: 'Approve 1 USDC allowance',
        program: TOKEN_PROGRAM,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'unlimited_approval').length).toBe(0);
    });
  });

  // =========================================================================
  // Description mismatch
  // =========================================================================

  describe('description mismatch', () => {
    it('detects "swap" description hiding approve instruction', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 1000n);
      const intent = makeIntent({
        description: 'Swap 5 SOL for USDC',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.descriptionMismatch).toBe(true);
      expect(result.violations.some(v => v.rule === 'description_mismatch')).toBe(true);
    });

    it('detects "view balance" description hiding transfer', () => {
      const tx = makeTransferTx(1_000_000_000);
      const intent = makeIntent({
        description: 'View wallet balance',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.descriptionMismatch).toBe(true);
    });

    it('detects dangerous method not mentioned in description', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 100n);
      const intent = makeIntent({
        description: 'Process this normal thing',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      // "approve" not mentioned anywhere in description
      expect(result.descriptionMismatch).toBe(true);
    });

    it('passes when description matches instruction', () => {
      const tx = makeTransferTx(1_000_000_000);
      const intent = makeIntent({
        description: 'Transfer 1 SOL to friend',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.descriptionMismatch).toBe(false);
    });

    it('passes when approve is mentioned in description', () => {
      const tx = makeTokenApproveTx(TOKEN_PROGRAM, 100n);
      const intent = makeIntent({
        description: 'Approve 100 token allowance for Jupiter',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.descriptionMismatch).toBe(false);
    });
  });

  // =========================================================================
  // Multi-instruction validation
  // =========================================================================

  describe('multi-instruction transactions', () => {
    it('validates ALL instructions, not just the first', () => {
      const from = makePayer();
      const tx = new Transaction();
      // First instruction: benign transfer
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 1000 }));
      // Second instruction: hidden unlimited approve
      const data = Buffer.alloc(9);
      data[0] = 4;
      data.writeBigUInt64LE(0xFFFFFFFFFFFFFFFFn, 1);
      tx.add(new TransactionInstruction({
        programId: new PublicKey(TOKEN_PROGRAM),
        keys: [
          { pubkey: makePayer(), isSigner: false, isWritable: true },
          { pubkey: makePayer(), isSigner: false, isWritable: false },
          { pubkey: from, isSigner: true, isWritable: false },
        ],
        data,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer small amount',
        transaction: tx,
      });

      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'unlimited_approval')).toBe(true);
    });

    it('sums amounts across all instructions', () => {
      const from = makePayer();
      const tx = new Transaction();
      // Two transfers: 3 SOL + 3 SOL = 6 SOL (exceeds 5 SOL limit)
      tx.add(
        SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 3_000_000_000 }),
        SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 3_000_000_000 }),
      );
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({ amount: 6, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'transaction_limit_exceeded')).toBe(true);
    });

    it('requires confirmation for dangerous methods in multi-ix tx', () => {
      const from = makePayer();
      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 1000 }));
      // close_account (type 9) — hidden as second instruction
      tx.add(new TransactionInstruction({
        programId: new PublicKey(TOKEN_PROGRAM),
        keys: [
          { pubkey: makePayer(), isSigner: false, isWritable: true },
          { pubkey: makePayer(), isSigner: false, isWritable: true },
          { pubkey: from, isSigner: true, isWritable: false },
        ],
        data: Buffer.from([9]),
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer small amount',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      // close_account in a multi-ix tx should flag for confirmation
      expect(result.requiresConfirmation).toBe(true);
      // Also should detect description mismatch (transfer description, close_account method)
      expect(result.descriptionMismatch).toBe(true);
    });
  });

  // =========================================================================
  // Anomaly detection
  // =========================================================================

  describe('anomaly detection', () => {
    it('flags outlier amounts', () => {
      // Build baseline: several small transactions (need ≥3 for anomaly detection)
      for (let i = 0; i < 5; i++) {
        engine.recordTransaction(0.01, SYSTEM_PROGRAM, 'walletA');
      }

      // Intent amount of 4.5 is way above 0.01 baseline (>3 sigma)
      // Use a transaction to provide decoded amounts, or rely on intent.amount
      const tx = makeTransferTx(4_500_000_000); // 4.5 SOL
      const intent = makeIntent({ amount: 4.5, program: SYSTEM_PROGRAM, transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'anomaly_detected')).toBe(true);
    });

    it('skips anomaly detection with insufficient history', () => {
      const intent = makeIntent({ amount: 4.5 });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'anomaly_detected').length).toBe(0);
    });
  });

  // =========================================================================
  // updateConfig clamping (Fix #9)
  // =========================================================================

  describe('updateConfig clamping', () => {
    it('cannot raise dailyLimitSol above construction value', () => {
      const e = new PolicyEngine({ dailyLimitSol: 10 });
      e.updateConfig({ dailyLimitSol: 999 });
      expect(e.getConfig().dailyLimitSol).toBe(10);
    });

    it('cannot raise transactionLimitSol above construction value', () => {
      const e = new PolicyEngine({ transactionLimitSol: 5 });
      e.updateConfig({ transactionLimitSol: 100 });
      expect(e.getConfig().transactionLimitSol).toBe(5);
    });

    it('cannot raise autoSignThresholdSol above construction value', () => {
      const e = new PolicyEngine({ autoSignThresholdSol: 0.1 });
      e.updateConfig({ autoSignThresholdSol: 50 });
      expect(e.getConfig().autoSignThresholdSol).toBe(0.1);
    });

    it('can lower limits', () => {
      const e = new PolicyEngine({ dailyLimitSol: 10, transactionLimitSol: 5 });
      e.updateConfig({ dailyLimitSol: 3, transactionLimitSol: 1 });
      expect(e.getConfig().dailyLimitSol).toBe(3);
      expect(e.getConfig().transactionLimitSol).toBe(1);
    });

    it('cannot set limits to Infinity', () => {
      const e = new PolicyEngine();
      e.updateConfig({ dailyLimitSol: Infinity, transactionLimitSol: Infinity });
      expect(e.getConfig().dailyLimitSol).toBeLessThan(Infinity);
      expect(e.getConfig().transactionLimitSol).toBeLessThan(Infinity);
    });
  });

  // =========================================================================
  // localStorage persistence
  // =========================================================================

  describe('persistence', () => {
    it('persists and restores daily spend', () => {
      engine.recordTransaction(3, SYSTEM_PROGRAM, 'walletA');
      // Create a new engine — should restore from localStorage
      const engine2 = new PolicyEngine();
      expect(engine2.getDailySpend('walletA')).toBe(3);
    });

    it('resets on new day', () => {
      engine.recordTransaction(5, SYSTEM_PROGRAM, 'walletA');
      // Simulate new day by changing stored date
      localStorageMock.setItem('pistolshrimp_spend_date', 'Thu Jan 01 2000');
      const engine2 = new PolicyEngine();
      expect(engine2.getDailySpend('walletA')).toBe(0);
    });
  });

  // =========================================================================
  // BPF Upgrade Detection (Feature #4)
  // =========================================================================

  describe('BPF upgrade detection', () => {
    const BPF_LOADER = 'BPFLoaderUpgradeab1e11111111111111111111111';

    it('flags transactions targeting BPF Upgradeable Loader', () => {
      const from = makePayer();
      const tx = new Transaction();
      tx.add(new TransactionInstruction({
        programId: new PublicKey(BPF_LOADER),
        keys: [
          { pubkey: makePayer(), isSigner: false, isWritable: true },
          { pubkey: from, isSigner: true, isWritable: false },
        ],
        data: Buffer.from([3]), // upgrade instruction
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Upgrade program',
        program: BPF_LOADER,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.rule === 'bpf_upgrade_detected')).toBe(true);
    });

    it('does not flag normal System Program transactions as BPF upgrades', () => {
      const tx = makeTransferTx(50_000_000);
      const intent = makeIntent({ transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'bpf_upgrade_detected').length).toBe(0);
    });
  });

  // =========================================================================
  // Destination Address Reputation (Feature #3)
  // =========================================================================

  describe('destination address reputation', () => {
    it('blocks transactions to known drainer addresses', () => {
      const from = makePayer();
      const drainerAddress = 'DRaiNEr1111111111111111111111111111111111111';
      const tx = new Transaction();
      tx.add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: new PublicKey(drainerAddress),
          lamports: 50_000_000,
        })
      );
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer SOL',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.passed).toBe(false);
      expect(result.violations.some(v => v.rule === 'known_drainer_address')).toBe(true);
    });

    it('allows transactions to non-drainer addresses', () => {
      const tx = makeTransferTx(50_000_000);
      const intent = makeIntent({ transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'known_drainer_address').length).toBe(0);
    });

    it('catches drainer address in multi-instruction tx', () => {
      const from = makePayer();
      const drainerAddress = 'FakeJUP111111111111111111111111111111111111';
      const tx = new Transaction();
      // First instruction: benign transfer
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 1000 }));
      // Second instruction: transfer to drainer
      tx.add(SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: new PublicKey(drainerAddress),
        lamports: 50_000_000,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({ description: 'Transfer SOL', transaction: tx });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'known_drainer_address')).toBe(true);
    });
  });

  // =========================================================================
  // Token-2022 Extension Detection (Feature #2)
  // =========================================================================

  describe('Token-2022 extension detection', () => {
    const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

    function makeToken2022Tx(extensionByte: number): Transaction {
      const from = makePayer();
      // Instruction data with the extension type byte
      const data = Buffer.alloc(10);
      data[0] = 25; // Some Token-2022 extension instruction type
      data[1] = extensionByte; // Extension type
      const tx = new Transaction();
      tx.add(new TransactionInstruction({
        programId: new PublicKey(TOKEN_2022),
        keys: [
          { pubkey: makePayer(), isSigner: false, isWritable: true },
          { pubkey: from, isSigner: true, isWritable: false },
        ],
        data,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();
      return tx;
    }

    it('flags PermanentDelegate extension (type 35)', () => {
      const tx = makeToken2022Tx(35);
      const intent = makeIntent({
        description: 'Initialize token with extensions',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.token2022Warnings).toBeDefined();
      expect(result.token2022Warnings!.some(w => w.extensionName === 'PermanentDelegate')).toBe(true);
      expect(result.violations.some(v => v.rule === 'token2022_dangerous_extension')).toBe(true);
    });

    it('flags TransferHook extension (type 36)', () => {
      const tx = makeToken2022Tx(36);
      const intent = makeIntent({
        description: 'Initialize token with hooks',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.token2022Warnings!.some(w => w.extensionName === 'TransferHook')).toBe(true);
    });

    it('flags ConfidentialTransfer extension (type 37)', () => {
      const tx = makeToken2022Tx(37);
      const intent = makeIntent({
        description: 'Initialize confidential transfer',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.token2022Warnings!.some(w => w.extensionName === 'ConfidentialTransfer')).toBe(true);
    });

    it('does not flag normal Token-2022 operations', () => {
      const tx = makeTokenApproveTx(TOKEN_2022, 1000n);
      const intent = makeIntent({
        description: 'Approve tokens',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      // Normal approve won't trigger extension warnings (data[0]=4, data[1]=low byte of amount)
      const extensionWarnings = result.token2022Warnings?.filter(
        w => w.extensionName === 'PermanentDelegate' || w.extensionName === 'TransferHook'
      ) || [];
      expect(extensionWarnings.length).toBe(0);
    });

    it('can be disabled via config', () => {
      const disabledEngine = new PolicyEngine({ enableToken2022Checks: false });
      const tx = makeToken2022Tx(35);
      const intent = makeIntent({
        description: 'Initialize token with extensions',
        program: TOKEN_2022,
        transaction: tx,
      });
      const result = disabledEngine.validateIntent(intent);
      expect(result.token2022Warnings).toBeUndefined();
    });
  });

  // =========================================================================
  // Multi-Asset Drain Pattern Detection (Feature #1)
  // =========================================================================

  describe('drain pattern detection', () => {
    it('detects 3+ distinct recipients in one tx', () => {
      const from = makePayer();
      const tx = new Transaction();
      for (let i = 0; i < 4; i++) {
        tx.add(SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: Keypair.generate().publicKey,
          lamports: 10_000_000,
        }));
      }
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer SOL to multiple recipients',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.drainPattern).toBeDefined();
      expect(result.drainPattern!.detected).toBe(true);
      expect(result.drainPattern!.distinctRecipients).toBeGreaterThanOrEqual(3);
      expect(result.violations.some(v => v.rule === 'drain_pattern_detected')).toBe(true);
    });

    it('does not flag 2 recipients', () => {
      const from = makePayer();
      const tx = new Transaction();
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 10_000_000 }));
      tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 10_000_000 }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer SOL to 2 recipients',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.drainPattern?.detected).toBe(false);
    });

    it('does not flag transfers to same recipient', () => {
      const from = makePayer();
      const to = makePayer();
      const tx = new Transaction();
      for (let i = 0; i < 5; i++) {
        tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 10_000_000 }));
      }
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Transfer SOL multiple times to same address',
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.drainPattern?.detected).toBe(false);
      expect(result.drainPattern?.distinctRecipients).toBe(1);
    });

    it('can be disabled via config', () => {
      const disabledEngine = new PolicyEngine({ enableDrainDetection: false });
      const from = makePayer();
      const tx = new Transaction();
      for (let i = 0; i < 4; i++) {
        tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: makePayer(), lamports: 10_000_000 }));
      }
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({ description: 'Transfer', transaction: tx });
      const result = disabledEngine.validateIntent(intent);
      expect(result.drainPattern).toBeUndefined();
    });
  });

  // =========================================================================
  // Swap Slippage Validation (Feature #7)
  // =========================================================================

  describe('swap slippage validation', () => {
    const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

    function makeJupiterSwapTx(slippageBps: number): Transaction {
      const from = makePayer();
      // Jupiter v6 route instruction: 8 byte discriminator + 2 byte slippage bps
      const data = Buffer.alloc(20);
      // Anchor discriminator (8 bytes)
      data.writeUInt32LE(0xdeadbeef, 0);
      data.writeUInt32LE(0xcafebabe, 4);
      // Slippage bps (u16 LE at offset 8)
      data.writeUInt16LE(slippageBps, 8);

      const tx = new Transaction();
      tx.add(new TransactionInstruction({
        programId: new PublicKey(JUPITER_V6),
        keys: [
          { pubkey: from, isSigner: true, isWritable: true },
          { pubkey: makePayer(), isSigner: false, isWritable: true },
        ],
        data,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();
      return tx;
    }

    it('blocks swap with >10% slippage', () => {
      const tx = makeJupiterSwapTx(5000); // 50%
      const intent = makeIntent({
        description: 'Swap SOL for USDC',
        program: JUPITER_V6,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.swapSlippage).toBeDefined();
      expect(result.swapSlippage!.bps).toBe(5000);
      expect(result.violations.some(v => v.rule === 'excessive_slippage')).toBe(true);
    });

    it('flags swap with >3% slippage as high risk', () => {
      const tx = makeJupiterSwapTx(500); // 5%
      const intent = makeIntent({
        description: 'Swap SOL for USDC',
        program: JUPITER_V6,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.swapSlippage!.bps).toBe(500);
      expect(result.violations.some(v => v.rule === 'high_slippage')).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('allows swap with reasonable slippage', () => {
      const tx = makeJupiterSwapTx(100); // 1%
      const intent = makeIntent({
        description: 'Swap SOL for USDC',
        program: JUPITER_V6,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'excessive_slippage').length).toBe(0);
      expect(result.violations.filter(v => v.rule === 'high_slippage').length).toBe(0);
    });

    it('respects custom maxSlippageBps', () => {
      const strictEngine = new PolicyEngine({ maxSlippageBps: 50 }); // 0.5%
      const tx = makeJupiterSwapTx(100); // 1% > 0.5%
      const intent = makeIntent({
        description: 'Swap SOL for USDC',
        program: JUPITER_V6,
        transaction: tx,
      });
      const result = strictEngine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'high_slippage')).toBe(true);
    });
  });

  // =========================================================================
  // MEV/Sandwich Attack Warning (Feature #8)
  // =========================================================================

  describe('MEV warning', () => {
    const JUPITER_V6 = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';

    it('warns for large swap (>= mevWarningThresholdSol)', () => {
      const from = makePayer();
      const data = Buffer.alloc(20);
      data.writeUInt32LE(0xdeadbeef, 0);
      data.writeUInt32LE(0xcafebabe, 4);
      data.writeUInt16LE(100, 8); // 1% slippage

      const tx = new Transaction();
      // Add a SOL transfer to set the amount
      tx.add(SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: makePayer(),
        lamports: 2_000_000_000, // 2 SOL
      }));
      // Add Jupiter swap instruction
      tx.add(new TransactionInstruction({
        programId: new PublicKey(JUPITER_V6),
        keys: [
          { pubkey: from, isSigner: true, isWritable: true },
          { pubkey: makePayer(), isSigner: false, isWritable: true },
        ],
        data,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Swap 2 SOL for USDC',
        amount: 2,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.some(v => v.rule === 'mev_exposure_warning')).toBe(true);
      expect(result.requiresConfirmation).toBe(true);
    });

    it('does not warn for small swaps', () => {
      const from = makePayer();
      const data = Buffer.alloc(20);
      data.writeUInt32LE(0xdeadbeef, 0);
      data.writeUInt32LE(0xcafebabe, 4);
      data.writeUInt16LE(100, 8);

      const tx = new Transaction();
      tx.add(new TransactionInstruction({
        programId: new PublicKey(JUPITER_V6),
        keys: [
          { pubkey: from, isSigner: true, isWritable: true },
          { pubkey: makePayer(), isSigner: false, isWritable: true },
        ],
        data,
      }));
      tx.feePayer = from;
      tx.recentBlockhash = PublicKey.default.toBase58();

      const intent = makeIntent({
        description: 'Swap small amount',
        amount: 0.5,
        transaction: tx,
      });
      const result = engine.validateIntent(intent);
      expect(result.violations.filter(v => v.rule === 'mev_exposure_warning').length).toBe(0);
    });
  });
});
