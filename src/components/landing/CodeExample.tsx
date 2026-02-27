import { CheckCircle, XCircle } from 'lucide-react';
import { FadeIn } from './FadeIn';

export function CodeExample() {
  return (
    <section className="py-20 px-4 bg-card/30">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            Under the Hood
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            The policy engine validates raw instruction data, not agent descriptions.
          </p>
        </FadeIn>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Legit Transaction */}
          <FadeIn delay={100}>
            <div className="bg-background rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-white font-mono text-sm font-semibold">LEGITIMATE TRANSACTION</span>
              </div>
              <div className="p-4 font-mono text-sm">
                <CodeLine type="comment">{`// Agent: "Swap 5 SOL for USDC on Jupiter"`}</CodeLine>
                <CodeLine type="object">{`{`}</CodeLine>
                <CodeLine type="key" indent>{`  program: `}<span className="text-white">"JUP6LkbZbjS..."</span></CodeLine>
                <CodeLine type="key" indent>{`  method: `}<span className="text-white">"swap"</span></CodeLine>
                <CodeLine type="key" indent>{`  amount: `}<span className="text-white">5</span></CodeLine>
                <CodeLine type="object">{`}`}</CodeLine>
                <div className="mt-4 pt-4 border-t border-border space-y-1">
                  <CheckItem pass>Rate check: 3/20 in window</CheckItem>
                  <CheckItem pass>IDL decode: route_swap confirmed</CheckItem>
                  <CheckItem pass>Program on allowlist</CheckItem>
                  <CheckItem pass>Amount under threshold (10 SOL)</CheckItem>
                  <CheckItem pass>Description matches instruction</CheckItem>
                  <CheckItem pass>Anomaly check passed</CheckItem>
                </div>
                <div className="mt-4 p-3 bg-card rounded-lg border border-border">
                  <p className="text-muted-foreground text-xs font-semibold">&rarr; AUTO-SIGN: Ephemeral signer executes, authority revoked</p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* Malicious Transaction */}
          <FadeIn delay={200}>
            <div className="bg-background rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <XCircle className="w-4 h-4 text-muted-foreground" />
                <span className="text-white font-mono text-sm font-semibold">COMPROMISED AGENT BLOCKED</span>
              </div>
              <div className="p-4 font-mono text-sm">
                <CodeLine type="comment">{`// Agent says: "Swap 5 SOL for USDC"`}</CodeLine>
                <CodeLine type="comment">{`// Actual instruction: unlimited approve()`}</CodeLine>
                <CodeLine type="object">{`{`}</CodeLine>
                <CodeLine type="key" indent>{`  description: `}<span className="text-white">"Swap 5 SOL..."</span></CodeLine>
                <CodeLine type="key" indent>{`  program: `}<span className="text-white">"UNKNOWN_ADDR"</span></CodeLine>
                <CodeLine type="key" indent>{`  raw_instruction: `}<span className="text-white">"approve(MAX)"</span></CodeLine>
                <CodeLine type="object">{`}`}</CodeLine>
                <div className="mt-4 pt-4 border-t border-border space-y-1">
                  <CheckItem pass={false}>Rate check: 15/20 — spike flagged</CheckItem>
                  <CheckItem pass={false}>Unknown program, no IDL</CheckItem>
                  <CheckItem pass={false}>Program NOT on allowlist</CheckItem>
                  <CheckItem pass={false}>Description-instruction MISMATCH</CheckItem>
                </div>
                <div className="mt-4 p-3 bg-card rounded-lg border border-border">
                  <p className="text-muted-foreground text-xs font-semibold">&rarr; BLOCKED: Intent logged, owner alerted, agent paused</p>
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
    comment: 'text-muted-foreground',
    object: 'text-white',
    key: 'text-muted-foreground',
  };

  return (
    <p className={`${colors[type]} ${indent ? 'ml-4' : ''}`}>{children}</p>
  );
}

function CheckItem({ children, pass }: { children: React.ReactNode; pass: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {pass ? (
        <CheckCircle className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {children}
    </div>
  );
}
