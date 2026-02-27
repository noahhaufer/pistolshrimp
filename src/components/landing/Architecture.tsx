import React from 'react';
import {
  Shield,
  Lock,
  Eye,
  Ban,
  UserCheck,
  Key,
  FileCode,
  AlertCircle,
} from 'lucide-react';
import { FadeIn } from './FadeIn';

export function Architecture() {
  return (
    <section id="architecture" className="py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white text-center mb-4">
            5-Gate Pipeline
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">
            Agents write transaction intents. They never touch signing keys.
          </p>
        </FadeIn>

        <div className="relative">
          {/* Agent Zone */}
          <FadeIn delay={100}>
            <div className="bg-card/50 border border-border rounded-t-xl p-6 sm:p-8 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2 mb-6">
                <h3 className="text-lg font-semibold text-destructive font-mono">AGENT ZONE</h3>
                <span className="text-xs text-muted-foreground ml-2">(no wallet keys, no signing authority)</span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <GateCard
                  number={1}
                  name="Skill Quarantine"
                  description="Scans for ClawHavoc IOCs, C2 infrastructure, credential theft patterns, reverse shells, malware signatures"
                  icon={<Shield className="w-5 h-5" />}
                />
                <div>
                  <GateCard
                    number={2}
                    name="Prompt Firewall"
                    description="Injection detection, context isolation, behavioral drift monitoring, encoding attack detection"
                    icon={<Eye className="w-5 h-5" />}
                  />
                  <div className="mt-3 p-3 bg-card border border-border rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Honest limitation:</span> Prompt injection can't be fully solved —
                        architecture designed so Gates 3-5 protect wallets independently.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground font-mono">
                  <span className="text-muted-foreground">&rarr;</span> Agent writes tx intent to <code className="text-white">~/.pistolshrimp/pending/</code>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {'{ program, method, params, amount, recipient, raw_instruction }'}
                </p>
              </div>
            </div>
          </FadeIn>

          {/* THE RED LINE */}
          <FadeIn delay={200}>
            <div className="relative py-4 my-0">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-4 border-dashed border-destructive" />
              </div>
              <div className="relative flex justify-center">
                <div className="px-6 py-2 bg-background border-2 border-destructive rounded-full">
                  <span className="text-destructive font-bold font-mono text-sm sm:text-base flex items-center gap-2">
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
            <div className="bg-card/50 border border-border rounded-b-xl p-6 sm:p-8 shadow-lg shadow-black/20">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-white" />
                <h3 className="text-lg font-semibold text-white font-mono">VALIDATION ZONE</h3>
                <span className="text-xs text-muted-foreground ml-2">(human/policy required)</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <GateCard
                  number={3}
                  name="Policy Engine"
                  description="Rate-limited queue, decodes raw Solana instructions via IDL, validates params not descriptions"
                  icon={<FileCode className="w-5 h-5" />}
                />
                <GateCard
                  number={4}
                  name="Human Confirm"
                  description="High-value txs require approval. Shows decoded instruction params, never agent description"
                  icon={<UserCheck className="w-5 h-5" />}
                />
                <GateCard
                  number={5}
                  name="Ephemeral Signer"
                  description="Per-transaction authority grant. Signing key access revoked immediately after use"
                  icon={<Key className="w-5 h-5" />}
                />
              </div>

              <div className="mt-6 p-4 bg-card/50 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground font-mono">
                  <span className="text-muted-foreground">&rarr;</span> Transaction signed and sent to Solana
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

function GateCard({ number, name, description, icon }: {
  number: number;
  name: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono font-bold text-muted-foreground">GATE {number}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <h4 className="text-white font-semibold mb-1">{name}</h4>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
}
