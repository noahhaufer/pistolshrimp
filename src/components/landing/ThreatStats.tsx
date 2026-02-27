import { FadeIn, StaggerChildren, StaggerItem } from './FadeIn';

const stats = [
  {
    number: '1,184+',
    label: 'Malicious skills identified on ClawHub',
    source: 'CyberPress/Antiy',
  },
  {
    number: '~20%',
    label: 'Of ClawHub registry was malware',
    source: 'Bitdefender',
  },
  {
    number: '91%',
    label: 'Of malicious skills included prompt injection',
    source: 'Awesome Agents',
  },
  {
    number: '8.8',
    label: 'CVSS score for CVE-2026-25253 (one-click RCE)',
    source: 'Conscia/NVD',
  },
  {
    number: '30,000+',
    label: 'Exposed OpenClaw instances without auth',
    source: 'Censys',
  },
  {
    number: '512',
    label: 'Total vulnerabilities found, 8 critical',
    source: 'Kaspersky',
  },
];

export function ThreatStats() {
  return (
    <section id="threats" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            The Crisis in Numbers
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            OpenClaw is experiencing the worst AI agent security crisis ever documented. These aren't theoretical risks.
          </p>
        </FadeIn>

        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <StaggerItem key={i}>
              <StatCard {...stat} />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </section>
  );
}

function StatCard({ number, label, source }: {
  number: string;
  label: string;
  source: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-lg shadow-black/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/30 transition-all duration-300">
      <p className="text-4xl sm:text-5xl font-bold font-mono text-white mb-3">
        {number}
      </p>
      <p className="text-white text-sm mb-2">{label}</p>
      <p className="text-muted-foreground text-xs font-mono">Source: {source}</p>
    </div>
  );
}
