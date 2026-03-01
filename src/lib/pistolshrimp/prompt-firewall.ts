import {
  PromptScanResult,
  InjectionAttempt,
  InjectionType,
  SecurityLogEntry,
} from './types';

// ============================================================================
// Prompt Firewall (Gate 2) - Context Isolation & Injection Detection
// ============================================================================

interface ContextSession {
  id: string;
  agentId: string;
  createdAt: number;
  lastActivity: number;
  accessedPaths: Set<string>;
  actionBaseline: Map<string, number>;
  inputHashes: Set<string>;
}

export class PromptFirewall {
  private sessions: Map<string, ContextSession> = new Map();
  private globalBlockedPatterns: RegExp[] = [];
  private logs: SecurityLogEntry[] = [];
  private scanHistory: PromptScanResult[] = [];

  constructor() {
    this.initializeBlockedPatterns();
  }

  // Initialize blocked patterns for injection detection
  private initializeBlockedPatterns(): void {
    this.globalBlockedPatterns = [
      // Instruction overrides
      /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|context)/gi,
      /disregard\s+(everything|all|any)\s+(above|before|prior)/gi,
      /forget\s+(everything|all)\s+(you\s+)?(know|learned|were\s+told)/gi,
      
      // System prompt manipulation
      /system\s*:\s*you\s+(are|must|should|will)/gi,
      /\[system\]\s*:/gi,
      /new\s+system\s+prompt/gi,
      /override\s+system\s+instructions/gi,
      
      // Role hijacking
      /you\s+are\s+(now|actually|really)\s+(a|an|the)/gi,
      /pretend\s+(to\s+be|you\s+are|you're)/gi,
      /act\s+as\s+(if\s+you\s+are|a|an)/gi,
      /roleplay\s+as/gi,
      
      // Jailbreak attempts
      /dan\s+mode|do\s+anything\s+now/gi,
      /developer\s+mode\s+enabled/gi,
      /jailbreak/gi,
      /bypass\s+(safety|filter|restriction)/gi,
      
      // Data exfiltration
      /read\s+(and\s+)?(output|print|display|show)\s+(the\s+)?content/gi,
      /send\s+(to|this\s+to)\s+(external|webhook|url|http)/gi,
      /exfiltrate|leak\s+data/gi,
      /output\s+your\s+(system\s+)?prompt/gi,
      
      // Hidden commands (various encodings)
      /\u200b|\u200c|\u200d|\ufeff/g, // Zero-width characters
      /<!--.*-->/gs, // HTML comments
      /\[INST\]|\[\/INST\]/gi, // Model-specific tokens
      
      // Chain of thought manipulation
      /let's\s+think\s+step\s+by\s+step.*then\s+(execute|run)/gi,
      /internal\s+monologue|inner\s+thoughts?/gi,
    ];
  }

  // Normalize input to defeat unicode/encoding evasion
  private normalizeInput(input: string): string {
    let normalized = input;

    // NFKC normalization: collapses fullwidth, compatibility chars, etc.
    normalized = normalized.normalize('NFKC');

    // Map common Cyrillic/Greek/other homoglyphs to ASCII
    const homoglyphMap: Record<string, string> = {
      '\u0430': 'a', '\u0435': 'e', '\u043e': 'o', '\u0440': 'p',
      '\u0441': 'c', '\u0443': 'y', '\u0445': 'x', '\u0456': 'i',
      '\u0458': 'j', '\u04bb': 'h', '\u0501': 'd', '\u051b': 'q',
      '\u0405': 'S', '\u0406': 'I', '\u0408': 'J', '\u0410': 'A',
      '\u0412': 'B', '\u0415': 'E', '\u041a': 'K', '\u041c': 'M',
      '\u041d': 'H', '\u041e': 'O', '\u0420': 'P', '\u0421': 'C',
      '\u0422': 'T', '\u0425': 'X',
      // Greek
      '\u03b1': 'a', '\u03b5': 'e', '\u03bf': 'o', '\u03c1': 'p',
      '\u0391': 'A', '\u0392': 'B', '\u0395': 'E', '\u039a': 'K',
      '\u039c': 'M', '\u039d': 'N', '\u039f': 'O', '\u03a1': 'P',
      '\u03a4': 'T', '\u03a7': 'X',
    };

    normalized = normalized.replace(/[\u0400-\u04ff\u0370-\u03ff]/g, ch => homoglyphMap[ch] || ch);

    // Strip zero-width and invisible characters (scan still detects them separately)
    normalized = normalized.replace(/[\u200b\u200c\u200d\u200e\u200f\u2060\u2061\u2062\u2063\u2064\ufeff\u00ad]/g, '');

    return normalized;
  }

  // Main scanning function
  scanInput(
    input: string,
    agentId: string,
    sessionId?: string,
    metadata?: { source?: string; toolDescription?: string }
  ): PromptScanResult {
    const injectionAttempts: InjectionAttempt[] = [];
    const inputHash = this.hashInput(input);

    // Normalize to catch unicode evasion — patterns run against normalized text
    const normalizedInput = this.normalizeInput(input);

    // Cap input length to prevent ReDoS — scan head + tail to catch hidden payloads
    const MAX_SCAN_LENGTH = 50_000;
    const TAIL_SCAN_LENGTH = 10_000;
    let tailInput: string | null = null;
    let tailOriginal: string | null = null;

    if (normalizedInput.length > MAX_SCAN_LENGTH) {
      injectionAttempts.push({
        type: 'encoding_attack',
        severity: 'high',
        pattern: 'oversized_input',
        location: `input_length: ${normalizedInput.length}`,
        blocked: true,
      });
      tailInput = normalizedInput.slice(-TAIL_SCAN_LENGTH);
      tailOriginal = input.slice(-TAIL_SCAN_LENGTH);
    }
    const scanInput = normalizedInput.length > MAX_SCAN_LENGTH
      ? normalizedInput.slice(0, MAX_SCAN_LENGTH)
      : normalizedInput;
    const scanOriginal = input.length > MAX_SCAN_LENGTH
      ? input.slice(0, MAX_SCAN_LENGTH)
      : input;
    
    // Get or create session
    const session = this.getOrCreateSession(agentId, sessionId);
    session.lastActivity = Date.now();

    // Check for duplicate inputs (replay attacks)
    if (session.inputHashes.has(inputHash)) {
      injectionAttempts.push({
        type: 'encoding_attack',
        severity: 'low',
        pattern: 'duplicate_input',
        location: 'full_input',
        blocked: false,
      });
    }
    session.inputHashes.add(inputHash);

    // Scan normalized+capped input for injection patterns (catches homoglyph evasion)
    const patternInjections = this.scanForInjectionPatterns(scanInput);
    injectionAttempts.push(...patternInjections);

    // Scan ORIGINAL (capped) input for encoding attacks (zero-width chars, base64, etc.)
    const encodingInjections = this.scanForEncodingAttacks(scanOriginal);
    injectionAttempts.push(...encodingInjections);

    // Flag if normalization changed the input significantly (evasion attempt)
    if (input !== normalizedInput && input.length !== normalizedInput.length) {
      injectionAttempts.push({
        type: 'encoding_attack',
        severity: 'high',
        pattern: 'unicode_normalization_diff',
        location: 'full_input',
        blocked: false,
      });
    }

    // Scan for context boundary violations
    const boundaryInjections = this.scanForBoundaryViolations(scanInput, metadata);
    injectionAttempts.push(...boundaryInjections);

    // Scan tail of oversized input to catch payloads hidden after the head cutoff
    if (tailInput) {
      injectionAttempts.push(...this.scanForInjectionPatterns(tailInput));
      injectionAttempts.push(...this.scanForBoundaryViolations(tailInput, metadata));
    }
    if (tailOriginal) {
      injectionAttempts.push(...this.scanForEncodingAttacks(tailOriginal));
    }

    // Check for context isolation violations
    const contextIsolationViolation = this.checkContextIsolation(session, scanInput);

    // Check for behavioral drift
    const behaviorDrift = this.checkBehaviorDrift(session, scanInput);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      injectionAttempts,
      contextIsolationViolation,
      behaviorDrift
    );

    // Determine if should pass
    const criticalInjections = injectionAttempts.filter(i => i.severity === 'critical');
    const passed = criticalInjections.length === 0 && !contextIsolationViolation;

    // Block critical injections
    for (const injection of injectionAttempts) {
      if (injection.severity === 'critical' || injection.severity === 'high') {
        injection.blocked = true;
      }
    }

    const result: PromptScanResult = {
      inputHash,
      passed,
      injectionAttempts,
      contextIsolationViolation,
      behaviorDrift,
      riskScore,
      timestamp: Date.now(),
    };

    // Store in history
    this.scanHistory.push(result);
    if (this.scanHistory.length > 1000) {
      this.scanHistory = this.scanHistory.slice(-1000);
    }

    // Log
    this.log(
      passed ? 'info' : 'warn',
      `Prompt scan: ${passed ? 'PASSED' : 'BLOCKED'} - ${injectionAttempts.length} injection attempts detected`,
      { agentId, riskScore, injections: injectionAttempts.length }
    );

    return result;
  }

  // Scan for known injection patterns
  private scanForInjectionPatterns(input: string): InjectionAttempt[] {
    const attempts: InjectionAttempt[] = [];

    const patternTypes: [RegExp, InjectionType, 'critical' | 'high' | 'medium' | 'low'][] = [
      // Instruction overrides - Critical
      [/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, 'instruction_override', 'critical'],
      [/disregard\s+(everything|all)\s+(above|before)/gi, 'instruction_override', 'critical'],
      [/forget\s+(everything|all)\s+you\s+(know|learned)/gi, 'instruction_override', 'critical'],
      
      // System prompt attacks - Critical
      [/system\s*:\s*you\s+(are|must|should)/gi, 'system_prompt_leak', 'critical'],
      [/\[system\]/gi, 'system_prompt_leak', 'high'],
      [/output\s+your\s+(system\s+)?prompt/gi, 'system_prompt_leak', 'critical'],
      
      // Role hijacking - High
      [/you\s+are\s+(now|actually)\s+(a|an)/gi, 'context_manipulation', 'high'],
      [/pretend\s+(to\s+be|you're)/gi, 'context_manipulation', 'high'],
      
      // Jailbreaks - Critical
      [/dan\s+mode|do\s+anything\s+now/gi, 'jailbreak', 'critical'],
      [/developer\s+mode/gi, 'jailbreak', 'high'],
      [/bypass\s+(safety|filter)/gi, 'jailbreak', 'critical'],
      
      // Data exfiltration - Critical
      [/send\s+(to|this)\s+(external|webhook)/gi, 'data_exfiltration', 'critical'],
      [/exfiltrate/gi, 'data_exfiltration', 'critical'],
      
      // Chain of thought - Medium
      [/let's\s+think\s+step\s+by\s+step.*execute/gi, 'chain_of_thought', 'medium'],
      
      // Hidden commands - High
      [/<!--[\s\S]*?-->/g, 'hidden_command', 'high'],
    ];

    for (const [pattern, type, severity] of patternTypes) {
      const matches = input.match(pattern);
      if (matches) {
        attempts.push({
          type,
          severity,
          pattern: pattern.source,
          location: this.findLocation(input, matches[0]),
          blocked: false,
        });
      }
    }

    return attempts;
  }

  // Scan for encoding attacks
  private scanForEncodingAttacks(input: string): InjectionAttempt[] {
    const attempts: InjectionAttempt[] = [];

    // Zero-width characters
    const zeroWidth = /[\u200b\u200c\u200d\ufeff]/g;
    if (zeroWidth.test(input)) {
      attempts.push({
        type: 'encoding_attack',
        severity: 'high',
        pattern: 'zero_width_characters',
        location: 'embedded',
        blocked: false,
      });
    }

    // Unicode confusables (homoglyphs)
    const confusables = /[\u0430\u0435\u043e\u0440\u0441\u0443\u0445]/g; // Cyrillic lookalikes
    if (confusables.test(input)) {
      attempts.push({
        type: 'encoding_attack',
        severity: 'medium',
        pattern: 'unicode_confusables',
        location: 'embedded',
        blocked: false,
      });
    }

    // Base64 encoded content that might be instructions
    const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
    const base64Matches = input.match(base64Pattern);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = atob(match);
          // Check if decoded content contains injection patterns
          const decodedScan = this.scanForInjectionPatterns(decoded);
          if (decodedScan.length > 0) {
            attempts.push({
              type: 'encoding_attack',
              severity: 'critical',
              pattern: 'base64_encoded_injection',
              location: this.findLocation(input, match),
              blocked: false,
            });
          }
        } catch {
          // Not valid base64, ignore
        }
      }
    }

    return attempts;
  }

  // Scan for context boundary violations
  private scanForBoundaryViolations(
    input: string,
    metadata?: { source?: string; toolDescription?: string }
  ): InjectionAttempt[] {
    const attempts: InjectionAttempt[] = [];

    // Check tool descriptions for injection
    if (metadata?.toolDescription) {
      const toolScan = this.scanForInjectionPatterns(metadata.toolDescription);
      for (const attempt of toolScan) {
        attempts.push({
          ...attempt,
          location: 'tool_description',
          severity: 'critical', // Elevate severity for tool description injections
        });
      }
    }

    // Check for attempts to break out of structured data
    const structureBreaks = [
      /```\s*\n\s*system/gi,
      /\]\s*\[\s*system/gi,
      /}\s*,?\s*{\s*"role"\s*:\s*"system"/gi,
    ];

    for (const pattern of structureBreaks) {
      if (pattern.test(input)) {
        attempts.push({
          type: 'context_manipulation',
          severity: 'high',
          pattern: pattern.source,
          location: 'structure_boundary',
          blocked: false,
        });
      }
    }

    return attempts;
  }

  // Check for context isolation violations
  private checkContextIsolation(session: ContextSession, input: string): boolean {
    // Check for attempts to access other sessions/users
    const crossSessionPatterns = [
      /other\s+users?\s+(data|info|session)/gi,
      /previous\s+conversation/gi,
      /another\s+session/gi,
    ];

    for (const pattern of crossSessionPatterns) {
      if (pattern.test(input)) {
        return true;
      }
    }

    return false;
  }

  // Check for behavioral drift
  private checkBehaviorDrift(session: ContextSession, input: string): boolean {
    // Track action categories
    const actionCategories = this.categorizeActions(input);
    
    for (const [category, count] of Object.entries(actionCategories)) {
      const baseline = session.actionBaseline.get(category) || 0;
      session.actionBaseline.set(category, baseline + count);
    }

    // Check for sudden changes in behavior
    // This is a simplified version - real implementation would be more sophisticated
    const hasFileAccess = /read\s+file|access\s+file|open\s+file/gi.test(input);
    const hasNetworkAccess = /fetch|http|request|curl|wget/gi.test(input);
    const hasWalletAccess = /sign|transfer|send|wallet/gi.test(input);
    const hasSystemAccess = /execute|run\s+command|shell|sudo|chmod|chown/gi.test(input);

    const newPaths: string[] = [];
    if (hasFileAccess) newPaths.push('file');
    if (hasNetworkAccess) newPaths.push('network');
    if (hasWalletAccess) newPaths.push('wallet');
    if (hasSystemAccess) newPaths.push('system');

    // Check if accessing new paths suddenly
    let driftDetected = false;
    for (const path of newPaths) {
      if (!session.accessedPaths.has(path)) {
        if (session.accessedPaths.size >= 2) {
          // Session has established patterns (2+) but now accessing new area
          driftDetected = true;
        }
        session.accessedPaths.add(path);
      }
    }

    return driftDetected;
  }

  // Categorize actions in input
  private categorizeActions(input: string): Record<string, number> {
    const categories: Record<string, number> = {};
    
    const actionPatterns: [string, RegExp][] = [
      ['file', /read|write|open|create|delete|file/gi],
      ['network', /fetch|http|request|url|api/gi],
      ['wallet', /sign|transfer|send|approve|token/gi],
      ['system', /execute|run|command|shell/gi],
    ];

    for (const [category, pattern] of actionPatterns) {
      const matches = input.match(pattern);
      categories[category] = matches?.length || 0;
    }

    return categories;
  }

  // Calculate risk score
  private calculateRiskScore(
    injections: InjectionAttempt[],
    contextViolation: boolean,
    behaviorDrift: boolean
  ): number {
    let score = 0;

    const severityScores: Record<string, number> = {
      critical: 35,
      high: 20,
      medium: 10,
      low: 3,
    };

    for (const injection of injections) {
      score += severityScores[injection.severity] || 0;
    }

    if (contextViolation) score += 25;
    if (behaviorDrift) score += 15;

    return Math.min(100, score);
  }

  // Get or create session
  private getOrCreateSession(agentId: string, sessionId?: string): ContextSession {
    const id = sessionId || agentId;
    let session = this.sessions.get(id);
    
    if (!session) {
      session = {
        id,
        agentId,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        accessedPaths: new Set(),
        actionBaseline: new Map(),
        inputHashes: new Set(),
      };
      this.sessions.set(id, session);
    }

    return session;
  }

  // Clean up old sessions
  cleanupSessions(maxAgeMs: number = 3600000): number {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > maxAgeMs) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }

  // Find location in input
  private findLocation(input: string, match: string): string {
    const index = input.indexOf(match);
    const start = Math.max(0, index - 20);
    const end = Math.min(input.length, index + match.length + 20);
    return `...${input.substring(start, end)}...`;
  }

  // Collision-resistant hash (sync FNV-1a 64-bit split)
  private hashInput(input: string): string {
    let h1 = 0x811c9dc5;
    let h2 = 0xcbf29ce4;
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ (c & 0xff), 0x01000193);
      h2 = Math.imul(h2 ^ ((c >> 8) & 0xff), 0x01000193);
    }
    return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  }

  // Sanitize input by removing detected injection patterns
  sanitizeInput(input: string): string {
    let sanitized = input;

    // Remove zero-width characters
    sanitized = sanitized.replace(/[\u200b\u200c\u200d\ufeff]/g, '');

    // Remove HTML comments
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');

    // This is a basic sanitizer - real implementation would be more sophisticated
    // Note: Sanitization can break legitimate content, so blocking is preferred

    return sanitized;
  }

  // Get session info
  getSession(agentId: string, sessionId?: string): ContextSession | undefined {
    return this.sessions.get(sessionId || agentId);
  }

  // Get scan history
  getScanHistory(limit = 100): PromptScanResult[] {
    return this.scanHistory.slice(-limit);
  }

  // Logging
  private log(level: SecurityLogEntry['level'], message: string, details?: Record<string, unknown>) {
    this.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      level,
      gate: 2,
      message,
      details,
    });
  }

  getLogs(limit = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }
}

// Singleton instance
let globalPromptFirewall: PromptFirewall | null = null;

export function getPromptFirewall(): PromptFirewall {
  if (!globalPromptFirewall) {
    globalPromptFirewall = new PromptFirewall();
  }
  return globalPromptFirewall;
}

export function resetPromptFirewall(): void {
  globalPromptFirewall = null;
}
