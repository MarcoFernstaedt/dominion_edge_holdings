import { cn } from '@/lib/utils';
import { AlertTriangle, XCircle, Info, CheckCircle2, X } from 'lucide-react';
import { useState } from 'react';

type AlertSeverity = 'danger' | 'warning' | 'info' | 'success';

interface AlertStripProps {
  severity: AlertSeverity;
  message: string;
  /** Short action label, e.g. "Review" or "Fix Now" */
  action?: string;
  onAction?: () => void;
  /** Allow user to dismiss */
  dismissible?: boolean;
  className?: string;
}

const severityConfig: Record<AlertSeverity, {
  bg: string;
  border: string;
  text: string;
  iconColor: string;
  Icon: typeof AlertTriangle;
}> = {
  danger: {
    bg:        'bg-[#D6454510]',
    border:    'border-[#D6454530]',
    text:      'text-[#D64545]',
    iconColor: 'text-[#D64545]',
    Icon:      XCircle,
  },
  warning: {
    bg:        'bg-[#E6A23C10]',
    border:    'border-[#E6A23C30]',
    text:      'text-[#E6A23C]',
    iconColor: 'text-[#E6A23C]',
    Icon:      AlertTriangle,
  },
  info: {
    bg:        'bg-[#4D7EA810]',
    border:    'border-[#4D7EA830]',
    text:      'text-[#4D7EA8]',
    iconColor: 'text-[#4D7EA8]',
    Icon:      Info,
  },
  success: {
    bg:        'bg-[#4CAF5010]',
    border:    'border-[#4CAF5030]',
    text:      'text-[#4CAF50]',
    iconColor: 'text-[#4CAF50]',
    Icon:      CheckCircle2,
  },
};

/**
 * AlertStrip — used for bottlenecks, risk warnings, integration degradation,
 * stale AI output, fatal deal issues, diligence blockers.
 *
 * Rule: do not spam alerts. Only meaningful alerts.
 */
export function AlertStrip({
  severity,
  message,
  action,
  onAction,
  dismissible = false,
  className,
}: AlertStripProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const cfg = severityConfig[severity];
  const { Icon } = cfg;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-[8px] border text-sm',
        cfg.bg,
        cfg.border,
        className
      )}
    >
      <Icon size={14} className={cn('flex-shrink-0', cfg.iconColor)} aria-hidden />
      <span className={cn('flex-1 min-w-0', cfg.text)}>{message}</span>
      {action && onAction && (
        <button
          onClick={onAction}
          className={cn(
            'flex-shrink-0 text-xs font-medium underline underline-offset-2 hover:no-underline transition-colors',
            cfg.text
          )}
        >
          {action}
        </button>
      )}
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          className="flex-shrink-0 text-[#737373] hover:text-[#A3A3A3] transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}

// ─── Alert stack (multiple alerts) ───────────────────────────────────────────

interface AlertItem {
  id: string;
  severity: AlertSeverity;
  message: string;
  action?: string;
  onAction?: () => void;
}

export function AlertStack({ alerts, className }: { alerts: AlertItem[]; className?: string }) {
  if (alerts.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {alerts.map((alert) => (
        <AlertStrip
          key={alert.id}
          severity={alert.severity}
          message={alert.message}
          action={alert.action}
          onAction={alert.onAction}
          dismissible
        />
      ))}
    </div>
  );
}
