'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { relationshipsApi } from '@/lib/api';
import {
  ArrowLeft,
  Users,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  RefreshCw,
  Building2,
  TrendingUp,
  Briefcase,
  Edit2,
  Plus,
  Check,
  X,
  Clock,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Relationship,
  RelationshipInteraction,
  RelationshipStatus,
  InterestLevel,
  RelationshipEntityType,
  RelationshipInteractionType,
} from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(iso: string): number {
  const diff = new Date(iso.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round(diff / 86_400_000);
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ENTITY_ICON: Record<RelationshipEntityType, LucideIcon> = {
  seller:       Building2,
  board_member: Briefcase,
  investor:     TrendingUp,
};

const ENTITY_COLOR: Record<RelationshipEntityType, string> = {
  seller:       'text-sky-400',
  board_member: 'text-violet-400',
  investor:     'text-[#C9A227]',
};

const STATUS_LABEL: Record<RelationshipStatus, string> = {
  new: 'New', warming: 'Warming', active: 'Active',
  long_term: 'Long Term', closed: 'Closed', not_interested: 'Not Interested',
};

const INTEREST_COLOR: Record<InterestLevel, string> = {
  low: 'text-[var(--color-text-muted)]', medium: 'text-[#C9A227]',
  high: 'text-emerald-400', ready: 'text-[#C9A227]',
};

const INTERACTION_ICON: Record<RelationshipInteractionType, LucideIcon> = {
  call:    Phone,
  email:   Mail,
  meeting: Calendar,
  note:    MessageSquare,
};

// ─── Inline edit field ────────────────────────────────────────────────────────

function EditableSelect<T extends string>({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSave: (v: T) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  const [saving,  setSaving]  = useState(false);

  const commit = async () => {
    setSaving(true);
    try { await onSave(val); setEditing(false); }
    finally { setSaving(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          value={val}
          onChange={(e) => setVal(e.target.value as T)}
          autoFocus
          className="bg-[#1A1A1E] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
          aria-label={label}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button onClick={commit} disabled={saving} aria-label="Save" className="text-emerald-400 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded p-0.5">
          {saving ? <RefreshCw size={12} className="animate-spin" aria-hidden /> : <Check size={12} aria-hidden />}
        </button>
        <button onClick={() => { setEditing(false); setVal(value); }} aria-label="Cancel" className="text-[var(--color-text-muted)] hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded p-0.5">
          <X size={12} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1 text-xs text-[var(--color-text-primary)] hover:text-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
      aria-label={`Edit ${label}: current value ${value}`}
    >
      {options.find((o) => o.value === value)?.label ?? value}
      <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
    </button>
  );
}

// ─── Log Interaction Modal ────────────────────────────────────────────────────

function LogInteractionModal({
  onClose,
  onLogged,
}: {
  onClose: () => void;
  onLogged: (interaction: RelationshipInteraction) => void;
  relationshipId: string;
}) {
  const [form, setForm] = useState({
    interactionType: 'call' as RelationshipInteractionType,
    interactionSummary: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const params = useParams<{ id: string }>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await relationshipsApi.logInteraction(params.id, form);
      onLogged(res.interaction);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to log interaction');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-label="Log interaction"
    >
      <div className="bg-[#161618] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Log Interaction</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="li-type">Type</label>
            <select id="li-type" value={form.interactionType} onChange={(e) => setForm((p) => ({ ...p, interactionType: e.target.value as RelationshipInteractionType }))}
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="note">Note</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="li-summary">Summary</label>
            <textarea id="li-summary" rows={4} value={form.interactionSummary}
              onChange={(e) => setForm((p) => ({ ...p, interactionSummary: e.target.value }))}
              placeholder="What was discussed? Key takeaways?"
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227] resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50">
              {saving ? 'Logging…' : 'Log Interaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Schedule Follow-up Modal ─────────────────────────────────────────────────

function ScheduleModal({
  onClose,
  onScheduled,
  relationshipId,
}: {
  onClose: () => void;
  onScheduled: (rel: Relationship) => void;
  relationshipId: string;
}) {
  const [days,   setDays]   = useState(7);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await relationshipsApi.scheduleFollowUp(relationshipId, days);
      onScheduled(res.relationship);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-label="Schedule follow-up"
    >
      <div className="bg-[#161618] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Schedule Follow-up</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>}
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-2" htmlFor="sf-days">Follow up in how many days?</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[3, 7, 14, 30, 60].map((d) => (
                <button
                  key={d} type="button"
                  onClick={() => setDays(d)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
                    days === d ? 'border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[#3A3A3E]'
                  }`}
                  aria-pressed={days === d}
                >
                  {d}d
                </button>
              ))}
            </div>
            <input
              id="sf-days" type="number" min="1" max="365"
              value={days} onChange={(e) => setDays(Number(e.target.value))}
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
              aria-label="Days until follow-up"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50">
              {saving ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Interaction timeline ─────────────────────────────────────────────────────

function InteractionTimeline({ interactions }: { interactions: RelationshipInteraction[] }) {
  if (interactions.length === 0) {
    return <p className="text-xs text-[var(--color-text-muted)] italic">No interactions logged yet.</p>;
  }

  return (
    <ol className="relative border-l border-[var(--color-border)] pl-4 space-y-4" aria-label="Interaction history">
      {interactions.map((i) => {
        const Icon = INTERACTION_ICON[i.interactionType] ?? MessageSquare;
        return (
          <li key={i.id} className="relative">
            <div
              className="absolute -left-[21px] top-0.5 w-5 h-5 rounded-full bg-[#1A1A1E] border border-[var(--color-border)] flex items-center justify-center"
              aria-hidden
            >
              <Icon size={10} className="text-[var(--color-text-muted)]" aria-hidden />
            </div>
            <div className="bg-[#1A1A1E] rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-primary)] capitalize">
                  {i.interactionType}
                </span>
                <time
                  className="text-[10px] text-[var(--color-text-muted)]"
                  dateTime={i.createdAt}
                >
                  {fmtDatetime(i.createdAt)}
                </time>
              </div>
              {i.interactionSummary && (
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {i.interactionSummary}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RelationshipDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [rel,          setRel]          = useState<Relationship | null>(null);
  const [interactions, setInteractions] = useState<RelationshipInteraction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await relationshipsApi.get(params.id);
        setRel(res.relationship);
        setInteractions(res.interactions);
      } catch {
        setError('Relationship not found.');
      } finally { setLoading(false); }
    };
    load();
  }, [params?.id]);

  const handleDelete = async () => {
    if (!rel || !confirm(`Delete relationship for ${rel.name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await relationshipsApi.delete(rel.id);
      router.push('/relationships');
    } catch { setDeleting(false); }
  };

  const handleInteractionLogged = (i: RelationshipInteraction) => {
    setInteractions((prev) => [i, ...prev]);
    // Reload relationship to get updated lastContactDate + nextFollowUpDate
    relationshipsApi.get(params.id).then((res) => setRel(res.relationship)).catch(() => {});
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <RefreshCw size={14} className="animate-spin" aria-hidden /> Loading…
      </div>
    );
  }

  if (error || !rel) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/relationships" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          <ArrowLeft size={14} aria-hidden /> Back
        </Link>
        <div className="bg-[var(--color-surface)] border border-red-800/30 rounded-xl p-6 text-center">
          <AlertCircle size={24} className="mx-auto mb-2 text-red-400" aria-hidden />
          <p className="text-sm">{error || 'Not found'}</p>
        </div>
      </div>
    );
  }

  const Icon    = ENTITY_ICON[rel.entityType];
  const color   = ENTITY_COLOR[rel.entityType];
  const du      = daysUntil(rel.nextFollowUpDate);
  const overdue = du < 0;
  const lastDs  = rel.lastContactDate ? daysSince(rel.lastContactDate) : null;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back nav */}
      <Link
        href="/relationships"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
      >
        <ArrowLeft size={14} aria-hidden /> Back to Relationships
      </Link>

      {/* Hero card */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={18} className={color} aria-hidden />
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{rel.name}</h1>
            </div>
            {rel.company && (
              <p className="text-sm text-[var(--color-text-muted)] ml-7">{rel.company}</p>
            )}
          </div>
          <div className={`text-sm font-bold px-3 py-1.5 rounded-lg border ${
            overdue
              ? 'border-red-700/40 bg-red-900/10 text-red-400'
              : du <= 3
              ? 'border-[#C9A22740] bg-[#C9A22710] text-[#C9A227]'
              : 'border-emerald-700/40 bg-emerald-900/10 text-emerald-400'
          }`}>
            {overdue
              ? `${Math.abs(du)}d overdue`
              : du === 0 ? 'Follow up today'
              : `Follow up in ${du}d`}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-[#1A1A1E] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Type</div>
            <div className={`text-sm font-semibold mt-1 ${color}`}>
              {rel.entityType.replace('_', ' ').replace(/^\w/, (c) => c.toUpperCase())}
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</div>
            <EditableSelect<RelationshipStatus>
              label="Status"
              value={rel.relationshipStatus}
              options={['new','warming','active','long_term','closed','not_interested'].map((s) => ({
                value: s as RelationshipStatus,
                label: STATUS_LABEL[s as RelationshipStatus],
              }))}
              onSave={async (v) => {
                const res = await relationshipsApi.update(rel.id, { relationshipStatus: v });
                setRel(res.relationship);
              }}
            />
          </div>
          <div className="bg-[#1A1A1E] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Interest</div>
            <EditableSelect<InterestLevel>
              label="Interest level"
              value={rel.interestLevel}
              options={[
                { value: 'low',    label: 'Low'    },
                { value: 'medium', label: 'Medium' },
                { value: 'high',   label: 'High'   },
                { value: 'ready',  label: 'Ready'  },
              ]}
              onSave={async (v) => {
                const res = await relationshipsApi.updateInterestLevel(rel.id, v);
                setRel(res.relationship);
              }}
            />
          </div>
          <div className="bg-[#1A1A1E] rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Last Contact</div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
              {lastDs == null ? '—' : lastDs === 0 ? 'Today' : `${lastDs}d ago`}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={() => setShowLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Plus size={13} aria-hidden /> Log Interaction
          </button>
          <button
            onClick={() => setShowSchedule(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Calendar size={13} aria-hidden /> Schedule Meeting
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-800/30 text-sm text-red-400 hover:border-red-700/50 transition-colors disabled:opacity-50 ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label="Delete relationship"
          >
            {deleting ? <RefreshCw size={13} className="animate-spin" aria-hidden /> : <Trash2 size={13} aria-hidden />}
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — interaction timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
              <Clock size={14} className="text-[#C9A227]" aria-hidden />
              Interaction History
              <span className="text-[10px] text-[var(--color-text-muted)] font-normal ml-auto">
                {interactions.length} logged
              </span>
            </h2>
            <InteractionTimeline interactions={interactions} />
          </div>
        </div>

        {/* Right — details */}
        <div className="space-y-4">
          {/* Follow-up info */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Follow-up Schedule</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Frequency</span>
                <span className="text-[var(--color-text-primary)] font-semibold">
                  Every {rel.followUpFrequencyDays} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Next follow-up</span>
                <span className={`font-semibold ${overdue ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmtDate(rel.nextFollowUpDate)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Last contact</span>
                <span className="text-[var(--color-text-primary)]">{fmtDate(rel.lastContactDate)}</span>
              </div>
            </div>
            <button
              onClick={() => setShowSchedule(true)}
              className="w-full mt-1 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
            >
              Reschedule
            </button>
          </div>

          {/* Status indicators */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Health</h2>
            {[
              {
                label: 'Follow-up current',
                ok: !overdue,
                okText: 'On schedule',
                warnText: `${Math.abs(du)}d overdue`,
              },
              {
                label: 'Recently contacted',
                ok: lastDs != null && lastDs <= 30,
                okText: lastDs != null ? `${lastDs}d ago` : '—',
                warnText: lastDs != null ? `${lastDs}d ago` : 'Never',
              },
              {
                label: 'Active interest',
                ok: rel.interestLevel === 'high' || rel.interestLevel === 'ready',
                okText: rel.interestLevel,
                warnText: rel.interestLevel,
              },
              {
                label: 'Interactions logged',
                ok: interactions.length >= 1,
                okText: `${interactions.length} logged`,
                warnText: 'None yet',
              },
            ].map(({ label, ok, okText, warnText }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                {ok
                  ? <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden />
                  : <AlertCircle  size={13} className="text-[#C9A227] flex-shrink-0"   aria-hidden />}
                <span className="text-[var(--color-text-muted)] flex-1">{label}</span>
                <span className={ok ? 'text-emerald-400' : 'text-[#C9A227]'}>{ok ? okText : warnText}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {rel.notes && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Notes</h2>
              <p className="text-xs text-[var(--color-text-muted)] whitespace-pre-wrap leading-relaxed">{rel.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="text-[10px] text-[var(--color-text-muted)] space-y-0.5 px-1">
            <div>Added: {fmtDate(rel.createdAt)}</div>
            <div>Updated: {fmtDate(rel.updatedAt)}</div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showLogModal && (
        <LogInteractionModal
          onClose={() => setShowLogModal(false)}
          onLogged={handleInteractionLogged}
          relationshipId={rel.id}
        />
      )}
      {showSchedule && (
        <ScheduleModal
          onClose={() => setShowSchedule(false)}
          onScheduled={(updated) => { setRel(updated); }}
          relationshipId={rel.id}
        />
      )}
    </div>
  );
}
