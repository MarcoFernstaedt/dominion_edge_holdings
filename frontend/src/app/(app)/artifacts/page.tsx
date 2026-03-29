'use client';

import { useState, useEffect, useCallback } from 'react';
import { artifactsApi, exportsApi, quickActionsApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import {
  FileText, Plus, RefreshCw, Archive, Download, Send,
  AlertTriangle, CheckCircle, Clock, AlertCircle, ChevronDown,
  Eye, RotateCcw, X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Artifact {
  artifactId?: string;
  id?: string;
  title: string;
  artifactType: string;
  status: string;
  approvalStatus?: string;
  format?: string;
  version?: number;
  createdAt: string;
  staleAfter?: string;
  generatedBySystem?: boolean;
  content?: string;
}

interface ExportRecord {
  export_id: string;
  artifact_id: string;
  artifact_type: string;
  export_type: string;
  requested_by: string;
  requested_at: string;
  completed_at?: string;
  status: string;
  destination?: string;
  stale_warning_at_export: boolean;
  warnings: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARTIFACT_TYPES = [
  { value: 'email_draft',         label: 'Email Draft' },
  { value: 'letter_draft',        label: 'Letter Draft' },
  { value: 'memo',                label: 'Memo' },
  { value: 'deal_memo',           label: 'Deal Memo' },
  { value: 'pitch_deck_outline',  label: 'Pitch Deck Outline' },
  { value: 'board_pitch',         label: 'Board Pitch' },
  { value: 'investor_update',     label: 'Investor Update' },
  { value: 'intro_request_draft', label: 'Intro Request Draft' },
  { value: 'follow_up_sequence',  label: 'Follow-up Sequence' },
  { value: 'loi',                 label: 'LOI' },
  { value: 'diligence_checklist', label: 'Diligence Checklist' },
];

const EXPORT_TYPES = [
  { value: 'email',    label: 'Email' },
  { value: 'pdf',      label: 'PDF' },
  { value: 'docx',     label: 'Word Document' },
  { value: 'clipboard', label: 'Clipboard (plain text)' },
];

const STATUS_COLORS: Record<string, string> = {
  draft:                    'text-[#737373]',
  ready:                    'text-blue-400',
  submitted_for_approval:   'text-[#C9A227]',
  approved:                 'text-green-400',
  rejected:                 'text-red-400',
  revision_requested:       'text-orange-400',
  sent:                     'text-green-400',
  exported:                 'text-green-400',
  stale:                    'text-orange-400',
  archived:                 'text-[#555555]',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function artifactId(a: Artifact): string {
  return (a.artifactId ?? a.id) as string;
}

// ─── Generate Artifact Modal ──────────────────────────────────────────────────

function GenerateModal({ open, onClose, onGenerated }: { open: boolean; onClose: () => void; onGenerated: () => void }) {
  const [form, setForm] = useState({
    artifact_type: 'email_draft',
    context_note:  '',
    approval_required: false,
    format: 'markdown',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      await artifactsApi.generate({
        artifact_type:    form.artifact_type,
        context:          { note: form.context_note },
        requested_by:     'user',
        format:           form.format,
        approval_required: form.approval_required,
      });
      onGenerated();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate Artifact" size="md">
      <div className="space-y-4">
        <Select
          label="Artifact Type"
          value={form.artifact_type}
          onChange={(e) => setForm((p) => ({ ...p, artifact_type: e.target.value }))}
          options={ARTIFACT_TYPES}
        />
        <Select
          label="Format"
          value={form.format}
          onChange={(e) => setForm((p) => ({ ...p, format: e.target.value }))}
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'plain_text', label: 'Plain text' },
            { value: 'rich_text', label: 'Rich text' },
          ]}
        />
        <Textarea
          label="Context / Instructions (optional)"
          value={form.context_note}
          onChange={(e) => setForm((p) => ({ ...p, context_note: e.target.value }))}
          placeholder="Any context for the AI to use when generating this document…"
          rows={3}
        />
        <label className="flex items-center gap-2 text-sm text-[#A7A29A] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.approval_required}
            onChange={(e) => setForm((p) => ({ ...p, approval_required: e.target.checked }))}
            className="rounded border-[#3A3A3E] bg-[#1A1A1A]"
          />
          Require approval before external export
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Generating…' : 'Generate'}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({
  artifact, open, onClose, onExported,
}: {
  artifact: Artifact | null;
  open: boolean;
  onClose: () => void;
  onExported: () => void;
}) {
  const [form, setForm] = useState({ export_type: 'email', destination: '', approve_first: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!artifact) return;
    setLoading(true);
    setError(null);
    try {
      const id = artifactId(artifact);
      if (form.approve_first) {
        await quickActionsApi.approveAndSend({
          artifact_id:  id,
          approved_by:  'user',
          export_type:  form.export_type,
          destination:  form.destination || undefined,
        });
      } else {
        await artifactsApi.export(id, {
          export_type:  form.export_type,
          requested_by: 'user',
          destination:  form.destination || undefined,
        });
      }
      onExported();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (!artifact) return null;

  const needsApproval = ['email_draft','letter_draft','memo','pitch_deck_outline','board_pitch','investor_update','intro_request_draft','LOI_support_summary'].includes(artifact.artifactType);
  const isApproved = artifact.approvalStatus === 'approved';

  return (
    <Modal open={open} onClose={onClose} title={`Export — ${artifact.title}`} size="md">
      <div className="space-y-4">
        {needsApproval && !isApproved && (
          <div className="bg-[#C9A22715] border border-[#C9A22730] rounded px-3 py-2 text-xs text-[#C9A227]">
            This artifact type requires approval for external export. Use &quot;Approve &amp; Send&quot; or get approval first.
          </div>
        )}
        <Select
          label="Export Type"
          value={form.export_type}
          onChange={(e) => setForm((p) => ({ ...p, export_type: e.target.value }))}
          options={EXPORT_TYPES}
        />
        <Input
          label="Destination (optional)"
          value={form.destination}
          onChange={(e) => setForm((p) => ({ ...p, destination: e.target.value }))}
          placeholder="email@example.com or portal URL"
        />
        {needsApproval && !isApproved && (
          <label className="flex items-center gap-2 text-sm text-[#A7A29A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.approve_first}
              onChange={(e) => setForm((p) => ({ ...p, approve_first: e.target.checked }))}
              className="rounded border-[#3A3A3E] bg-[#1A1A1A]"
            />
            Approve &amp; export in one step
          </label>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button variant="primary" onClick={handleExport} disabled={loading}>
            <Send size={13} aria-hidden />
            {loading ? 'Exporting…' : (form.approve_first ? 'Approve & Send' : 'Queue Export')}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── View Modal ───────────────────────────────────────────────────────────────

function ViewModal({ artifact, open, onClose }: { artifact: Artifact | null; open: boolean; onClose: () => void }) {
  function handleDownload() {
    if (!artifact?.content) return;
    const blob = new Blob([artifact.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artifact.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!artifact) return null;

  return (
    <Modal open={open} onClose={onClose} title={artifact.title} size="xl">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-[#737373]">
          <span className={cn('font-medium', STATUS_COLORS[artifact.status] ?? 'text-[#737373]')}>{statusLabel(artifact.status)}</span>
          <span>·</span>
          <span>{artifact.artifactType.replace(/_/g, ' ')}</span>
          {artifact.version && <><span>·</span><span>v{artifact.version}</span></>}
          <span>·</span>
          <span>{formatDate(artifact.createdAt)}</span>
        </div>
        {artifact.content ? (
          <pre className="bg-[#0D0D0D] border border-[#2A2A2E] rounded p-4 text-sm text-[#E8E6E3] whitespace-pre-wrap font-sans leading-relaxed max-h-[55vh] overflow-y-auto">
            {artifact.content}
          </pre>
        ) : (
          <div className="bg-[#0D0D0D] border border-[#2A2A2E] rounded p-8 text-center text-xs text-[#737373]">
            No content available (still generating or empty)
          </div>
        )}
        <div className="flex gap-2">
          {artifact.content && (
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download size={13} aria-hidden />
              Download
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Artifact row ─────────────────────────────────────────────────────────────

function ArtifactRow({
  artifact,
  onView,
  onExport,
  onArchive,
  onRegenerate,
}: {
  artifact: Artifact;
  onView: () => void;
  onExport: () => void;
  onArchive: () => void;
  onRegenerate: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const id = artifactId(artifact);

  return (
    <div className="bg-[#141414] border border-[#2A2A2E] rounded-md px-4 py-3 flex items-center justify-between gap-4 hover:border-[#3A3A3E] transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <FileText size={15} className="text-[#737373] flex-shrink-0" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium text-[#E8E6E3] truncate">{artifact.title}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn('text-[11px] font-medium', STATUS_COLORS[artifact.status] ?? 'text-[#737373]')}>
              {statusLabel(artifact.status)}
            </span>
            <span className="text-[11px] text-[#555555]">·</span>
            <span className="text-[11px] text-[#737373] capitalize">{artifact.artifactType.replace(/_/g, ' ')}</span>
            {artifact.version && (
              <>
                <span className="text-[11px] text-[#555555]">·</span>
                <span className="text-[11px] text-[#737373]">v{artifact.version}</span>
              </>
            )}
            {artifact.generatedBySystem && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-400 uppercase tracking-wide">AI</span>
            )}
            {artifact.status === 'stale' && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/10 text-orange-400 uppercase tracking-wide">Stale</span>
            )}
            <span className="text-[11px] text-[#555555]">·</span>
            <span className="text-[11px] text-[#555555]">{formatDate(artifact.createdAt)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <Button variant="ghost" size="sm" onClick={onView} title="View content">
          <Eye size={12} aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" onClick={onExport} title="Export">
          <Send size={12} aria-hidden />
        </Button>
        <div className="relative">
          <Button variant="ghost" size="sm" onClick={() => setMenuOpen((o) => !o)} aria-label="More actions">
            <ChevronDown size={12} aria-hidden />
          </Button>
          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-20 bg-[#1A1A1A] border border-[#262626] rounded-md shadow-xl py-1 min-w-[140px]"
              onBlur={() => setMenuOpen(false)}
            >
              <button
                onClick={() => { onRegenerate(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[#A7A29A] hover:text-[#E8E6E3] hover:bg-[#262626] transition-colors"
              >
                <RotateCcw size={11} aria-hidden />
                Regenerate
              </button>
              <button
                onClick={() => { onArchive(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-[#262626] transition-colors"
              >
                <Archive size={11} aria-hidden />
                Archive
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Export log ───────────────────────────────────────────────────────────────

function ExportLog({ exports }: { exports: ExportRecord[] }) {
  if (exports.length === 0) return null;

  const statusIcon = (s: string) => {
    if (s === 'exported')  return <CheckCircle size={11} className="text-green-400" aria-hidden />;
    if (s === 'failed')    return <AlertCircle size={11} className="text-red-400" aria-hidden />;
    if (s === 'cancelled') return <X size={11} className="text-[#737373]" aria-hidden />;
    return <Clock size={11} className="text-[#C9A227]" aria-hidden />;
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-[#2A2A2E]">
        <span className="text-sm font-medium text-[#E8E6E3]">Export Log</span>
      </div>
      <div className="divide-y divide-[#1A1A1A]">
        {exports.slice(0, 15).map((ex) => (
          <div key={ex.export_id} className="flex items-center gap-3 px-4 py-2.5">
            {statusIcon(ex.status)}
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[#E8E6E3] capitalize">{ex.export_type}</span>
              {ex.destination && <span className="text-xs text-[#737373] ml-2">→ {ex.destination}</span>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {ex.stale_warning_at_export && (
                <AlertTriangle size={10} className="text-orange-400" aria-label="Artifact was stale at export" aria-hidden />
              )}
              <span className="text-[10px] text-[#555555] capitalize">{ex.status}</span>
              <span className="text-[10px] text-[#555555]">{formatDate(ex.requested_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [exports, setExports] = useState<ExportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [viewArtifact, setViewArtifact] = useState<Artifact | null>(null);
  const [exportArtifact, setExportArtifact] = useState<Artifact | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [artRes, expRes] = await Promise.allSettled([
        artifactsApi.list({ artifactStatus: filterStatus || undefined, includeArchived: showArchived }),
        exportsApi.list(),
      ]);
      if (artRes.status === 'fulfilled') {
        setArtifacts((artRes.value as { artifacts: Artifact[] }).artifacts ?? []);
      }
      if (expRes.status === 'fulfilled') {
        setExports((expRes.value as { exports: ExportRecord[] }).exports ?? []);
      }
    } catch {
      setError('Failed to load artifacts');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, showArchived]);

  useEffect(() => { load(); }, [load]);

  async function handleArchive(artifact: Artifact) {
    try {
      await artifactsApi.archive(artifactId(artifact), 'user', 'Archived by user');
      load();
    } catch { /* silent */ }
  }

  async function handleRegenerate(artifact: Artifact) {
    try {
      await artifactsApi.regenerate(artifactId(artifact), { requested_by: 'user' });
      load();
    } catch { /* silent */ }
  }

  const displayed = artifacts.filter((a) => !filterStatus || a.status === filterStatus);

  const pendingApproval = artifacts.filter((a) => a.status === 'submitted_for_approval').length;
  const staleCount = artifacts.filter((a) => a.status === 'stale').length;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Artifacts</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {artifacts.length} artifact{artifacts.length !== 1 ? 's' : ''} · AI-generated documents with approval and export tracking
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw size={13} aria-hidden />
          </Button>
          <Button variant="primary" onClick={() => setShowGenerate(true)}>
            <Plus size={14} aria-hidden />
            Generate
          </Button>
        </div>
      </header>

      {/* Alert strip */}
      {(pendingApproval > 0 || staleCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {pendingApproval > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#C9A22715] border border-[#C9A22730] rounded text-xs text-[#C9A227]">
              <Clock size={12} aria-hidden />
              {pendingApproval} pending approval
            </div>
          )}
          {staleCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-400">
              <AlertTriangle size={12} aria-hidden />
              {staleCount} stale — review before sending
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select
          label=""
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'ready', label: 'Ready' },
            { value: 'submitted_for_approval', label: 'Pending approval' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'sent', label: 'Sent' },
            { value: 'stale', label: 'Stale' },
          ]}
        />
        <label className="flex items-center gap-2 text-xs text-[#737373] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-[#3A3A3E] bg-[#1A1A1A]"
          />
          Show archived
        </label>
      </div>

      {/* Artifact list */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-red-400 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded">
          <AlertCircle size={14} aria-hidden />
          {error}
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <FileText size={28} className="mx-auto text-[#3A3A3E] mb-3" aria-hidden />
          <p className="text-sm text-[#737373] mb-3">No artifacts yet. Generate your first document.</p>
          <Button variant="primary" onClick={() => setShowGenerate(true)}>
            <Plus size={13} aria-hidden />
            Generate Artifact
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((artifact) => (
            <ArtifactRow
              key={artifactId(artifact)}
              artifact={artifact}
              onView={() => setViewArtifact(artifact)}
              onExport={() => setExportArtifact(artifact)}
              onArchive={() => handleArchive(artifact)}
              onRegenerate={() => handleRegenerate(artifact)}
            />
          ))}
        </div>
      )}

      {/* Export log */}
      <ExportLog exports={exports} />

      {/* Modals */}
      <GenerateModal open={showGenerate} onClose={() => setShowGenerate(false)} onGenerated={load} />
      <ViewModal artifact={viewArtifact} open={!!viewArtifact} onClose={() => setViewArtifact(null)} />
      <ExportModal
        artifact={exportArtifact}
        open={!!exportArtifact}
        onClose={() => setExportArtifact(null)}
        onExported={load}
      />
    </div>
  );
}
