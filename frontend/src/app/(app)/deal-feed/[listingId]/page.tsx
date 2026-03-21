'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { dealFeedApi } from '@/lib/api';
import {
  ArrowLeft,
  Store,
  Bookmark,
  BookmarkCheck,
  Upload,
  RefreshCw,
  TrendingUp,
  MapPin,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import type {
  DealFeedListing,
  DealFeedScoreBreakdownItem,
} from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Detail skeleton ───────────────────────────────────────────────────────────

function ListingDetailSkeleton() {
  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" aria-busy="true" aria-label="Loading listing">
      {/* Back nav */}
      <Skeleton className="h-4 w-24" />
      {/* Hero */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-36" />
          </div>
          {/* Score ring placeholder */}
          <Skeleton className="w-20 h-20 rounded-full flex-shrink-0" />
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-20 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: financials + description + score breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial estimates */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-4">
            <Skeleton className="h-4 w-36" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-14" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          </div>
          {/* Description */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          {/* Score breakdown */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-36" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 flex-1 rounded-full" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
        {/* Right: details + contact */}
        <div className="space-y-6">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-20" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex justify-between gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(val: number | null): string {
  if (val == null) return '—';
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)     return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? '#10b981' :
    score >= 50 ? '#f59e0b' :
    score >= 25 ? '#f97316' :
                  '#6b7280';

  return (
    <div
      className="relative inline-flex items-center justify-center w-20 h-20"
      role="img"
      aria-label={`Acquisition score: ${score} out of 100`}
    >
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#2a2a2e" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray={`${score} ${100 - score}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-[var(--color-text-primary)]">{score}</span>
        <span className="text-[9px] text-[var(--color-text-muted)] -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

function ScoreBreakdownBar({ item }: { item: DealFeedScoreBreakdownItem }) {
  const pct = item.maxPts > 0 ? Math.round((item.pts / item.maxPts) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--color-text-muted)]">{item.factor}</span>
        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
          {item.pts} / {item.maxPts}
        </span>
      </div>
      <div className="h-1.5 bg-[#2a2a2e] rounded-full overflow-hidden" role="progressbar" aria-valuenow={item.pts} aria-valuemin={0} aria-valuemax={item.maxPts} aria-label={item.factor}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct >= 20 ? '#f97316' : '#6b7280',
          }}
        />
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon size={14} className="text-[var(--color-text-muted)] mt-0.5 flex-shrink-0" aria-hidden />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
        <div className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function RiskIndicators({ listing }: { listing: DealFeedListing }) {
  const risks: { label: string; active: boolean; severity: 'warn' | 'ok' }[] = [
    {
      label: 'Owner retirement signal',
      active: listing.ownerRetirementSignal,
      severity: 'ok',
    },
    {
      label: 'No website detected',
      active: listing.noWebsiteSignal,
      severity: 'warn',
    },
    {
      label: 'Limited financial disclosure',
      active: listing.revenueEstimate == null && listing.ebitdaEstimate == null,
      severity: 'warn',
    },
    {
      label: 'No price listed',
      active: listing.listingPrice == null,
      severity: 'warn',
    },
    {
      label: 'Young business (< 3 years)',
      active: listing.yearsInBusiness != null && listing.yearsInBusiness < 3,
      severity: 'warn',
    },
  ];

  const active = risks.filter((r) => r.active);

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
      <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Risk Indicators</h2>
      {active.length === 0 ? (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 size={13} aria-hidden /> No risk flags identified
        </p>
      ) : (
        <ul className="space-y-2">
          {active.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-xs">
              {r.severity === 'warn' ? (
                <AlertTriangle size={13} className="text-[#C9A227] flex-shrink-0" aria-hidden />
              ) : (
                <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" aria-hidden />
              )}
              <span className={r.severity === 'ok' ? 'text-emerald-400' : 'text-[#C9A227]'}>{r.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ListingDetailPage() {
  const params = useParams<{ listingId: string }>();
  const router = useRouter();

  const [listing,       setListing]       = useState<DealFeedListing | null>(null);
  const [breakdown,     setBreakdown]     = useState<DealFeedScoreBreakdownItem[]>([]);
  const [saved,         setSaved]         = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [importing,     setImporting]     = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [error,         setError]         = useState('');

  useEffect(() => {
    if (!params?.listingId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [detail, savedRes] = await Promise.all([
          dealFeedApi.get(params.listingId),
          dealFeedApi.getSaved(),
        ]);
        setListing(detail.listing);
        setBreakdown(detail.scoreBreakdown ?? []);
        const ids = new Set<string>(
          ((savedRes as { saved: { listingId: string }[] }).saved ?? []).map((s) => s.listingId)
        );
        setSaved(ids.has(params.listingId));
      } catch {
        setError('Listing not found or could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params?.listingId]);

  const handleSave = async () => {
    if (!listing || saving || saved) return;
    setSaving(true);
    try {
      await dealFeedApi.save(listing.id);
      setSaved(true);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const handleImport = async () => {
    if (!listing || importing) return;
    setImporting(true);
    try {
      const result = await dealFeedApi.import(listing.id);
      setImportSuccess(true);
      setListing((prev) => prev ? { ...prev, listingStatus: 'imported' } : prev);
      if (!result.alreadyImported) {
        setTimeout(() => router.push('/pipeline'), 2000);
      }
    } catch { /* silent */ }
    finally { setImporting(false); }
  };

  if (loading) {
    return <ListingDetailSkeleton />;
  }

  if (error || !listing) {
    return (
      <div className="p-6 space-y-4">
        <Link href="/deal-feed" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
          <ArrowLeft size={14} aria-hidden /> Back to Feed
        </Link>
        <div className="bg-[var(--color-surface)] border border-red-800/30 rounded-xl p-6 text-center">
          <AlertTriangle size={24} className="mx-auto mb-2 text-red-400" aria-hidden />
          <p className="text-sm text-[var(--color-text-primary)]">{error || 'Listing not found'}</p>
        </div>
      </div>
    );
  }

  const margin = listing.revenueEstimate && listing.ebitdaEstimate
    ? ((listing.ebitdaEstimate / listing.revenueEstimate) * 100).toFixed(1)
    : null;

  const priceMultiple = listing.listingPrice && listing.revenueEstimate
    ? (listing.listingPrice / listing.revenueEstimate).toFixed(1)
    : null;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Back nav */}
      <Link
        href="/deal-feed"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
      >
        <ArrowLeft size={14} aria-hidden /> Back to Feed
      </Link>

      {/* Hero */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{listing.companyName}</h1>
              {listing.listingStatus === 'imported' && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-sky-700/40 bg-sky-900/20 text-sky-400">
                  In CRM
                </span>
              )}
              {listing.ownerRetirementSignal && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-[#C9A22740] bg-[#C9A22710] text-[#C9A227]">
                  Retirement Signal
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-muted)]">
              {listing.industry && (
                <span className="flex items-center gap-1">
                  <Building2 size={12} aria-hidden /> {listing.industry}
                </span>
              )}
              {listing.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} aria-hidden /> {listing.location}
                </span>
              )}
            </div>
          </div>
          <ScoreRing score={listing.acquisitionScore} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[var(--color-border)]">
          <button
            onClick={handleSave}
            disabled={saving || saved}
            aria-label={saved ? 'Listing saved' : 'Save listing'}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
          >
            {saving ? <RefreshCw size={13} className="animate-spin" aria-hidden /> :
             saved  ? <BookmarkCheck size={13} className="text-[#C9A227]" aria-hidden /> :
                      <Bookmark size={13} aria-hidden />}
            {saved ? 'Saved' : 'Save Listing'}
          </button>

          {listing.listingStatus !== 'imported' ? (
            <button
              onClick={handleImport}
              disabled={importing}
              aria-label="Import listing to CRM pipeline"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
            >
              {importing ? <RefreshCw size={13} className="animate-spin" aria-hidden /> : <Upload size={13} aria-hidden />}
              Import to CRM Pipeline
            </button>
          ) : (
            <Link
              href="/pipeline"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-sky-700/40 text-sky-400 text-sm hover:border-sky-600/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
            >
              View in Pipeline <ExternalLink size={13} aria-hidden />
            </Link>
          )}

          {importSuccess && !importing && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} aria-hidden /> Imported — redirecting to pipeline…
            </span>
          )}

          {listing.sourceUrl && (
            <a
              href={listing.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]"
              aria-label="View original listing source (opens in new tab)"
            >
              Source <ExternalLink size={12} aria-hidden />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Financial overview */}
          <section aria-label="Financial overview">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">
                Financial Estimates
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Revenue',        value: fmtMoney(listing.revenueEstimate) },
                  { label: 'EBITDA',         value: fmtMoney(listing.ebitdaEstimate)  },
                  { label: 'Listing Price',  value: fmtMoney(listing.listingPrice)    },
                  { label: 'EBITDA Margin',  value: margin ? `${margin}%` : '—'       },
                  { label: 'Rev Multiple',   value: priceMultiple ? `${priceMultiple}×` : '—' },
                  { label: 'Years in Biz',   value: listing.yearsInBusiness != null ? `${listing.yearsInBusiness} yrs` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#1A1A1E] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</div>
                    <div className="text-base font-bold text-[var(--color-text-primary)] mt-1">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Business details */}
          <section aria-label="Business details">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Business Details</h2>
              <InfoRow icon={Building2}  label="Industry"      value={listing.industry  || '—'} />
              <InfoRow icon={MapPin}     label="Location"      value={listing.location  || '—'} />
              <InfoRow icon={Calendar}   label="Years in Business" value={listing.yearsInBusiness != null ? `${listing.yearsInBusiness} years` : '—'} />
              <InfoRow icon={Store}      label="Source"        value={listing.source    || '—'} />
              <InfoRow icon={TrendingUp} label="Listing Status" value={
                <span className={`capitalize ${listing.listingStatus === 'imported' ? 'text-sky-400' : 'text-[var(--color-text-primary)]'}`}>
                  {listing.listingStatus}
                </span>
              } />
            </div>
          </section>

          {/* Broker / Seller contact */}
          {(listing.contactName || listing.contactEmail || listing.contactPhone) && (
            <section aria-label="Broker contact">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Broker / Contact</h2>
                {listing.contactName  && <InfoRow icon={User}  label="Name"  value={listing.contactName}  />}
                {listing.contactEmail && (
                  <InfoRow icon={Mail} label="Email" value={
                    <a href={`mailto:${listing.contactEmail}`} className="text-[#C9A227] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
                      {listing.contactEmail}
                    </a>
                  } />
                )}
                {listing.contactPhone && (
                  <InfoRow icon={Phone} label="Phone" value={
                    <a href={`tel:${listing.contactPhone}`} className="text-[#C9A227] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded">
                      {listing.contactPhone}
                    </a>
                  } />
                )}
              </div>
            </section>
          )}

          {/* Notes */}
          {listing.notes && (
            <section aria-label="Listing notes">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Notes</h2>
                <p className="text-sm text-[var(--color-text-muted)] whitespace-pre-wrap">{listing.notes}</p>
              </div>
            </section>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Score breakdown */}
          <section aria-label="Acquisition score breakdown">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-[#C9A227]" aria-hidden />
                Score Breakdown
              </h2>
              <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
                Acquisition attractiveness: <strong className="text-[var(--color-text-primary)]">{listing.acquisitionScore}/100</strong>
              </p>
              <div className="space-y-3">
                {breakdown.map((item) => (
                  <ScoreBreakdownBar key={item.factor} item={item} />
                ))}
              </div>
            </div>
          </section>

          {/* Risk indicators */}
          <RiskIndicators listing={listing} />

          {/* Financial ratio reference */}
          {listing.revenueEstimate && listing.listingPrice && (
            <section aria-label="Valuation context">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-[#C9A227]" aria-hidden />
                  Valuation Context
                </h2>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Price / Revenue</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {priceMultiple ? `${priceMultiple}×` : '—'}
                    </span>
                  </div>
                  {listing.ebitdaEstimate && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-muted)]">Price / EBITDA</span>
                      <span className="font-semibold text-[var(--color-text-primary)]">
                        {(listing.listingPrice! / listing.ebitdaEstimate).toFixed(1)}×
                      </span>
                    </div>
                  )}
                  <div className="pt-1 border-t border-[var(--color-border)]">
                    <p className="text-[var(--color-text-muted)] text-[10px]">
                      QLA target: 3–5× SDE · SBA max $5M
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Metadata */}
          <div className="text-[10px] text-[var(--color-text-muted)] space-y-0.5 px-1">
            <div>Added: {new Date(listing.createdAt).toLocaleDateString()}</div>
            <div>Updated: {new Date(listing.updatedAt).toLocaleDateString()}</div>
            {listing.externalId && <div>External ID: {listing.externalId}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
