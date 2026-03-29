'use client';

import { useEffect, useState, useCallback } from 'react';
import { executionApi } from '@/lib/api';
import { RiskBadge, MomentumScoreRing } from '@/components/execution/ExecutionComponents';
import type { DealMomentumStat, MomentumRiskLevel } from '@/lib/types';

const STAGE_LABELS: Record<string, string> = {
  identified:       'Identified',
  contacted:        'Contacted',
  discovery:        'Discovery',
  financial_review: 'Financial Review',
  loi_discussion:   'LOI Discussion',
  loi_signed:       'LOI Signed',
  due_diligence:    'Due Diligence',
  financing:        'Financing',
  closing:          'Closing',
};

const RISK_ORDER: Record<MomentumRiskLevel, number> = {
  stalled: 0, cooling: 1, warming: 2, healthy: 3,
};

const RISK_BORDER: Record<MomentumRiskLevel, string> = {
  stalled: 'border-l-red-500',
  cooling: 'border-l-orange-400',
  warming: 'border-l-[#C9A227]',
  healthy: 'border-l-emerald-500',
};

function dayLabel(d: number | null) {
  if (d === null || d === undefined) return '—';
  if (d === 0) return 'Today';
  if (d === 1) return '1 day ago';
  return `${d}d ago`;
}

export default function DealMomentumPage() {
  const [momentum, setMomentum] = useState<DealMomentumStat[]>([]);
  const [filter,   setFilter]   = useState<MomentumRiskLevel | 'all'>('all');
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getDealMomentum();
      setMomentum((res as { momentum: DealMomentumStat[] }).momentum || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all'
    ? momentum
    : momentum.filter((m) => m.riskLevel === filter);

  const counts = {
    stalled: momentum.filter((m) => m.riskLevel === 'stalled').length,
    cooling: momentum.filter((m) => m.riskLevel === 'cooling').length,
    warming: momentum.filter((m) => m.riskLevel === 'warming').length,
    healthy: momentum.filter((m) => m.riskLevel === 'healthy').length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Deal Momentum</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Active deal health ranked by momentum score — stalled deals first
        </p>
      </div>

      {/* Risk summary tiles */}
      <div className="grid grid-cols-4 gap-3">
        {(['stalled', 'cooling', 'warming', 'healthy'] as const).map((level) => {
          const colors = {
            stalled: 'border-red-800/50 text-red-400',
            cooling: 'border-orange-800/50 text-orange-400',
            warming: 'border-[#C9A22750] text-[#C9A227]',
            healthy: 'border-emerald-800/50 text-emerald-400',
          };
          return (
            <button
              key={level}
              onClick={() => setFilter(filter === level ? 'all' : level)}
              className={`bg-[var(--color-surface)] border rounded-xl p-4 text-center transition-colors ${
                filter === level ? `border-current ${colors[level]}` : 'border-[var(--color-border)]'
              }`}
            >
              <p className={`text-2xl font-bold ${colors[level]}`}>{counts[level]}</p>
              <p className="text-xs text-[var(--color-text-muted)] capitalize mt-1">{level}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--color-text-muted)]">
            {momentum.length === 0
              ? 'No active deals in the pipeline yet.'
              : `No ${filter} deals.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className={`bg-[var(--color-surface)] border-l-4 border border-[var(--color-border)] rounded-r-xl p-4 ${RISK_BORDER[m.riskLevel]}`}
            >
              <div className="flex items-start gap-4">
                {/* Score ring */}
                <MomentumScoreRing score={m.momentumScore} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-medium text-[var(--color-text-primary)]">{m.companyName}</h3>
                    <RiskBadge level={m.riskLevel} />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {STAGE_LABELS[m.stage] || m.stage}
                    </span>
                  </div>
                  <p className="text-sm text-[#C9A227]/90 mt-1">
                    → {m.nextActionRequired}
                  </p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                    <span>Last contact: <strong className="text-[var(--color-text-secondary)]">{dayLabel(m.daysSinceLastContact)}</strong></span>
                    <span>Last meeting: <strong className="text-[var(--color-text-secondary)]">{dayLabel(m.daysSinceLastMeeting)}</strong></span>
                    <span>Interactions: <strong className="text-[var(--color-text-secondary)]">{m.interactionCount}</strong></span>
                  </div>
                </div>

                {/* Score label */}
                <div className="text-right shrink-0">
                  <p className="text-xs text-[var(--color-text-muted)]">Score</p>
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{m.momentumScore}<span className="text-xs font-normal text-[var(--color-text-muted)]">/100</span></p>
                </div>
              </div>

              {/* Days since contact visual */}
              {m.daysSinceLastContact !== null && (
                <div className="mt-3">
                  <div className="h-1 bg-[var(--color-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((m.daysSinceLastContact / 30) * 100, 100)}%`,
                        backgroundColor:
                          m.riskLevel === 'stalled' ? '#C35B5B' :
                          m.riskLevel === 'cooling' ? '#D97B4D' :
                          m.riskLevel === 'warming' ? '#D9A441' : '#3FA66B',
                      }}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{m.daysSinceLastContact}d since last contact</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-4">
        <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Risk Level Rules</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div><dt className="text-emerald-400 font-medium">Healthy</dt><dd className="text-[var(--color-text-muted)]">0–7 days since contact</dd></div>
          <div><dt className="text-[#C9A227] font-medium">Warming</dt><dd className="text-[var(--color-text-muted)]">7–14 days since contact</dd></div>
          <div><dt className="text-orange-400 font-medium">Cooling</dt><dd className="text-[var(--color-text-muted)]">14–30 days since contact</dd></div>
          <div><dt className="text-red-400 font-medium">Stalled</dt><dd className="text-[var(--color-text-muted)]">30+ days since contact</dd></div>
        </dl>
      </div>
    </div>
  );
}
