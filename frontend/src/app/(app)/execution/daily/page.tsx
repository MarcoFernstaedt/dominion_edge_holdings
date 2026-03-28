'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { executionApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExecutionProgressBar, ExecutionMetricCard, AlertBanner } from '@/components/execution/ExecutionComponents';
import { getAffirmationDisciplineState } from '@/lib/qlaAffirmations';
import type { ExecutionDailyStat, QlaTargets, ExecutionAlert } from '@/lib/types';

function today() {
  return new Date().toISOString().split('T')[0];
}

function fmt(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const FIELD_LABELS: [keyof ExecutionDailyStat, string][] = [
  ['ownersCalled',          'Calls made'],
  ['ownersEmailed',         'Emails sent'],
  ['ownersLinkedIn',        'LinkedIn outreach'],
  ['ownersTotalContacted',  'Total owners contacted'],
  ['ownerConversations',    'Owner conversations'],
  ['meetingsScheduled',     'Meetings scheduled'],
  ['loisSent',              'LOIs sent'],
  ['investorConversations', 'Investor conversations'],
  ['boardOutreach',         'Board outreach'],
  ['boardMeetings',         'Board meetings'],
];

export default function DailyPage() {
  const affirmations = useAppStore((s) => s.affirmations);
  const settings = useAppStore((s) => s.settings);
  const currentAffirmationIndex = useAppStore((s) => s.currentAffirmationIndex);
  const affirmationStatusByDate = useAppStore((s) => s.affirmationStatusByDate);
  const [stat, setStat]       = useState<ExecutionDailyStat | null>(null);
  const [targets, setTargets] = useState<QlaTargets | null>(null);
  const [alerts, setAlerts]   = useState<ExecutionAlert[]>([]);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, alertRes] = await Promise.all([
        executionApi.getDaily(),
        executionApi.getAlerts(),
      ]);
      const { stat: s, targets: t } = dayRes as { stat: ExecutionDailyStat; targets: QlaTargets };
      setStat(s);
      setTargets(t);
      setAlerts((alertRes as { alerts: ExecutionAlert[] }).alerts);
      // Pre-fill form with current values
      const f: Record<string, string> = {};
      FIELD_LABELS.forEach(([key]) => { f[key] = String((s as unknown as Record<string, unknown>)[key] ?? 0); });
      setForm(f);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: Record<string, number> = {};
      FIELD_LABELS.forEach(([key]) => { payload[key] = Number(form[key]) || 0; });
      const updated = await executionApi.recordDaily(payload);
      setStat(updated as ExecutionDailyStat);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  const callsTarget  = targets?.daily_owner_calls ?? 20;
  const callsActual  = stat?.ownersCalled ?? 0;

  const operatorTargets = useMemo(() => {
    const conversationsTarget = Math.max(2, Math.ceil(callsTarget * 0.1));
    const meetingsTarget = Math.max(2, Math.ceil(callsTarget * 0.1));
    return [
      {
        label: 'Calls made',
        actual: stat?.ownersCalled ?? 0,
        target: callsTarget,
        href: '#daily-log-form',
        prompt: callsActual < callsTarget ? 'Push raw call volume before perfect follow-up.' : 'Call target hit — protect momentum.',
      },
      {
        label: 'Owner conversations',
        actual: stat?.ownerConversations ?? 0,
        target: conversationsTarget,
        href: '#daily-log-form',
        prompt: 'Conversations prove contact quality, not just activity.',
      },
      {
        label: 'Meetings booked',
        actual: stat?.meetingsScheduled ?? 0,
        target: meetingsTarget,
        href: '/meetings#section-meetings',
        prompt: 'Push one next step into a real calendar slot.',
      },
    ];
  }, [stat, callsTarget, callsActual]);

  const biggestGap = [...operatorTargets]
    .map((item) => ({ ...item, gap: Math.max(0, item.target - item.actual) }))
    .sort((a, b) => b.gap - a.gap)[0];

  const affirmationState = getAffirmationDisciplineState({
    affirmations,
    settings,
    currentIndex: currentAffirmationIndex,
    affirmationStatusByDate,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Daily Execution</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{fmt(today())}</p>
      </div>

      <AlertBanner alerts={alerts} />

      {!loading && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Affirmation discipline</div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {affirmationState.currentAffirmation?.text || 'No active affirmation stack configured.'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">
                {affirmationState.enforcementMessage}
              </p>
            </div>
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)]">QLA discipline state</span>
                <span className="text-xs font-semibold" style={{ color: affirmationState.enforcementTone === 'critical' ? '#D64545' : affirmationState.enforcementTone === 'warning' ? '#E6A23C' : '#4CAF50' }}>
                  {affirmationState.enforcementLabel}
                </span>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] mb-1">
                  <span>{affirmationState.completedBlocks}/2 affirmation blocks</span>
                  <span>{affirmationState.streakDays} day streak</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${affirmationState.progressPct}%` }} />
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                Required now: {affirmationState.nextCompletionLabel}. Execution is only counted as disciplined once the affirmation block is logged.
              </div>
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Operator Day</div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {biggestGap && biggestGap.gap > 0
                  ? `Biggest gap: ${biggestGap.label} (${biggestGap.actual}/${biggestGap.target})`
                  : 'Daily targets are on track. Keep pressure on conversions.'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {biggestGap?.prompt || 'Log every meaningful action and keep moving.'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/command-center" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Command Center
              </Link>
              <Link href="/pipeline" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Pipeline
              </Link>
              <Link href="/board#section-board-candidates" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Board
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {operatorTargets.map((item) => {
              const gap = Math.max(0, item.target - item.actual);
              const progress = item.target > 0 ? Math.min(100, Math.round((item.actual / item.target) * 100)) : 0;
              const isInternalAnchor = item.href.startsWith('#');
              const content = (
                <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 h-full hover:border-[var(--color-accent)] transition-colors">
                  <div className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">{item.label}</div>
                  <div className="flex items-baseline justify-between gap-2 mt-2">
                    <div className="text-lg font-semibold text-[var(--color-text-primary)]">{item.actual}/{item.target}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">gap {gap}</div>
                  </div>
                  <div className="mt-3 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-3">{item.prompt}</div>
                </div>
              );
              return isInternalAnchor ? (
                <a key={item.label} href={item.href}>{content}</a>
              ) : (
                <Link key={item.label} href={item.href}>{content}</Link>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metric overview */}
          <div className="space-y-5">
            <h2 className="font-medium text-[var(--color-text-primary)]">Today&apos;s Progress</h2>
            <div className="grid grid-cols-2 gap-3">
              <ExecutionMetricCard label="Calls Made"       value={stat?.ownersCalled ?? 0}          target={callsTarget} />
              <ExecutionMetricCard label="Emails Sent"      value={stat?.ownersEmailed ?? 0}         />
              <ExecutionMetricCard label="Total Outreach"   value={stat?.ownersTotalContacted ?? 0}  />
              <ExecutionMetricCard label="Conversations"    value={stat?.ownerConversations ?? 0}    />
              <ExecutionMetricCard label="Meetings Booked"  value={stat?.meetingsScheduled ?? 0}     />
              <ExecutionMetricCard label="LOIs Sent"        value={stat?.loisSent ?? 0}              target={1} />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">vs. Targets</h3>
              <ExecutionProgressBar label="Calls made"        actual={stat?.ownersCalled ?? 0}         target={callsTarget} />
              <ExecutionProgressBar label="Meetings scheduled" actual={stat?.meetingsScheduled ?? 0}   target={2} />
              <ExecutionProgressBar label="Total contacted"   actual={stat?.ownersTotalContacted ?? 0} target={callsTarget} />
            </div>
          </div>

          {/* Manual entry form */}
          <div id="daily-log-form" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4 scroll-mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-[var(--color-text-primary)]">Log Activity</h2>
              {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Enter counts for today. Computed fields update automatically from CRM interactions.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {FIELD_LABELS.map(([key, label]) => (
                <Input
                  key={key}
                  label={label}
                  type="number"
                  min="0"
                  value={form[key] ?? '0'}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              ))}
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? 'Saving…' : 'Save Daily Log'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
