'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { conversationsApi } from '@/lib/api';
import { ConversationKPIWidget } from '@/components/modules/ConversationKPIWidget';
import {
  MessageCircle,
  Plus,
  Search,
  RefreshCw,
  Building2,
  Briefcase,
  TrendingUp,
  Phone,
  Video,
  Users,
  Mail,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  SlidersHorizontal,
  Trash2,
  BarChart2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type {
  RelationshipConversation,
  ConversationEntityType,
  ConversationType,
  ConversationFilters,
  ConversationTrendWeek,
  ConversationWeeklyReport,
} from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ConversationsSkeleton() {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--color-border)]" aria-busy="true" aria-label="Loading conversations">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[#1A1A1E] border-b border-[var(--color-border)]">
            <tr>
              {['Contact', 'Type', 'Channel', 'Date', 'Summary', ''].map((h, i) => (
                <th key={i} className="py-2 px-4 text-left">
                  <Skeleton className="h-2.5" style={{ width: h === '' ? 24 : `${50 + i * 10}%` }} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                {/* Contact */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-3.5 h-3.5 rounded flex-shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-2.5 w-20" />
                    </div>
                  </div>
                </td>
                {/* Type badge */}
                <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                {/* Channel */}
                <td className="py-3 px-4"><Skeleton className="h-5 w-16 rounded-full" /></td>
                {/* Date */}
                <td className="py-3 px-4"><Skeleton className="h-3 w-20" /></td>
                {/* Summary */}
                <td className="py-3 px-4"><Skeleton className="h-3 w-48" /></td>
                {/* Delete */}
                <td className="py-3 px-4 text-right"><Skeleton className="h-5 w-5 ml-auto rounded" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="md:hidden space-y-3" aria-busy="true" aria-label="Loading conversations">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-3.5 h-3.5 rounded flex-shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="w-5 h-5 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="h-5 w-20 rounded" />
              <Skeleton className="h-5 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Display helpers ──────────────────────────────────────────────────────────

const ENTITY_ICON: Record<ConversationEntityType, LucideIcon> = {
  seller:       Building2,
  board_member: Briefcase,
  investor:     TrendingUp,
};
const ENTITY_COLOR: Record<ConversationEntityType, string> = {
  seller:       'text-sky-400',
  board_member: 'text-violet-400',
  investor:     'text-[#C9A227]',
};
const ENTITY_LABEL: Record<ConversationEntityType, string> = {
  seller: 'Seller', board_member: 'Board Member', investor: 'Investor',
};
const CONV_TYPE_ICON: Record<ConversationType, LucideIcon> = {
  phone:        Phone,
  zoom:         Video,
  meeting:      Users,
  email_thread: Mail,
};
const CONV_TYPE_LABEL: Record<ConversationType, string> = {
  phone: 'Phone', zoom: 'Zoom', meeting: 'Meeting', email_thread: 'Email Thread',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Trend sparkline (pure SVG) ───────────────────────────────────────────────

function TrendSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max  = Math.max(...data, 1);
  const w    = 80;
  const h    = 28;
  const step = w / (data.length - 1);
  const pts  = data.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} aria-hidden role="img" aria-label="Trend sparkline">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Record Conversation Modal ────────────────────────────────────────────────

function RecordModal({ onClose, onRecorded }: { onClose: () => void; onRecorded: () => void }) {
  const [form, setForm] = useState({
    entityType:          'seller' as ConversationEntityType,
    entityName:          '',
    company:             '',
    conversationType:    'phone' as ConversationType,
    conversationSummary: '',
    date:                new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      await conversationsApi.record(form);
      onRecorded(); onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record conversation');
    } finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" aria-label="Record conversation"
    >
      <div className="bg-[#161618] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Record Conversation</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-type">Contact Type <span className="text-red-400">*</span></label>
              <select id="rc-type" value={form.entityType} onChange={(e) => set('entityType', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="seller">Seller</option>
                <option value="board_member">Board Member</option>
                <option value="investor">Investor</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-conv">Conversation Type <span className="text-red-400">*</span></label>
              <select id="rc-conv" value={form.conversationType} onChange={(e) => set('conversationType', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
                <option value="phone">Phone</option>
                <option value="zoom">Zoom</option>
                <option value="meeting">Meeting</option>
                <option value="email_thread">Email Thread</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-name">Contact Name <span className="text-red-400">*</span></label>
              <input id="rc-name" required value={form.entityName} onChange={(e) => set('entityName', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-company">Company</label>
              <input id="rc-company" value={form.company} onChange={(e) => set('company', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-date">Date</label>
              <input id="rc-date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="rc-summary">Summary</label>
            <textarea id="rc-summary" rows={4} value={form.conversationSummary} onChange={(e) => set('conversationSummary', e.target.value)}
              placeholder="Key topics discussed, outcomes, next steps…"
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227] resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50">
              {saving ? 'Recording…' : 'Record Conversation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Trend chart ──────────────────────────────────────────────────────────────

function TrendSection({ trends }: { trends: ConversationTrendWeek[] }) {
  const series = [
    { key: 'seller'       as keyof ConversationTrendWeek, label: 'Sellers',      color: '#38bdf8' },
    { key: 'board_member' as keyof ConversationTrendWeek, label: 'Board Members', color: '#a78bfa' },
    { key: 'investor'     as keyof ConversationTrendWeek, label: 'Investors',    color: '#C9A227' },
  ];

  return (
    <section aria-label="Conversation trends" className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2 mb-4">
        <BarChart2 size={14} className="text-[#C9A227]" aria-hidden />
        8-Week Trend
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {series.map(({ key, label, color }) => {
          const values = trends.map((t) => Number(t[key]) || 0);
          const total  = values.reduce((a, b) => a + b, 0);
          const avg    = values.length ? (total / values.length).toFixed(1) : '0';
          const latest = values[values.length - 1] ?? 0;
          return (
            <div key={String(key)} className="bg-[#1A1A1E] rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color }}>{label}</span>
                <span className="text-lg font-bold text-[var(--color-text-primary)]">{latest}</span>
              </div>
              <TrendSparkline data={values} color={color} />
              <p className="text-[10px] text-[var(--color-text-muted)]">avg {avg}/wk · total {total}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── Conversation row ─────────────────────────────────────────────────────────

function ConversationRow({
  conv,
  onDelete,
}: {
  conv: RelationshipConversation;
  onDelete: (id: string) => void;
}) {
  const EIcon = ENTITY_ICON[conv.entityType];
  const CIcon = CONV_TYPE_ICON[conv.conversationType];
  const color = ENTITY_COLOR[conv.entityType];

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[#1A1A1E] transition-colors group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <EIcon size={13} className={`${color} flex-shrink-0`} aria-hidden />
          <span className="text-xs font-medium text-[var(--color-text-primary)]">{conv.entityName}</span>
        </div>
        {conv.company && <div className="text-[10px] text-[var(--color-text-muted)] pl-5 mt-0.5">{conv.company}</div>}
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-[var(--color-text-muted)]">{ENTITY_LABEL[conv.entityType]}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <CIcon size={11} aria-hidden />
          {CONV_TYPE_LABEL[conv.conversationType]}
        </div>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-[var(--color-text-muted)]">{fmtDate(conv.date)}</span>
      </td>
      <td className="py-3 px-4 max-w-[260px]">
        {conv.conversationSummary ? (
          <p className="text-xs text-[var(--color-text-muted)] truncate">{conv.conversationSummary}</p>
        ) : (
          <span className="text-[10px] text-[var(--color-text-muted)] italic">No summary</span>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <button
          onClick={() => onDelete(conv.id)}
          aria-label={`Delete conversation with ${conv.entityName}`}
          className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded p-1"
        >
          <Trash2 size={12} aria-hidden />
        </button>
      </td>
    </tr>
  );
}

// ─── Mobile card ──────────────────────────────────────────────────────────────

function ConversationCard({ conv, onDelete }: { conv: RelationshipConversation; onDelete: (id: string) => void }) {
  const EIcon = ENTITY_ICON[conv.entityType];
  const CIcon = CONV_TYPE_ICON[conv.conversationType];
  const color = ENTITY_COLOR[conv.entityType];

  return (
    <article
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-2"
      aria-label={`Conversation with ${conv.entityName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <EIcon size={14} className={color} aria-hidden />
          <div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)]">{conv.entityName}</div>
            {conv.company && <div className="text-xs text-[var(--color-text-muted)]">{conv.company}</div>}
          </div>
        </div>
        <button onClick={() => onDelete(conv.id)} aria-label="Delete" className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded p-1">
          <Trash2 size={12} aria-hidden />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">{ENTITY_LABEL[conv.entityType]}</span>
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">
          <CIcon size={9} aria-hidden /> {CONV_TYPE_LABEL[conv.conversationType]}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-[#1A1A1E] text-[var(--color-text-muted)]">{fmtDate(conv.date)}</span>
      </div>
      {conv.conversationSummary && (
        <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{conv.conversationSummary}</p>
      )}
    </article>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

function FilterPanel({ filters, onChange, onClose }: {
  filters: ConversationFilters;
  onChange: (p: Partial<ConversationFilters>) => void;
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
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="cf-type">Contact Type</label>
          <select id="cf-type" value={filters.entityType ?? ''} onChange={(e) => onChange({ entityType: (e.target.value as ConversationEntityType) || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="">All Types</option>
            <option value="seller">Seller</option>
            <option value="board_member">Board Member</option>
            <option value="investor">Investor</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="cf-conv">Conversation Type</label>
          <select id="cf-conv" value={filters.conversationType ?? ''} onChange={(e) => onChange({ conversationType: (e.target.value as ConversationType) || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="">All</option>
            <option value="phone">Phone</option>
            <option value="zoom">Zoom</option>
            <option value="meeting">Meeting</option>
            <option value="email_thread">Email Thread</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="cf-from">Date From</label>
          <input id="cf-from" type="date" value={filters.dateFrom ?? ''} onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="cf-to">Date To</label>
          <input id="cf-to" type="date" value={filters.dateTo ?? ''} onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: ConversationFilters = { sortDir: 'desc', page: 1, pageSize: 50 };

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<RelationshipConversation[]>([]);
  const [report,        setReport]        = useState<ConversationWeeklyReport | null>(null);
  const [trends,        setTrends]        = useState<ConversationTrendWeek[]>([]);
  const [total,         setTotal]         = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [filters,       setFilters]       = useState<ConversationFilters>(DEFAULT_FILTERS);
  const [loading,       setLoading]       = useState(true);
  const [showFilters,   setShowFilters]   = useState(false);
  const [showRecord,    setShowRecord]    = useState(false);
  const [search,        setSearch]        = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (f: ConversationFilters) => {
    setLoading(true);
    try {
      const [listRes, reportRes, trendsRes] = await Promise.all([
        conversationsApi.list(f),
        conversationsApi.getWeeklyReport(),
        conversationsApi.getTrends(8),
      ]);
      setConversations(listRes.conversations);
      setTotal(listRes.total);
      setTotalPages(listRes.totalPages);
      setReport(reportRes);
      setTrends(trendsRes.trends);
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

  const applyFilters = (patch: Partial<ConversationFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next); load(next);
  };

  const setPage = (p: number) => {
    const next = { ...filters, page: p };
    setFilters(next); load(next);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await conversationsApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setTotal((t) => t - 1);
    } catch { /* silent */ }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <MessageCircle size={22} className="text-[#C9A227]" aria-hidden />
            Conversations
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {report ? `${report.kpi.items.reduce((s, k) => s + k.count, 0)} this week · ${total} total logged` : 'Relationship Conversation KPI System'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRecord(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Plus size={14} aria-hidden /> Record Conversation
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

      {/* KPI widget */}
      {report && (
        <ConversationKPIWidget
          kpi={report.kpi}
          alerts={report.alerts}
          showLink={false}
        />
      )}

      {/* Weekly report summary */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="region" aria-label="Weekly report">
          {[
            { label: 'Seller Convs',  value: report.kpi.items.find((k) => k.entityType === 'seller')?.count       ?? 0, target: report.kpi.items.find((k) => k.entityType === 'seller')?.target       },
            { label: 'Board Convs',   value: report.kpi.items.find((k) => k.entityType === 'board_member')?.count ?? 0, target: report.kpi.items.find((k) => k.entityType === 'board_member')?.target },
            { label: 'Investor Convs',value: report.kpi.items.find((k) => k.entityType === 'investor')?.count     ?? 0, target: report.kpi.items.find((k) => k.entityType === 'investor')?.target     },
            { label: 'New Opportunities', value: report.conversions.toOpportunities, target: undefined },
          ].map(({ label, value, target }) => (
            <div key={label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">
                {value}{target != null ? <span className="text-sm text-[var(--color-text-muted)] font-normal"> / {target}</span> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Trend chart */}
      {trends.length > 0 && <TrendSection trends={trends} />}

      {/* Pipeline health alerts */}
      {report && report.alerts.length > 0 && (
        <section aria-label="Pipeline health alerts" className="space-y-2">
          {report.alerts.map((alert) => (
            <div key={alert.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
              alert.severity === 'critical'
                ? 'bg-red-900/15 border-red-700/30 text-red-400'
                : 'bg-[#C9A22720]/15 border-[#C9A22730] text-[#C9A227]'
            }`} role="alert">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <div className="font-semibold">{alert.title}</div>
                <div className="text-xs mt-0.5 opacity-80">{alert.message}</div>
                <div className="text-xs mt-1 font-medium">→ {alert.action}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
          <input
            type="search" placeholder="Search by name, company, or summary…"
            value={search} onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search conversations"
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
          />
        </div>
        <button
          onClick={() => setShowFilters((p) => !p)}
          aria-expanded={showFilters} aria-label="Toggle filters"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${
            showFilters ? 'border-[#C9A227] text-[#C9A227] bg-[#C9A227]/10' : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <SlidersHorizontal size={14} aria-hidden /> Filters
        </button>
      </div>

      {showFilters && <FilterPanel filters={filters} onChange={applyFilters} onClose={() => setShowFilters(false)} />}

      {/* List */}
      {loading ? (
        <ConversationsSkeleton />
      ) : conversations.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" aria-live="polite">
          <MessageCircle size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No conversations logged</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Record your first conversation to start tracking KPIs.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
            Showing {conversations.length} of {total}
          </p>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left min-w-[640px]" aria-label="Conversations">
              <thead className="bg-[#1A1A1E] border-b border-[var(--color-border)]">
                <tr>
                  {['Contact', 'Type', 'Channel', 'Date', 'Summary', ''].map((h) => (
                    <th key={h} className="py-2 px-4 text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conversations.map((c) => <ConversationRow key={c.id} conv={c} onDelete={handleDelete} />)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3" role="list" aria-label="Conversations">
            {conversations.map((c) => (
              <div key={c.id} role="listitem">
                <ConversationCard conv={c} onDelete={handleDelete} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2 pt-2" aria-label="Pagination">
              <button onClick={() => setPage(Math.max(1, (filters.page ?? 1) - 1))} disabled={(filters.page ?? 1) <= 1}
                aria-label="Previous page" className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]">
                <ChevronLeft size={14} aria-hidden />
              </button>
              <span className="text-xs text-[var(--color-text-muted)]">Page {filters.page ?? 1} of {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, (filters.page ?? 1) + 1))} disabled={(filters.page ?? 1) >= totalPages}
                aria-label="Next page" className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]">
                <ChevronRight size={14} aria-hidden />
              </button>
            </nav>
          )}
        </>
      )}

      {showRecord && (
        <RecordModal onClose={() => setShowRecord(false)} onRecorded={() => load(filters)} />
      )}
    </div>
  );
}
