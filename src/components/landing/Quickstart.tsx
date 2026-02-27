import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { FadeIn } from './FadeIn';

const installCommand = 'npm install pistolshrimp';

const wrapSnippet = `import { PistolShrimp } from 'pistolshrimp';

const shrimp = new PistolShrimp({ wallet, rpcUrl });
await shrimp.wrap(agent);`;

export function Quickstart() {
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  return (
    <section className="py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-12">
            Quick Start
          </h2>
        </FadeIn>

        <FadeIn delay={100}>
          <div className="space-y-4">
            {/* Install command */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <code className="font-mono text-sm text-white">
                  <span className="text-muted-foreground select-none">$ </span>
                  {installCommand}
                </code>
                <button
                  onClick={() => copy(installCommand, setCopiedInstall)}
                  className="text-muted-foreground hover:text-white transition-colors p-1"
                  aria-label="Copy install command"
                >
                  {copiedInstall ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Provider wrap snippet */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="text-xs text-muted-foreground font-mono">usage</span>
                <button
                  onClick={() => copy(wrapSnippet, setCopiedSnippet)}
                  className="text-muted-foreground hover:text-white transition-colors p-1"
                  aria-label="Copy code snippet"
                >
                  {copiedSnippet ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <pre className="px-4 py-3 font-mono text-sm text-white overflow-x-auto">
                <code>{wrapSnippet}</code>
              </pre>
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
