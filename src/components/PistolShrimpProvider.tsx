import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, VersionedTransaction } from '@solana/web3.js';
import {
  SecurityOrchestrator,
  getSecurityOrchestrator,
  PistolShrimpConfig,
  PistolShrimpState,
  TransactionIntent,
  SecurityReport,
  SecureTransactionResult,
  SecurityLogEntry,
} from '@/lib/pistolshrimp';

// ============================================================================
// Context Types
// ============================================================================

interface PistolShrimpContextValue {
  // State
  isInitialized: boolean;
  pendingIntents: TransactionIntent[];
  securityLogs: SecurityLogEntry[];
  dailySpend: number;
  remainingLimit: number;
  quarantinedSkills: string[];

  // Core actions
  submitTransaction: (
    description: string,
    transaction: Transaction | VersionedTransaction,
    options?: {
      agentId?: string;
      program?: string;
      method?: string;
      params?: Record<string, unknown>;
      amount?: number;
      recipient?: string;
      skillName?: string;
      promptContext?: string;
    }
  ) => Promise<SecureTransactionResult>;

  confirmIntent: (intentId: string) => Promise<SecureTransactionResult>;
  rejectIntent: (intentId: string, reason?: string) => boolean;
  executeIntent: (intentId: string) => Promise<SecureTransactionResult>;

  // Skill scanning
  scanSkill: (
    skillId: string,
    skillName: string,
    source: string,
    content: string,
    authorId?: string,
    options?: import('../lib/pistolshrimp/types').SkillScanOptions
  ) => ReturnType<SecurityOrchestrator['scanSkill']>;
  isSkillQuarantined: (skillId: string) => boolean;

  // Configuration
  updatePolicy: (updates: Partial<PistolShrimpConfig['policy']>) => void;
  getConfig: () => PistolShrimpConfig;

  // Intent for confirmation modal
  intentForConfirmation: TransactionIntent | null;
  setIntentForConfirmation: (intent: TransactionIntent | null) => void;
}

const PistolShrimpContext = createContext<PistolShrimpContextValue | null>(null);

// ============================================================================
// Provider Component
// ============================================================================

interface PistolShrimpProviderProps {
  children: ReactNode;
  config?: Partial<PistolShrimpConfig>;
  defaultAgentId?: string;
}

export function PistolShrimpProvider({
  children,
  config,
  defaultAgentId = 'default_agent',
}: PistolShrimpProviderProps) {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [orchestrator] = useState(() => getSecurityOrchestrator(config));
  const [state, setState] = useState<PistolShrimpState>(() => orchestrator.getState());
  const [intentForConfirmation, setIntentForConfirmation] = useState<TransactionIntent | null>(null);

  // Refresh state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setState(orchestrator.getState());
    }, 1000);

    return () => clearInterval(interval);
  }, [orchestrator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      orchestrator.cleanup();
    };
  }, [orchestrator]);

  // Submit transaction through security layer
  const submitTransaction = useCallback(async (
    description: string,
    transaction: Transaction | VersionedTransaction,
    options?: {
      agentId?: string;
      program?: string;
      method?: string;
      params?: Record<string, unknown>;
      amount?: number;
      recipient?: string;
      skillName?: string;
      promptContext?: string;
    }
  ): Promise<SecureTransactionResult> => {
    const agentId = options?.agentId || defaultAgentId;

    const result = await orchestrator.submitTransaction(
      agentId,
      description,
      transaction,
      options
    );

    // Refresh state
    setState(orchestrator.getState());

    // If requires confirmation, set for modal
    if (result.status === 'requires_confirmation') {
      const intent = orchestrator.getIntent(result.intentId);
      if (intent) {
        setIntentForConfirmation(intent);
      }
    }

    return result;
  }, [orchestrator, defaultAgentId]);

  // Confirm an intent
  const confirmIntent = useCallback(async (intentId: string): Promise<SecureTransactionResult> => {
    const walletAddress = wallet.publicKey?.toBase58();
    const confirmed = orchestrator.confirmTransaction(intentId, walletAddress);
    if (!confirmed) {
      return {
        success: false,
        intentId,
        status: 'rejected',
        error: 'Failed to confirm intent',
      };
    }

    // Execute the transaction
    const result = await orchestrator.executeTransaction(intentId, wallet, connection);
    setState(orchestrator.getState());
    setIntentForConfirmation(null);

    return result;
  }, [orchestrator, wallet, connection]);

  // Reject an intent
  const rejectIntent = useCallback((intentId: string, reason?: string): boolean => {
    const walletAddress = wallet.publicKey?.toBase58();
    const result = orchestrator.rejectTransaction(intentId, reason, walletAddress);
    setState(orchestrator.getState());
    setIntentForConfirmation(null);
    return result;
  }, [orchestrator, wallet]);

  // Execute an approved intent
  const executeIntent = useCallback(async (intentId: string): Promise<SecureTransactionResult> => {
    const result = await orchestrator.executeTransaction(intentId, wallet, connection);
    setState(orchestrator.getState());
    return result;
  }, [orchestrator, wallet, connection]);

  // Scan a skill
  const scanSkill = useCallback((
    skillId: string,
    skillName: string,
    source: string,
    content: string,
    authorId?: string,
    options?: import('../lib/pistolshrimp/types').SkillScanOptions
  ) => {
    const result = orchestrator.scanSkill(skillId, skillName, source, content, authorId, options);
    setState(orchestrator.getState());
    return result;
  }, [orchestrator]);

  // Check if skill is quarantined
  const isSkillQuarantined = useCallback((skillId: string): boolean => {
    return orchestrator.isSkillQuarantined(skillId);
  }, [orchestrator]);

  // Update policy
  const updatePolicy = useCallback((updates: Partial<PistolShrimpConfig['policy']>) => {
    orchestrator.updatePolicyConfig(updates);
  }, [orchestrator]);

  // Get config
  const getConfig = useCallback((): PistolShrimpConfig => {
    return orchestrator.getConfig();
  }, [orchestrator]);

  const contextValue: PistolShrimpContextValue = {
    isInitialized: state.isInitialized,
    pendingIntents: state.pendingIntents,
    securityLogs: state.securityLogs,
    dailySpend: state.dailySpend,
    remainingLimit: orchestrator.getConfig().policy.dailyLimitSol - state.dailySpend,
    quarantinedSkills: Array.from(state.quarantinedSkills),
    submitTransaction,
    confirmIntent,
    rejectIntent,
    executeIntent,
    scanSkill,
    isSkillQuarantined,
    updatePolicy,
    getConfig,
    intentForConfirmation,
    setIntentForConfirmation,
  };

  return (
    <PistolShrimpContext.Provider value={contextValue}>
      {children}
    </PistolShrimpContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

export function usePistolShrimp(): PistolShrimpContextValue {
  const context = useContext(PistolShrimpContext);
  if (!context) {
    throw new Error('usePistolShrimp must be used within a PistolShrimpProvider');
  }
  return context;
}

/**
 * Hook for submitting secure transactions
 */
export function useSecureTransaction() {
  const { submitTransaction, confirmIntent, rejectIntent, executeIntent, pendingIntents } = usePistolShrimp();

  return {
    submitTransaction,
    confirmIntent,
    rejectIntent,
    executeIntent,
    pendingIntents,
  };
}

/**
 * Hook for skill scanning
 */
export function useSkillScanner() {
  const { scanSkill, isSkillQuarantined, quarantinedSkills } = usePistolShrimp();

  return {
    scanSkill,
    isSkillQuarantined,
    quarantinedSkills,
  };
}

/**
 * Hook for security monitoring
 */
export function useSecurityMonitor() {
  const { securityLogs, dailySpend, remainingLimit, pendingIntents, isInitialized } = usePistolShrimp();

  return {
    logs: securityLogs,
    dailySpend,
    remainingLimit,
    pendingIntentsCount: pendingIntents.length,
    isActive: isInitialized,
  };
}

/**
 * Hook for policy configuration
 */
export function usePolicyConfig() {
  const { updatePolicy, getConfig } = usePistolShrimp();

  return {
    updatePolicy,
    getConfig,
  };
}
