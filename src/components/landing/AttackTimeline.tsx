import { FadeIn } from './FadeIn';

const events = [
  {
    date: 'Jan 27, 2026',
    title: 'ClawHavoc Campaign Begins',
    description: '335 malicious skills uploaded, all sharing the same C2 infrastructure (91.92.242.30). Distributes Atomic macOS Stealer.',
  },
  {
    date: 'Jan 28, 2026',
    title: 'CVE-2026-25253 Disclosed',
    description: 'Critical one-click RCE via cross-site WebSocket hijacking. CVSS 8.8. Visit a webpage = full compromise.',
  },
  {
    date: 'Jan 30, 2026',
    title: 'Partial Patch Released',
    description: 'OpenClaw v2026.1.29 patches WebSocket auth, but 30,000+ instances remain exposed without authentication.',
  },
  {
    date: 'Feb 2026',
    title: '1,184+ Malicious Packages',
    description: 'The #1 ranked skill on ClawHub had 9 vulnerabilities (2 critical), was functionally malware. Its ranking was faked.',
  },
  {
    date: 'Feb 21, 2026',
    title: 'NoahAI Ships OpenClaw Integration',
    description: 'Agents become "onchain economic actors" with wallet access. They now inherit the entire ClawHavoc attack surface.',
  },
];

export function AttackTimeline() {
  return (
    <section className="py-20 px-4 bg-card/30">
      <div className="max-w-4xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Attack Timeline
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            How we got here — and why NoahAI agents need protection now.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-border" />

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

function TimelineEvent({ date, title, description, isLeft }: {
  date: string;
  title: string;
  description: string;
  isLeft: boolean;
}) {
  return (
    <div className={`relative flex items-start gap-4 mb-8 ${isLeft ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      {/* Dot */}
      <div className="absolute left-4 sm:left-1/2 w-3 h-3 rounded-full bg-muted-foreground -translate-x-1/2 mt-1.5 ring-4 ring-background" />

      {/* Content */}
      <div className={`ml-10 sm:ml-0 sm:w-1/2 ${isLeft ? 'sm:pr-12' : 'sm:pl-12'}`}>
        <p className="text-muted-foreground font-mono text-sm mb-1">{date}</p>
        <h3 className="text-white font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  );
}
