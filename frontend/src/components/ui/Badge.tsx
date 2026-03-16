import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

const variantClasses = {
  default: 'bg-[#2A2A2E] text-[#E8E6E3] border-[#3A3A3E]',
  gold: 'bg-[#D4AF3720] text-[#D4AF37] border-[#D4AF3740]',
  success: 'bg-[#3FA66B20] text-[#3FA66B] border-[#3FA66B40]',
  warning: 'bg-[#D9A44120] text-[#D9A441] border-[#D9A44140]',
  danger: 'bg-[#C35B5B20] text-[#C35B5B] border-[#C35B5B40]',
  info: 'bg-[#4D7EA820] text-[#4D7EA8] border-[#4D7EA840]',
  muted: 'bg-[#1B1B1D] text-[#A7A29A] border-[#2A2A2E]',
  outline: 'bg-transparent text-[#A7A29A] border-[#2A2A2E]',
};

const sizeClasses = {
  sm: 'text-[10px] px-1.5 py-0.5',
  md: 'text-xs px-2 py-0.5',
};

export function Badge({ variant = 'default', size = 'md', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border font-medium leading-tight',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, BadgeProps['variant']> = {
    target: 'muted',
    contacted: 'info',
    conversation: 'info',
    interested: 'gold',
    diligence: 'warning',
    under_loi: 'warning',
    under_contract: 'success',
    closed: 'success',
    lost: 'danger',
    archived: 'muted',
    active: 'success',
    stalled: 'warning',
    identified: 'muted',
    researched: 'info',
    outreach_sent: 'info',
    meeting_scheduled: 'gold',
    negotiating: 'warning',
    confirmed: 'success',
    passed: 'danger',
    open: 'muted',
    in_progress: 'info',
    filled: 'success',
    todo: 'muted',
    in_progress_task: 'info',
    blocked: 'danger',
    done: 'success',
    draft: 'muted',
    approved: 'gold',
    sent: 'info',
    signed: 'success',
    critical: 'danger',
    high: 'warning',
    medium: 'info',
    low: 'muted',
  };

  const label = status
    .replace(/_task$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return <Badge variant={map[status] ?? 'default'}>{label}</Badge>;
}
