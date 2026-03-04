export const FPS = 30;
export const DURATION_SECONDS = 20;
export const TOTAL_FRAMES = FPS * DURATION_SECONDS;

export type LineColor = 'white' | 'muted' | 'success' | 'warning' | 'danger' | 'info' | 'cyan';

export interface TerminalLine {
  text: string;
  color: LineColor;
  startFrame: number;
  typeSpeed?: number; // chars per frame, default 2
  prefix?: string;
}

// Act 1: Legitimate 2 SOL Jupiter swap — full 3-gate pipeline (frames 0-290)
// Act 2: Malicious agent blocked (frames 310-530)
// Closing: tagline (frames 540-580)

export const SCRIPT: TerminalLine[] = [
  // Act 1 - header
  { text: '$ pistolshrimp --watch', color: 'cyan', startFrame: 0, typeSpeed: 3 },
  { text: '', color: 'muted', startFrame: 20 },
  { text: '[intent received] agent-7f3a: "Swap 2 SOL for USDC on Jupiter"', color: 'white', startFrame: 30, typeSpeed: 3 },
  { text: '', color: 'muted', startFrame: 60 },

  // Gate 1
  { text: 'Gate 1 │ Skill Scanner      scanning skill: jupiter-swap-v2...', color: 'muted', startFrame: 70, typeSpeed: 2 },
  { text: 'Gate 1 │ Skill Scanner      ✓ no malware signatures', color: 'success', startFrame: 95 },
  { text: 'Gate 1 │ Skill Scanner      ✓ no C2 infrastructure', color: 'success', startFrame: 105 },
  { text: 'Gate 1 │ Skill Scanner      PASS  risk: 0/100', color: 'success', startFrame: 115 },

  // Gate 2
  { text: 'Gate 2 │ Prompt Firewall    scanning description + context...', color: 'muted', startFrame: 125, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    ✓ no injection patterns', color: 'success', startFrame: 148 },
  { text: 'Gate 2 │ Prompt Firewall    ✓ description matches intent', color: 'success', startFrame: 158 },
  { text: 'Gate 2 │ Prompt Firewall    PASS', color: 'success', startFrame: 168 },

  // Gate 3
  { text: 'Gate 3 │ Policy Engine      decoding transaction...', color: 'muted', startFrame: 178, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      program: JUP6LkbZbjS1jKKw... (Jupiter v6)', color: 'info', startFrame: 195 },
  { text: 'Gate 3 │ Policy Engine      ✓ program on allowlist', color: 'success', startFrame: 205 },
  { text: 'Gate 3 │ Policy Engine      ✓ method: route_swap — matches description', color: 'success', startFrame: 215 },
  { text: 'Gate 3 │ Policy Engine      ✓ amount: 2 SOL (under 5 SOL limit)', color: 'success', startFrame: 225 },
  { text: 'Gate 3 │ Policy Engine      ✓ slippage: 50 bps (under 300 bps max)', color: 'success', startFrame: 235 },
  { text: 'Gate 3 │ Policy Engine      ✓ no drain pattern (single recipient)', color: 'success', startFrame: 245 },
  { text: 'Gate 3 │ Policy Engine      PASS', color: 'success', startFrame: 255 },

  // Execution
  { text: 'Execution │ TOCTOU           ✓ snapshot fresh (240ms)', color: 'success', startFrame: 265 },
  { text: 'Execution │ Simulation       ✓ simulation passed — no CPI to untrusted programs', color: 'success', startFrame: 275, typeSpeed: 2 },
  { text: 'Execution │ Sign             signed → tx sent → confirmed', color: 'success', startFrame: 288, typeSpeed: 2 },
  { text: '', color: 'muted', startFrame: 300 },
  { text: '✓ Transaction confirmed: Fv9k...3xQp  (2 SOL → 312.48 USDC)', color: 'success', startFrame: 305, typeSpeed: 2 },

  // Separator
  { text: '', color: 'muted', startFrame: 320 },
  { text: '────────────────────────────────────────────────────', color: 'muted', startFrame: 325 },
  { text: '', color: 'muted', startFrame: 330 },

  // Act 2 - Malicious
  { text: '[intent received] agent-7f3a: "Swap 5 SOL for USDC"', color: 'white', startFrame: 340, typeSpeed: 3 },
  { text: '', color: 'muted', startFrame: 365 },

  // Gate 1 pass (skill already cached)
  { text: 'Gate 1 │ Skill Scanner      ✓ cached — PASS', color: 'success', startFrame: 375 },

  // Gate 2 warns
  { text: 'Gate 2 │ Prompt Firewall    scanning description...', color: 'muted', startFrame: 385, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    ⚠ behavioral drift: amount 2→5 SOL, 14/20 rate window', color: 'warning', startFrame: 405, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    WARN  continuing to Gate 3...', color: 'warning', startFrame: 425 },

  // Gate 3 FAILS
  { text: 'Gate 3 │ Policy Engine      decoding transaction...', color: 'muted', startFrame: 438, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      program: 9xQe...unknown (NOT ON ALLOWLIST)', color: 'danger', startFrame: 455, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ decoded method: approve — NOT "swap"', color: 'danger', startFrame: 470, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ approve(u64::MAX) — UNLIMITED TOKEN APPROVAL', color: 'danger', startFrame: 485, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ description says "swap" but instruction is "approve"', color: 'danger', startFrame: 500, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ drain pattern: 4 distinct recipients detected', color: 'danger', startFrame: 515, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      BLOCKED  — 4 critical violations', color: 'danger', startFrame: 530 },

  { text: '', color: 'muted', startFrame: 540 },
  { text: '✗ BLOCKED — intent logged, owner alerted, agent-7f3a paused', color: 'danger', startFrame: 545, typeSpeed: 2 },

  // Closing
  { text: '', color: 'muted', startFrame: 565 },
  { text: 'Agents propose. They never sign.', color: 'cyan', startFrame: 575, typeSpeed: 1.5 },
];
