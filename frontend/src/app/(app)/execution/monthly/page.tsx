'use client';

import { useEffect, useState, useCallback } from 'react';
import { executionApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExecutionProgressBar, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import type { ExecutionMonthlyStat, QlaTargets } from '@/lib/types';

function monthLabel(m: string) {
  const [year, month] = m.split('-');
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const FIELD_LABELS: [keyof ExecutionMonthlyStat, string][] = [
  ['ownersContacted',       'Owners contacted'],
  ['ownerConversations',    'Owner conversations'],
  ['meetingsScheduled',     'Meetings scheduled'],
  ['investorConversations', 'Investor conversations'],
  ['boardMeetings',         'Board meetings'],
  ['loisSent',              'LOIs sent'],
  ['dealsOpened',           'Deals opened'],
  ['dealsClosed',           'Deals closed'],
];

export default function MonthlyPage() {
  const [stat, setStat]       = useState<ExecutionMonthlyStat | null>(null);
  const [targets, setTargets] = useState<QlaTargets | null>(null);
  const [form, setForm]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getMonthly();
      const { stat: s, targets: t } = res as { stat: ExecutionMonthlyStat; targets: QlaTargets };
      setStat(s);
      setTargets(t);
      const f: Record<string, string> = {};
      FIELD_LABELS.forEach(([key]) => { f[key] = String((s as Record<string, unknown>)[key] ?? 0); });
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
      const updated = await executionApi.updateMonthly(patch);
      setStat(updated as ExecutionMonthlyStat);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Monthly Execution</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {stat?.month ? monthLabel(stat.month) : 'This month'}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metrics */}
          <div className="space-y-5">
            <h2 className="font-medium text-[var(--color-text-primary)]">This Month's Results</h2>
            <div className="grid grid-cols-2 gap-3">
              <ExecutionMetricCard label="Owners Contacted"     value={stat?.ownersContacted ?? 0}       />
              <ExecutionMetricCard label="Conversations"        value={stat?.ownerConversations ?? 0}    />
              <ExecutionMetricCard label="Meetings"             value={stat?.meetingsScheduled ?? 0}     />
              <ExecutionMetricCard label="LOIs Sent"            value={stat?.loisSent ?? 0}              target={targets?.monthly_lois} />
              <ExecutionMetricCard label="Deals Opened"         value={stat?.dealsOpened ?? 0}           />
              <ExecutionMetricCard label="Deals Closed"         value={stat?.dealsClosed ?? 0}           target={1} accent={stat?.dealsClosed ? stat.dealsClosed >= 1 : false} />
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)]">vs. Monthly Goals</h3>
              <ExecutionProgressBar
                label="LOIs sent"
                actual={stat?.loisSent ?? 0}
                target={targets?.monthly_lois ?? 3}
              />
              <ExecutionProgressBar
                label="Deals closed"
                actual={stat?.dealsClosed ?? 0}
                target={1}
              />
              <ExecutionProgressBar
                label="Board meetings"
                actual={stat?.boardMeetings ?? 0}
                target={4}
              />
            </div>

            {/* Monthly KPI summary */}
            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4">
              <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-3">Monthly Milestones</h3>
              {[
                { label: 'LOI target', met: (stat?.loisSent ?? 0) >= (targets?.monthly_lois ?? 3), detail: `${stat?.loisSent ?? 0} / ${targets?.monthly_lois ?? 3}` },
                { label: 'Deal closed', met: (stat?.dealsClosed ?? 0) >= 1, detail: stat?.dealsClosed ? '✓' : '—' },
                { label: 'Board meetings held', met: (stat?.boardMeetings ?? 0) >= 2, detail: `${stat?.boardMeetings ?? 0}` },
              ].map(({ label, met, detail }) => (
                <div key={label} className="flex items-center justify-between text-sm py-1.5 border-b border-[var(--color-border)] last:border-0">
                  <span className="text-[var(--color-text-muted)]">{label}</span>
                  <span className={met ? 'text-emerald-400 font-medium' : 'text-[var(--color-text-muted)]'}>
                    {detail}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-[var(--color-text-primary)]">Override Monthly Stats</h2>
              {saved && <span className="text-xs text-emerald-400">Saved ✓</span>}
            </div>
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
              {saving ? 'Saving…' : 'Save Monthly Override'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
