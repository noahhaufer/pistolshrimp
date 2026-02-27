import {
  SkillScanResult,
  SkillThreat,
  SkillThreatType,
  ThreatIntelligence,
  DEFAULT_THREAT_INTEL,
  SecurityLogEntry,
} from './types';

// ============================================================================
// Skill Scanner (Gate 1) - Quarantine & Code Analysis
// ============================================================================

export class SkillScanner {
  private threatIntel: ThreatIntelligence;
  private quarantinedSkills: Set<string> = new Set();
  private scanCache: Map<string, SkillScanResult> = new Map();
  private logs: SecurityLogEntry[] = [];

  constructor(customThreatIntel?: Partial<ThreatIntelligence>) {
    this.threatIntel = { ...DEFAULT_THREAT_INTEL, ...customThreatIntel };
  }

  // Main scanning function
  scanSkill(
    skillId: string,
    skillName: string,
    source: string,
    content: string,
    authorId?: string
  ): SkillScanResult {
    // Check cache
    const cacheKey = `${skillId}_${this.hashContent(content)}`;
    const cached = this.scanCache.get(cacheKey);
    if (cached && Date.now() - cached.scanTimestamp < 3600000) { // 1 hour cache
      return cached;
    }

    const threats: SkillThreat[] = [];

    // Check known malicious authors
    if (authorId && this.threatIntel.knownMaliciousAuthors.includes(authorId)) {
      threats.push({
        type: 'malware_signature',
        severity: 'critical',
        description: `Author "${authorId}" is known for distributing malicious skills`,
        indicator: authorId,
      });
    }

    // Check known malicious skills
    if (this.threatIntel.knownMaliciousSkills.includes(skillId)) {
      threats.push({
        type: 'malware_signature',
        severity: 'critical',
        description: `Skill "${skillId}" is flagged in threat intelligence database`,
        indicator: skillId,
      });
    }

    // Scan content for malware signatures
    const signatureThreats = this.scanForMalwareSignatures(content);
    threats.push(...signatureThreats);

    // Scan for C2 infrastructure
    const c2Threats = this.scanForC2Infrastructure(content);
    threats.push(...c2Threats);

    // Scan for credential theft patterns
    const credThreats = this.scanForCredentialTheft(content);
    threats.push(...credThreats);

    // Scan for reverse shells
    const shellThreats = this.scanForReverseShells(content);
    threats.push(...shellThreats);

    // Scan for prompt injection in skill content
    const injectionThreats = this.scanForEmbeddedInjection(content);
    threats.push(...injectionThreats);

    // Scan for social engineering patterns
    const socialThreats = this.scanForSocialEngineering(content);
    threats.push(...socialThreats);

    // Scan for obfuscated code
    const obfuscationThreats = this.scanForObfuscation(content);
    threats.push(...obfuscationThreats);

    // Scan for unauthorized MCP endpoints
    const mcpThreats = this.scanForUnauthorizedMCP(content);
    threats.push(...mcpThreats);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(threats);

    // Determine if skill should be quarantined
    const hasCritical = threats.some(t => t.severity === 'critical');
    const hasHighRisk = threats.some(t => t.severity === 'high');
    const quarantined = hasCritical || (hasHighRisk && threats.length >= 2) || riskScore > 70;

    if (quarantined) {
      this.quarantinedSkills.add(skillId);
    }

    const result: SkillScanResult = {
      skillId,
      skillName,
      source,
      passed: !quarantined,
      threats,
      riskScore,
      quarantined,
      scanTimestamp: Date.now(),
    };

    // Cache result
    this.scanCache.set(cacheKey, result);

    // Log
    this.log(
      quarantined ? 'warn' : 'info',
      `Skill scan: ${skillName} (${skillId}) - ${quarantined ? 'QUARANTINED' : 'PASSED'} - Risk: ${riskScore}`,
      { skillId, threats: threats.length, riskScore }
    );

    return result;
  }

  // Scan for malware signatures
  private scanForMalwareSignatures(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    for (const signature of this.threatIntel.malwareSignatures) {
      const regex = new RegExp(signature, 'gi');
      const matches = content.match(regex);
      if (matches) {
        threats.push({
          type: 'malware_signature',
          severity: 'critical',
          description: `Detected malware signature pattern: ${signature}`,
          indicator: matches[0],
        });
      }
    }

    return threats;
  }

  // Scan for C2 infrastructure connections
  private scanForC2Infrastructure(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    // Check for known C2 IPs
    for (const ip of this.threatIntel.knownC2Ips) {
      if (content.includes(ip)) {
        threats.push({
          type: 'c2_infrastructure',
          severity: 'critical',
          description: `Detected connection to known C2 infrastructure: ${ip}`,
          indicator: ip,
        });
      }
    }

    // Check for suspicious domains
    for (const domain of this.threatIntel.suspiciousDomains) {
      if (content.toLowerCase().includes(domain)) {
        threats.push({
          type: 'suspicious_network',
          severity: 'high',
          description: `Detected connection to suspicious domain: ${domain}`,
          indicator: domain,
        });
      }
    }

    // Check for webhook/tunnel patterns
    const tunnelPatterns = [
      /ngrok\.io/gi,
      /bore\.pub/gi,
      /localtunnel\.me/gi,
      /serveo\.net/gi,
      /webhook\.site/gi,
    ];

    for (const pattern of tunnelPatterns) {
      const match = content.match(pattern);
      if (match) {
        threats.push({
          type: 'c2_infrastructure',
          severity: 'high',
          description: 'Detected external tunnel/webhook endpoint',
          indicator: match[0],
        });
      }
    }

    return threats;
  }

  // Scan for credential theft patterns
  private scanForCredentialTheft(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    const patterns: [RegExp, string][] = [
      [/\.env\b/gi, 'Environment file access (.env)'],
      [/mnemonic|seed\s*phrase|recovery\s*phrase/gi, 'Seed phrase/mnemonic access'],
      [/private\s*key|privatekey|secret\s*key/gi, 'Private key access'],
      [/wallet.*export|export.*wallet/gi, 'Wallet export operation'],
      [/keystore|keyring/gi, 'Keystore/keyring access'],
      [/password.*file|credentials?\s*\.\w+/gi, 'Credential file access'],
      [/\.ssh/gi, 'SSH directory access'],
      [/id_rsa|id_ed25519/gi, 'SSH key access'],
      [/telegram.*bot.*token|discord.*webhook/gi, 'Exfiltration channel detected'],
    ];

    for (const [pattern, description] of patterns) {
      if (pattern.test(content)) {
        threats.push({
          type: 'credential_theft',
          severity: 'critical',
          description: `Detected potential credential theft: ${description}`,
          indicator: content.match(pattern)?.[0],
        });
      }
    }

    return threats;
  }

  // Scan for reverse shell patterns
  private scanForReverseShells(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    const patterns: [RegExp, string][] = [
      [/nc\s+-e|netcat\s+-e/gi, 'Netcat reverse shell'],
      [/bash\s+-i\s+>&?\s*\/dev\/tcp/gi, 'Bash reverse shell'],
      [/python.*socket.*connect/gi, 'Python reverse shell'],
      [/exec\s*\(\s*["']bash/gi, 'Exec bash command'],
      [/\/dev\/tcp\/\d+\.\d+\.\d+\.\d+/gi, 'Dev TCP connection'],
      [/mkfifo.*\/tmp\/f/gi, 'Named pipe for shell'],
      [/socat.*exec.*bash/gi, 'Socat reverse shell'],
    ];

    for (const [pattern, description] of patterns) {
      if (pattern.test(content)) {
        threats.push({
          type: 'reverse_shell',
          severity: 'critical',
          description: `Detected reverse shell pattern: ${description}`,
          indicator: content.match(pattern)?.[0],
        });
      }
    }

    return threats;
  }

  // Scan for embedded prompt injection
  private scanForEmbeddedInjection(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    const patterns: [RegExp, string][] = [
      [/ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi, 'Instruction override'],
      [/you\s+are\s+(now|actually)\s+a/gi, 'Role hijacking'],
      [/system\s*:\s*you\s+must/gi, 'System prompt injection'],
      [/do\s+not\s+tell\s+(the\s+)?user/gi, 'Secrecy instruction'],
      [/pretend\s+(to\s+be|you\s+are)/gi, 'Identity manipulation'],
      [/forget\s+(everything|all|your)\s+(you\s+)?know/gi, 'Memory wipe attempt'],
      [/execute\s+(this|the\s+following)\s+without/gi, 'Blind execution'],
    ];

    for (const [pattern, description] of patterns) {
      if (pattern.test(content)) {
        threats.push({
          type: 'prompt_injection',
          severity: 'high',
          description: `Detected embedded prompt injection: ${description}`,
          indicator: content.match(pattern)?.[0],
        });
      }
    }

    return threats;
  }

  // Scan for social engineering patterns
  private scanForSocialEngineering(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    const patterns: [RegExp, string][] = [
      [/prerequisites?\s*:.*curl.*\|.*bash/gi, 'Copy-paste terminal injection'],
      [/run\s+this\s+(in\s+your\s+)?terminal/gi, 'Terminal command prompt'],
      [/click\s+here\s+to\s+(download|install)/gi, 'Download redirect'],
      [/urgent\s*:?\s*(action|update)\s+required/gi, 'Urgency manipulation'],
      [/your\s+(account|wallet)\s+(has\s+been|is)\s+(compromised|hacked)/gi, 'Fear-based manipulation'],
    ];

    for (const [pattern, description] of patterns) {
      if (pattern.test(content)) {
        threats.push({
          type: 'social_engineering',
          severity: 'medium',
          description: `Detected social engineering pattern: ${description}`,
          indicator: content.match(pattern)?.[0],
        });
      }
    }

    return threats;
  }

  // Scan for obfuscated code
  private scanForObfuscation(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    // Base64 encoded commands
    const base64Pattern = /base64\s*(-d|--decode)|atob\s*\(|Buffer\.from\s*\([^)]+,\s*['"]base64['"]/gi;
    if (base64Pattern.test(content)) {
      threats.push({
        type: 'obfuscated_code',
        severity: 'high',
        description: 'Detected base64 decoding - potential obfuscated payload',
        indicator: content.match(base64Pattern)?.[0],
      });
    }

    // Eval with string construction
    const evalPattern = /eval\s*\(|Function\s*\([^)]*\)\s*\(|new\s+Function\s*\(/gi;
    if (evalPattern.test(content)) {
      threats.push({
        type: 'obfuscated_code',
        severity: 'high',
        description: 'Detected dynamic code execution (eval/Function)',
        indicator: content.match(evalPattern)?.[0],
      });
    }

    // Hex-encoded strings
    const hexPattern = /\\x[0-9a-f]{2}\\x[0-9a-f]{2}\\x[0-9a-f]{2}/gi;
    if (hexPattern.test(content)) {
      threats.push({
        type: 'obfuscated_code',
        severity: 'medium',
        description: 'Detected hex-encoded strings - potential obfuscation',
        indicator: content.match(hexPattern)?.[0],
      });
    }

    return threats;
  }

  // Scan for unauthorized MCP endpoints
  private scanForUnauthorizedMCP(content: string): SkillThreat[] {
    const threats: SkillThreat[] = [];

    // Check for MCP server definitions
    const mcpPattern = /mcp.*server|server.*mcp|mcpServers?\s*[=:]/gi;
    if (mcpPattern.test(content)) {
      // Check if it's pointing to external endpoints
      const externalPattern = /https?:\/\/(?!localhost|127\.0\.0\.1)[^\s"']+/gi;
      const externalMatches = content.match(externalPattern);
      
      if (externalMatches) {
        threats.push({
          type: 'unauthorized_mcp',
          severity: 'high',
          description: 'Detected MCP server with external endpoint',
          indicator: externalMatches[0],
        });
      }
    }

    return threats;
  }

  // Calculate overall risk score
  private calculateRiskScore(threats: SkillThreat[]): number {
    const severityScores: Record<string, number> = {
      critical: 40,
      high: 25,
      medium: 15,
      low: 5,
    };

    let score = 0;
    for (const threat of threats) {
      score += severityScores[threat.severity] || 0;
    }

    // Cap at 100
    return Math.min(100, score);
  }

  // Simple hash for cache key
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  // Check if skill is quarantined
  isQuarantined(skillId: string): boolean {
    return this.quarantinedSkills.has(skillId);
  }

  // Release from quarantine (manual override)
  releaseFromQuarantine(skillId: string): boolean {
    return this.quarantinedSkills.delete(skillId);
  }

  // Get quarantined skills
  getQuarantinedSkills(): string[] {
    return Array.from(this.quarantinedSkills);
  }

  // Update threat intelligence
  updateThreatIntel(updates: Partial<ThreatIntelligence>): void {
    this.threatIntel = {
      ...this.threatIntel,
      ...updates,
      lastUpdated: Date.now(),
    };
  }

  // Get threat intelligence
  getThreatIntel(): ThreatIntelligence {
    return { ...this.threatIntel };
  }

  // Logging
  private log(level: SecurityLogEntry['level'], message: string, details?: Record<string, unknown>) {
    this.logs.push({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      level,
      gate: 1,
      message,
      details,
    });
  }

  getLogs(limit = 100): SecurityLogEntry[] {
    return this.logs.slice(-limit);
  }
}

// Singleton instance
let globalSkillScanner: SkillScanner | null = null;

export function getSkillScanner(threatIntel?: Partial<ThreatIntelligence>): SkillScanner {
  if (!globalSkillScanner) {
    globalSkillScanner = new SkillScanner(threatIntel);
  }
  return globalSkillScanner;
}

export function resetSkillScanner(): void {
  globalSkillScanner = null;
}
