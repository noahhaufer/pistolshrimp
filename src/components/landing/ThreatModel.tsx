import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { FadeIn, StaggerChildren, StaggerItem } from './FadeIn';

const threats = [
  { threat: 'Malicious skill drains wallet', status: 'protected' as const, how: 'Agent never has signing authority; intent queue + policy engine' },
  { threat: 'Supply chain attack via ClawHub', status: 'protected' as const, how: 'Gate 1 skill quarantine blocks known malware patterns' },
  { threat: 'Misleading tx description tricks approver', status: 'protected' as const, how: 'Policy engine + human review use decoded instructions, not descriptions' },
  { threat: 'Compromised agent floods queue (DoS)', status: 'protected' as const, how: 'Rate limiting, burst detection, queue depth caps' },
  { threat: 'Prompt injection exfiltrates non-wallet data', status: 'partial' as const, how: 'Context isolation helps, but requires agent-runtime fixes beyond our scope' },
  { threat: 'Novel zero-day injection bypasses Gate 2', status: 'partial' as const, how: 'Expected to happen — Gates 3-5 protect wallets independently' },
  { threat: 'Compromised agent manipulates non-tx actions', status: 'out-of-scope' as const, how: 'Pistol Shrimp gates wallet operations only' },
  { threat: 'OpenClaw core vulnerabilities', status: 'out-of-scope' as const, how: 'Requires fixes from OpenClaw team, not middleware' },
];

export function ThreatModel() {
  return (
    <section id="threat-model" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Honest Threat Model
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-3xl mx-auto">
            We're transparent about what Pistol Shrimp does and doesn't protect.
            No security layer is perfect — here's our honest assessment.
          </p>
        </FadeIn>

        <StaggerChildren className="grid sm:grid-cols-2 gap-4">
          {threats.map((t, i) => (
            <StaggerItem key={i}>
              <ThreatCard {...t} />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}

function ThreatCard({ threat, status, how }: {
  threat: string;
  status: 'protected' | 'partial' | 'out-of-scope';
  how: string;
}) {
  const icons = {
    protected: <CheckCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />,
    partial: <AlertTriangle className="w-5 h-5 text-muted-foreground flex-shrink-0" />,
    'out-of-scope': <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />,
  };

  const labels = {
    protected: 'Protected',
    partial: 'Partial / Expected',
    'out-of-scope': 'Out of Scope',
  };

  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          {icons[status]}
          <h4 className="text-white font-medium text-sm">{threat}</h4>
        </div>
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {labels[status]}
        </span>
      </div>
      <p className="text-muted-foreground text-xs ml-8">{how}</p>
    </div>
  );
}
