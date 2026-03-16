import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  gold?: boolean;
  as?: 'div' | 'article' | 'section';
}

export function Card({ children, className, gold, as: Tag = 'div' }: CardProps) {
  return (
    <Tag
      className={cn(
        'rounded-md border bg-[#141414]',
        gold ? 'border-[#D4AF3740]' : 'border-[#2A2A2E]',
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 pt-5 pb-3', className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('px-5 pb-5', className)}>
      {children}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function MetricCard({ label, value, sub, className }: MetricCardProps) {
  return (
    <Card className={cn('p-5', className)}>
      <div className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-2">
        {label}
      </div>
      <div className="text-3xl font-bold text-[#D4AF37] leading-none mb-1 font-serif">
        {value}
      </div>
      {sub && (
        <div className="text-xs text-[#A7A29A] mt-1">{sub}</div>
      )}
    </Card>
  );
}
