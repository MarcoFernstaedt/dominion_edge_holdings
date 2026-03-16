'use client';

import { useEffect, useState, useCallback } from 'react';
import { executionApi } from '@/lib/api';
import { ExecutionProgressBar, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import type { InvestorPipelineStat, QlaTargets } from '@/lib/types';
import Link from 'next/link';

export default function InvestorsPipelinePage() {
  const [investors, setInvestors] = useState<InvestorPipelineStat | null>(null);
  const [targets,   setTargets]   = useState<QlaTargets | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getInvestors();
      const { investors: i, targets: t } = res as { investors: InvestorPipelineStat; targets: QlaTargets };
      setInvestors(i);
      setTargets(t);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const minTarget = targets?.investor_identified_min ?? 50;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Investor Pipeline</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Target: {minTarget}+ investors identified
          </p>
        </div>
        <Link href="/capital-raising/investors" className="text-sm text-[var(--color-accent)] hover:underline">
          Open Investor CRM →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <ExecutionMetricCard label="Identified"     value={investors?.investorsIdentified ?? 0} target={minTarget} />
            <ExecutionMetricCard label="Contacted"      value={investors?.investorsContacted ?? 0}  />
            <ExecutionMetricCard label="Meetings"       value={investors?.investorMeetings ?? 0}    />
            <ExecutionMetricCard label="Soft Commits"   value={investors?.softCommitments ?? 0}     />
            <ExecutionMetricCard label="Hard Commits"   value={investors?.hardCommitments ?? 0}     accent={!!investors?.hardCommitments} />
          </div>

          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            <h2 className="font-medium text-[var(--color-text-primary)]">Investor Funnel</h2>
            <ExecutionProgressBar label="Investors identified"   actual={investors?.investorsIdentified ?? 0} target={minTarget} />
            <ExecutionProgressBar label="Investors contacted"    actual={investors?.investorsContacted ?? 0}  target={Math.round(minTarget * 0.6)} />
            <ExecutionProgressBar label="Investor meetings held" actual={investors?.investorMeetings ?? 0}    target={Math.round(minTarget * 0.3)} />
            <ExecutionProgressBar label="Soft commitments"       actual={investors?.softCommitments ?? 0}     target={5} />
            <ExecutionProgressBar label="Hard commitments"       actual={investors?.hardCommitments ?? 0}     target={3} />
          </div>

          {/* QLA reference */}
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-3">QLA Investor Targets</h2>
            <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
              <li>• Minimum 50 investors identified in the pipeline</li>
              <li>• Weekly investor calls: {targets?.weekly_investor_calls ?? 3} per week</li>
              <li>• Build relationships before the deal — not during</li>
              <li>• Target angel investors, family offices, and search fund investors first</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
