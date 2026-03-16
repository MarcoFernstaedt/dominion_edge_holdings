'use client';

import { useEffect, useState, useCallback } from 'react';
import { executionApi } from '@/lib/api';
import { ExecutionProgressBar, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import type { BoardRecruitmentStat, QlaTargets } from '@/lib/types';
import Link from 'next/link';

export default function BoardPage() {
  const [board,   setBoard]   = useState<BoardRecruitmentStat | null>(null);
  const [targets, setTargets] = useState<QlaTargets | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getBoard();
      const { board: b, targets: t } = res as { board: BoardRecruitmentStat; targets: QlaTargets };
      setBoard(b);
      setTargets(t);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const targetMin = targets?.board_target_min ?? 5;
  const targetMax = targets?.board_target_max ?? 7;
  const secured   = board?.boardMembersSecured ?? 0;
  const pct       = Math.round((secured / targetMin) * 100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Board Recruitment</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Target: {targetMin}–{targetMax} board members
          </p>
        </div>
        <Link href="/board" className="text-sm text-[var(--color-accent)] hover:underline">
          Open Board Builder →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ExecutionMetricCard label="Candidates Identified" value={board?.candidatesIdentified ?? 0} />
            <ExecutionMetricCard label="Candidates Contacted"  value={board?.candidatesContacted ?? 0}  />
            <ExecutionMetricCard label="Calls Scheduled"       value={board?.callsScheduled ?? 0}       />
            <ExecutionMetricCard label="Members Secured"       value={secured} target={targetMin}        accent={secured >= targetMin} />
          </div>

          {/* Progress bars */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            <h2 className="font-medium text-[var(--color-text-primary)]">Recruitment Funnel</h2>
            <ExecutionProgressBar label="Candidates identified" actual={board?.candidatesIdentified ?? 0} target={20} />
            <ExecutionProgressBar label="Candidates contacted"  actual={board?.candidatesContacted ?? 0}  target={15} />
            <ExecutionProgressBar label="Calls scheduled"       actual={board?.callsScheduled ?? 0}       target={10} />
            <ExecutionProgressBar label="Members secured"       actual={secured}                           target={targetMin} />
          </div>

          {/* Board completion widget */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-medium text-[var(--color-text-primary)] mb-4">Board Completion</h2>
            <div className="flex items-center gap-6">
              {/* Ring */}
              <div className="relative w-24 h-24 shrink-0">
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="var(--color-bg)" strokeWidth="8" />
                  <circle
                    cx="48" cy="48" r="40"
                    fill="none"
                    stroke={secured >= targetMin ? '#3FA66B' : '#4D7EA8'}
                    strokeWidth="8"
                    strokeDasharray={`${Math.min(pct, 100) * 2.51} 251`}
                    strokeLinecap="round"
                    transform="rotate(-90 48 48)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-[var(--color-text-primary)]">{secured}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">/ {targetMin}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-[var(--color-text-muted)]">
                  {secured >= targetMin
                    ? `✓ Board complete — ${secured} members secured`
                    : `${targetMin - secured} more member${targetMin - secured !== 1 ? 's' : ''} needed to reach minimum`}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">Full board target: {targetMax} members</p>
                <div className="flex gap-2 pt-1">
                  {Array.from({ length: targetMax }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full border-2 ${i < secured ? 'bg-[var(--color-accent)] border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
