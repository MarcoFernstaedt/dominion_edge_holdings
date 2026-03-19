import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /** Width as Tailwind class or inline value */
  width?: string;
  height?: string;
}

/**
 * Skeleton — use for premium loading states.
 * Rule: no cheap spinners. Use skeletons for cards, tables, panels.
 */
export function Skeleton({ className, ...props }: SkeletonProps & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-[6px] shimmer bg-[#1A1A1A]', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

// ─── Preset skeleton layouts ──────────────────────────────────────────────────

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      {Array.from({ length: lines - 2 }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${60 + Math.random() * 30}%` }} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-[#262626]">
      <Skeleton className="h-4 w-4 rounded-full flex-shrink-0" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
