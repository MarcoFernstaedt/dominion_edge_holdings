'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { dealFeedApi } from '@/lib/api';
import {
  Store,
  Search,
  SlidersHorizontal,
  Bookmark,
  BookmarkCheck,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  TrendingUp,
  X,
  Upload,
} from 'lucide-react';
import type { DealFeedListing, DealFeedFilters, DealFeedSummary } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ListingCardSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
        <Skeleton className="h-7 w-10 rounded-md flex-shrink-0" />
      </div>
      {/* Financials grid */}
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Skeleton className="h-7 w-14 rounded-lg" />
        <Skeleton className="h-7 w-14 rounded-lg" />
        <Skeleton className="h-7 w-28 rounded-lg" />
      </div>
    </div>
  );
}

function DealFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading listings">
      {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(val: number | null): string {
  if (val == null) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 75 ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/40' :
    score >= 50 ? 'bg-[#C9A22720]/40  text-[#C9A227]  border-[#C9A22740]'    :
    score >= 25 ? 'bg-orange-900/40 text-orange-400 border-orange-800/30'   :
                  'bg-[#1F1F23]      text-[var(--color-text-muted)] border-[var(--color-border)]';
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}
      aria-label={`Acquisition score: ${score} out of 100`}
    >
      <TrendingUp size={10} aria-hidden /> {score}
    </span>
  );
}

// ─── Add Listing Modal ────────────────────────────────────────────────────────

interface AddListingModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddListingModal({ onClose, onCreated }: AddListingModalProps) {
  const [form, setForm] = useState({
    companyName: '', industry: '', location: '',
    revenueEstimate: '', ebitdaEstimate: '', yearsInBusiness: '',
    listingPrice: '', source: '', sourceUrl: '',
    contactName: '', contactEmail: '', contactPhone: '',
    ownerRetirementSignal: false, noWebsiteSignal: false, notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const set = (k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        companyName: form.companyName,
        industry:    form.industry    || undefined,
        location:    form.location    || undefined,
        source:      form.source      || undefined,
        sourceUrl:   form.sourceUrl   || undefined,
        contactName: form.contactName || undefined,
        contactEmail:form.contactEmail || undefined,
        contactPhone:form.contactPhone || undefined,
        notes:       form.notes       || undefined,
        ownerRetirementSignal: form.ownerRetirementSignal,
        noWebsiteSignal:       form.noWebsiteSignal,
      };
      if (form.revenueEstimate)  payload.revenueEstimate  = Number(form.revenueEstimate);
      if (form.ebitdaEstimate)   payload.ebitdaEstimate   = Number(form.ebitdaEstimate);
      if (form.yearsInBusiness)  payload.yearsInBusiness  = Number(form.yearsInBusiness);
      if (form.listingPrice)     payload.listingPrice     = Number(form.listingPrice);
      await dealFeedApi.create(payload);
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add listing"
    >
      <div className="bg-[#161618] border border-[var(--color-border)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="font-semibold text-[var(--color-text-primary)]">Add Listing</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
            <X size={16} aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded px-3 py-2">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-name">Company Name <span className="text-red-400">*</span></label>
              <input id="al-name" required value={form.companyName} onChange={(e) => set('companyName', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-industry">Industry</label>
              <input id="al-industry" value={form.industry} onChange={(e) => set('industry', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-location">Location</label>
              <input id="al-location" value={form.location} onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Austin, TX"
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-years">Years in Business</label>
              <input id="al-years" type="number" min="0" value={form.yearsInBusiness} onChange={(e) => set('yearsInBusiness', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-rev">Revenue Estimate ($)</label>
              <input id="al-rev" type="number" min="0" value={form.revenueEstimate} onChange={(e) => set('revenueEstimate', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-ebitda">EBITDA Estimate ($)</label>
              <input id="al-ebitda" type="number" min="0" value={form.ebitdaEstimate} onChange={(e) => set('ebitdaEstimate', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-price">Listing Price ($)</label>
              <input id="al-price" type="number" min="0" value={form.listingPrice} onChange={(e) => set('listingPrice', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-source">Source</label>
              <input id="al-source" value={form.source} onChange={(e) => set('source', e.target.value)}
                placeholder="e.g. bizbuysell, broker, referral"
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-url">Source URL</label>
              <input id="al-url" type="url" value={form.sourceUrl} onChange={(e) => set('sourceUrl', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-cname">Broker / Contact Name</label>
              <input id="al-cname" value={form.contactName} onChange={(e) => set('contactName', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-cemail">Broker Email</label>
              <input id="al-cemail" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-cphone">Broker Phone</label>
              <input id="al-cphone" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)}
                className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-primary)]">
              <input type="checkbox" checked={form.ownerRetirementSignal} onChange={(e) => set('ownerRetirementSignal', e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] bg-[#1A1A1E] accent-[#C9A227]" />
              Owner retirement signal
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text-primary)]">
              <input type="checkbox" checked={form.noWebsiteSignal} onChange={(e) => set('noWebsiteSignal', e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] bg-[#1A1A1E] accent-[#C9A227]" />
              No website signal
            </label>
          </div>
          <div>
            <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="al-notes">Notes</label>
            <textarea id="al-notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)}
              className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227] resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Filter panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
  filters: DealFeedFilters;
  onChange: (f: Partial<DealFeedFilters>) => void;
  onClose: () => void;
}

function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Filters</h3>
        <button onClick={onClose} aria-label="Close filters" className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-industry">Industry</label>
          <input id="f-industry" value={filters.industry ?? ''} onChange={(e) => onChange({ industry: e.target.value || undefined })}
            placeholder="e.g. HVAC"
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-location">Location</label>
          <input id="f-location" value={filters.location ?? ''} onChange={(e) => onChange({ location: e.target.value || undefined })}
            placeholder="e.g. Texas"
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-minscore">Min Score</label>
          <input id="f-minscore" type="number" min="0" max="100" value={filters.minScore ?? ''} onChange={(e) => onChange({ minScore: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="0–100"
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-minrev">Min Revenue ($)</label>
          <input id="f-minrev" type="number" min="0" value={filters.minRevenue ?? ''} onChange={(e) => onChange({ minRevenue: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-maxrev">Max Revenue ($)</label>
          <input id="f-maxrev" type="number" min="0" value={filters.maxRevenue ?? ''} onChange={(e) => onChange({ maxRevenue: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-minyears">Min Years</label>
          <input id="f-minyears" type="number" min="0" value={filters.minYears ?? ''} onChange={(e) => onChange({ minYears: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]" />
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-sort">Sort By</label>
          <select id="f-sort" value={filters.sortBy ?? 'acquisitionScore'} onChange={(e) => onChange({ sortBy: e.target.value as DealFeedFilters['sortBy'] })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="acquisitionScore">Score</option>
            <option value="revenueEstimate">Revenue</option>
            <option value="listingPrice">Price</option>
            <option value="yearsInBusiness">Years in Business</option>
            <option value="createdAt">Date Added</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-[var(--color-text-muted)] mb-1" htmlFor="f-dir">Direction</label>
          <select id="f-dir" value={filters.sortDir ?? 'desc'} onChange={(e) => onChange({ sortDir: e.target.value as 'asc' | 'desc' })}
            className="w-full bg-[#1A1A1E] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[#C9A227]">
            <option value="desc">Highest first</option>
            <option value="asc">Lowest first</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Listing card ─────────────────────────────────────────────────────────────

interface ListingCardProps {
  listing: DealFeedListing;
  saved: boolean;
  onSave: (id: string) => void;
  saving: string | null;
  importing: string | null;
  onImport: (id: string) => void;
}

function ListingCard({ listing, saved, onSave, saving, importing, onImport }: ListingCardProps) {
  const isSaving   = saving   === listing.id;
  const isImporting = importing === listing.id;
  const margin = listing.revenueEstimate && listing.ebitdaEstimate
    ? Math.round((listing.ebitdaEstimate / listing.revenueEstimate) * 100)
    : null;

  return (
    <article
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-3 hover:border-[#3A3A3E] transition-colors"
      aria-label={`Listing: ${listing.companyName}`}
    >
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
              {listing.companyName}
            </h3>
            {listing.listingStatus === 'imported' && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-sky-700/40 bg-sky-900/20 text-sky-400">
                In CRM
              </span>
            )}
            {listing.ownerRetirementSignal && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#C9A22740] bg-[#C9A22710] text-[#C9A227]" aria-label="Owner retirement signal">
                Retirement
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {[listing.industry, listing.location].filter(Boolean).join(' · ')}
          </div>
        </div>
        <ScoreBadge score={listing.acquisitionScore} />
      </div>

      {/* Financials */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Revenue</div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtMoney(listing.revenueEstimate)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">EBITDA</div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtMoney(listing.ebitdaEstimate)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Price</div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtMoney(listing.listingPrice)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">Years / Margin</div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">
            {listing.yearsInBusiness != null ? `${listing.yearsInBusiness}yr` : '—'}
            {margin != null ? ` · ${margin}%` : ''}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 flex-wrap">
        <Link
          href={`/deal-feed/${listing.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          aria-label={`View details for ${listing.companyName}`}
        >
          View <ArrowUpRight size={11} aria-hidden />
        </Link>

        <button
          onClick={() => onSave(listing.id)}
          disabled={isSaving || saved}
          aria-label={saved ? 'Listing saved' : 'Save listing'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
        >
          {isSaving ? <RefreshCw size={11} className="animate-spin" aria-hidden /> :
           saved    ? <BookmarkCheck size={11} className="text-[#C9A227]" aria-hidden /> :
                      <Bookmark size={11} aria-hidden />}
          {saved ? 'Saved' : 'Save'}
        </button>

        {listing.listingStatus !== 'imported' && (
          <button
            onClick={() => onImport(listing.id)}
            disabled={isImporting}
            aria-label={`Import ${listing.companyName} to CRM`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227]/10 border border-[#C9A227]/30 text-xs text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            {isImporting ? <RefreshCw size={11} className="animate-spin" aria-hidden /> : <Upload size={11} aria-hidden />}
            Import to CRM
          </button>
        )}
      </div>
    </article>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: DealFeedFilters = {
  sortBy: 'acquisitionScore',
  sortDir: 'desc',
  page: 1,
  pageSize: 20,
};

export default function DealFeedPage() {
  const [listings,  setListings]  = useState<DealFeedListing[]>([]);
  const [summary,   setSummary]   = useState<DealFeedSummary | null>(null);
  const [total,     setTotal]     = useState(0);
  const [totalPages,setTotalPages]= useState(1);
  const [filters,   setFilters]   = useState<DealFeedFilters>(DEFAULT_FILTERS);
  const [savedIds,  setSavedIds]  = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [showFilters,setShowFilters] = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [search,    setSearch]    = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadListings = useCallback(async (f: DealFeedFilters) => {
    setLoading(true);
    try {
      const [feedRes, summaryRes, savedRes] = await Promise.all([
        dealFeedApi.list(f),
        dealFeedApi.getSummary(),
        dealFeedApi.getSaved(),
      ]);
      setListings(feedRes.listings);
      setTotal(feedRes.total);
      setTotalPages(feedRes.totalPages);
      setSummary(summaryRes);
      const ids = new Set<string>(
        ((savedRes as { saved: { listingId: string }[] }).saved ?? []).map((s) => s.listingId)
      );
      setSavedIds(ids);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadListings(filters); }, []);

  // Debounced search
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const next = { ...filters, search: val || undefined, page: 1 };
      setFilters(next);
      loadListings(next);
    }, 400);
  };

  const applyFilters = (patch: Partial<DealFeedFilters>) => {
    const next = { ...filters, ...patch, page: 1 };
    setFilters(next);
    loadListings(next);
  };

  const setPage = (p: number) => {
    const next = { ...filters, page: p };
    setFilters(next);
    loadListings(next);
  };

  const handleSave = async (id: string) => {
    setSaving(id);
    try {
      await dealFeedApi.save(id);
      setSavedIds((prev) => new Set(prev).add(id));
    } catch { /* silent */ }
    finally { setSaving(null); }
  };

  const handleImport = async (id: string) => {
    setImporting(id);
    try {
      await dealFeedApi.import(id);
      await loadListings(filters);
    } catch { /* silent */ }
    finally { setImporting(null); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Store size={22} className="text-[#C9A227]" aria-hidden />
            Deal Feed
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {summary ? `${summary.activeListings} active listings · avg score ${summary.avgScore}/100` : 'Verified deal marketplace'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <Plus size={14} aria-hidden /> Add Listing
          </button>
          <button
            onClick={() => loadListings(filters)}
            disabled={loading}
            aria-label="Refresh feed"
            className="p-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="region" aria-label="Feed summary">
          {[
            { label: 'Active',   value: summary.activeListings },
            { label: 'Saved',    value: summary.savedListings  },
            { label: 'Imported', value: summary.importedListings },
            { label: 'Avg Score',value: `${summary.avgScore}/100` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)]">{label}</div>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" aria-hidden />
          <input
            type="search"
            placeholder="Search by name, industry, or location…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            aria-label="Search listings"
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

      {/* Filter panel */}
      {showFilters && (
        <FilterPanel
          filters={filters}
          onChange={applyFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Listing grid */}
      {loading ? (
        <DealFeedSkeleton />
      ) : listings.length === 0 ? (
        <div className="text-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl" aria-live="polite">
          <Store size={32} className="mx-auto mb-3 text-[var(--color-text-muted)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No listings found</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Try adjusting filters or add a listing manually.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-text-muted)]" aria-live="polite">
            Showing {listings.length} of {total} listings
          </p>
          <div
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            role="list"
            aria-label="Deal listings"
          >
            {listings.map((listing) => (
              <div key={listing.id} role="listitem">
                <ListingCard
                  listing={listing}
                  saved={savedIds.has(listing.id)}
                  onSave={handleSave}
                  saving={saving}
                  importing={importing}
                  onImport={handleImport}
                />
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav
              className="flex items-center justify-center gap-2 pt-4"
              aria-label="Pagination"
            >
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

      {/* Add listing modal */}
      {showAdd && (
        <AddListingModal
          onClose={() => setShowAdd(false)}
          onCreated={() => loadListings(filters)}
        />
      )}
    </div>
  );
}
