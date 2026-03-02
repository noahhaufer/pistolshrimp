import React, { useState } from 'react';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePistolShrimp, useSecurityMonitor } from './PistolShrimpProvider';
import { SecurityLogEntry, TransactionIntent } from '@/lib/pistolshrimp';

// ============================================================================
// Main Security Monitor
// ============================================================================

export function SecurityMonitor() {
  const { logs, dailySpend, remainingLimit, pendingIntentsCount, isActive } = useSecurityMonitor();
  const { pendingIntents, getConfig } = usePistolShrimp();
  const config = getConfig();
  const dailyPct = (dailySpend / config.policy.dailyLimitSol) * 100;

  return (
    <div className="space-y-3">
      {/* Status */}
      <Card className={isActive ? 'border-foreground/10' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo-transparent.png" alt="" className="w-6 h-6 object-contain opacity-60" />
              <div>
                <p className="text-sm font-medium text-white">Pistol Shrimp</p>
                <p className="text-[10px] text-muted-foreground">Security Monitor</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-foreground/50' : 'bg-destructive'}`} />
              <span className="text-[10px] text-muted-foreground">{isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Daily Spend" value={`${dailySpend.toFixed(3)} SOL`} sub={`of ${config.policy.dailyLimitSol}`} />
        <Stat label="Remaining" value={`${remainingLimit.toFixed(3)} SOL`} />
        <Stat label="Pending" value={pendingIntentsCount.toString()} sub="intents" />
        <Stat label="Events" value={logs.length.toString()} sub="logged" />
      </div>

      {/* Limit Bar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">Daily Limit</span>
            <span className="text-[10px] font-mono text-muted-foreground">{dailyPct.toFixed(0)}%</span>
          </div>
          <Progress value={dailyPct} className="h-1.5 bg-secondary" />
        </CardContent>
      </Card>

      {/* Gates */}
      <Card>
        <CardHeader className="pb-2 p-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-muted-foreground" /> Gates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3 pt-0">
          <Gate num={1} name="Skill Scanner" enabled={config.enableGate1} />
          <Gate num={2} name="Prompt Firewall" enabled={config.enableGate2} />
          <Gate num={3} name="Policy Engine" enabled={config.enableGate3} />
        </CardContent>
      </Card>

      {/* Pending */}
      {pendingIntents.length > 0 && (
        <Card>
          <CardHeader className="pb-2 p-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" /> Pending ({pendingIntents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <ScrollArea className="h-[120px]">
              <div className="space-y-1.5">
                {pendingIntents.map((intent) => <IntentRow key={intent.id} intent={intent} />)}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Log */}
      <Card>
        <CardHeader className="pb-2 p-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Eye className="w-3 h-3 text-muted-foreground" /> Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <ScrollArea className="h-[180px]">
            <div className="space-y-0.5">
              {logs.slice(0, 20).map((log) => <LogRow key={log.id} log={log} />)}
              {logs.length === 0 && (
                <div className="text-center py-8">
                  <Shield className="w-5 h-5 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/50">Run a demo to see events</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Compact Security Badge
// ============================================================================

export function SecurityBadge() {
  const { isActive, pendingIntentsCount } = useSecurityMonitor();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-border hover:border-foreground/20 transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-foreground/50' : 'bg-destructive'}`} />
        <span className="text-sm font-medium text-foreground">Protected</span>
        {pendingIntentsCount > 0 && (
          <Badge variant="outline" className="text-xs">{pendingIntentsCount}</Badge>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="absolute top-full right-0 mt-2 w-80 z-50">
          <SecurityMonitor />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-semibold text-white">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground/50">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Gate({ num, name, enabled }: { num: number; name: string; enabled: boolean }) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${enabled ? 'bg-secondary' : 'bg-background'} border border-border`}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground w-4">{num}</span>
        <span className="text-xs text-foreground">{name}</span>
      </div>
      {enabled ? <CheckCircle className="w-3 h-3 text-muted-foreground" /> : <XCircle className="w-3 h-3 text-muted-foreground/30" />}
    </div>
  );
}

function IntentRow({ intent }: { intent: TransactionIntent }) {
  const isRejected = intent.status === 'rejected';
  return (
    <div className="p-2 rounded bg-secondary border border-border">
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground truncate flex-1 mr-2">{intent.description}</p>
        <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${isRejected ? 'bg-destructive/12 text-red-400 border border-destructive/20' : 'text-muted-foreground'}`}>{intent.status}</span>
      </div>
      <p className="text-[10px] text-muted-foreground/50">
        {intent.amount ? `${intent.amount} SOL` : ''} {timeAgo(intent.createdAt)}
      </p>
    </div>
  );
}

function LogRow({ log }: { log: SecurityLogEntry }) {
  const icons = {
    debug: <Activity className="w-2.5 h-2.5 text-muted-foreground/40" />,
    info: <CheckCircle className="w-2.5 h-2.5 text-muted-foreground" />,
    warn: <AlertTriangle className="w-2.5 h-2.5 text-red-400/70" />,
    error: <XCircle className="w-2.5 h-2.5 text-destructive" />,
  };

  return (
    <div className={`flex items-start gap-1.5 py-1 px-1.5 rounded hover:bg-secondary/50 transition-colors ${log.level === 'error' ? 'bg-destructive/5' : ''}`}>
      <div className="mt-0.5">{icons[log.level]}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] truncate ${log.level === 'error' ? 'text-red-400' : 'text-foreground'}`}>{log.message}</p>
        <p className="text-[10px] text-muted-foreground/40">
          {log.gate ? <span className="text-red-400/40">G{log.gate}</span> : ''}{log.gate ? ' · ' : ''}{timeAgo(log.timestamp)}
        </p>
      </div>
    </div>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
