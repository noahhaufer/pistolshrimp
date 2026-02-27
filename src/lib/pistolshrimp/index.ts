// ============================================================================
// Pistol Shrimp Security Layer for NoahAI OpenClaw Integration
// ============================================================================
//
// A real-time security middleware that scans, sandboxes, and policy-gates
// OpenClaw agent actions before they touch Solana wallets.
//
// Core Pattern: "No Keys Above The Line"
// - Agent writes transaction INTENT to queue
// - Security gates validate the intent
// - Only after clearance does signing occur
// - Agent never has direct signing authority
//

// Types
export * from './types';

// Configuration
export { 
  createConfig,
  DEFAULT_PISTOL_SHRIMP_CONFIG,
  DEFAULT_INTENT_QUEUE_CONFIG,
  DEFAULT_POLICY_CONFIG,
} from './config';

// Gate 1: Skill Scanner
export { 
  SkillScanner, 
  getSkillScanner, 
  resetSkillScanner,
} from './skill-scanner';

// Gate 2: Prompt Firewall
export { 
  PromptFirewall, 
  getPromptFirewall, 
  resetPromptFirewall,
} from './prompt-firewall';

// Gate 3: Policy Engine + Transaction Decoder
export { 
  PolicyEngine, 
  getPolicyEngine, 
  resetPolicyEngine,
  decodeTransaction,
} from './policy-engine';

// Intent Queue + Rate Limiter
export { 
  IntentQueue, 
  getIntentQueue, 
  resetIntentQueue,
} from './intent-queue';

// Main Orchestrator
export { 
  SecurityOrchestrator, 
  getSecurityOrchestrator, 
  resetSecurityOrchestrator,
} from './security-orchestrator';
