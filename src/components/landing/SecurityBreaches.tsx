import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { FadeIn } from './FadeIn';

interface Breach {
  quote: string;
  source: string;
  author?: string;
  avatar: string;
  url: string;
  tag: string;
}

const row1: Breach[] = [
  {
    quote: "The Control UI trusts gatewayUrl from the query string without validation. Clicking a crafted link lets an attacker steal the auth token, disable sandboxing, and execute arbitrary shell commands.",
    source: "The Hacker News",
    author: "Ravie Lakshmanan",
    avatar: "https://www.google.com/s2/favicons?domain=thehackernews.com&sz=128",
    url: "https://thehackernews.com/2026/02/openclaw-bug-enables-one-click-remote.html",
    tag: "CVE-2026-25253",
  },
  {
    quote: "I had to RUN to my Mac mini like I was defusing a bomb. The agent deleted 200+ emails from my real inbox after context window compaction caused it to forget my safety instruction.",
    source: "TechCrunch",
    author: "Julie Bort",
    avatar: "https://www.google.com/s2/favicons?domain=techcrunch.com&sz=128",
    url: "https://techcrunch.com/2026/02/23/a-meta-ai-security-researcher-said-an-openclaw-agent-ran-amok-on-her-inbox/",
    tag: "Rogue Agent",
  },
  {
    quote: "Any website can silently take full control of a developer's AI agent — with no plugins, extensions, or user interaction required.",
    source: "Oasis Security",
    avatar: "https://www.google.com/s2/favicons?domain=oasis.security&sz=128",
    url: "https://www.oasis.security/blog/openclaw-vulnerability",
    tag: "ClawJacked",
  },
  {
    quote: "If you've installed a skill in the past month, there's a 13% chance it contains a critical security flaw and a non-zero chance it's actively exfiltrating your credentials right now.",
    source: "Snyk",
    avatar: "https://www.google.com/s2/favicons?domain=snyk.io&sz=128",
    url: "https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/",
    tag: "Supply Chain",
  },
  {
    quote: "Over 40,000 OpenClaw deployments exposed to potential attack across 28,663 unique IPs. 63% are vulnerable. 12,812 are directly exploitable via RCE.",
    source: "Infosecurity Magazine",
    author: "Phil Muncaster",
    avatar: "https://www.google.com/s2/favicons?domain=infosecurity-magazine.com&sz=128",
    url: "https://www.infosecurity-magazine.com/news/researchers-40000-exposed-openclaw/",
    tag: "40k Exposed",
  },
];

const row2: Breach[] = [
  {
    quote: "A threat actor on BreachForums is selling root shell access to a UK company through a compromised OpenClaw instance — including the CEO's personal contacts and full database access. Asking price: $25K.",
    source: "Cato Networks",
    author: "Vitaly Simonovich",
    avatar: "https://www.google.com/s2/favicons?domain=catonetworks.com&sz=128",
    url: "https://www.catonetworks.com/blog/cato-ctrl-when-openclaw-ai-personal-assistant-becomes-backdoor/",
    tag: "Dark Web",
  },
  {
    quote: "OpenClaw exhibits all three properties of the lethal trifecta: access to private data, exposure to untrusted content, and the ability to communicate externally. Exfiltration is a likely outcome.",
    source: "Simon Willison",
    avatar: "https://unavatar.io/x/simonw",
    url: "https://simonw.substack.com/p/the-lethal-trifecta-for-ai-agents",
    tag: "Lethal Trifecta",
  },
  {
    quote: "1 exposed database. 35,000 emails. 1.5M API keys. A misconfigured Supabase database granted unauthenticated read/write access to everything.",
    source: "Wiz",
    author: "Gal Nagli",
    avatar: "https://www.google.com/s2/favicons?domain=wiz.io&sz=128",
    url: "https://www.wiz.io/blog/exposed-moltbook-database-reveals-millions-of-api-keys",
    tag: "Data Breach",
  },
  {
    quote: "Malicious instructions hidden in SKILL.md files exploit AI agents as trusted intermediaries — marking a shift from prompt injection to using the AI itself as a social engineering vector.",
    source: "Trend Micro",
    avatar: "https://www.google.com/s2/favicons?domain=trendmicro.com&sz=128",
    url: "https://www.trendmicro.com/en_us/research/26/b/openclaw-skills-used-to-distribute-atomic-macos-stealer.html",
    tag: "Malware",
  },
  {
    quote: "180,000 developers just made that your problem. OpenClaw proves agentic AI works. It also proves your security model doesn't.",
    source: "VentureBeat",
    avatar: "https://www.google.com/s2/favicons?domain=venturebeat.com&sz=128",
    url: "https://venturebeat.com/security/openclaw-agentic-ai-security-risk-ciso-guide",
    tag: "Enterprise Risk",
  },
];

function Avatar({ src, fallback }: { src: string; fallback: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
        {fallback}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded-full bg-muted object-cover flex-shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

function BreachCard({ breach }: { breach: Breach }) {
  return (
    <a
      href={breach.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex-shrink-0 w-[340px] sm:w-[380px] bg-card/50 border border-border rounded-xl p-5 hover:border-destructive/40 hover:bg-card/80 transition-all duration-300"
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar src={breach.avatar} fallback={breach.source[0]} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-white font-medium truncate">{breach.source}</span>
            <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
          </div>
          {breach.author && (
            <span className="text-xs text-muted-foreground">{breach.author}</span>
          )}
        </div>
      </div>

      <blockquote className="text-sm text-muted-foreground leading-relaxed mb-3 line-clamp-3">
        &ldquo;{breach.quote}&rdquo;
      </blockquote>

      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-destructive/15 text-destructive border border-destructive/30">
        {breach.tag}
      </span>
    </a>
  );
}

function MarqueeRow({ items, direction }: { items: Breach[]; direction: 'left' | 'right' }) {
  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div
        className={`flex gap-4 ${
          direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right'
        }`}
        style={{ width: 'max-content' }}
        onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
        onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
      >
        {doubled.map((breach, i) => (
          <BreachCard key={`${breach.source}-${i}`} breach={breach} />
        ))}
      </div>
    </div>
  );
}

export function SecurityBreaches() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <FadeIn>
          <p className="text-sm font-mono text-destructive text-center mb-3 tracking-wider uppercase">
            Why This Exists
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            The OpenClaw Security Crisis
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto">
            512 vulnerabilities. 40,000+ exposed instances. 1,467 malicious skills.
            These aren't hypotheticals — they're headlines.
          </p>
        </FadeIn>
      </div>

      <div className="flex flex-col gap-4">
        <MarqueeRow items={row1} direction="left" />
        <MarqueeRow items={row2} direction="right" />
      </div>
    </section>
  );
}
