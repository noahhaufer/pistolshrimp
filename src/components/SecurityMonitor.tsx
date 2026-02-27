import React, { useState } from 'react';
import { 
  Shield, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Zap,
  Lock,
  Eye,
  ChevronDown,
  ChevronUp,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { usePistolShrimp, useSecurityMonitor } from './PistolShrimpProvider';
import { SecurityLogEntry, TransactionIntent } from '@/lib/pistolshrimp';

// ============================================================================
// Main Security Monitor Component
// ============================================================================

export function SecurityMonitor() {
  const { logs, dailySpend, remainingLimit, pendingIntentsCount, isActive } = useSecurityMonitor();
  const { pendingIntents, getConfig } = usePistolShrimp();
  const config = getConfig();

  const dailyLimitUsedPercent = (dailySpend / config.policy.dailyLimitSol) * 100;

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <Card className="security-card-glow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Pistol Shrimp</h3>
                <p className="text-sm text-muted-foreground">Security Layer Active</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`gate-indicator ${isActive ? 'gate-pass' : 'gate-fail'}`} />
              <span className="text-sm text-muted-foreground">
                {isActive ? 'Protected' : 'Inactive'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Wallet className="w-4 h-4" />}
          label="Daily Spend"
          value={`${dailySpend.toFixed(4)} SOL`}
          subvalue={`of ${config.policy.dailyLimitSol} SOL`}
          color="primary"
        />
        <StatCard
          icon={<Lock className="w-4 h-4" />}
          label="Remaining"
          value={`${remainingLimit.toFixed(4)} SOL`}
          color="success"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Pending"
          value={pendingIntentsCount.toString()}
          subvalue="intents"
          color={pendingIntentsCount > 0 ? 'warning' : 'muted'}
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Events"
          value={logs.length.toString()}
          subvalue="logged"
          color="muted"
        />
      </div>

      {/* Daily Limit Progress */}
      <Card className="security-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Daily Limit Usage</span>
            <span className="text-sm font-medium">{dailyLimitUsedPercent.toFixed(1)}%</span>
          </div>
          <Progress 
            value={dailyLimitUsedPercent} 
            className="h-2 bg-secondary"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Auto-sign threshold: {config.policy.autoSignThresholdSol} SOL
          </p>
        </CardContent>
      </Card>

      {/* Security Gates Status */}
      <Card className="security-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Security Gates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <GateStatus 
            number={1} 
            name="Skill Quarantine" 
            description="Malware & threat detection"
            enabled={config.enableGate1}
          />
          <GateStatus 
            number={2} 
            name="Prompt Firewall" 
            description="Injection prevention"
            enabled={config.enableGate2}
          />
          <GateStatus 
            number={3} 
            name="Policy Engine" 
            description="Transaction validation"
            enabled={config.enableGate3}
          />
        </CardContent>
      </Card>

      {/* Pending Intents */}
      {pendingIntents.length > 0 && (
        <Card className="security-card border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Pending Intents ({pendingIntents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[150px]">
              <div className="space-y-2">
                {pendingIntents.map((intent) => (
                  <IntentCard key={intent.id} intent={intent} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      <Card className="security-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Eye className="w-4 h-4 text-muted-foreground" />
            Security Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <div className="space-y-1">
              {logs.slice(0, 20).map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No security events logged yet
                </p>
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 transition-colors"
      >
        <div className={`gate-indicator ${isActive ? 'gate-pass' : 'gate-fail'}`} />
        <Shield className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Protected</span>
        {pendingIntentsCount > 0 && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
            {pendingIntentsCount}
          </Badge>
        )}
        {expanded ? (
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        )}
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
// Helper Components
// ============================================================================

function StatCard({
  icon,
  label,
  value,
  subvalue,
  color = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subvalue?: string;
  color?: 'primary' | 'success' | 'warning' | 'muted';
}) {
  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    muted: 'text-muted-foreground',
  };

  return (
    <Card className="security-card">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <p className={`text-lg font-semibold ${colorClasses[color]}`}>{value}</p>
        {subvalue && (
          <p className="text-xs text-muted-foreground">{subvalue}</p>
        )}
      </CardContent>
    </Card>
  );
}

function GateStatus({
  number,
  name,
  description,
  enabled,
}: {
  number: number;
  name: string;
  description: string;
  enabled: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2 rounded-lg ${enabled ? 'bg-success/5 border border-success/20' : 'bg-secondary/30 border border-border'}`}>
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={`text-xs ${enabled ? 'bg-success/10 text-success border-success/30' : 'bg-secondary text-muted-foreground'}`}
        >
          {number}
        </Badge>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {enabled ? (
        <CheckCircle className="w-4 h-4 text-success" />
      ) : (
        <XCircle className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

function IntentCard({ intent }: { intent: TransactionIntent }) {
  const statusColors = {
    pending: 'warning',
    requires_confirmation: 'warning',
    approved: 'success',
    rejected: 'destructive',
    executed: 'success',
    expired: 'muted',
  } as const;

  const status = intent.status as keyof typeof statusColors;
  const color = statusColors[status] || 'muted';

  return (
    <div className="intent-item p-2">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{intent.description}</p>
          <p className="text-xs text-muted-foreground">
            {intent.amount ? `${intent.amount} SOL` : 'N/A'} • {formatTimeAgo(intent.createdAt)}
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={`status-badge status-${color === 'destructive' ? 'danger' : color === 'success' ? 'safe' : 'warning'} text-xs`}
        >
          {intent.status}
        </Badge>
      </div>
    </div>
  );
}

function LogEntry({ log }: { log: SecurityLogEntry }) {
  const levelIcons = {
    debug: <Activity className="w-3 h-3 text-muted-foreground" />,
    info: <CheckCircle className="w-3 h-3 text-primary" />,
    warn: <AlertTriangle className="w-3 h-3 text-warning" />,
    error: <XCircle className="w-3 h-3 text-destructive" />,
  };

  return (
    <div className="flex items-start gap-2 py-1 px-2 rounded hover:bg-secondary/30 transition-colors">
      {levelIcons[log.level]}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground truncate">{log.message}</p>
        <p className="text-xs text-muted-foreground">
          {log.gate && `Gate ${log.gate} • `}
          {formatTimeAgo(log.timestamp)}
        </p>
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
