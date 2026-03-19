import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#1A1A1A] text-[#E5E5E5] border-[#333333]',
  gold:    'bg-[#C9A22718] text-[#C9A227] border-[#C9A22740]',
  success: 'bg-[#4CAF5018] text-[#4CAF50] border-[#4CAF5040]',
  warning: 'bg-[#E6A23C18] text-[#E6A23C] border-[#E6A23C40]',
  danger:  'bg-[#D6454518] text-[#D64545] border-[#D6454540]',
  info:    'bg-[#4D7EA818] text-[#4D7EA8] border-[#4D7EA840]',
  muted:   'bg-[#1A1A1A] text-[#737373] border-[#262626]',
  outline: 'bg-transparent text-[#A3A3A3] border-[#333333]',
};

const sizeClasses: Record<NonNullable<BadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 tracking-[0.04em]',
  md: 'text-[11px] px-2 py-0.5 tracking-[0.02em]',
};

export function Badge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[5px] border font-medium leading-tight whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Status badge (maps status strings to badge variants) ────────────────────

const STATUS_MAP: Record<string, BadgeProps['variant']> = {
  // Company/deal status
  target:           'muted',
  contacted:        'info',
  conversation:     'info',
  interested:       'gold',
  diligence:        'warning',
  under_loi:        'warning',
  under_contract:   'success',
  closed:           'success',
  lost:             'danger',
  archived:         'muted',
  active:           'success',
  stalled:          'warning',
  // Board candidates
  identified:       'muted',
  researched:       'info',
  outreach_sent:    'info',
  meeting_scheduled:'gold',
  negotiating:      'warning',
  confirmed:        'success',
  passed:           'danger',
  // Tasks
  open:             'muted',
  in_progress:      'info',
  in_progress_task: 'info',
  filled:           'success',
  todo:             'muted',
  blocked:          'danger',
  done:             'success',
  // Documents
  draft:            'muted',
  approved:         'gold',
  sent:             'info',
  signed:           'success',
  // Priority
  critical:         'danger',
  high:             'warning',
  medium:           'info',
  low:              'muted',
  // Pressure
  cooling:          'warning',
  // Integration
  connected:        'success',
  misconfigured:    'danger',
  degraded:         'warning',
};

export function StatusBadge({ status, size = 'md' }: { status: string; size?: BadgeProps['size'] }) {
  const label = status
    .replace(/_task$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant={STATUS_MAP[status] ?? 'default'} size={size}>
      {label}
    </Badge>
  );
}
