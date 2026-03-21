'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Plug,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface IntegrationStatus {
  integrationName: string;
  enabled:         boolean;
  apiConfigured:   boolean;
  lastHealthCheck: string | null;
  lastError:       string | null;
  status:          'connected' | 'disabled' | 'misconfigured' | 'unreachable';
}

interface IntegrationTestResult {
  integration: string;
  reachable:   boolean;
  reason?:     string;
  message?:    string;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: IntegrationStatus['status'] }) {
  const MAP = {
    connected:    { label: 'Connected',    color: 'text-green-400  bg-green-950/30 border-green-900/50', Icon: CheckCircle2 },
    disabled:     { label: 'Disabled',     color: 'text-[#A7A29A] bg-[#1B1B1D]     border-[#2A2A2E]',   Icon: XCircle },
    misconfigured:{ label: 'Misconfigured',color: 'text-[#C9A227]  bg-[#C9A22715]  border-[#C9A22740]', Icon: AlertTriangle },
    unreachable:  { label: 'Unreachable',  color: 'text-red-400    bg-red-950/20    border-red-900/40',   Icon: XCircle },
  };
  const cfg = MAP[status] ?? MAP.disabled;
  const Icon = cfg.Icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded border ${cfg.color}`}>
      <Icon size={10} aria-hidden />
      {cfg.label}
    </span>
  );
}

// ─── Individual integration card ──────────────────────────────────────────────
interface IntegrationCardProps {
  name:        string;
  label:       string;
  description: string;
  status:      IntegrationStatus;
  fields:      { key: string; label: string; type: 'text' | 'password' | 'select'; options?: string[] }[];
  onTest:      (name: string) => Promise<IntegrationTestResult>;
  onSave:      (name: string, patch: Record<string, unknown>) => Promise<void>;
}

function IntegrationCard({ name, label, description, status, fields, onTest, onSave }: IntegrationCardProps) {
  const [values, setValues]     = useState<Record<string, string>>({});
  const [showPass, setShowPass] = useState<Record<string, boolean>>({});
  const [testing, setTesting]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  const [saveMsg, setSaveMsg]   = useState<string | null>(null);
  const settings = useAppStore((s) => s.settings);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(name);
      setTestResult(result);
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await onSave(name, values);
      setSaveMsg('Saved successfully.');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (err: unknown) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const hasValues = Object.values(values).some((v) => v.trim());

  return (
    <div className="border border-[#2A2A2E] rounded-lg bg-[#141414] overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#2A2A2E]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-sm font-semibold text-[#E8E6E3]">{label}</h3>
            <StatusBadge status={status.status} />
          </div>
          <p className="text-xs text-[#A7A29A]">{description}</p>
          {status.lastError && (
            <p className="mt-1.5 text-[11px] text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={10} aria-hidden /> {status.lastError}
            </p>
          )}
          {status.lastHealthCheck && (
            <p className="mt-1 text-[10px] text-[#605C57]">
              Last checked: {new Date(status.lastHealthCheck).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#A7A29A] border border-[#2A2A2E] rounded hover:border-[#C9A227] hover:text-[#C9A227] transition-colors disabled:opacity-40"
          title="Test connection"
        >
          {testing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} aria-hidden />}
          Test
        </button>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`px-5 py-2.5 text-xs border-b border-[#2A2A2E] ${testResult.reachable ? 'text-green-400 bg-green-950/10' : 'text-[#C9A227] bg-[#C9A22710]'}`}>
          {testResult.reachable
            ? '✓ Connection successful'
            : `⚠ ${testResult.message || testResult.reason || 'Connection failed'}`}
        </div>
      )}

      {/* Fields */}
      {fields.length > 0 && (
        <div className="px-5 py-4 space-y-3">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
                {field.label}
              </label>
              {field.type === 'select' ? (
                <select
                  className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]"
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {field.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <div className="relative">
                  <input
                    type={field.type === 'password' && !showPass[field.key] ? 'password' : 'text'}
                    className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] pr-9"
                    value={values[field.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    placeholder={field.type === 'password' ? '(unchanged)' : ''}
                    autoComplete={field.type === 'password' ? 'new-password' : 'off'}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A7A29A] hover:text-[#E8E6E3]"
                      onClick={() => setShowPass((s) => ({ ...s, [field.key]: !s[field.key] }))}
                      aria-label={showPass[field.key] ? 'Hide' : 'Show'}
                    >
                      {showPass[field.key] ? <EyeOff size={13} aria-hidden /> : <Eye size={13} aria-hidden />}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !hasValues}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-xs font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden />}
              Save
            </button>
            {saveMsg && (
              <span className={`text-xs ${saveMsg.includes('success') ? 'text-green-400' : 'text-red-400'}`}>
                {saveMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Degradation notice when disabled */}
      {status.status === 'disabled' && (
        <div className="px-5 py-3 border-t border-[#2A2A2E] bg-[#0F0F10]">
          <p className="text-[11px] text-[#605C57]">
            {name === 'apollo'   && 'Apollo disabled. You can still add companies manually or import CSV data.'}
            {name === 'ai'       && 'AI disabled. Agents will use keyword heuristics and deterministic templates.'}
            {name === 'calendar' && 'Calendar disabled. Meetings will only exist inside the platform.'}
            {name === 'email'    && 'Email disabled. Emails will be saved as drafts for manual sending.'}
            {name === 'google'   && 'Google Workspace disabled. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in your environment to enable Gmail and Google Calendar.'}
            {name === 'storage'  && 'Object storage disabled. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET in your environment to enable file storage.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const settings   = useAppStore((s) => s.settings);
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading]   = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [globalMsg, setGlobalMsg]     = useState<string | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const res  = await fetch(`${settings.apiUrl}/api/integrations`);
      const data = await res.json();
      setStatuses(data.status || []);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, [settings.apiUrl]);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  const handleTest = async (name: string): Promise<IntegrationTestResult> => {
    const res  = await fetch(`${settings.apiUrl}/api/integrations/${name}/test`, { method: 'POST' });
    const data = await res.json();
    // Refresh statuses after test
    fetchStatuses();
    return data;
  };

  const handleSave = async (name: string, patch: Record<string, unknown>) => {
    const res = await fetch(`${settings.apiUrl}/api/integrations/${name}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || 'Save failed');
    }
    fetchStatuses();
  };

  const handleCheckAll = async () => {
    setCheckingAll(true);
    setGlobalMsg(null);
    try {
      const res  = await fetch(`${settings.apiUrl}/api/integrations/health/check-all`, { method: 'POST' });
      const data = await res.json();
      const connected = data.results.filter((r: IntegrationTestResult) => r.reachable).length;
      setGlobalMsg(`Health check complete: ${connected}/${data.results.length} integrations reachable.`);
      fetchStatuses();
    } finally {
      setCheckingAll(false);
      setTimeout(() => setGlobalMsg(null), 5000);
    }
  };

  const getStatus = (name: string): IntegrationStatus =>
    statuses.find((s) => s.integrationName === name) ?? {
      integrationName: name, enabled: false, apiConfigured: false,
      lastHealthCheck: null, lastError: null, status: 'disabled',
    };

  const INTEGRATIONS: Omit<IntegrationCardProps, 'status' | 'onTest' | 'onSave'>[] = [
    {
      name: 'ai',
      label: 'AI Provider (Anthropic)',
      description: 'Powers all AI agents: response analysis, deal analysis, outreach drafting, and strategy advice. Platform remains fully functional without AI via keyword heuristics and deterministic templates.',
      fields: [
        { key: 'apiKey', label: 'Anthropic API Key', type: 'password' },
      ],
    },
    {
      name: 'email',
      label: 'Email Provider (SMTP)',
      description: 'Enables outbound email sending. When disabled, all emails are saved as drafts for manual sending — the Email Center remains fully functional.',
      fields: [
        { key: 'smtpHost',  label: 'SMTP Host',      type: 'text' },
        { key: 'smtpPort',  label: 'SMTP Port',       type: 'text' },
        { key: 'smtpUser',  label: 'SMTP Username',   type: 'text' },
        { key: 'fromName',  label: 'From Name',        type: 'text' },
        { key: 'fromEmail', label: 'From Email',       type: 'text' },
      ],
    },
    {
      name: 'apollo',
      label: 'Apollo.io Lead Discovery',
      description: 'Optional external lead enrichment. When disabled, the Lead Discovery Agent uses internal company data and manual entry. All CRM features remain available.',
      fields: [
        { key: 'apolloApiKey', label: 'Apollo API Key', type: 'password' },
      ],
    },
    {
      name: 'calendar',
      label: 'Calendar Provider',
      description: 'Sync meetings with Google Calendar or Outlook. When disabled, meetings are tracked internally only. Scheduling still works — events just won\'t appear in external calendars.',
      fields: [
        { key: 'calendarProvider', label: 'Provider', type: 'select', options: ['google', 'outlook', 'none'] },
      ],
    },
    {
      name: 'google',
      label: 'Google Workspace (Gmail + Calendar)',
      description: 'Real Gmail sending and thread sync, plus Google Calendar event creation and availability checking. Configured via environment variables (OAuth2 refresh token). No credentials stored in the database.',
      fields: [],
    },
    {
      name: 'storage',
      label: 'Object Storage (S3-compatible)',
      description: 'Store deal documents, proof of concept attachments, and exported artifacts in S3-compatible object storage (AWS S3, Cloudflare R2, MinIO). Configured via environment variables. Files go browser → S3 directly via presigned URLs.',
      fields: [],
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#0F0F10]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Plug size={18} className="text-[#C9A227]" aria-hidden />
              <h1 className="text-lg font-bold text-[#E8E6E3]">Integrations</h1>
            </div>
            <p className="text-sm text-[#A7A29A]">
              External integrations enhance automation but are never required. The platform degrades gracefully to manual workflows when any integration is disabled or unavailable.
            </p>
          </div>
          <button
            onClick={handleCheckAll}
            disabled={checkingAll}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs border border-[#2A2A2E] rounded text-[#A7A29A] hover:border-[#C9A227] hover:text-[#C9A227] transition-colors disabled:opacity-40"
          >
            {checkingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} aria-hidden />}
            Check All
          </button>
        </div>

        {/* Global message */}
        {globalMsg && (
          <div className="mb-4 px-4 py-2.5 rounded border border-[#C9A22740] bg-[#C9A22710] text-xs text-[#C9A227]">
            {globalMsg}
          </div>
        )}

        {/* Integration cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#A7A29A]">
            <Loader2 size={20} className="animate-spin mr-2" />
            Loading integration status…
          </div>
        ) : (
          <div className="space-y-4">
            {INTEGRATIONS.map((cfg) => (
              <IntegrationCard
                key={cfg.name}
                {...cfg}
                status={getStatus(cfg.name)}
                onTest={handleTest}
                onSave={handleSave}
              />
            ))}
          </div>
        )}

        {/* Fail-safe principle notice */}
        <div className="mt-6 px-4 py-3 rounded border border-[#2A2A2E] bg-[#141414]">
          <p className="text-[11px] text-[#605C57] leading-relaxed">
            <span className="text-[#A7A29A] font-medium">Fail-safe principle: </span>
            External service failures never break the platform. Data integrity is always preserved, users are notified of issues in a non-blocking way, and all core workflows (CRM, pipeline, tasks, meetings) function without any external integration.
          </p>
        </div>
      </div>
    </div>
  );
}
