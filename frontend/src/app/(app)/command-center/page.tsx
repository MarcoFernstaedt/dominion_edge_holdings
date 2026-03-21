'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/Card';
import { AlertStrip } from '@/components/ui/AlertStrip';
import { InlineEmpty } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { PageHeader, SectionHeader } from '@/components/ui/PageHeader';
import { cn, formatDate, daysSince, nowIso, generateId, STAGE_LABELS, formatCurrency, formatRelativeDate } from '@/lib/utils';
import {
  ChevronRight, ChevronLeft, AlertTriangle, Clock, Plus,
  CheckCircle2, Circle, ArrowRight, Users, KanbanSquare,
  Bell, Zap, Activity, Flame, BarChart2, TrendingDown,
  MessageSquare, UserCheck, Radar, BookOpen, TrendingUp,
  Settings2, Pencil, Trash2, Check, X as XIcon,
} from 'lucide-react';
import { sourcingRadarApi, meetingPrepApi, dealProbabilityApi } from '@/lib/api';
import { ConversationKPIWidget } from '@/components/modules/ConversationKPIWidget';
import type {
  Task, NextBestAction, PipelinePressureMetrics, AcquisitionScoreboard,
  DealVelocityEntry, ConversationFunnel, FrequencyProgress,
  Deal, EmailThread, BoardCandidate, ChecklistPhase,
} from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a NextBestAction to the route the user should navigate to when they
 * click "Start Now". Returns the most specific URL possible.
 */
function getActionRoute(action: NextBestAction): string {
  switch (action.actionType) {
    case 'task':
      return '/command-center'; // scroll to task panel on same page
    case 'email':
      return '/inbox';
    case 'board':
      return action.linkedEntityId
        ? `/board`
        : '/board';
    case 'deal':
      return action.linkedEntityId
        ? `/pipeline/${action.linkedEntityId}`
        : '/pipeline';
    case 'checklist':
      return '/checklist';
    case 'outreach':
      return '/outreach';
    case 'meeting':
      return '/meetings';
    default:
      return '/checklist';
  }
}

function generateNextBestActions(
  tasks: Task[], deals: Deal[], emailThreads: EmailThread[],
  boardCandidates: BoardCandidate[], checklistPhases: ChecklistPhase[]
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date())
    .slice(0, 2).forEach((t) => actions.push({
      id: `task-${t.id}`, actionType: 'task',
      title: `Complete: ${t.title}`, whyItMatters: 'This task is overdue. Delays compound.',
      estimatedTimeMinutes: 30, linkedEntityType: 'task', linkedEntityId: t.id,
      urgency: 'critical', recommendedBy: 'System',
    }));

  emailThreads.filter((t) => t.requiresReply).slice(0, 2).forEach((thread) => actions.push({
    id: `email-${thread.id}`, actionType: 'email',
    title: `Reply to: ${thread.subject}`, whyItMatters: 'Unanswered emails kill deals.',
    estimatedTimeMinutes: 15, linkedEntityType: 'thread', linkedEntityId: thread.id,
    urgency: 'high', recommendedBy: 'Inbox Agent',
  }));

  boardCandidates.filter((c) => c.status === 'identified' || c.status === 'researched')
    .slice(0, 1).forEach((c) => actions.push({
      id: `board-${c.id}`, actionType: 'board',
      title: `Reach out: ${c.name}`, whyItMatters: 'Board assembly is your most critical early-stage activity.',
      estimatedTimeMinutes: 20, linkedEntityType: 'candidate', linkedEntityId: c.id,
      urgency: 'high', recommendedBy: 'Board Builder',
    }));

  deals.filter((d) => d.status === 'active' && daysSince(d.updatedAt) > 5)
    .slice(0, 1).forEach((d) => actions.push({
      id: `deal-${d.id}`, actionType: 'deal',
      title: `Advance deal: ${d.name}`,
      whyItMatters: `No activity in ${daysSince(d.updatedAt)} days. Stalled deals die.`,
      estimatedTimeMinutes: 45, linkedEntityType: 'deal', linkedEntityId: d.id,
      urgency: 'medium', recommendedBy: 'Deal Analyst',
    }));

  const nextItem = checklistPhases.flatMap((p) => p.items).find((i) => !i.isComplete);
  if (nextItem && actions.length < 5) actions.push({
    id: `checklist-${nextItem.id}`, actionType: 'checklist',
    title: `Next step: ${nextItem.title}`,
    whyItMatters: nextItem.whyItMatters || 'Keep the process moving.',
    estimatedTimeMinutes: 60, linkedEntityType: 'checklist', linkedEntityId: nextItem.id,
    urgency: 'medium', recommendedBy: 'Strategy Advisor',
  });

  if (actions.length === 0) {
    actions.push({ id: 'default-1', actionType: 'outreach', title: 'Send 5 seller outreach emails today',
      whyItMatters: 'Consistent outreach is the engine of deal flow.', estimatedTimeMinutes: 45, urgency: 'high', recommendedBy: 'Strategy Advisor' });
    actions.push({ id: 'default-2', actionType: 'board', title: 'Identify 3 new board candidates',
      whyItMatters: 'Board assembly is your most critical priority.', estimatedTimeMinutes: 30, urgency: 'high', recommendedBy: 'Board Builder' });
  }

  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => order[a.urgency] - order[b.urgency]).slice(0, 6);
}

// ─── Zone 1: Hero — single best next action ───────────────────────────────────

function HeroAction({ action }: { action: NextBestAction }) {
  const router = useRouter();
  const urgencyColor = { critical: '#D64545', high: '#E6A23C', medium: '#4D7EA8', low: '#737373' };
  const color = urgencyColor[action.urgency] ?? '#737373';
  const route = getActionRoute(action);

  function handleStartNow() {
    router.push(route);
  }

  return (
    <div
      className="bg-[#111111] border border-[#262626] rounded-[10px] p-6 flex flex-col sm:flex-row sm:items-center gap-5"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-medium tracking-[0.12em] uppercase mb-2" style={{ color }}>
          {action.urgency} priority · next best action
        </div>
        <h2 className="font-serif text-[22px] font-semibold text-[#E5E5E5] leading-snug mb-2">
          {action.title}
        </h2>
        <p className="text-sm text-[#737373] leading-relaxed">{action.whyItMatters}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-[#737373]">
          <span className="flex items-center gap-1.5"><Clock size={11} aria-hidden />~{action.estimatedTimeMinutes} min</span>
          <span className="flex items-center gap-1.5"><Zap size={11} aria-hidden />{action.recommendedBy}</span>
        </div>
      </div>
      <div className="flex-shrink-0">
        <Button variant="primary" size="lg" onClick={handleStartNow}>
          Start Now <ArrowRight size={14} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ─── Zone 2: Priority band — alerts + top KPIs ────────────────────────────────

function PriorityBand() {
  const tasks = useAppStore((s) => s.tasks);
  const deals = useAppStore((s) => s.deals);
  const emailThreads = useAppStore((s) => s.emailThreads);
  const interactions = useAppStore((s) => s.interactions);
  const companies = useAppStore((s) => s.companies);

  const overdue   = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const needsReply = emailThreads.filter((t) => t.requiresReply && !t.isSuppressed).length;
  const stalled   = deals.filter((d) => d.status === 'stalled' || (d.updatedAt && daysSince(d.updatedAt) > 7)).length;
  const thisWeek  = new Date(); thisWeek.setDate(thisWeek.getDate() - 7);
  const contacted = interactions.filter((i) => i.interactionType === 'email' && i.direction === 'outbound' && new Date(i.createdAt) > thisWeek).length;
  const activeDeals = deals.filter((d) => d.status === 'active').length;
  const newTargets  = companies.filter((c) => new Date(c.createdAt) > thisWeek).length;

  const alerts = [
    overdue > 0    && { id: 'overdue',   severity: 'danger'  as const, message: `${overdue} overdue task${overdue !== 1 ? 's' : ''} — resolve immediately` },
    stalled > 0    && { id: 'stalled',   severity: 'warning' as const, message: `${stalled} deal${stalled !== 1 ? 's' : ''} stalled or inactive` },
    needsReply > 0 && { id: 'inbox',     severity: 'warning' as const, message: `${needsReply} inbox thread${needsReply !== 1 ? 's' : ''} awaiting reply` },
  ].filter(Boolean) as { id: string; severity: 'danger' | 'warning'; message: string }[];

  return (
    <div className="space-y-3">
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => <AlertStrip key={a.id} severity={a.severity} message={a.message} dismissible />)}
        </div>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <StatCard label="Active Deals"    value={activeDeals}  sub="in review" />
        <StatCard label="Contacted"       value={contacted}    sub="this week" />
        <StatCard label="Targets Added"   value={newTargets}   sub="this week" />
        <StatCard label="Overdue Tasks"   value={overdue}      sub="need action"  valueColor={overdue > 0 ? 'danger' : 'success'} />
        <StatCard label="Needs Reply"     value={needsReply}   sub="in inbox"     valueColor={needsReply > 0 ? 'warning' : 'success'} />
        <StatCard label="Stalled Deals"   value={stalled}      sub="no activity"  valueColor={stalled > 0 ? 'warning' : 'success'} />
      </div>
    </div>
  );
}

// ─── Zone 3: Next actions queue ───────────────────────────────────────────────

function NextActionsQueue({ actions }: { actions: NextBestAction[] }) {
  const rest = actions.slice(1); // hero handles [0]
  if (rest.length === 0) return null;

  const urgencyMap: Record<string, 'danger' | 'warning' | 'info' | 'muted'> = {
    critical: 'danger', high: 'warning', medium: 'info', low: 'muted',
  };

  return (
    <section aria-labelledby="queue-heading">
      <SectionHeader title="Action Queue" icon={Zap} />
      <ol className="space-y-2">
        {rest.map((action, i) => (
          <li key={action.id}
            className="bg-[#111111] border border-[#262626] rounded-[10px] px-4 py-3.5 flex items-start gap-4 hover:border-[#333333] transition-colors"
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1A1A1A] text-[#737373] flex items-center justify-center text-[10px] font-bold border border-[#333333]" aria-hidden>{i + 2}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#E5E5E5]">{action.title}</span>
                <Badge variant={urgencyMap[action.urgency]} size="sm">{action.urgency}</Badge>
              </div>
              <p className="text-xs text-[#737373] mt-0.5">{action.whyItMatters}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#737373]">
                <span className="flex items-center gap-1"><Clock size={10} aria-hidden />~{action.estimatedTimeMinutes}min</span>
                <span className="flex items-center gap-1"><Zap size={10} aria-hidden />{action.recommendedBy}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ─── Tasks panel ──────────────────────────────────────────────────────────────

function TaskPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const addTask    = useAppStore((s) => s.addTask);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'high', dueDate: '' });

  const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived')
    .sort((a, b) => { const o = { critical: 0, high: 1, medium: 2, low: 3 }; return (o[a.priority] ?? 2) - (o[b.priority] ?? 2); })
    .slice(0, 8);

  const todayDone = tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;

  function handleComplete(id: string) {
    updateTask(id, { status: 'done', completedAt: nowIso() });
  }

  function handleAdd() {
    if (!form.title.trim()) return;
    addTask({ id: generateId(), title: form.title, status: 'todo', priority: form.priority as Task['priority'], dueDate: form.dueDate || undefined, createdAt: nowIso(), updatedAt: nowIso() });
    setForm({ title: '', priority: 'high', dueDate: '' });
    setShowForm(false);
  }

  const dot: Record<string, string> = { critical: '#D64545', high: '#E6A23C', medium: '#4D7EA8', low: '#737373' };

  return (
    <section aria-labelledby="tasks-heading">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title={`Tasks · ${todayDone} done today`} />
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={13} aria-hidden /> Add
        </Button>
      </div>

      {showForm && (
        <div className="bg-[#1A1A1A] border border-[#C9A22730] rounded-[10px] p-4 mb-3 space-y-3">
          <input
            className="w-full bg-[#111111] border border-[#333333] rounded-[8px] px-3 py-2 text-sm text-[#E5E5E5] placeholder:text-[#737373] focus:outline-none focus:ring-2 focus:ring-[#C9A227]"
            placeholder="Task title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleAdd}>Save</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {active.length === 0
        ? <InlineEmpty message="No open tasks. Add one above." />
        : (
          <ul className="space-y-1" role="list">
            {active.map((task) => {
              const overdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <li key={task.id} className="flex items-center gap-3 bg-[#111111] border border-[#262626] rounded-[8px] px-3 py-2.5 hover:border-[#333333] transition-colors">
                  <button onClick={() => handleComplete(task.id)} className="flex-shrink-0 text-[#737373] hover:text-[#4CAF50] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A227] rounded" aria-label={`Complete "${task.title}"`}>
                    <Circle size={14} aria-hidden />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#E5E5E5] truncate">{task.title}</div>
                    {task.dueDate && <div className={cn('text-[11px] mt-0.5', overdue ? 'text-[#D64545]' : 'text-[#737373]')}>{overdue ? 'Overdue · ' : ''}{formatDate(task.dueDate)}</div>}
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot[task.priority] }} />
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

// ─── Pipeline snapshot ────────────────────────────────────────────────────────

function PipelineSnapshot() {
  const deals = useAppStore((s) => s.deals);

  return (
    <section aria-labelledby="pipeline-snap-heading">
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title={`Pipeline · ${deals.length} deal${deals.length !== 1 ? 's' : ''}`} icon={KanbanSquare} />
        <Link href="/pipeline" className="text-xs text-[#C9A227] hover:text-[#E0B93B] flex items-center gap-1 transition-colors">
          Full View <ArrowRight size={10} aria-hidden />
        </Link>
      </div>

      {deals.length === 0
        ? <InlineEmpty message="No deals yet. Add your first target to start screening." />
        : (
          <ul className="space-y-1.5">
            {deals.slice(0, 5).map((deal) => (
              <li key={deal.id}>
                <Link href={`/pipeline/${deal.id}`} className="flex items-center justify-between bg-[#111111] border border-[#262626] rounded-[8px] px-4 py-3 hover:border-[#333333] transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#E5E5E5] group-hover:text-[#C9A227] transition-colors truncate">{deal.companyName}</div>
                    <div className="text-xs text-[#737373] mt-0.5">{STAGE_LABELS[deal.stage]}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {deal.estimatedSDE && <span className="text-xs text-[#C9A227]">{formatCurrency(deal.estimatedSDE)} SDE</span>}
                    <StatusBadge status={deal.status} size="sm" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}

// ─── Affirmation strip ────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  'mindset', 'capital', 'board', 'sourcing', 'finance', 'urgency', 'vision',
  'discipline', 'execution', 'outreach', 'resilience', 'operations', 'identity',
];

function AffirmationStrip() {
  const affirmations     = useAppStore((s) => s.affirmations);
  const idx              = useAppStore((s) => s.currentAffirmationIndex);
  const setIdx           = useAppStore((s) => s.setAffirmationIndex);
  const addAffirmation    = useAppStore((s) => s.addAffirmation);
  const updateAffirmation = useAppStore((s) => s.updateAffirmation);
  const deleteAffirmation = useAppStore((s) => s.deleteAffirmation);

  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ text: '', theme: 'mindset' });
  const [addDraft, setAddDraft] = useState({ text: '', theme: 'mindset' });
  const [adding, setAdding] = useState(false);

  const active = affirmations.filter((a) => a.isActive !== false);
  const aff = active.length > 0 ? active[idx % active.length] : null;
  const total = active.length;

  function startEdit(a: typeof affirmations[0]) {
    setEditingId(a.id);
    setEditDraft({ text: a.text, theme: a.theme });
  }

  function commitEdit() {
    if (!editingId || !editDraft.text.trim()) return;
    updateAffirmation(editingId, { text: editDraft.text.trim(), theme: editDraft.theme });
    setEditingId(null);
  }

  function commitAdd() {
    if (!addDraft.text.trim()) return;
    addAffirmation({
      id: `a-${Date.now()}`,
      text: addDraft.text.trim(),
      theme: addDraft.theme,
      isActive: true,
      order: affirmations.length + 1,
    });
    setAddDraft({ text: '', theme: 'mindset' });
    setAdding(false);
  }

  if (!aff && !managing) return null;

  // ── Manage panel ──
  if (managing) {
    return (
      <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-4 space-y-3" style={{ borderLeftWidth: 2, borderLeftColor: '#C9A22760' }}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]">
            Affirmations · {total} active
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setAdding((v) => !v)}
              className="h-6 px-2 text-[10px] font-medium rounded bg-[#C9A22718] text-[#C9A227] hover:bg-[#C9A22730] transition-colors flex items-center gap-1"
            >
              <Plus size={10} aria-hidden /> Add
            </button>
            <button
              onClick={() => { setManaging(false); setEditingId(null); setAdding(false); }}
              className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] rounded transition-colors"
              aria-label="Close manager"
            >
              <XIcon size={12} aria-hidden />
            </button>
          </div>
        </div>

        {adding && (
          <div className="bg-[#1A1A1A] border border-[#C9A22730] rounded-[8px] p-3 space-y-2">
            <textarea
              className="w-full bg-[#111111] border border-[#333333] rounded-[6px] px-3 py-2 text-sm text-[#E5E5E5] placeholder:text-[#737373] focus:outline-none focus:ring-1 focus:ring-[#C9A227] resize-none"
              rows={2}
              placeholder="Enter your affirmation…"
              value={addDraft.text}
              onChange={(e) => setAddDraft((d) => ({ ...d, text: e.target.value }))}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <select
                className="flex-1 bg-[#111111] border border-[#333333] rounded-[6px] px-2 py-1.5 text-xs text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                value={addDraft.theme}
                onChange={(e) => setAddDraft((d) => ({ ...d, theme: e.target.value }))}
              >
                {THEME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={commitAdd} className="h-7 px-3 text-[11px] font-medium rounded bg-[#C9A227] text-black hover:bg-[#E0B93B] transition-colors">Save</button>
              <button onClick={() => setAdding(false)} className="h-7 px-2 text-[11px] text-[#737373] hover:text-[#E5E5E5] rounded transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
          {affirmations.map((a) => (
            <li key={a.id} className="bg-[#1A1A1A] border border-[#262626] rounded-[8px] px-3 py-2.5">
              {editingId === a.id ? (
                <div className="space-y-2">
                  <textarea
                    className="w-full bg-[#111111] border border-[#333333] rounded-[6px] px-2 py-1.5 text-sm text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#C9A227] resize-none"
                    rows={2}
                    value={editDraft.text}
                    onChange={(e) => setEditDraft((d) => ({ ...d, text: e.target.value }))}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') setEditingId(null); }}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 bg-[#111111] border border-[#333333] rounded-[6px] px-2 py-1 text-xs text-[#E5E5E5] focus:outline-none focus:ring-1 focus:ring-[#C9A227]"
                      value={editDraft.theme}
                      onChange={(e) => setEditDraft((d) => ({ ...d, theme: e.target.value }))}
                    >
                      {THEME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button onClick={commitEdit} className="w-6 h-6 flex items-center justify-center text-[#4CAF50] hover:text-[#66BB6A] rounded transition-colors" aria-label="Save">
                      <Check size={12} aria-hidden />
                    </button>
                    <button onClick={() => setEditingId(null)} className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] rounded transition-colors" aria-label="Cancel">
                      <XIcon size={12} aria-hidden />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] uppercase tracking-wider text-[#C9A22799] mb-0.5">{a.theme}</div>
                    <p className="text-xs text-[#A3A3A3] leading-relaxed line-clamp-2">{a.text}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0 mt-0.5">
                    <button onClick={() => startEdit(a)} className="w-5 h-5 flex items-center justify-center text-[#737373] hover:text-[#C9A227] rounded transition-colors" aria-label={`Edit "${a.text.slice(0, 20)}…"`}>
                      <Pencil size={10} aria-hidden />
                    </button>
                    <button
                      onClick={() => {
                        deleteAffirmation(a.id);
                        if (idx >= total - 1) setIdx(Math.max(0, total - 2));
                      }}
                      className="w-5 h-5 flex items-center justify-center text-[#737373] hover:text-[#D64545] rounded transition-colors"
                      aria-label={`Delete "${a.text.slice(0, 20)}…"`}
                    >
                      <Trash2 size={10} aria-hidden />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ── Display strip ──
  return (
    <div className="bg-[#111111] border border-[#262626] rounded-[10px] px-5 py-4 flex items-center gap-4" style={{ borderLeftWidth: 2, borderLeftColor: '#C9A22760' }}>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A227] mb-1.5">{aff!.theme}</div>
        <blockquote className="font-serif text-base italic text-[#A3A3A3] leading-relaxed">&ldquo;{aff!.text}&rdquo;</blockquote>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={() => setIdx((idx - 1 + total) % total)} className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] rounded transition-colors" aria-label="Previous affirmation">
          <ChevronLeft size={12} aria-hidden />
        </button>
        <button onClick={() => setIdx((idx + 1) % total)} className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#E5E5E5] rounded transition-colors" aria-label="Next affirmation">
          <ChevronRight size={12} aria-hidden />
        </button>
        <button onClick={() => setManaging(true)} className="w-6 h-6 flex items-center justify-center text-[#737373] hover:text-[#C9A227] rounded transition-colors" aria-label="Manage affirmations">
          <Settings2 size={11} aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ─── Compact API panels ───────────────────────────────────────────────────────

function PipelinePressurePanel() {
  const [data, setData] = useState<PipelinePressureMetrics | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => { fetch(`${API_BASE}/api/pipeline-pressure`).then((r) => r.json()).then(setData).catch(() => {}); }, []);

  async function scan() {
    setScanning(true);
    try { const r = await fetch(`${API_BASE}/api/pipeline-pressure/scan`, { method: 'POST' }); setData(await r.json()); }
    finally { setScanning(false); }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Pipeline Pressure" icon={Activity} />
        <Button variant="ghost" size="sm" onClick={scan} disabled={scanning}>{scanning ? 'Scanning…' : 'Scan'}</Button>
      </div>
      {!data ? <Skeleton className="h-20" /> : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Stalled Companies', value: data.stalledCompaniesCount },
            { label: 'Stalled Deals',     value: data.stalledDealsCount },
            { label: 'Cooling Contacts',  value: data.coolingRelationshipsCount },
            { label: 'Stalled Contacts',  value: data.stalledContactsCount },
          ].map((m) => (
            <StatCard key={m.label} label={m.label} value={m.value} valueColor={m.value > 0 ? 'danger' : 'success'} />
          ))}
        </div>
      )}
    </section>
  );
}

function DealVelocityPanel() {
  const [data, setData] = useState<{ deals: DealVelocityEntry[]; slowMovingCount: number } | null>(null);

  useEffect(() => { fetch(`${API_BASE}/api/deal-velocity`).then((r) => r.json()).then(setData).catch(() => {}); }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <SectionHeader title="Deal Velocity" icon={TrendingDown} />
        {data && data.slowMovingCount > 0 && <Badge variant="danger" size="sm">{data.slowMovingCount} slow</Badge>}
      </div>
      {!data ? <Skeleton className="h-20" /> : data.deals.length === 0
        ? <InlineEmpty message="No active deals." />
        : (
          <ul className="space-y-1.5">
            {data.deals.slice(0, 5).map((d) => {
              const pct = d.threshold ? Math.min(100, (d.stageDurationDays / d.threshold) * 100) : null;
              return (
                <li key={d.dealId} className={cn('bg-[#111111] border rounded-[8px] px-3 py-2.5', d.slowMoving ? 'border-[#D6454530]' : 'border-[#262626]')}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-sm text-[#E5E5E5] truncate">{d.companyName}</span>
                    <span className={cn('text-xs flex-shrink-0', d.slowMoving ? 'text-[#D64545]' : 'text-[#737373]')}>
                      {d.stageDurationDays}d{d.threshold ? `/${d.threshold}d` : ''}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-0.5 rounded-full bg-[#262626] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#D64545' : pct >= 75 ? '#E6A23C' : '#4CAF50' }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

function ConversationFunnelPanel() {
  const [funnel, setFunnel] = useState<ConversationFunnel | null>(null);
  const [freq, setFreq]     = useState<FrequencyProgress | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/conversation-funnel`).then((r) => r.json()),
      fetch(`${API_BASE}/api/frequency-progress`).then((r) => r.json()),
    ]).then(([f, p]) => { setFunnel(f); setFreq(p); }).catch(() => {});
  }, []);

  const steps = funnel ? [
    { label: 'Identified',  value: funnel.companiesIdentified },
    { label: 'Contacted',   value: funnel.ownersContacted },
    { label: 'Replied',     value: funnel.repliesReceived },
    { label: 'Meetings',    value: funnel.meetingsScheduled },
    { label: 'Progressing', value: funnel.dealsProgressing },
  ] : [];
  const maxVal = funnel ? Math.max(funnel.companiesIdentified, 1) : 1;

  return (
    <section>
      <SectionHeader title="Conversation Funnel" icon={MessageSquare} className="mb-3" />
      {!funnel ? <Skeleton className="h-24" /> : (
        <div className="bg-[#111111] border border-[#262626] rounded-[10px] p-4 space-y-2.5">
          {steps.map((step) => (
            <div key={step.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#737373]">{step.label}</span>
                <span className="font-medium text-[#E5E5E5]">{step.value}</span>
              </div>
              <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
                <div className="h-full rounded-full bg-[#C9A227]" style={{ width: `${Math.round((step.value / maxVal) * 100)}%` }} />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#262626]">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Reply Rate</div>
              <div className="text-lg font-serif font-semibold text-[#C9A227]">{funnel.replyRate}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-[#737373]">Meeting Rate</div>
              <div className="text-lg font-serif font-semibold text-[#C9A227]">{funnel.meetingRate}%</div>
            </div>
          </div>
          {freq && (
            <div className="pt-2 border-t border-[#262626] space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-[#737373] flex items-center gap-1"><UserCheck size={9} aria-hidden /> Weekly Targets</div>
              {[freq.ownersContactedPerWeek, freq.followUpsPerDay, freq.boardOutreachPerWeek].map((t) => {
                const pct = Math.min(100, t.target > 0 ? (t.current / t.target) * 100 : 0);
                return (
                  <div key={t.label}>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-[#737373]">{t.label}</span>
                      <span className={pct >= 100 ? 'text-[#4CAF50]' : 'text-[#737373]'}>{t.current}/{t.target}</span>
                    </div>
                    <div className="h-0.5 rounded-full bg-[#262626] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#4CAF50' : '#C9A227' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function SellerSignalsPanel() {
  const companies = useAppStore((s) => s.companies);
  const SIGNAL_LABELS: Record<string, string> = {
    retirementSignal: 'Retirement', noWebsiteSignal: 'No Website',
    reviewDeclineSignal: 'Reviews ↓', websiteOutdatedSignal: 'Outdated Site',
    hiringSlowdownSignal: 'Hiring ↓', linkedinInactiveSignal: 'LinkedIn Inactive',
  };
  const high = companies.filter((c) => (c.sellerSignalScore ?? 0) >= 3)
    .sort((a, b) => (b.sellerSignalScore ?? 0) - (a.sellerSignalScore ?? 0)).slice(0, 5);

  return (
    <section>
      <SectionHeader title={`Seller Signals · ${high.length} likely`} icon={Flame} className="mb-3" />
      {high.length === 0
        ? <InlineEmpty message="No companies with 3+ seller signals." />
        : (
          <ul className="space-y-1.5">
            {high.map((c) => {
              const sigs = Object.keys(SIGNAL_LABELS).filter((f) => (c as any)[f]);
              return (
                <li key={c.id} className="bg-[#111111] border border-[#D6454520] rounded-[8px] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[#E5E5E5] truncate">{c.name}</span>
                    <span className="text-xs font-bold text-[#D64545] flex-shrink-0">{c.sellerSignalScore ?? sigs.length}/6</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {sigs.map((s) => (
                      <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-[#D6454515] text-[#D64545] uppercase tracking-wider">{SIGNAL_LABELS[s]}</span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const tasks           = useAppStore((s) => s.tasks);
  const deals           = useAppStore((s) => s.deals);
  const emailThreads    = useAppStore((s) => s.emailThreads);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const checklistPhases = useAppStore((s) => s.checklistPhases);

  const actions = generateNextBestActions(tasks, deals, emailThreads, boardCandidates, checklistPhases);
  const hero    = actions[0];

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="page-container space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <PageHeader
        title="Command Center"
        subtitle={today}
        context="Dominion Edge Holdings"
      />

      {/* ── Zone 1: Hero action ─────────────────────────────────────────── */}
      {hero && <HeroAction action={hero} />}

      {/* ── Zone 2: Priority band ───────────────────────────────────────── */}
      <PriorityBand />

      {/* ── Zone 3: Main work area — actions + tasks/pipeline ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NextActionsQueue actions={actions} />
        <TaskPanel />
      </div>

      {/* ── Zone 4: Pipeline + affirmation ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineSnapshot />
        <div className="space-y-4">
          <AffirmationStrip />
          <ConversationKPIWidget />
        </div>
      </div>

      {/* ── Zone 5: Intelligence systems ────────────────────────────────── */}
      <div>
        <SectionHeader title="Performance Systems" icon={Activity} className="mb-4" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PipelinePressurePanel />
          <SellerSignalsPanel />
          <DealVelocityPanel />
        </div>
      </div>

      {/* ── Zone 6: Funnel + KPI ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversationFunnelPanel />
        <ConversationKPIWidget />
      </div>

    </div>
  );
}
