'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { executionApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExecutionProgressBar, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import type { ExecutionWeeklyStat, QlaTargets } from '@/lib/types';

function weekLabel(d: string) {
  const start = new Date(d + 'T12:00:00');
  const end   = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `Week of ${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
}

const FIELD_LABELS: [keyof ExecutionWeeklyStat, string][] = [
  ['ownersContacted',       'Owners contacted'],
  ['ownerConversations',    'Owner conversations'],
  ['meetingsScheduled',     'Meetings scheduled'],
  ['investorConversations', 'Investor conversations'],
  ['boardMeetings',         'Board meetings'],
  ['loisSent',              'LOIs sent'],
  ['companiesAdded',        'Companies added'],
];

export default function WeeklyPage() {
  const [stat, setStat]       = useState<ExecutionWeeklyStat | null>(null);
  const [targets, setTargets] = useState<QlaTargets | null>(null);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getWeekly();
      const { stat: s, targets: t } = res as { stat: ExecutionWeeklyStat; targets: QlaTargets };
      setStat(s);
      setTargets(t);
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
      const patch: Record<string, unknown> = {};
      FIELD_LABELS.forEach(([key]) => { patch[key] = Number(form[key]) || 0; });
      const updated = await executionApi.updateWeekly(patch);
      setStat(updated as ExecutionWeeklyStat);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  const operatorTargets = useMemo(() => {
    return [
      {
        label: 'Owners contacted',
        actual: stat?.ownersContacted ?? 0,
        target: targets?.weekly_owner_contacts ?? 100,
        href: '#weekly-override-form',
        prompt: 'Board, sourcing, and pipeline all die if weekly touch volume slips.',
      },
      {
        label: 'Investor calls',
        actual: stat?.investorConversations ?? 0,
        target: targets?.weekly_investor_calls ?? 3,
        href: '/execution/investors',
        prompt: 'Warm capital before you need it.',
      },
      {
        label: 'LOIs sent',
        actual: stat?.loisSent ?? 0,
        target: Math.max(1, Math.ceil((targets?.monthly_lois ?? 3) / 4)),
        href: '/execution/monthly',
        prompt: 'Weekly urgency should ladder into monthly LOI pressure.',
      },
    ];
  }, [stat, targets]);

  const biggestGap = [...operatorTargets]
    .map((item) => ({ ...item, gap: Math.max(0, item.target - item.actual) }))
    .sort((a, b) => b.gap - a.gap)[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Weekly Execution</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {stat?.weekStartDate ? weekLabel(stat.weekStartDate) : 'This week'}
        </p>
      </div>

      {!loading && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Weekly Pressure</div>
              <p className="text-sm text-[var(--color-text-primary)]">
                {biggestGap && biggestGap.gap > 0
                  ? `Biggest weekly gap: ${biggestGap.label} (${biggestGap.actual}/${biggestGap.target})`
                  : 'Weekly targets are on track. Keep forcing visible movement.'}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{biggestGap?.prompt || 'Do not let weekly activity become elegant drift.'}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href="/execution/daily" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Daily
              </Link>
              <Link href="/execution/investors" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Investors
              </Link>
              <Link href="/command-center" className="inline-flex items-center px-3 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-accent)] transition-colors">
                Command Center
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
              return isInternalAnchor ? <a key={item.label} href={item.href}>{content}</a> : <Link key={item.label} href={item.href}>{content}</Link>;
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metrics */}
          <div className="space-y-5">
            <h2 className="font-medium text-[var(--color-text-primary)]">This Week&apos;s Progress</h2>
            <div className="grid grid-cols-2 gap-3">
              <ExecutionMetricCard label="Owners Contacted"     value={stat?.ownersContacted ?? 0}       target={targets?.weekly_owner_contacts} />
              <ExecutionMetricCard label="Conversations"        value={stat?.ownerConversations ?? 0}    />
              <ExecutionMetricCard label="Investor Calls"       value={stat?.investorConversations ?? 0} target={targets?.weekly_investor_calls} />
              <ExecutionMetricCard label="Meetings"             value={stat?.meetingsScheduled ?? 0}     />
              <ExecutionMetricCard label="Board Meetings"       value={stat?.boardMeetings ?? 0}         />
              <ExecutionMetricCard label="LOIs Sent"            value={stat?.loisSent ?? 0}              />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">vs. Weekly Goals</h3>
              <ExecutionProgressBar
                label="Owners contacted"
                actual={stat?.ownersContacted ?? 0}
                target={targets?.weekly_owner_contacts ?? 100}
              />
              <ExecutionProgressBar
                label="Investor conversations"
                actual={stat?.investorConversations ?? 0}
                target={targets?.weekly_investor_calls ?? 3}
              />
              <ExecutionProgressBar
                label="Meetings scheduled"
                actual={stat?.meetingsScheduled ?? 0}
                target={5}
              />
            </div>
          </div>

          {/* Form */}
          <div id="weekly-override-form" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4 scroll-mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-[var(--color-text-primary)]">Override Weekly Stats</h2>
              {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Computed automatically from CRM data. Override individual fields if needed.
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
              {saving ? 'Saving…' : 'Save Weekly Override'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
