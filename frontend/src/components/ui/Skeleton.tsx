import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Skeleton — premium loading states. No spinners.
 * Use for cards, tables, panels, and full-page loads.
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

// ─── KPI / metric card skeleton ───────────────────────────────────────────────

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-16" />
      {Array.from({ length: Math.max(0, lines - 2) }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${60 + (i % 3) * 12}%` }} />
      ))}
    </div>
  );
}

// ─── Table row skeleton ───────────────────────────────────────────────────────

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

// ─── Metric grid skeleton ─────────────────────────────────────────────────────

export function SkeletonMetricGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}

// ─── Page header skeleton ─────────────────────────────────────────────────────

export function SkeletonPageHeader() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-2 w-32" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-3 w-72" />
    </div>
  );
}

// ─── List / candidate row skeleton ───────────────────────────────────────────

export function SkeletonListRow() {
  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-64" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-1.5 flex-1 rounded-full" />
        <Skeleton className="h-3 w-6" />
      </div>
    </div>
  );
}

// ─── Section with header + list skeleton ─────────────────────────────────────

export function SkeletonSection({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-28" />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonListRow key={i} />
      ))}
    </div>
  );
}

// ─── Full radar / sourcing page skeleton ─────────────────────────────────────

export function SkeletonRadarPage() {
  return (
    <div className="page-container space-y-8" aria-busy="true" aria-label="Loading sourcing radar">
      <SkeletonPageHeader />

      {/* Source health */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="bg-[#111111] border border-[#262626] rounded-[10px] p-3 flex items-center gap-3">
            <Skeleton className="w-2 h-2 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-48" />
            </div>
            <Skeleton className="h-7 w-14 rounded-[8px]" />
          </div>
        ))}
      </div>

      {/* Last scan */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-6 w-8 mx-auto" />
                <Skeleton className="h-2.5 w-16 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Candidate list */}
      <SkeletonSection rows={4} />
    </div>
  );
}

// ─── Full list/table page skeleton ───────────────────────────────────────────

export function SkeletonTablePage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="page-container space-y-5" aria-busy="true" aria-label="Loading">
      <SkeletonPageHeader />
      <div className="bg-[#111111] border border-[#262626] rounded-[10px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#262626] flex gap-4">
          {[32, 20, 16].map((w, i) => <Skeleton key={i} className="h-2.5" style={{ width: `${w}%` }} />)}
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="px-4 py-3.5 border-b border-[#262626] last:border-0 flex gap-4 items-center">
            <Skeleton className="h-3" style={{ width: '32%' }} />
            <Skeleton className="h-3" style={{ width: '18%' }} />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 ml-auto" style={{ width: '12%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
