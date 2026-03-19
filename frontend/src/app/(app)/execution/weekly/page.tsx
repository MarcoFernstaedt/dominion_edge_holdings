'use client';

import { useEffect, useState, useCallback } from 'react';
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Weekly Execution</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {stat?.weekStartDate ? weekLabel(stat.weekStartDate) : 'This week'}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Metrics */}
          <div className="space-y-5">
            <h2 className="font-medium text-[var(--color-text-primary)]">This Week's Progress</h2>
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
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
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
