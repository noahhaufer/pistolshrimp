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

// Act 1: Legitimate 2 SOL Jupiter swap passes all 5 gates (frames 0-250)
// Act 2: Malicious agent blocked (frames 270-510)
// Closing: tagline (frames 520-580)

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
  { text: 'Gate 2 │ Prompt Firewall    scanning description...', color: 'muted', startFrame: 125, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    ✓ no injection patterns', color: 'success', startFrame: 145 },
  { text: 'Gate 2 │ Prompt Firewall    ✓ behavioral baseline normal', color: 'success', startFrame: 155 },
  { text: 'Gate 2 │ Prompt Firewall    PASS', color: 'success', startFrame: 165 },

  // Gate 3
  { text: 'Gate 3 │ Policy Engine      decoding instruction via IDL...', color: 'muted', startFrame: 175, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      program: JUP6LkbZbjS1jKKw... (Jupiter v6)', color: 'info', startFrame: 195 },
  { text: 'Gate 3 │ Policy Engine      ✓ program on allowlist', color: 'success', startFrame: 205 },
  { text: 'Gate 3 │ Policy Engine      ✓ method: route_swap — matches description', color: 'success', startFrame: 215 },
  { text: 'Gate 3 │ Policy Engine      ✓ amount: 2 SOL (under 5 SOL tx limit)', color: 'success', startFrame: 225 },
  { text: 'Gate 3 │ Policy Engine      PASS', color: 'success', startFrame: 235 },

  // Gate 4 + 5
  { text: 'Gate 4 │ Auto-sign          2 SOL < 5 SOL threshold — no human confirm needed', color: 'success', startFrame: 245 },
  { text: 'Gate 5 │ Ephemeral Signer   signing... authority granted → tx signed → authority revoked', color: 'success', startFrame: 258, typeSpeed: 2 },
  { text: '', color: 'muted', startFrame: 275 },
  { text: '✓ Transaction confirmed: Fv9k...3xQp  (2 SOL → 312.48 USDC)', color: 'success', startFrame: 280, typeSpeed: 2 },

  // Separator
  { text: '', color: 'muted', startFrame: 295 },
  { text: '────────────────────────────────────────────────────', color: 'muted', startFrame: 300 },
  { text: '', color: 'muted', startFrame: 305 },

  // Act 2 - Malicious
  { text: '[intent received] agent-7f3a: "Swap 5 SOL for USDC"', color: 'white', startFrame: 315, typeSpeed: 3 },
  { text: '', color: 'muted', startFrame: 340 },

  // Gate 1 pass (skill already cached)
  { text: 'Gate 1 │ Skill Scanner      ✓ cached — PASS', color: 'success', startFrame: 350 },

  // Gate 2 warns
  { text: 'Gate 2 │ Prompt Firewall    scanning description...', color: 'muted', startFrame: 360, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    ⚠ behavioral drift: amount 2→5 SOL, 14/20 rate window', color: 'warning', startFrame: 380, typeSpeed: 2 },
  { text: 'Gate 2 │ Prompt Firewall    WARN  continuing to Gate 3...', color: 'warning', startFrame: 400 },

  // Gate 3 FAILS
  { text: 'Gate 3 │ Policy Engine      decoding instruction via IDL...', color: 'muted', startFrame: 415, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      program: 9xQe...unknown (NOT ON ALLOWLIST)', color: 'danger', startFrame: 435, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ decoded method: approve — NOT "swap"', color: 'danger', startFrame: 450, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ raw param: approve(u64::MAX) — UNLIMITED TOKEN APPROVAL', color: 'danger', startFrame: 465, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      ✗ description-instruction MISMATCH', color: 'danger', startFrame: 480, typeSpeed: 2 },
  { text: 'Gate 3 │ Policy Engine      BLOCKED', color: 'danger', startFrame: 495 },

  { text: '', color: 'muted', startFrame: 505 },
  { text: '✗ BLOCKED — intent logged, owner alerted, agent-7f3a paused', color: 'danger', startFrame: 510, typeSpeed: 2 },

  // Closing
  { text: '', color: 'muted', startFrame: 535 },
  { text: 'Agents propose. They never sign.', color: 'cyan', startFrame: 545, typeSpeed: 1.5 },
];
