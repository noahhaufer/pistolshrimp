import { Github, Zap } from 'lucide-react';
import { FadeIn } from './FadeIn';

export function CTASection() {
  return (
    <section className="py-20 px-4 bg-card/30">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <div className="relative bg-background rounded-xl p-8 sm:p-12 text-center overflow-hidden shadow-2xl shadow-black/30 border border-border">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Agents Should Propose, Not Sign.
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              The "no keys above the line" pattern ensures that even a fully compromised agent
              can only write transaction proposals — never sign them.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <a
                href="https://github.com/noahhaufer/pistolshrimp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-white text-background font-semibold rounded-lg hover:bg-white/90 transition-colors"
              >
                <Github className="w-5 h-5" />
                View on GitHub
              </a>
              <a
                href="#demo"
                className="flex items-center gap-2 px-6 py-3 bg-card border border-border text-white font-semibold rounded-lg hover:border-muted-foreground transition-colors"
              >
                <Zap className="w-5 h-5" />
                Try the Demo
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="px-3 py-1 bg-card rounded-full text-xs text-muted-foreground border border-border">
                Built for Solana
              </span>
              <span className="px-3 py-1 bg-card rounded-full text-xs text-muted-foreground border border-border">
                NoahAI × Superteam Sprint
              </span>
              <span className="px-3 py-1 bg-card rounded-full text-xs text-muted-foreground border border-border">
                Feb 2026
              </span>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
