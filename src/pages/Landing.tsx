import React, { useEffect, useRef, useState } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Github,
  ChevronDown,
  Lock,
  Eye,
  Zap,
  Clock,
  Ban,
  UserCheck,
  Key,
  FileCode,
  AlertCircle,
  Activity,
} from 'lucide-react';

// ============================================================================
// Landing Page for Pistol Shrimp
// ============================================================================

export default function Landing() {
  return (
    <div className="min-h-screen bg-landing-bg text-landing-text overflow-x-hidden">
      {/* Scanline Overlay */}
      <div className="scanline-overlay" />
      
      <Navigation />
      <Hero />
      <ThreatStats />
      <AttackTimeline />
      <ArchitectureDiagram />
      <CodeExample />
      <ThreatModel />
      <CTASection />
      <Footer />
    </div>
  );
}

// ============================================================================
// Navigation
// ============================================================================

function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-landing-bg/95 backdrop-blur-md border-b border-landing-border' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <img 
              src="https://storage.googleapis.com/prod-plena-ai-coder-images/Fky1Jxyx.png" 
              alt="Pistol Shrimp" 
              className="w-10 h-10 object-contain"
            />
            <span className="font-bold text-lg text-white">Pistol Shrimp</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#threats" className="text-sm text-landing-muted hover:text-white transition-colors">Threats</a>
            <a href="#architecture" className="text-sm text-landing-muted hover:text-white transition-colors">Architecture</a>
            <a href="#threat-model" className="text-sm text-landing-muted hover:text-white transition-colors">Threat Model</a>
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-landing-card border border-landing-border rounded-lg text-sm hover:border-landing-muted transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ============================================================================
// Hero Section
// ============================================================================

function Hero() {
  return (
    <section className="relative pt-32 pb-20 px-4">
      <div className="max-w-5xl mx-auto text-center">
        {/* Active Threat Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-landing-danger/10 border border-landing-danger/30 rounded-full mb-8 animate-pulse-slow">
          <span className="w-2 h-2 bg-landing-danger rounded-full animate-ping-slow" />
          <span className="text-landing-danger font-mono text-sm font-medium">ACTIVE THREAT</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
          AI agents have Solana wallet access.{' '}
          <span className="text-landing-danger">20% of their skills are malware.</span>
        </h1>

        {/* Subtext */}
        <p className="text-lg sm:text-xl text-landing-muted max-w-3xl mx-auto mb-10 leading-relaxed">
          Pistol Shrimp is a security middleware for NoahAI that scans, sandboxes, and policy-gates 
          OpenClaw agent actions <span className="text-white">before they touch your wallet</span>. 
          Named after the crustacean that stuns threats before they can act.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a 
            href="#architecture"
            className="flex items-center gap-2 px-6 py-3 bg-landing-success text-landing-bg font-semibold rounded-lg hover:bg-landing-success/90 transition-colors"
          >
            See the Architecture
            <ChevronDown className="w-4 h-4" />
          </a>
          <a 
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 bg-landing-card border border-landing-border text-white font-semibold rounded-lg hover:border-landing-muted transition-colors"
          >
            <Github className="w-4 h-4" />
            View Source
          </a>
        </div>
      </div>

      {/* Decorative gradient */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-landing-danger/5 rounded-full blur-[120px]" />
      </div>
    </section>
  );
}

// ============================================================================
// Threat Stats Grid
// ============================================================================

function ThreatStats() {
  const stats = [
    {
      number: '1,184+',
      label: 'Malicious skills identified on ClawHub',
      source: 'CyberPress/Antiy',
      severity: 'danger',
    },
    {
      number: '~20%',
      label: 'Of ClawHub registry was malware',
      source: 'Bitdefender',
      severity: 'danger',
    },
    {
      number: '91%',
      label: 'Of malicious skills included prompt injection',
      source: 'Awesome Agents',
      severity: 'warning',
    },
    {
      number: '8.8',
      label: 'CVSS score for CVE-2026-25253 (one-click RCE)',
      source: 'Conscia/NVD',
      severity: 'danger',
    },
    {
      number: '30,000+',
      label: 'Exposed OpenClaw instances without auth',
      source: 'Censys',
      severity: 'warning',
    },
    {
      number: '512',
      label: 'Total vulnerabilities found, 8 critical',
      source: 'Kaspersky',
      severity: 'info',
    },
  ];

  return (
    <section id="threats" className="py-20 px-4">
      <div className="max-w-7xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            The Crisis in Numbers
          </h2>
          <p className="text-landing-muted text-center mb-12 max-w-2xl mx-auto">
            OpenClaw is experiencing the worst AI agent security crisis ever documented. These aren't theoretical risks.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <FadeIn key={i} delay={i * 100}>
              <StatCard {...stat} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({ number, label, source, severity }: {
  number: string;
  label: string;
  source: string;
  severity: 'danger' | 'warning' | 'info';
}) {
  const borderColors = {
    danger: 'border-t-landing-danger',
    warning: 'border-t-landing-warning',
    info: 'border-t-landing-info',
  };

  const textColors = {
    danger: 'text-landing-danger',
    warning: 'text-landing-warning',
    info: 'text-landing-info',
  };

  return (
    <div className={`bg-landing-card border border-landing-border ${borderColors[severity]} border-t-2 rounded-lg p-6 hover:translate-y-[-2px] transition-transform`}>
      <p className={`text-4xl sm:text-5xl font-bold font-mono ${textColors[severity]} mb-3`}>
        {number}
      </p>
      <p className="text-white text-sm mb-2">{label}</p>
      <p className="text-landing-muted text-xs font-mono">Source: {source}</p>
    </div>
  );
}

// ============================================================================
// Attack Timeline
// ============================================================================

function AttackTimeline() {
  const events = [
    {
      date: 'Jan 27, 2026',
      title: 'ClawHavoc Campaign Begins',
      description: '335 malicious skills uploaded, all sharing the same C2 infrastructure (91.92.242.30). Distributes Atomic macOS Stealer.',
      severity: 'danger',
    },
    {
      date: 'Jan 28, 2026',
      title: 'CVE-2026-25253 Disclosed',
      description: 'Critical one-click RCE via cross-site WebSocket hijacking. CVSS 8.8. Visit a webpage = full compromise.',
      severity: 'danger',
    },
    {
      date: 'Jan 30, 2026',
      title: 'Partial Patch Released',
      description: 'OpenClaw v2026.1.29 patches WebSocket auth, but 30,000+ instances remain exposed without authentication.',
      severity: 'warning',
    },
    {
      date: 'Feb 2026',
      title: '1,184+ Malicious Packages',
      description: 'The #1 ranked skill on ClawHub had 9 vulnerabilities (2 critical), was functionally malware. Its ranking was faked.',
      severity: 'danger',
    },
    {
      date: 'Feb 21, 2026',
      title: 'NoahAI Ships OpenClaw Integration',
      description: 'Agents become "onchain economic actors" with wallet access. They now inherit the entire ClawHavoc attack surface.',
      severity: 'critical',
    },
  ];

  return (
    <section className="py-20 px-4 bg-landing-card/30">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Attack Timeline
          </h2>
          <p className="text-landing-muted text-center mb-12">
            How we got here — and why NoahAI agents need protection now.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-landing-border" />

          {events.map((event, i) => (
            <FadeIn key={i} delay={i * 150}>
              <TimelineEvent {...event} isLeft={i % 2 === 0} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function TimelineEvent({ date, title, description, severity, isLeft }: {
  date: string;
  title: string;
  description: string;
  severity: 'danger' | 'warning' | 'critical';
  isLeft: boolean;
}) {
  const dotColors = {
    danger: 'bg-landing-danger',
    warning: 'bg-landing-warning',
    critical: 'bg-landing-danger animate-pulse',
  };

  return (
    <div className={`relative flex items-start gap-4 mb-8 ${isLeft ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      {/* Dot */}
      <div className={`absolute left-4 sm:left-1/2 w-3 h-3 rounded-full ${dotColors[severity]} -translate-x-1/2 mt-1.5 ring-4 ring-landing-bg`} />
      
      {/* Content */}
      <div className={`ml-10 sm:ml-0 sm:w-1/2 ${isLeft ? 'sm:pr-12' : 'sm:pl-12'}`}>
        <p className="text-landing-muted font-mono text-sm mb-1">{date}</p>
        <h3 className="text-white font-semibold mb-2">{title}</h3>
        <p className="text-landing-muted text-sm">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Architecture Diagram
// ============================================================================

function ArchitectureDiagram() {
  return (
    <section id="architecture" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            The "No Keys Above This Line" Architecture
          </h2>
          <p className="text-landing-muted text-center mb-12 max-w-3xl mx-auto">
            The critical insight: just like a well-designed email system where AI writes drafts but never touches OAuth tokens, 
            Pistol Shrimp ensures the agent <span className="text-white">never has direct signing authority</span>.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Agent Zone */}
          <FadeIn delay={100}>
            <div className="bg-landing-danger/5 border border-landing-danger/20 rounded-t-xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-landing-danger" />
                <h3 className="text-lg font-semibold text-landing-danger font-mono">AGENT ZONE</h3>
                <span className="text-xs text-landing-muted ml-2">(no wallet keys, no signing authority)</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <GateCard
                  number={1}
                  name="Skill Quarantine"
                  description="Scans for ClawHavoc IOCs, C2 infrastructure, credential theft patterns, reverse shells, malware signatures"
                  icon={<Shield className="w-5 h-5" />}
                  color="danger"
                />
                <div>
                  <GateCard
                    number={2}
                    name="Prompt Firewall"
                    description="Injection detection, context isolation, behavioral drift monitoring, encoding attack detection"
                    icon={<Eye className="w-5 h-5" />}
                    color="warning"
                  />
                  <div className="mt-3 p-3 bg-landing-warning/10 border border-landing-warning/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-landing-warning mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-landing-warning">
                        <span className="font-semibold">Honest limitation:</span> Prompt injection can't be fully solved — 
                        architecture designed so Gates 3-5 protect wallets independently.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-landing-card/50 rounded-lg border border-landing-border">
                <p className="text-sm text-landing-muted font-mono">
                  <span className="text-landing-warning">→</span> Agent writes tx intent to <code className="text-landing-info">~/.pistolshrimp/pending/</code>
                </p>
                <p className="text-xs text-landing-muted mt-1">
                  {'{ program, method, params, amount, recipient, raw_instruction }'}
                </p>
              </div>
            </div>
          </FadeIn>

          {/* THE RED LINE - Most Important Visual Element */}
          <FadeIn delay={200}>
            <div className="relative py-4 my-0">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-4 border-dashed border-landing-danger" />
              </div>
              <div className="relative flex justify-center">
                <div className="px-6 py-2 bg-landing-bg border-2 border-landing-danger rounded-full">
                  <span className="text-landing-danger font-bold font-mono text-sm sm:text-base flex items-center gap-2">
                    <Ban className="w-4 h-4" />
                    NO WALLET ACCESS ABOVE THIS LINE
                    <Ban className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Validation Zone */}
          <FadeIn delay={300}>
            <div className="bg-landing-success/5 border border-landing-success/20 rounded-b-xl p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-landing-success" />
                <h3 className="text-lg font-semibold text-landing-success font-mono">VALIDATION ZONE</h3>
                <span className="text-xs text-landing-muted ml-2">(human/policy required)</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <GateCard
                  number={3}
                  name="Policy Engine"
                  description="Rate-limited queue, decodes raw Solana instructions via IDL, validates params not descriptions"
                  icon={<FileCode className="w-5 h-5" />}
                  color="success"
                />
                <GateCard
                  number={4}
                  name="Human Confirm"
                  description="High-value txs require approval. Shows decoded instruction params, never agent description"
                  icon={<UserCheck className="w-5 h-5" />}
                  color="success"
                />
                <GateCard
                  number={5}
                  name="Ephemeral Signer"
                  description="Per-transaction authority grant. Signing key access revoked immediately after use"
                  icon={<Key className="w-5 h-5" />}
                  color="success"
                />
              </div>

              <div className="mt-6 p-4 bg-landing-card/50 rounded-lg border border-landing-border">
                <p className="text-sm text-landing-muted font-mono">
                  <span className="text-landing-success">→</span> Transaction signed and sent to Solana
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function GateCard({ number, name, description, icon, color }: {
  number: number;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: 'danger' | 'warning' | 'success';
}) {
  const colors = {
    danger: 'border-landing-danger/30 text-landing-danger',
    warning: 'border-landing-warning/30 text-landing-warning',
    success: 'border-landing-success/30 text-landing-success',
  };

  const bgColors = {
    danger: 'bg-landing-danger/10',
    warning: 'bg-landing-warning/10',
    success: 'bg-landing-success/10',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]} ${bgColors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-mono font-bold ${colors[color].split(' ')[1]}`}>GATE {number}</span>
        {icon}
      </div>
      <h4 className="text-white font-semibold mb-1">{name}</h4>
      <p className="text-landing-muted text-xs">{description}</p>
    </div>
  );
}

// ============================================================================
// Code Example
// ============================================================================

function CodeExample() {
  return (
    <section className="py-20 px-4 bg-landing-card/30">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            See It In Action
          </h2>
          <p className="text-landing-muted text-center mb-12">
            The policy engine validates raw instruction data, not agent descriptions.
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Legit Transaction */}
          <FadeIn delay={100}>
            <div className="bg-landing-bg rounded-xl border border-landing-success/30 overflow-hidden">
              <div className="px-4 py-3 bg-landing-success/10 border-b border-landing-success/30 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-landing-success" />
                <span className="text-landing-success font-mono text-sm font-semibold">LEGITIMATE TRANSACTION</span>
              </div>
              <div className="p-4 font-mono text-sm">
                <CodeLine type="comment">{`// Agent: "Swap 5 SOL for USDC on Jupiter"`}</CodeLine>
                <CodeLine type="object">{`{`}</CodeLine>
                <CodeLine type="key" indent>{`  program: `}<span className="text-landing-info">"JUP6LkbZbjS..."</span></CodeLine>
                <CodeLine type="key" indent>{`  method: `}<span className="text-landing-info">"swap"</span></CodeLine>
                <CodeLine type="key" indent>{`  amount: `}<span className="text-landing-warning">5</span></CodeLine>
                <CodeLine type="object">{`}`}</CodeLine>
                <div className="mt-4 pt-4 border-t border-landing-border space-y-1">
                  <CheckItem color="success">Rate check: 3/20 in window</CheckItem>
                  <CheckItem color="success">IDL decode: route_swap confirmed</CheckItem>
                  <CheckItem color="success">Program on allowlist</CheckItem>
                  <CheckItem color="success">Amount under threshold (10 SOL)</CheckItem>
                  <CheckItem color="success">Description matches instruction</CheckItem>
                  <CheckItem color="success">Anomaly check passed</CheckItem>
                </div>
                <div className="mt-4 p-3 bg-landing-success/10 rounded-lg border border-landing-success/30">
                  <p className="text-landing-success text-xs font-semibold">→ AUTO-SIGN: Ephemeral signer executes, authority revoked</p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Malicious Transaction */}
          <FadeIn delay={200}>
            <div className="bg-landing-bg rounded-xl border border-landing-danger/30 overflow-hidden">
              <div className="px-4 py-3 bg-landing-danger/10 border-b border-landing-danger/30 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-landing-danger" />
                <span className="text-landing-danger font-mono text-sm font-semibold">COMPROMISED AGENT BLOCKED</span>
              </div>
              <div className="p-4 font-mono text-sm">
                <CodeLine type="comment">{`// Agent says: "Swap 5 SOL for USDC"`}</CodeLine>
                <CodeLine type="comment">{`// Actual instruction: unlimited approve()`}</CodeLine>
                <CodeLine type="object">{`{`}</CodeLine>
                <CodeLine type="key" indent>{`  description: `}<span className="text-landing-info">"Swap 5 SOL..."</span></CodeLine>
                <CodeLine type="key" indent>{`  program: `}<span className="text-landing-danger">"UNKNOWN_ADDR"</span></CodeLine>
                <CodeLine type="key" indent>{`  raw_instruction: `}<span className="text-landing-danger">"approve(MAX)"</span></CodeLine>
                <CodeLine type="object">{`}`}</CodeLine>
                <div className="mt-4 pt-4 border-t border-landing-border space-y-1">
                  <CheckItem color="warning">Rate check: 15/20 — spike flagged</CheckItem>
                  <CheckItem color="danger">Unknown program, no IDL</CheckItem>
                  <CheckItem color="danger">Program NOT on allowlist</CheckItem>
                  <CheckItem color="danger">Description-instruction MISMATCH</CheckItem>
                </div>
                <div className="mt-4 p-3 bg-landing-danger/10 rounded-lg border border-landing-danger/30">
                  <p className="text-landing-danger text-xs font-semibold">→ BLOCKED: Intent logged, owner alerted, agent paused</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function CodeLine({ children, type, indent }: { children: React.ReactNode; type: 'comment' | 'object' | 'key'; indent?: boolean }) {
  const colors = {
    comment: 'text-landing-muted',
    object: 'text-white',
    key: 'text-landing-muted',
  };

  return (
    <p className={`${colors[type]} ${indent ? 'ml-4' : ''}`}>{children}</p>
  );
}

function CheckItem({ children, color }: { children: React.ReactNode; color: 'success' | 'warning' | 'danger' }) {
  const icons = {
    success: <CheckCircle className="w-3 h-3 text-landing-success" />,
    warning: <AlertTriangle className="w-3 h-3 text-landing-warning" />,
    danger: <XCircle className="w-3 h-3 text-landing-danger" />,
  };

  const colors = {
    success: 'text-landing-success',
    warning: 'text-landing-warning',
    danger: 'text-landing-danger',
  };

  return (
    <div className={`flex items-center gap-2 text-xs ${colors[color]}`}>
      {icons[color]}
      {children}
    </div>
  );
}

// ============================================================================
// Threat Model
// ============================================================================

function ThreatModel() {
  const threats = [
    { threat: 'Malicious skill drains wallet', status: 'protected', how: 'Agent never has signing authority; intent queue + policy engine' },
    { threat: 'Supply chain attack via ClawHub', status: 'protected', how: 'Gate 1 skill quarantine blocks known malware patterns' },
    { threat: 'Misleading tx description tricks approver', status: 'protected', how: 'Policy engine + human review use decoded instructions, not descriptions' },
    { threat: 'Compromised agent floods queue (DoS)', status: 'protected', how: 'Rate limiting, burst detection, queue depth caps' },
    { threat: 'Prompt injection exfiltrates non-wallet data', status: 'partial', how: 'Context isolation helps, but requires agent-runtime fixes beyond our scope' },
    { threat: 'Novel zero-day injection bypasses Gate 2', status: 'partial', how: 'Expected to happen — Gates 3-5 protect wallets independently' },
    { threat: 'Compromised agent manipulates non-tx actions', status: 'out-of-scope', how: 'Pistol Shrimp gates wallet operations only' },
    { threat: 'OpenClaw core vulnerabilities', status: 'out-of-scope', how: 'Requires fixes from OpenClaw team, not middleware' },
  ];

  return (
    <section id="threat-model" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Honest Threat Model
          </h2>
          <p className="text-landing-muted text-center mb-12 max-w-3xl mx-auto">
            We're transparent about what Pistol Shrimp does and doesn't protect. 
            No security layer is perfect — here's our honest assessment.
          </p>
        </FadeIn>

        <div className="grid sm:grid-cols-2 gap-4">
          {threats.map((t, i) => (
            <FadeIn key={i} delay={i * 75}>
              <ThreatCard {...t} />
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

function ThreatCard({ threat, status, how }: {
  threat: string;
  status: 'protected' | 'partial' | 'out-of-scope';
  how: string;
}) {
  const configs = {
    protected: {
      border: 'border-landing-success/30',
      bg: 'bg-landing-success/5',
      icon: <CheckCircle className="w-5 h-5 text-landing-success" />,
      label: 'Protected',
      labelColor: 'text-landing-success bg-landing-success/10',
    },
    partial: {
      border: 'border-landing-warning/30',
      bg: 'bg-landing-warning/5',
      icon: <AlertTriangle className="w-5 h-5 text-landing-warning" />,
      label: 'Partial / Expected',
      labelColor: 'text-landing-warning bg-landing-warning/10',
    },
    'out-of-scope': {
      border: 'border-landing-danger/30',
      bg: 'bg-landing-danger/5',
      icon: <XCircle className="w-5 h-5 text-landing-danger" />,
      label: 'Out of Scope',
      labelColor: 'text-landing-danger bg-landing-danger/10',
    },
  };

  const config = configs[status];

  return (
    <div className={`p-4 rounded-lg border ${config.border} ${config.bg}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          {config.icon}
          <h4 className="text-white font-medium text-sm">{threat}</h4>
        </div>
        <span className={`text-xs font-mono px-2 py-1 rounded ${config.labelColor}`}>
          {config.label}
        </span>
      </div>
      <p className="text-landing-muted text-xs ml-8">{how}</p>
    </div>
  );
}

// ============================================================================
// CTA Section
// ============================================================================

function CTASection() {
  return (
    <section className="py-20 px-4 bg-landing-card/30">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <div className="relative bg-landing-bg rounded-xl border border-landing-border p-8 sm:p-12 text-center overflow-hidden">
            {/* Gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-landing-danger via-landing-warning to-landing-success" />
            
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Agents Should Propose, Not Sign.
            </h2>
            <p className="text-landing-muted mb-8 max-w-xl mx-auto">
              The "no keys above the line" pattern ensures that even a fully compromised agent 
              can only write transaction proposals — never sign them.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a 
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-landing-bg font-semibold rounded-lg hover:bg-white/90 transition-colors"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
              <a 
                href="/demo"
                className="flex items-center gap-2 px-6 py-3 bg-landing-success text-landing-bg font-semibold rounded-lg hover:bg-landing-success/90 transition-colors"
              >
                <Zap className="w-5 h-5" />
                Try the Demo
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="px-3 py-1 bg-landing-card rounded-full text-xs text-landing-muted border border-landing-border">
                Built for Solana
              </span>
              <span className="px-3 py-1 bg-landing-card rounded-full text-xs text-landing-muted border border-landing-border">
                NoahAI × Superteam Sprint
              </span>
              <span className="px-3 py-1 bg-landing-card rounded-full text-xs text-landing-muted border border-landing-border">
                Feb 2026
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer() {
  return (
    <footer className="py-8 px-4 border-t border-landing-border">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img 
            src="https://storage.googleapis.com/prod-plena-ai-coder-images/Fky1Jxyx.png" 
            alt="Pistol Shrimp" 
            className="w-6 h-6 object-contain"
          />
          <span className="text-landing-muted text-sm">
            Pistol Shrimp — MIT License
          </span>
        </div>
        <a 
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-landing-muted text-sm hover:text-white transition-colors"
        >
          <Github className="w-4 h-4" />
          View Source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </footer>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {children}
    </div>
  );
}
