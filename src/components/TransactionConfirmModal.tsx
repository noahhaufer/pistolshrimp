import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Wallet,
  ArrowRight,
  FileCode,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { usePistolShrimp } from './PistolShrimpProvider';
import { TransactionIntent, GateResult, PolicyViolation } from '@/lib/pistolshrimp';

// ============================================================================
// Transaction Confirmation Modal
// ============================================================================

export function TransactionConfirmModal() {
  const { intentForConfirmation, confirmIntent, rejectIntent, setIntentForConfirmation } = usePistolShrimp();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!intentForConfirmation) return null;

  const intent = intentForConfirmation;
  const report = intent.securityReport;
  const riskScore = report?.riskScore || 0;

  const handleConfirm = async () => {
    setIsProcessing(true);
    setError(null);
    
    try {
      const result = await confirmIntent(intent.id);
      if (!result.success) {
        setError(result.error || 'Transaction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = () => {
    rejectIntent(intent.id, 'Rejected by user');
  };

  const handleClose = () => {
    setIntentForConfirmation(null);
  };

  return (
    <Dialog open={!!intentForConfirmation} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Transaction Confirmation Required</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Review the transaction details before signing
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Risk Score */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm text-muted-foreground">Security Risk Score</span>
            <RiskBadge score={riskScore} />
          </div>

          {/* Transaction Description */}
          <div className="p-4 rounded-lg bg-secondary/30 border border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Transaction</h4>
            <p className="text-foreground">{intent.description}</p>
          </div>

          {/* Transaction Details */}
          <div className="grid grid-cols-2 gap-4">
            <DetailCard
              icon={<FileCode className="w-4 h-4" />}
              label="Program"
              value={formatAddress(intent.program)}
            />
            <DetailCard
              icon={<Wallet className="w-4 h-4" />}
              label="Amount"
              value={intent.amount ? `${intent.amount} SOL` : 'N/A'}
            />
          </div>

          {intent.recipient && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/30 border border-border">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-sm">
                <span className="text-muted-foreground">To: </span>
                <span className="code-display">{formatAddress(intent.recipient)}</span>
              </span>
            </div>
          )}

          {/* Security Gates */}
          {report && report.gates.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Security Checks</h4>
              <ScrollArea className="h-[120px]">
                <div className="space-y-2">
                  {report.gates.map((gate, idx) => (
                    <GateResultCard key={idx} gate={gate} />
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Warnings */}
          {report?.gates.some(g => g.details?.violations) && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-warning">Warnings</p>
                  {report.gates.map((g) => {
                    const violations = g.details?.violations as PolicyViolation[] | undefined;
                    return violations?.filter(v => v.severity !== 'critical').map((v, i) => (
                      <p key={i} className="text-sm text-warning/80">{v.message}</p>
                    ));
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </div>

        <Separator className="bg-border" />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className="border-border text-foreground hover:bg-secondary"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="btn-security"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            {isProcessing ? 'Signing...' : 'Confirm & Sign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function RiskBadge({ score }: { score: number }) {
  let variant: 'safe' | 'warning' | 'danger' = 'safe';
  let label = 'Low Risk';

  if (score >= 70) {
    variant = 'danger';
    label = 'High Risk';
  } else if (score >= 30) {
    variant = 'warning';
    label = 'Medium Risk';
  }

  return (
    <div className={`status-badge status-${variant}`}>
      {variant === 'safe' && <CheckCircle className="w-3 h-3" />}
      {variant === 'warning' && <AlertTriangle className="w-3 h-3" />}
      {variant === 'danger' && <AlertCircle className="w-3 h-3" />}
      <span>{label} ({score})</span>
    </div>
  );
}

function DetailCard({ 
  icon, 
  label, 
  value 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-border">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

function GateResultCard({ gate }: { gate: GateResult }) {
  const getStatusIcon = () => {
    switch (gate.status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-success" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusClass = () => {
    switch (gate.status) {
      case 'pass':
        return 'border-success/30 bg-success/5';
      case 'fail':
        return 'border-destructive/30 bg-destructive/5';
      case 'pending':
        return 'border-warning/30 bg-warning/5';
      default:
        return 'border-border bg-secondary/20';
    }
  };

  return (
    <div className={`flex items-center justify-between p-2 rounded-lg border ${getStatusClass()}`}>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs bg-secondary/50">
          Gate {gate.gate}
        </Badge>
        <span className="text-sm">{gate.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {gate.message.substring(0, 40)}...
        </span>
        {getStatusIcon()}
      </div>
    </div>
  );
}

function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
