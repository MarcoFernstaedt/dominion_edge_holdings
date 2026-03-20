'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { api } from '@/lib/api';
import {
  Bot,
  Mail,
  CalendarDays,
  BarChart3,
  Users,
  Send,
  TrendingUp,
  Database,
  Search,
  Target,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AgentCard {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  endpoint: string;
  inputComponent: React.FC<{ onSubmit: (data: unknown) => void; loading: boolean }>;
}

// ─── Input form components ────────────────────────────────────────────────────
function ResponseAnalysisInput({ onSubmit, loading }: { onSubmit: (d: unknown) => void; loading: boolean }) {
  const [emailBody, setEmailBody] = useState('');
  const [senderName, setSenderName] = useState('');
  const [companyName, setCompanyName] = useState('');
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Sender Name</label>
        <input className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="John Smith" />
      </div>
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Company</label>
        <input className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Industrial" />
      </div>
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Email Body *</label>
        <textarea className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] resize-none" rows={5} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Paste the inbound email reply here..." />
      </div>
      <button onClick={() => onSubmit({ emailBody, senderName, companyName })} disabled={!emailBody.trim() || loading} className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-sm font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Analyze Reply
      </button>
    </div>
  );
}

function SchedulingInput({ onSubmit, loading }: { onSubmit: (d: unknown) => void; loading: boolean }) {
  const [meetingType, setMeetingType] = useState('seller_discovery');
  const [contactName, setContactName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const MEETING_TYPES = ['seller_discovery', 'seller_followup', 'board_intro', 'banker_intro', 'attorney_intro', 'cpa_intro', 'capital_intro', 'diligence_review', 'post_acquisition_transition', 'internal_planning'];
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Meeting Type</label>
        <select className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]" value={meetingType} onChange={(e) => setMeetingType(e.target.value)}>
          {MEETING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Contact Name</label>
        <input className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Doe" />
      </div>
      <div>
        <label className="block text-[11px] tracking-widest uppercase text-[#A7A29A] mb-1">Duration (minutes)</label>
        <input type="number" className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227]" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} min={15} max={180} />
      </div>
      <button onClick={() => onSubmit({ meetingType, contactName, durationMinutes })} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-sm font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Propose Slots
      </button>
    </div>
  );
}

function SimpleTextInput({ onSubmit, loading, placeholder, buttonLabel, field = 'question' }: { onSubmit: (d: unknown) => void; loading: boolean; placeholder: string; buttonLabel: string; field?: string }) {
  const [value, setValue] = useState('');
  return (
    <div className="space-y-3">
      <textarea className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded px-3 py-2 text-sm text-[#E8E6E3] focus:outline-none focus:border-[#C9A227] resize-none" rows={4} value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} />
      <button onClick={() => onSubmit({ [field]: value })} disabled={!value.trim() || loading} className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-sm font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />}
        {buttonLabel}
      </button>
    </div>
  );
}

function DailyBriefingInput({ onSubmit, loading }: { onSubmit: (d: unknown) => void; loading: boolean }) {
  return (
    <div>
      <p className="text-sm text-[#A7A29A] mb-3">Generates your personalized daily briefing based on current pipeline, tasks, and meetings.</p>
      <button onClick={() => onSubmit({})} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-sm font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Generate Briefing
      </button>
    </div>
  );
}

function CRMHealthInput({ onSubmit, loading }: { onSubmit: (d: unknown) => void; loading: boolean }) {
  return (
    <div>
      <p className="text-sm text-[#A7A29A] mb-3">Analyzes your entire CRM for data quality issues, stale contacts, and re-engagement opportunities.</p>
      <button onClick={() => onSubmit({})} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-[#C9A227] text-black text-sm font-semibold rounded hover:bg-[#C09B2A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        {loading && <Loader2 size={14} className="animate-spin" />}
        Run CRM Health Check
      </button>
    </div>
  );
}

// ─── Result renderer ──────────────────────────────────────────────────────────
function ResultBlock({ result }: { result: unknown }) {
  const [collapsed, setCollapsed] = useState(false);
  if (!result) return null;
  return (
    <div className="mt-4 border border-[#2A2A2E] rounded overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-[#1B1B1D] text-[#A7A29A] text-xs"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span className="flex items-center gap-2"><CheckCircle2 size={12} className="text-green-500" /> Agent Result</span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
      {!collapsed && (
        <pre className="p-4 text-xs text-[#E8E6E3] overflow-x-auto bg-[#0F0F10] leading-relaxed whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ─── Agent card ───────────────────────────────────────────────────────────────
function AgentPanel({ agent }: { agent: AgentCard }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const settings = useAppStore((s) => s.settings);

  async function handleSubmit(data: unknown) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${settings.apiUrl}${agent.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `Request failed: ${res.status}`);
      }
      setResult(await res.json());
      if (!expanded) setExpanded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const Icon = agent.icon;
  const InputComponent = agent.inputComponent;

  return (
    <div className="border border-[#2A2A2E] rounded-lg overflow-hidden bg-[#141414]">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1B1B1D] transition-colors"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="w-8 h-8 rounded bg-[#C9A22715] flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-[#C9A227]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[#E8E6E3] truncate">{agent.name}</div>
          <div className="text-xs text-[#A7A29A] truncate">{agent.description}</div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-[#A7A29A] flex-shrink-0" /> : <ChevronDown size={14} className="text-[#A7A29A] flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#2A2A2E]">
          <div className="pt-4">
            <InputComponent onSubmit={handleSubmit} loading={loading} />
          </div>
          {error && (
            <div className="mt-3 flex items-start gap-2 text-red-400 text-xs bg-red-950/20 border border-red-900/40 rounded px-3 py-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
          <ResultBlock result={result} />
        </div>
      )}
    </div>
  );
}

// ─── Agent definitions ────────────────────────────────────────────────────────
const AGENTS: AgentCard[] = [
  {
    id: 'analyze-response',
    name: 'Response Analysis',
    description: 'Classify inbound email replies and extract structured signals',
    icon: Mail,
    endpoint: '/api/agents/analyze-response',
    inputComponent: ResponseAnalysisInput,
  },
  {
    id: 'schedule-meeting',
    name: 'Calendar Scheduling',
    description: 'Propose optimal meeting time slots for any meeting type',
    icon: CalendarDays,
    endpoint: '/api/agents/schedule-meeting',
    inputComponent: SchedulingInput,
  },
  {
    id: 'daily-briefing',
    name: 'Daily Operations Briefing',
    description: 'Generate your personalized daily operational briefing',
    icon: BarChart3,
    endpoint: '/api/agents/daily-briefing',
    inputComponent: DailyBriefingInput,
  },
  {
    id: 'board-analysis',
    name: 'Board Builder',
    description: 'Analyze board candidates and recommend composition strategy',
    icon: Users,
    endpoint: '/api/agents/board-analysis',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Describe the target industry and deal context..." buttonLabel="Run Board Analysis" field="targetIndustry" />
    ),
  },
  {
    id: 'generate-outreach',
    name: 'Outreach Generation',
    description: 'Generate personalized outreach emails for any contact type',
    icon: Send,
    endpoint: '/api/agents/generate-outreach',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Describe the contact, company, and outreach goal..." buttonLabel="Generate Outreach" field="context" />
    ),
  },
  {
    id: 'analyze-deal',
    name: 'Deal Analysis',
    description: 'Structured deal analysis, risk scoring, and investment thesis',
    icon: TrendingUp,
    endpoint: '/api/agents/analyze-deal',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Describe the deal: company name, industry, revenue, SDE, asking price, and any notes..." buttonLabel="Analyze Deal" field="notes" />
    ),
  },
  {
    id: 'crm-health',
    name: 'CRM Health Check',
    description: 'Analyze CRM data quality and relationship hygiene',
    icon: Database,
    endpoint: '/api/agents/crm-health',
    inputComponent: CRMHealthInput,
  },
  {
    id: 'lead-discovery',
    name: 'Lead Discovery',
    description: 'Generate lead sourcing strategies and target parameters',
    icon: Search,
    endpoint: '/api/agents/lead-discovery',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Describe your target industry and geography focus..." buttonLabel="Generate Strategy" field="targetIndustry" />
    ),
  },
  {
    id: 'qualify-target',
    name: 'Target Qualification',
    description: 'Quickly qualify or disqualify an acquisition target',
    icon: Target,
    endpoint: '/api/agents/qualify-target',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Describe the company: name, industry, location, years in business, estimated revenue, any signals..." buttonLabel="Qualify Target" field="researchNotes" />
    ),
  },
  {
    id: 'strategy-advice',
    name: 'Strategy Advisor',
    description: 'Strategic advice on acquisition, deal structuring, and negotiation',
    icon: Lightbulb,
    endpoint: '/api/agents/strategy-advice',
    inputComponent: ({ onSubmit, loading }) => (
      <SimpleTextInput onSubmit={onSubmit} loading={loading} placeholder="Ask a strategic question about your acquisition search, deal structure, negotiation position, or post-acquisition planning..." buttonLabel="Get Advice" field="question" />
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AgentsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="page-container-narrow">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Bot size={20} className="text-[#C9A227]" aria-hidden />
            <h1 className="text-lg font-bold text-[#E8E6E3]">AI Agents</h1>
          </div>
          <p className="text-sm text-[#A7A29A]">
            Specialized AI agents for acquisition operations — analysis, outreach, scheduling, and strategy.
          </p>
        </div>

        {/* Agent grid */}
        <div className="space-y-3">
          {AGENTS.map((agent) => (
            <AgentPanel key={agent.id} agent={agent} />
          ))}
        </div>
      </div>
    </div>
  );
}
