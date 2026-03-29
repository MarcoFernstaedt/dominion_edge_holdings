import { cn } from '@/lib/utils';

// ─── Card variants ────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'elevated' | 'gold' | 'warning' | 'danger' | 'success' | 'selected';

const variantClasses: Record<CardVariant, string> = {
  default:  'bg-[#111111] border border-[#262626]',
  elevated: 'bg-[#1A1A1A] border border-[#333333]',
  gold:     'bg-[#111111] border border-[#C9A22740]',
  warning:  'bg-[#111111] border border-[#E6A23C30]',
  danger:   'bg-[#111111] border border-[#D6454530]',
  success:  'bg-[#111111] border border-[#4CAF5030]',
  selected: 'bg-[#111111] border border-[#C9A227] ring-1 ring-[#C9A22720]',
};

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: CardVariant;
  /** @deprecated use variant="gold" */
  gold?: boolean;
  as?: 'div' | 'article' | 'section';
  onClick?: () => void;
  role?: string;
  tabIndex?: number;
  'aria-label'?: string;
}

export function Card({
  children,
  className,
  variant = 'default',
  gold,
  as: Tag = 'div',
  ...rest
}: CardProps) {
  const resolvedVariant = gold ? 'gold' : variant;

  return (
    <Tag
      className={cn(
        'rounded-[10px]',
        variantClasses[resolvedVariant],
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 pt-5 pb-3', className)}>
      {children}
    </div>
  );
}

export function CardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-5 pb-5', className)}>
      {children}
    </div>
  );
}

export function CardDivider() {
  return <div className="h-px bg-[#262626]" />;
}

// ─── Metric / Stat card ───────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  /** Highlight value in gold (default) or use status color */
  valueColor?: 'gold' | 'danger' | 'warning' | 'success' | 'default';
  className?: string;
}

const valueColorClasses: Record<NonNullable<MetricCardProps['valueColor']>, string> = {
  gold:    'text-[#C9A227]',
  danger:  'text-[#D64545]',
  warning: 'text-[#E6A23C]',
  success: 'text-[#4CAF50]',
  default: 'text-[#E5E5E5]',
};

export function MetricCard({ label, value, sub, valueColor = 'gold', className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#737373] mb-2">
        {label}
      </div>
      <div className={cn('text-3xl leading-none mb-1 font-serif font-semibold', valueColorClasses[valueColor])}>
        {value}
      </div>
      {sub && (
        <div className="text-xs text-[#737373] mt-1">{sub}</div>
      )}
    </Card>
  );
}

// ─── Stat card (compact) ──────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  valueColor?: MetricCardProps['valueColor'];
  className?: string;
}

export function StatCard({ label, value, sub, valueColor = 'gold', className }: StatCardProps) {
  return (
    <div className={cn('bg-[#111111] border border-[#262626] rounded-[10px] p-4', className)}>
      <div className="text-[10px] font-medium tracking-[0.1em] uppercase text-[#737373] mb-1.5 leading-tight">
        {label}
      </div>
      <div className={cn('text-2xl leading-none font-serif font-semibold', valueColorClasses[valueColor])}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] text-[#737373] mt-1">{sub}</div>
      )}
    </div>
  );
}
