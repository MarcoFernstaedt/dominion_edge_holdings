'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { executionApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { AlertBanner, ExecutionProgressBar, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import { getAffirmationDisciplineState } from '@/lib/qlaAffirmations';
import { Activity, CalendarDays, TrendingUp, Users, Layers, Target, Zap, Settings2 } from 'lucide-react';
import type { ExecutionSummary } from '@/lib/types';

const NAV_TILES = [
  { href: '/execution/daily',          icon: CalendarDays, label: 'Daily',         description: 'Log and track daily outreach activity' },
  { href: '/execution/weekly',         icon: Activity,     label: 'Weekly',        description: 'Weekly owner and investor contacts' },
  { href: '/execution/monthly',        icon: TrendingUp,   label: 'Monthly',       description: 'Monthly LOIs, deals, and progress' },
  { href: '/execution/pipeline',       icon: Target,       label: 'Pipeline',      description: 'QLA acquisition funnel progress' },
  { href: '/execution/board',          icon: Users,        label: 'Board',         description: 'Board recruitment tracker' },
  { href: '/execution/investors',      icon: Layers,       label: 'Investors',     description: 'Investor pipeline tracker' },
  { href: '/execution/deal-momentum',  icon: Zap,          label: 'Deal Momentum', description: 'Active deal health and risk levels' },
];

export default function ExecutionPage() {
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const settings = useAppStore((s) => s.settings);
  const affirmations = useAppStore((s) => s.affirmations);
  const currentAffirmationIndex = useAppStore((s) => s.currentAffirmationIndex);
  const affirmationStatusByDate = useAppStore((s) => s.affirmationStatusByDate);

  const load = useCallback(async () => {
    try {
      const res = await executionApi.getSummary();
      setSummary(res as ExecutionSummary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const t  = summary?.targets;
  const td = summary?.today;
  const wk = summary?.week;
  const mo = summary?.month;
  const pl = summary?.pipeline;

  const operatorGaps = useMemo(() => {
    if (!summary?.targets) return [] as Array<{ label: string; actual: number; target: number; href: string }>;
    return [
      { label: 'Daily owner calls', actual: td?.ownersCalled ?? 0, target: t?.daily_owner_calls ?? 0, href: '/execution/daily' },
      { label: 'Weekly owner contacts', actual: wk?.ownersContacted ?? 0, target: t?.weekly_owner_contacts ?? 0, href: '/execution/weekly' },
      { label: 'Weekly investor calls', actual: wk?.investorConversations ?? 0, target: t?.weekly_investor_calls ?? 0, href: '/execution/investors' },
      { label: 'Monthly LOIs', actual: mo?.loisSent ?? 0, target: t?.monthly_lois ?? 0, href: '/execution/monthly' },
      { label: 'Pipeline companies', actual: pl?.totalCompanies ?? 0, target: t?.pipeline_companies ?? 0, href: '/execution/pipeline' },
    ]
      .map((item) => ({ ...item, gap: Math.max(0, item.target - item.actual) }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 3);
  }, [summary, td, wk, mo, pl, t]);

  const affirmationState = getAffirmationDisciplineState({
    affirmations,
    settings,
    currentIndex: currentAffirmationIndex,
    affirmationStatusByDate,
  });

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">QLA Execution Tracker</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Measure daily execution against QLA acquisition targets
        </p>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 mb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Affirmation posture</div>
                <p className="text-sm text-[var(--color-text-primary)]">{affirmationState.currentAffirmation?.text || 'No active affirmation stack configured.'}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{affirmationState.enforcementMessage}</p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ color: affirmationState.enforcementTone === 'critical' ? '#D64545' : affirmationState.enforcementTone === 'warning' ? '#E6A23C' : '#4CAF50' }}>
                  {affirmationState.enforcementLabel}
                </div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{affirmationState.completedBlocks}/2 complete · {affirmationState.streakDays} day streak</div>
              </div>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Operator Alignment</div>
            <p className="text-sm text-[var(--color-text-primary)]">
              Focus: {settings.qlaPrimaryIndustry || 'QLA acquisition'} · Goal: {settings.qlaPrimaryGoal || 'Close the first acquisition.'}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Wake {settings.operatorWakeTime || '05:00'} · Evening mode {settings.qlaEveningModeStartTime || '16:00'} · QLA block {settings.qlaWorkStartTime || '17:00'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/command-center" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
              <Zap className="w-4 h-4 text-[var(--color-accent)]" /> Command Center
            </Link>
            <Link href="/settings" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
              <Settings2 className="w-4 h-4 text-[var(--color-accent)]" /> Tune Targets
            </Link>
          </div>
        </div>
        {!loading && operatorGaps.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {operatorGaps.map((item) => (
              <Link key={item.label} href={item.href} className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 hover:border-[var(--color-accent)] transition-colors">
                <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Biggest gap</div>
                <div className="text-sm font-medium text-[var(--color-text-primary)] mt-1">{item.label}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">{item.actual} / {item.target} · gap {Math.max(0, item.target - item.actual)}</div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      {!loading && summary?.alerts && <AlertBanner alerts={summary.alerts} />}

      {/* Key metrics row */}
      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <ExecutionMetricCard label="Calls Today"         value={td?.ownersCalled ?? 0}       target={t?.daily_owner_calls}      />
            <ExecutionMetricCard label="Owners This Week"    value={wk?.ownersContacted ?? 0}    target={t?.weekly_owner_contacts}  />
            <ExecutionMetricCard label="Investor Calls / Wk" value={wk?.investorConversations ?? 0} target={t?.weekly_investor_calls} />
            <ExecutionMetricCard label="LOIs This Month"     value={mo?.loisSent ?? 0}           target={t?.monthly_lois}          />
            <ExecutionMetricCard label="Pipeline Companies"  value={pl?.totalCompanies ?? 0}     target={t?.pipeline_companies}    />
          </div>

          {/* QLA Pipeline Progress */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="font-medium text-[var(--color-text-primary)] mb-5">QLA Pipeline Progress</h2>
            <div className="space-y-4">
              <ExecutionProgressBar label="Companies identified"  actual={pl?.totalCompanies ?? 0}       target={t?.pipeline_companies ?? 500} />
              <ExecutionProgressBar label="Owners contacted"      actual={pl?.ownersContacted ?? 0}      target={t?.pipeline_owners_contacted ?? 200} />
              <ExecutionProgressBar label="Conversations"         actual={pl?.ownerConversations ?? 0}   target={t?.pipeline_conversations ?? 50} />
              <ExecutionProgressBar label="Opportunities"         actual={pl?.seriousOpportunities ?? 0} target={t?.pipeline_opportunities ?? 10} />
              <ExecutionProgressBar label="LOIs sent"             actual={pl?.loisSent ?? 0}             target={t?.pipeline_lois ?? 3} />
              <ExecutionProgressBar label="Deals closed"          actual={pl?.dealsClosed ?? 0}          target={t?.pipeline_closed ?? 1} />
            </div>
          </div>

          {/* Deal momentum snapshot */}
          {summary && summary.momentum.length > 0 && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-[var(--color-text-primary)]">Deal Momentum Snapshot</h2>
                <Link href="/execution/deal-momentum" className="text-sm text-[var(--color-accent)] hover:underline">
                  View all →
                </Link>
              </div>
              <div className="space-y-2">
                {summary.momentum.slice(0, 5).map((m) => {
                  const riskColors = {
                    stalled: 'border-l-red-500',
                    cooling: 'border-l-orange-400',
                    warming: 'border-l-[#C9A227]',
                    healthy: 'border-l-emerald-500',
                  };
                  return (
                    <div key={m.id} className={`flex items-center justify-between p-3 border-l-4 bg-[var(--color-bg)] rounded-r-lg ${riskColors[m.riskLevel]}`}>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{m.companyName}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">{m.daysSinceLastContact ?? '?'}d since contact · {m.stage}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{m.momentumScore}/100</p>
                        <p className="text-xs text-[var(--color-text-muted)] capitalize">{m.riskLevel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Navigation tiles */}
      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-3">Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NAV_TILES.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-accent)] transition-colors group"
            >
              <Icon className="w-4 h-4 text-[var(--color-accent)] mb-2" />
              <h3 className="font-medium text-sm text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">{label}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
