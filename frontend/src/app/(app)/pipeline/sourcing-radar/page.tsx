'use client';

import { useState, useEffect, useCallback } from 'react';
import { sourcingRadarApi } from '@/lib/api';
import { cn, formatRelativeDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import {
  Radar, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, Filter, Download, Upload, Globe, Zap,
} from 'lucide-react';
import type { SourceAdapter, SourcingCandidate, SourcingRadarRun } from '@/lib/types';
import Link from 'next/link';

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  healthy:       '#3FA66B',
  connected:     '#3FA66B',
  disabled:      '#A7A29A',
  misconfigured: '#D9A441',
  unreachable:   '#C35B5B',
  rate_limited:  '#D9A441',
};

const BAND_COLOR: Record<string, string> = {
  very_high: '#3FA66B',
  high:      '#5E9E7A',
  medium:    '#D9A441',
  low:       '#C48C3A',
  very_low:  '#C35B5B',
};

function scoreBar(score: number) {
  const color = score >= 70 ? '#3FA66B' : score >= 50 ? '#D9A441' : '#C35B5B';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#2A2A2E] rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
          aria-hidden
        />
      </div>
      <span className="text-xs font-mono w-7 text-right" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

// ─── Source Health Card ───────────────────────────────────────────────────────

function SourceHealthSection({
  adapters,
  onHealthCheck,
  onRunNow,
  running,
}: {
  adapters: SourceAdapter[];
  onHealthCheck: (id: string) => void;
  onRunNow: () => void;
  running: boolean;
}) {
  return (
    <section aria-labelledby="source-health-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="source-health-heading" className="text-sm font-semibold text-[#E8E6E3] tracking-wide uppercase">
          Source Health
        </h2>
        <Button variant="primary" size="sm" onClick={onRunNow} disabled={running} aria-label="Run sourcing radar scan now">
          <RefreshCw size={12} className={cn('mr-1.5', running && 'animate-spin')} aria-hidden />
          {running ? 'Scanning…' : 'Run Now'}
        </Button>
      </div>

      <div className="grid gap-2">
        {adapters.length === 0 && (
          <div className="text-sm text-[#A7A29A] py-4 text-center">No source adapters configured.</div>
        )}
        {adapters.map((adapter) => (
          <div
            key={adapter.id}
            className="bg-[#1A1A1E] border border-[#2A2A2E] rounded-md p-3 flex items-center gap-3"
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: STATUS_COLOR[adapter.status] || '#A7A29A' }}
              aria-hidden
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#E8E6E3]">{adapter.adapterName}</span>
                <span className="text-[10px] uppercase tracking-wider text-[#A7A29A]">
                  {adapter.adapterType.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-[#A7A29A] mt-0.5">
                Status: <span style={{ color: STATUS_COLOR[adapter.status] || '#A7A29A' }}>{adapter.status}</span>
                {adapter.lastSuccessAt && ` · Last success: ${formatRelativeDate(adapter.lastSuccessAt)}`}
                {adapter.lastErrorMessage && (
                  <span className="text-[#C35B5B] ml-1" role="alert">· {adapter.lastErrorMessage}</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onHealthCheck(adapter.id)}
              aria-label={`Check health for ${adapter.adapterName}`}
            >
              Check
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Last Run Summary ─────────────────────────────────────────────────────────

function LastRunSummary({ run }: { run: SourcingRadarRun | null }) {
  if (!run) {
    return (
      <section aria-labelledby="last-run-heading">
        <h2 id="last-run-heading" className="text-sm font-semibold text-[#E8E6E3] tracking-wide uppercase mb-3">
          Last Scan
        </h2>
        <div className="text-sm text-[#A7A29A]">No scans yet. Run the radar to discover targets.</div>
      </section>
    );
  }

  const statusColor = run.status === 'completed' ? '#3FA66B' : run.status === 'failed' ? '#C35B5B' : '#D9A441';

  return (
    <section aria-labelledby="last-run-heading">
      <h2 id="last-run-heading" className="text-sm font-semibold text-[#E8E6E3] tracking-wide uppercase mb-3">
        Last Scan
      </h2>
      <div className="bg-[#1A1A1E] border border-[#2A2A2E] rounded-md p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-[#A7A29A]">
            {run.completedAt ? formatRelativeDate(run.completedAt) : 'In progress'}
          </span>
          <span className="text-xs font-medium" style={{ color: statusColor }}>
            {run.status.replace('_', ' ')}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Sources tried', value: run.sourcesAttempted },
            { label: 'Succeeded',     value: run.sourcesSucceeded },
            { label: 'New targets',   value: run.newCandidatesInserted },
            { label: 'Duplicates',    value: run.duplicatesDetected },
          ].map((m) => (
            <div key={m.label} className="text-center">
              <div className="text-xl font-bold text-[#E8E6E3]">{m.value}</div>
              <div className="text-[10px] text-[#A7A29A] mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>
        {run.warnings.length > 0 && (
          <div className="mt-3 text-xs text-[#D9A441] border-t border-[#2A2A2E] pt-2" role="alert">
            <AlertTriangle size={10} className="inline mr-1" aria-hidden />
            {run.warnings.slice(0, 3).join(' · ')}
            {run.warnings.length > 3 && ` (+${run.warnings.length - 3} more)`}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Candidate Row ────────────────────────────────────────────────────────────

function CandidateRow({
  candidate,
  onAccept,
  onReject,
  onSelect,
}: {
  candidate: SourcingCandidate;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onSelect: (c: SourcingCandidate) => void;
}) {
  return (
    <div
      className="bg-[#1A1A1E] border border-[#2A2A2E] rounded-md p-3 hover:border-[#3A3A3E] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="text-sm font-medium text-[#E8E6E3] hover:text-[#C9A227] text-left"
              onClick={() => onSelect(candidate)}
              aria-label={`View details for ${candidate.name}`}
            >
              {candidate.name}
            </button>
            {candidate.dedupeStatus === 'possible_duplicate' && (
              <Badge variant="warning" aria-label="Possible duplicate">Possible duplicate</Badge>
            )}
          </div>
          <div className="text-xs text-[#A7A29A] mt-0.5">
            {[candidate.industry, candidate.city, candidate.state].filter(Boolean).join(' · ')}
            {candidate.yearsInBusiness && ` · ${candidate.yearsInBusiness}yr`}
            {candidate.sourceType && ` · via ${candidate.sourceType.replace('_', ' ')}`}
          </div>
          <div className="mt-1.5">{scoreBar(candidate.relevanceScore)}</div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelect(candidate)}
            aria-label={`View details for ${candidate.name}`}
          >
            <ChevronRight size={12} aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onAccept(candidate.id)}
            aria-label={`Accept ${candidate.name} to CRM`}
          >
            <CheckCircle2 size={12} className="mr-1" aria-hidden />
            Accept
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReject(candidate.id)}
            aria-label={`Reject ${candidate.name}`}
          >
            <XCircle size={12} aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function CandidateDetailModal({
  candidate,
  onClose,
  onAccept,
  onReject,
}: {
  candidate: SourcingCandidate;
  onClose: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Modal open onClose={onClose} title={candidate.name}>
      <div className="space-y-4">
        {/* Score */}
        <div>
          <div className="text-xs text-[#A7A29A] mb-1">Relevance Score</div>
          {scoreBar(candidate.relevanceScore)}
        </div>

        {/* Fields */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {[
            ['Industry',          candidate.industry],
            ['City',              candidate.city],
            ['State',             candidate.state],
            ['Website',          candidate.website],
            ['Phone',            candidate.phone],
            ['Email',            candidate.email],
            ['Owner',            candidate.ownerName],
            ['Years in business', candidate.yearsInBusiness],
            ['Employees',        candidate.employeeEstimate],
            ['Source',           candidate.sourceType?.replace('_', ' ')],
          ].filter(([, v]) => v != null && v !== '').map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-[#A7A29A] text-[10px] uppercase tracking-wide">{label}</dt>
              <dd className="text-[#E8E6E3] mt-0.5">{String(value)}</dd>
            </div>
          ))}
        </dl>

        {candidate.notes && (
          <div>
            <div className="text-xs text-[#A7A29A] mb-1">Notes</div>
            <p className="text-sm text-[#E8E6E3]">{candidate.notes}</p>
          </div>
        )}

        {candidate.linkedCompanyId && (
          <div className="text-xs text-[#D9A441] flex items-center gap-1.5" role="alert">
            <AlertTriangle size={12} aria-hidden />
            Matched to existing CRM company.{' '}
            <Link href={`/crm/companies/${candidate.linkedCompanyId}`} className="underline hover:text-[#E8C860]">
              View company
            </Link>
          </div>
        )}

        <div className="flex gap-2 pt-2 border-t border-[#2A2A2E]">
          <Button
            variant="primary"
            onClick={() => { onAccept(candidate.id); onClose(); }}
            aria-label={`Add ${candidate.name} to CRM`}
          >
            <CheckCircle2 size={14} className="mr-1.5" aria-hidden />
            Add to CRM
          </Button>
          <Button
            variant="ghost"
            onClick={() => { onReject(candidate.id); onClose(); }}
            aria-label={`Reject ${candidate.name}`}
          >
            <XCircle size={14} className="mr-1.5" aria-hidden />
            Reject
          </Button>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SourcingRadarPage() {
  const [adapters,     setAdapters]     = useState<SourceAdapter[]>([]);
  const [lastRun,      setLastRun]      = useState<SourcingRadarRun | null>(null);
  const [candidates,   setCandidates]   = useState<SourcingCandidate[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [running,      setRunning]      = useState(false);
  const [selected,     setSelected]     = useState<SourcingCandidate | null>(null);
  const [tab,          setTab]          = useState<'pending' | 'accepted' | 'rejected'>('pending');
  const [filterScore,  setFilterScore]  = useState('');
  const [filterState,  setFilterState]  = useState('');
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [adapterRes, candidateRes, runsRes] = await Promise.all([
        sourcingRadarApi.listAdapters(),
        sourcingRadarApi.getCandidates(),
        sourcingRadarApi.getRuns(1),
      ]);
      setAdapters(adapterRes.adapters as SourceAdapter[]);
      setCandidates(candidateRes.candidates as SourcingCandidate[]);
      setLastRun((runsRes.runs as SourcingRadarRun[])[0] || null);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to load sourcing radar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const res = await sourcingRadarApi.runScan();
      setLastRun(res.run as SourcingRadarRun);
      await load();
    } catch (err: unknown) {
      setError((err as Error).message || 'Scan failed');
    } finally {
      setRunning(false);
    }
  };

  const handleHealthCheck = async (adapterId: string) => {
    await sourcingRadarApi.healthCheck(adapterId);
    const res = await sourcingRadarApi.listAdapters();
    setAdapters(res.adapters as SourceAdapter[]);
  };

  const handleAccept = async (id: string) => {
    try {
      await sourcingRadarApi.acceptCandidate(id);
      setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, reviewStatus: 'accepted_to_crm' } : c));
    } catch (err: unknown) {
      setError((err as Error).message || 'Accept failed');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await sourcingRadarApi.updateCandidate(id, { reviewStatus: 'rejected' });
      setCandidates((prev) => prev.map((c) => c.id === id ? { ...c, reviewStatus: 'rejected' } : c));
    } catch (err: unknown) {
      setError((err as Error).message || 'Reject failed');
    }
  };

  // ── Filter candidates by tab + filters
  const displayed = candidates.filter((c) => {
    if (tab === 'pending'   && c.reviewStatus !== 'pending_review')    return false;
    if (tab === 'accepted'  && c.reviewStatus !== 'accepted_to_crm')   return false;
    if (tab === 'rejected'  && !['rejected', 'archived'].includes(c.reviewStatus)) return false;
    if (filterScore && c.relevanceScore < Number(filterScore)) return false;
    if (filterState && (c.state || '').toUpperCase() !== filterState.toUpperCase()) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#A7A29A]" aria-busy="true" aria-label="Loading sourcing radar">
        <Radar size={24} className="animate-pulse mr-2" aria-hidden />
        Loading sourcing radar…
      </div>
    );
  }

  return (
    <main className="space-y-8" aria-label="Sourcing Radar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E6E3] flex items-center gap-2">
            <Radar size={22} className="text-[#C9A227]" aria-hidden />
            Sourcing Radar
          </h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            Continuously monitors configured sources for new acquisition targets.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#2A1A1A] border border-[#C35B5B] rounded-md p-3 text-sm text-[#C35B5B]" role="alert">
          <AlertTriangle size={14} className="inline mr-1.5" aria-hidden />
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)} aria-label="Dismiss error">Dismiss</button>
        </div>
      )}

      {/* Source Health */}
      <SourceHealthSection
        adapters={adapters}
        onHealthCheck={handleHealthCheck}
        onRunNow={handleRunNow}
        running={running}
      />

      {/* Last Run */}
      <LastRunSummary run={lastRun} />

      {/* Review Queue */}
      <section aria-labelledby="review-queue-heading">
        <h2 id="review-queue-heading" className="text-sm font-semibold text-[#E8E6E3] tracking-wide uppercase mb-3">
          Candidate Review
        </h2>

        {/* Tabs */}
        <div className="flex gap-1 mb-4" role="tablist" aria-label="Candidate status tabs">
          {(['pending', 'accepted', 'rejected'] as const).map((t) => {
            const count = candidates.filter((c) =>
              t === 'pending'  ? c.reviewStatus === 'pending_review'  :
              t === 'accepted' ? c.reviewStatus === 'accepted_to_crm' :
              ['rejected', 'archived'].includes(c.reviewStatus)
            ).length;
            return (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded-md transition-colors',
                  tab === t
                    ? 'bg-[#C9A227] text-[#0A0A0B] font-semibold'
                    : 'bg-[#1A1A1E] text-[#A7A29A] hover:text-[#E8E6E3] border border-[#2A2A2E]'
                )}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)} ({count})
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap" aria-label="Candidate filters">
          <Input
            type="number"
            placeholder="Min score (0-100)"
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value)}
            className="w-40 text-sm"
            aria-label="Filter by minimum relevance score"
          />
          <Input
            placeholder="State (e.g. TX)"
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="w-32 text-sm"
            aria-label="Filter by state"
          />
          {(filterScore || filterState) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterScore(''); setFilterState(''); }} aria-label="Clear filters">
              Clear filters
            </Button>
          )}
        </div>

        {/* List */}
        <div className="space-y-2" role="list" aria-label={`${tab} candidates`}>
          {displayed.length === 0 && (
            <div className="text-sm text-[#A7A29A] text-center py-8">
              {tab === 'pending'
                ? 'No pending candidates. Run the radar to discover new targets.'
                : `No ${tab} candidates.`}
            </div>
          )}
          {displayed.map((c) => (
            <div key={c.id} role="listitem">
              <CandidateRow
                candidate={c}
                onAccept={handleAccept}
                onReject={handleReject}
                onSelect={setSelected}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Detail Modal */}
      {selected && (
        <CandidateDetailModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}
    </main>
  );
}
