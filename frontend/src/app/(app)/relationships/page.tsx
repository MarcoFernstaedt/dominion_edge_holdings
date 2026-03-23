'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { relationshipsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Users,
  Search,
  Plus,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle2,
  SlidersHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  TrendingUp,
  Briefcase,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  Relationship,
  RelationshipDashboard,
  RelationshipFilters,
  RelationshipEntityType,
  RelationshipStatus,
  InterestLevel,
} from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function isOverdue(nextFollowUp: string): boolean {
  return nextFollowUp.slice(0, 10) <= new Date().toISOString().slice(0, 10);
}

function daysUntil(iso: string): number {
  const diff = new Date(iso.slice(0, 10)).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round(diff / 86_400_000);
}

const ENTITY_LABEL: Record<RelationshipEntityType, string> = {
  seller:       'Seller',
  board_member: 'Board Member',
  investor:     'Investor',
};

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
  new:            'New',
  warming:        'Warming',
  active:         'Active',
  long_term:      'Long Term',
  closed:         'Closed',
  not_interested: 'Not Interested',
};

const INTEREST_COLOR: Record<InterestLevel, string> = {
  low:    'text-[var(--color-text-muted)]',
  medium: 'text-[#C9A227]',
  high:   'text-emerald-400',
  ready:  'text-[#C9A227]',
};

// ─── Dashboard widget ─────────────────────────────────────────────────────────

function DashboardWidget({ dashboard }: { dashboard: RelationshipDashboard }) {
  const groups = [
    { label: 'Sellers',       items: dashboard.overdueSellers,      color: 'border-sky-700/40 bg-sky-900/10',     textColor: 'text-sky-400' },
    { label: 'Board Members', items: dashboard.overdueBoardMembers, color: 'border-violet-700/40 bg-violet-900/10', textColor: 'text-violet-400' },
    { label: 'Investors',     items: dashboard.overdueInvestors,    color: 'border-[#C9A22740] bg-[#C9A22710]', textColor: 'text-[#C9A227]' },
  ];

  return (
    <section
      aria-label="Relationship Tracker — overdue follow-ups"
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <AlertCircle size={14} className="text-[#C9A227]" aria-hidden />
          Relationship Tracker
        </h2>
        {dashboard.overdueTotal > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#C9A22720]/30 text-[#C9A227] border border-[#C9A22740]">
            {dashboard.overdueTotal} overdue
          </span>
        )}
      </div>

      {dashboard.overdueTotal === 0 ? (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 size={13} aria-hidden /> All relationships up to date
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {groups.map(({ label, items, color, textColor }) => (
            <div key={label} className={`border ${color} rounded-lg p-3`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${textColor} mb-2`}>{label}</div>
              {items.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">None overdue</p>
              ) : (
                <ul className="space-y-1.5" role="list">
                  {items.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/relationships/${r.id}`}
                        className={`flex items-center justify-between gap-1 text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded ${textColor}`}
                        aria-label={`${r.name}${r.company ? `, ${r.company}` : ''} — follow-up overdue`}
                      >
                        <span className="truncate">{r.name}</span>
                        <span className="flex-shrink-0 font-bold text-red-400">
                          {Math.abs(daysUntil(r.nextFollowUpDate))}d
                        </span>
                      </Link>
                    </li>
                  ))}
                  {items.length > 4 && (
                    <li className="text-[10px] text-[var(--color-text-muted)]">+{items.length - 4} more</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[var(--color-border)]">
        {[
          { label: 'Total',        value: dashboard.summary.total       },
          { label: 'Active',       value: dashboard.summary.active      },
          { label: 'High Interest',value: dashboard.summary.highInterest},
          { label: 'Long Term',    value: dashboard.summary.longTerm    },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <div className="text-base font-bold text-[var(--color-text-primary)]">{value}</div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Add Relationship Modal ───────────────────────────────────────────────────

function AddRelationshipModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    entityType: 'seller' as RelationshipEntityType,
    name: '', company: '', entityId: '',
    relationshipStatus: 'new' as RelationshipStatus,
    interestLevel: 'medium' as InterestLevel,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await relationshipsApi.create(form);
      onCreated(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create relationship');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-label="Add relationship"
    >
      <div className="bg-[#161618] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Add Relationship</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-type">Type <span className="text-red-400">*</span></label>
              <select id="ar-type" value={form.entityType} onChange={(e) => set('entityType', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="seller">Seller</option>
                <option value="board_member">Board Member</option>
                <option value="investor">Investor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-name">Name <span className="text-red-400">*</span></label>
              <input id="ar-name" required value={form.name} onChange={(e) => set('name', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-company">Company</label>
              <input id="ar-company" value={form.company} onChange={(e) => set('company', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-status">Status</label>
              <select id="ar-status" value={form.relationshipStatus} onChange={(e) => set('relationshipStatus', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
                {(['new','warming','active','long_term','closed','not_interested'] as RelationshipStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-interest">Interest Level</label>
              <select id="ar-interest" value={form.interestLevel} onChange={(e) => set('interestLevel', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="ready">Ready</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="ar-notes">Notes</label>
            <textarea id="ar-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227] resize-none" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Relationship'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

function FilterPanel({
  filters,
  onChange,
  onClose,
}: {
  filters: RelationshipFilters;
  onChange: (p: Partial<RelationshipFilters>) => void;
  onClose: () => void;
}) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Filters</h3>
        <button onClick={onClose} aria-label="Close filters" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rf-type">Entity Type</label>
          <select id="rf-type" value={filters.entityType ?? ''} onChange={(e) => onChange({ entityType: (e.target.value as RelationshipEntityType) || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="">All Types</option>
            <option value="seller">Seller</option>
            <option value="board_member">Board Member</option>
            <option value="investor">Investor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rf-status">Status</label>
          <select id="rf-status" value={filters.relationshipStatus ?? ''} onChange={(e) => onChange({ relationshipStatus: (e.target.value as RelationshipStatus) || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="">All Statuses</option>
            {(['new','warming','active','long_term','closed','not_interested'] as RelationshipStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rf-interest">Interest</label>
          <select id="rf-interest" value={filters.interestLevel ?? ''} onChange={(e) => onChange({ interestLevel: (e.target.value as InterestLevel) || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="">All Levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="ready">Ready</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rf-sort">Sort By</label>
          <select id="rf-sort" value={filters.sortBy ?? 'nextFollowUpDate'} onChange={(e) => onChange({ sortBy: e.target.value as RelationshipFilters['sortBy'] })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="nextFollowUpDate">Next Follow-up</option>
            <option value="lastContactDate">Last Contact</option>
            <option value="name">Name</option>
            <option value="createdAt">Date Added</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" checked={!!filters.overdue} onChange={(e) => onChange({ overdue: e.target.checked || undefined })}
            className="w-4 h-4 rounded accent-[#C9A227]" />
          Show overdue only
        </label>
      </div>
    </div>
  );
}

// ─── Relationship row ─────────────────────────────────────────────────────────

function RelationshipRow({ rel }: { rel: Relationship }) {
  const Icon  = ENTITY_ICON[rel.entityType];
  const color = ENTITY_COLOR[rel.entityType];
  const overdue = isOverdue(rel.nextFollowUpDate);
  const du = daysUntil(rel.nextFollowUpDate);
  const lastDs = rel.lastContactDate ? daysSince(rel.lastContactDate) : null;

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[#1A1A1E] transition-colors group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <Icon size={13} className={`${color} flex-shrink-0`} aria-hidden />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">{rel.name}</span>
        </div>
        {rel.company && <div className="text-[10px] text-[var(--color-text-muted)] pl-5 mt-0.5">{rel.company}</div>}
      </td>
      <td className="py-3 px-4 text-xs text-[var(--color-text-muted)]">
        {ENTITY_LABEL[rel.entityType]}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-[var(--color-text-muted)]">{STATUS_LABEL[rel.relationshipStatus]}</span>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium ${INTEREST_COLOR[rel.interestLevel]}`}>
          {rel.interestLevel.charAt(0).toUpperCase() + rel.interestLevel.slice(1)}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-[var(--color-text-muted)]">
          {lastDs == null ? '—' : lastDs === 0 ? 'Today' : `${lastDs}d ago`}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className={`text-xs font-semibold ${overdue ? 'text-red-400' : 'text-emerald-400'}`}>
          {overdue ? `${Math.abs(du)}d overdue` : du === 0 ? 'Today' : `in ${du}d`}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <Link
          href={`/relationships/${rel.id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
          aria-label={`View ${rel.name}`}
        >
          View <ArrowUpRight size={11} aria-hidden />
        </Link>
      </td>
    </tr>
  );
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function RelationshipCard({ rel }: { rel: Relationship }) {
  const Icon  = ENTITY_ICON[rel.entityType];
  const color = ENTITY_COLOR[rel.entityType];
  const overdue = isOverdue(rel.nextFollowUpDate);
  const du = daysUntil(rel.nextFollowUpDate);
  const lastDs = rel.lastContactDate ? daysSince(rel.lastContactDate) : null;

  return (
    <article
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2"
      aria-label={`Relationship: ${rel.name}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={color} aria-hidden />
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{rel.name}</div>
            {rel.company && <div className="text-xs text-[var(--color-text-muted)]">{rel.company}</div>}
          </div>
        </div>
        <Link
          href={`/relationships/${rel.id}`}
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
            overdue
              ? 'border-red-700/40 bg-red-900/10 text-red-400'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
          aria-label={`View ${rel.name}`}
        >
          {overdue ? `${Math.abs(du)}d overdue` : `in ${du}d`}
          <ArrowUpRight size={11} aria-hidden />
        </Link>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">
          {ENTITY_LABEL[rel.entityType]}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">
          {STATUS_LABEL[rel.relationshipStatus]}
        </span>
        <span className={`px-1.5 py-0.5 rounded bg-[#1A1A1E] font-medium ${INTEREST_COLOR[rel.interestLevel]}`}>
          {rel.interestLevel}
        </span>
        {lastDs != null && (
          <span className="px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">
            Last: {lastDs === 0 ? 'today' : `${lastDs}d ago`}
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: RelationshipFilters = {
  sortBy: 'nextFollowUpDate',
  sortDir: 'asc',
  page: 1,
  pageSize: 50,
};

export default function RelationshipsPage() {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [dashboard,     setDashboard]     = useState<RelationshipDashboard | null>(null);
  const [total,         setTotal]         = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [filters,       setFilters]       = useState<RelationshipFilters>(DEFAULT_FILTERS);
  const [loading,       setLoading]       = useState(true);
  const [showFilters,   setShowFilters]   = useState(false);
  const [showAdd,       setShowAdd]       = useState(false);
  const [search,        setSearch]        = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (f: RelationshipFilters) => {
    setLoading(true);
    try {
      const [listRes, dashRes] = await Promise.all([
        relationshipsApi.list(f),
        relationshipsApi.getDashboard(),
      ]);
      setRelationships(listRes.relationships);
      setTotal(listRes.total);
      setTotalPages(listRes.totalPages);
      setDashboard(dashRes);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(filters); }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const next = { ...filters, search: val || undefined, page: 1 };
      setFilters(next); load(next);
    }, 400);
  };

  const applyFilters = (patch: Partial<RelationshipFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next); load(next);
  };

  const setPage = (p: number) => {
    const next = { ...filters, page: p };
    setFilters(next); load(next);
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <UserCheck size={22} className="text-[#C9A227]" aria-hidden />
            Relationships
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {dashboard ? `${dashboard.summary.total} tracked · ${dashboard.overdueTotal} overdue` : 'Relationship Management Engine'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Plus size={14} aria-hidden /> Add Relationship
          </button>
          <button
            onClick={() => load(filters)}
            disabled={loading}
            aria-label="Refresh"
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      {/* Dashboard widget */}
      {dashboard && <DashboardWidget dashboard={dashboard} />}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
          <input
            type="search"
            placeholder="Search by name or company…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search relationships"
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
          />
        </div>
        <button
          onClick={() => setShowFilters((p) => !p)}
          aria-expanded={showFilters}
          aria-label="Toggle filters"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
            showFilters
              ? 'border-[#C9A227] text-[#C9A227] bg-[#C9A227]/10'
              : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <SlidersHorizontal size={14} aria-hidden /> Filters
        </button>
      </div>

      {showFilters && <FilterPanel filters={filters} onChange={applyFilters} onClose={() => setShowFilters(false)} />}

      {/* Content */}
      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading relationships">
          {/* Dashboard widget skeleton */}
          <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="border border-[#262626] rounded-[10px] p-3 space-y-2">
                  <Skeleton className="h-2.5 w-20" />
                  {[0, 1, 2].map((j) => (
                    <Skeleton key={j} className="h-3" style={{ width: `${55 + j * 15}%` }} />
                  ))}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#262626]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="text-center space-y-1.5">
                  <Skeleton className="h-5 w-8 mx-auto" />
                  <Skeleton className="h-2 w-12 mx-auto" />
                </div>
              ))}
            </div>
          </div>
          {/* Table skeleton — desktop */}
          <div className="hidden md:block bg-[#111111] border border-[#262626] rounded-[10px] overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[#262626] flex gap-6">
              {[28, 12, 12, 12, 14, 14].map((w, i) => (
                <Skeleton key={i} className="h-2.5" style={{ width: `${w}%` }} />
              ))}
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3.5 border-b border-[#262626] last:border-0 flex gap-6 items-center">
                <div className="space-y-1.5" style={{ width: '28%' }}>
                  <Skeleton className="h-3 w-36" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
                <Skeleton className="h-3" style={{ width: '12%' }} />
                <Skeleton className="h-5 w-16 rounded-full" style={{ width: '12%' }} />
                <Skeleton className="h-3" style={{ width: '12%' }} />
                <Skeleton className="h-3" style={{ width: '14%' }} />
                <Skeleton className="h-3" style={{ width: '14%' }} />
              </div>
            ))}
          </div>
          {/* Card skeleton — mobile */}
          <div className="md:hidden space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[#111111] border border-[#262626] rounded-[10px] p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-7 w-20 rounded-[8px]" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-14 rounded" />
                  <Skeleton className="h-5 w-14 rounded" />
                  <Skeleton className="h-5 w-10 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : relationships.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" aria-live="polite">
          <Users size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No relationships found</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Add your first relationship to start tracking.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
            Showing {relationships.length} of {total}
          </p>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left" aria-label="Relationships">
              <thead className="bg-[#1A1A1E] border-b border-[var(--color-border)]">
                <tr>
                  {['Name', 'Type', 'Status', 'Interest', 'Last Contact', 'Next Follow-up', ''].map((h) => (
                    <th key={h} className="py-2 px-4 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relationships.map((r) => <RelationshipRow key={r.id} rel={r} />)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3" role="list" aria-label="Relationships">
            {relationships.map((r) => (
              <div key={r.id} role="listitem">
                <RelationshipCard rel={r} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
              <button
                onClick={() => setPage(Math.max(1, (filters.page ?? 1) - 1))}
                disabled={(filters.page ?? 1) <= 1}
                aria-label="Previous page"
                className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
              >
                <ChevronLeft size={14} aria-hidden />
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">
                Page {filters.page ?? 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, (filters.page ?? 1) + 1))}
                disabled={(filters.page ?? 1) >= totalPages}
                aria-label="Next page"
                className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
              >
                <ChevronRight size={14} aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}

      {showAdd && (
        <AddRelationshipModal
          onClose={() => setShowAdd(false)}
          onCreated={() => load(filters)}
        />
      )}
    </div>
  );
}
