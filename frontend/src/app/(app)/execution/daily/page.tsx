'use client';

import { useEffect, useState, useCallback } from 'react';
import { executionApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ExecutionProgressBar, ExecutionMetricCard, AlertBanner } from '@/components/execution/ExecutionComponents';
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Daily Execution</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{fmt(today())}</p>
      </div>

      <AlertBanner alerts={alerts} />

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
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
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
