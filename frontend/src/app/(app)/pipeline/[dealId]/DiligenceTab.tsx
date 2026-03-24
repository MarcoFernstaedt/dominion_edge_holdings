'use client';

/**
 * DiligenceTab — diligence document ingestion, findings, and summary.
 *
 * Sections:
 *   1. Upload strip — pick file, select type, link & analyze
 *   2. Document list — ingestion status + per-doc findings
 *   3. All findings — grouped by severity with status controls
 *   4. Summary card — readiness score, executive summary, questions by stakeholder
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  DiligenceDocument,
  DiligenceFinding,
  DiligenceSummary,
} from '@/lib/types';
import { diligenceApi } from '@/lib/api';
import { api } from '@/lib/api';

// ─── Severity colours ─────────────────────────────────────────────────────────

const SEV_STYLES: Record<string, string> = {
  fatal:    'bg-red-900/30 text-red-300 border-red-700',
  critical: 'bg-red-700/20 text-red-400 border-red-600',
  high:     'bg-orange-800/20 text-orange-300 border-orange-600',
  medium:   'bg-yellow-800/20 text-yellow-300 border-yellow-600',
  low:      'bg-slate-700/30 text-slate-400 border-slate-600',
};

const STATUS_STYLES: Record<string, string> = {
  pending:    'text-slate-500',
  processing: 'text-blue-400',
  done:       'text-emerald-400',
  failed:     'text-red-400',
};

const DOCUMENT_TYPES = [
  { value: 'cim',                   label: 'CIM / Offering Memo' },
  { value: 'financial_statements',  label: 'Financial Statements' },
  { value: 'contract',              label: 'Contract' },
  { value: 'lease',                 label: 'Lease' },
  { value: 'tax_return',            label: 'Tax Return' },
  { value: 'checklist',             label: 'Diligence Checklist' },
  { value: 'broker_notes',          label: 'Broker Notes' },
  { value: 'seller_notes',          label: 'Seller Notes' },
  { value: 'other',                 label: 'Other' },
];

const STAKEHOLDER_LABELS: Record<string, string> = {
  seller:   'Seller',
  broker:   'Broker',
  lender:   'Lender',
  attorney: 'Attorney',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface DiligenceTabProps {
  dealId: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiligenceTab({ dealId }: DiligenceTabProps) {
  const [documents, setDocuments]       = useState<DiligenceDocument[]>([]);
  const [findings,  setFindings]        = useState<DiligenceFinding[]>([]);
  const [summary,   setSummary]         = useState<DiligenceSummary | null>(null);
  const [loading,   setLoading]         = useState(true);
  const [activeTab, setActiveTab]       = useState<'docs' | 'findings' | 'summary'>('docs');
  const [synthesizing, setSynthesizing] = useState(false);

  // Upload state
  const [file,          setFile]         = useState<File | null>(null);
  const [documentType,  setDocumentType] = useState('other');
  const [uploading,     setUploading]    = useState(false);
  const [uploadError,   setUploadError]  = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Polling for processing docs
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [docsRes, findingsRes, summaryRes] = await Promise.all([
        diligenceApi.listDocuments(dealId),
        diligenceApi.listFindings(dealId),
        diligenceApi.getSummary(dealId),
      ]);
      setDocuments(docsRes.documents);
      setFindings(findingsRes.findings);
      setSummary(summaryRes.summary);
    } catch {
      // Non-fatal — show empty state
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll while any doc is processing
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.ingestionStatus === 'pending' || d.ingestionStatus === 'processing',
    );
    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(loadAll, 4000);
    }
    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [documents, loadAll]);

  // ── Upload handler ──────────────────────────────────────────────────────────

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    try {
      // 1. Request presigned upload URL
      const uploadRes = await api.post<{
        fileId: string; uploadUrl: string; key: string; bucket: string;
      }>('/api/files/upload-url', {
        originalName: file.name,
        mimeType:     file.type || 'application/octet-stream',
        entityType:   'deal',
        entityId:     dealId,
        metadata:     { purpose: 'diligence' },
      });

      // 2. Upload directly to S3
      await fetch(uploadRes.uploadUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });

      // 3. Confirm
      await api.post(`/api/files/${uploadRes.fileId}/confirm`, {
        sizeBytes: file.size,
      });

      // 4. Link to diligence
      await diligenceApi.linkDocument(dealId, {
        fileId:       uploadRes.fileId,
        documentType,
        displayName:  file.name,
      });

      // Reset
      setFile(null);
      setDocumentType('other');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadAll();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  // ── Finding status update ───────────────────────────────────────────────────

  async function handleFindingStatus(findingId: string, status: string) {
    try {
      const res = await diligenceApi.updateFinding(dealId, findingId, { status });
      setFindings((prev) => prev.map((f) => f.id === findingId ? res.finding : f));
    } catch { /* silent */ }
  }

  // ── Synthesize ──────────────────────────────────────────────────────────────

  async function handleSynthesize() {
    setSynthesizing(true);
    try {
      const res = await diligenceApi.synthesize(dealId);
      setSummary(res.summary);
      setActiveTab('summary');
    } catch { /* silent */ } finally {
      setSynthesizing(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--color-text-muted)] text-sm">
        Loading diligence data…
      </div>
    );
  }

  const fatalCount    = findings.filter((f) => f.severity === 'fatal'    && f.status === 'open').length;
  const criticalCount = findings.filter((f) => f.severity === 'critical' && f.status === 'open').length;
  const openCount     = findings.filter((f) => f.status === 'open').length;

  return (
    <div className="space-y-5">

      {/* ── Upload strip ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
          Add Diligence Document
        </h3>

        <div className="flex flex-wrap gap-3 items-end">
          {/* File picker */}
          <div className="flex-1 min-w-[180px]">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.csv,.xlsx,.doc,.docx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-[var(--color-text-muted)]
                file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0
                file:text-xs file:font-medium file:bg-[var(--color-surface-raised)]
                file:text-[var(--color-text-primary)] file:cursor-pointer"
            />
            {file && (
              <p className="mt-1 text-xs text-[var(--color-text-muted)] truncate">
                {file.name} ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          {/* Document type */}
          <div className="w-48">
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full text-xs rounded border border-[var(--color-border)]
                bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]
                px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-4 py-1.5 text-xs font-medium rounded
              bg-[var(--color-accent)] text-black
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {uploading ? 'Uploading…' : 'Link & Analyze'}
          </button>
        </div>

        {uploadError && (
          <p className="text-xs text-red-400">{uploadError}</p>
        )}
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────────────── */}
      {findings.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs text-[var(--color-text-muted)]">
          {fatalCount > 0 && (
            <span className="text-red-400 font-medium">{fatalCount} Fatal</span>
          )}
          {criticalCount > 0 && (
            <span className="text-red-500 font-medium">{criticalCount} Critical</span>
          )}
          <span>{openCount} Open findings</span>
          <span>{findings.length} Total findings</span>
          {summary && (
            <span className="ml-auto">
              Readiness: <span className="font-medium text-[var(--color-text-primary)]">
                {summary.readinessScore}/100 ({summary.readinessState.replace('_', ' ')})
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(['docs', 'findings', 'summary'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-medium capitalize transition-colors
              ${activeTab === tab
                ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)] -mb-px'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
              }`}
          >
            {tab === 'docs'     ? `Documents (${documents.length})`      : ''}
            {tab === 'findings' ? `Findings (${findings.length})`        : ''}
            {tab === 'summary'  ? 'Summary'                               : ''}
          </button>
        ))}
      </div>

      {/* ── Documents tab ────────────────────────────────────────────────────── */}
      {activeTab === 'docs' && (
        <div className="space-y-3">
          {documents.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">
              No diligence documents yet. Upload a CIM, financial statements, or contract above.
            </p>
          )}
          {documents.map((doc) => (
            <DiligenceDocCard
              key={doc.id}
              doc={doc}
              onReprocess={async () => {
                await diligenceApi.reprocess(dealId, doc.id);
                loadAll();
              }}
            />
          ))}
        </div>
      )}

      {/* ── Findings tab ─────────────────────────────────────────────────────── */}
      {activeTab === 'findings' && (
        <div className="space-y-3">
          {findings.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">
              No findings yet. Upload and analyze documents to extract red flags.
            </p>
          )}
          {(['fatal', 'critical', 'high', 'medium', 'low'] as const).map((sev) => {
            const group = findings.filter((f) => f.severity === sev);
            if (group.length === 0) return null;
            return (
              <div key={sev}>
                <h4 className="text-xs font-semibold uppercase tracking-wider
                  text-[var(--color-text-muted)] mb-2">
                  {sev} ({group.length})
                </h4>
                <div className="space-y-2">
                  {group.map((f) => (
                    <FindingCard
                      key={f.id}
                      finding={f}
                      onStatusChange={(status) => handleFindingStatus(f.id, status)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Summary tab ──────────────────────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <SummaryPanel
          summary={summary}
          synthesizing={synthesizing}
          onSynthesize={handleSynthesize}
          hasDocuments={documents.some((d) => d.ingestionStatus === 'done')}
        />
      )}
    </div>
  );
}

// ─── DiligenceDocCard ─────────────────────────────────────────────────────────

function DiligenceDocCard({
  doc,
  onReprocess,
}: {
  doc: DiligenceDocument;
  onReprocess: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--color-surface-raised)] transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Status dot */}
        <span className={`text-xs font-medium shrink-0 ${STATUS_STYLES[doc.ingestionStatus] ?? ''}`}>
          {doc.ingestionStatus === 'processing' ? '⟳ Processing…'
            : doc.ingestionStatus === 'done'       ? '✓ Done'
            : doc.ingestionStatus === 'failed'     ? '✗ Failed'
            : '○ Pending'}
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
            {doc.displayName}
          </div>
          <div className="text-xs text-[var(--color-text-muted)]">
            {DOCUMENT_TYPES.find((t) => t.value === doc.documentType)?.label ?? doc.documentType}
            {doc.wordCount && ` · ${doc.wordCount.toLocaleString()} words`}
            {doc.findings && doc.findings.length > 0 && (
              <span className="ml-2 text-amber-400">
                {doc.findings.length} finding{doc.findings.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {doc.ingestionStatus === 'failed' && (
          <button
            onClick={(e) => { e.stopPropagation(); onReprocess(); }}
            className="text-xs px-2 py-1 rounded border border-[var(--color-border)]
              text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Re-process
          </button>
        )}

        <span className="text-[var(--color-text-muted)] text-xs">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-2">
          {doc.processingError && (
            <p className="text-xs text-red-400">Error: {doc.processingError}</p>
          )}
          {doc.textPreview && (
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed line-clamp-4">
              {doc.textPreview}
            </p>
          )}
          {doc.findings && doc.findings.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {doc.findings.map((f) => (
                <div key={f.id} className={`text-xs rounded px-2 py-1.5 border ${SEV_STYLES[f.severity] ?? ''}`}>
                  <span className="font-medium uppercase mr-2">{f.severity}</span>
                  {f.title}
                </div>
              ))}
            </div>
          )}
          {doc.ingestionStatus === 'done' && (!doc.findings || doc.findings.length === 0) && (
            <p className="text-xs text-[var(--color-text-muted)]">No red flags found in this document.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FindingCard ──────────────────────────────────────────────────────────────

function FindingCard({
  finding,
  onStatusChange,
}: {
  finding: DiligenceFinding;
  onStatusChange: (status: string) => void;
}) {
  const [expanded, setExpanded] = useState(finding.severity === 'fatal' || finding.severity === 'critical');

  return (
    <div className={`rounded-lg border px-4 py-3 space-y-2 ${SEV_STYLES[finding.severity] ?? 'border-[var(--color-border)]'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="text-xs font-bold uppercase">{finding.severity}</span>
            <span className="text-xs text-[var(--color-text-muted)]">{finding.category}</span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {finding.confidence} confidence
            </span>
            {finding.document && (
              <span className="text-xs text-[var(--color-text-muted)] truncate">
                {finding.document.displayName}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">{finding.title}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={finding.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="text-xs rounded border border-current/30 bg-transparent px-1.5 py-0.5
              focus:outline-none"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="waived">Waived</option>
          </select>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-xs opacity-60 hover:opacity-100"
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 pt-1">
          {finding.sourceSnippet && (
            <blockquote className="text-xs italic border-l-2 border-current/40 pl-2 opacity-75">
              &ldquo;{finding.sourceSnippet}&rdquo;
            </blockquote>
          )}
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Why it matters: </span>
            {finding.whyItMatters}
          </p>
          <p className="text-xs leading-relaxed">
            <span className="font-medium">Recommended: </span>
            {finding.recommendedFollowUp}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SummaryPanel ─────────────────────────────────────────────────────────────

function SummaryPanel({
  summary,
  synthesizing,
  onSynthesize,
  hasDocuments,
}: {
  summary: DiligenceSummary | null;
  synthesizing: boolean;
  onSynthesize: () => void;
  hasDocuments: boolean;
}) {
  const [qTab, setQTab] = useState<'seller' | 'broker' | 'lender' | 'attorney'>('seller');

  const score = summary?.readinessScore ?? 0;
  const scoreColor =
    score >= 80 ? 'text-emerald-400'
    : score >= 60 ? 'text-yellow-400'
    : score >= 30 ? 'text-orange-400'
    : 'text-red-400';

  return (
    <div className="space-y-5">
      {/* Readiness + synthesize */}
      <div className="flex items-center gap-4">
        <div>
          <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
          <span className="text-[var(--color-text-muted)] text-sm ml-1">/100</span>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5 capitalize">
            {(summary?.readinessState ?? 'not_started').replace('_', ' ')}
          </div>
        </div>

        <button
          onClick={onSynthesize}
          disabled={synthesizing || !hasDocuments}
          className="ml-auto px-4 py-1.5 text-xs font-medium rounded
            bg-[var(--color-accent)] text-black
            disabled:opacity-40 disabled:cursor-not-allowed
            hover:opacity-90 transition-opacity"
        >
          {synthesizing ? 'Synthesizing…' : 'Synthesize Now'}
        </button>
      </div>

      {!hasDocuments && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Process at least one document before synthesizing.
        </p>
      )}

      {summary?.executiveSummary && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Executive Summary
          </h4>
          <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
            {summary.executiveSummary}
          </p>
        </div>
      )}

      {/* Top risks */}
      {summary?.topRisks && summary.topRisks.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Top Risks
          </h4>
          <div className="space-y-2">
            {summary.topRisks.map((r, i) => (
              <div
                key={i}
                className={`flex gap-3 text-xs px-3 py-2 rounded border ${SEV_STYLES[r.severity] ?? 'border-[var(--color-border)]'}`}
              >
                <span className="font-bold uppercase shrink-0">{r.severity}</span>
                <span>{r.risk}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing items */}
      {summary?.missingItems && summary.missingItems.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Missing Items
          </h4>
          <div className="space-y-1">
            {summary.missingItems.map((m, i) => (
              <div key={i} className="flex gap-2 text-xs text-[var(--color-text-muted)]">
                <span className="w-16 shrink-0 text-[var(--color-text-primary)]">{m.category}</span>
                <span>{m.item}</span>
                <span className={`ml-auto shrink-0 ${
                  m.priority === 'high' ? 'text-orange-400' : m.priority === 'medium' ? 'text-yellow-400' : ''
                }`}>{m.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stakeholder questions */}
      {summary && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-muted)] mb-2">
            Follow-Up Questions
          </h4>
          <div className="flex gap-1 mb-3">
            {(['seller', 'broker', 'lender', 'attorney'] as const).map((stakeholder) => {
              const questions = summary[`${stakeholder}Questions` as keyof DiligenceSummary] as string[] | undefined;
              const count = questions?.length ?? 0;
              return (
                <button
                  key={stakeholder}
                  onClick={() => setQTab(stakeholder)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    qTab === stakeholder
                      ? 'bg-[var(--color-accent)] text-black'
                      : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  {STAKEHOLDER_LABELS[stakeholder]} {count > 0 ? `(${count})` : ''}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            {(() => {
              const key = `${qTab}Questions` as keyof DiligenceSummary;
              const questions = summary[key] as string[] | undefined;
              if (!questions || questions.length === 0) {
                return (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    No questions generated for {STAKEHOLDER_LABELS[qTab]} yet.
                  </p>
                );
              }
              return questions.map((q, i) => (
                <div key={i} className="flex gap-2 text-xs text-[var(--color-text-primary)]">
                  <span className="text-[var(--color-text-muted)] shrink-0">{i + 1}.</span>
                  <span>{q}</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
