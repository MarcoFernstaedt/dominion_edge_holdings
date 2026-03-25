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
  Server, Cpu, MemoryStick, Bot, Workflow, RefreshCw,
} from 'lucide-react';
import { dashboardApi, performanceSystemsApi } from '@/lib/api';
import { smoothScrollTo, navigateWithScroll } from '@/lib/scrollTo';
import { useScrollTarget } from '@/hooks/useScrollTarget';
import { ConversationKPIWidget } from '@/components/modules/ConversationKPIWidget';
import type {
  Task, NextBestAction, PipelinePressureMetrics, AcquisitionScoreboard,
  DealVelocityEntry, ConversationFunnel, FrequencyProgress,
  Deal, EmailThread, BoardCandidate, ChecklistPhase, Company,
} from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Maps a NextBestAction to the route the user should navigate to when they
 * click "Start Now". Returns the most specific URL possible.
 */
/** Returns { route, scrollId } — scrollId is a section ID to focus after navigation */
function getActionDestination(action: NextBestAction): { route: string; scrollId: string } {
  switch (action.actionType) {
    case 'task':
      return { route: '/command-center', scrollId: 'section-tasks' };
    case 'email':
      return { route: '/inbox', scrollId: 'section-inbox' };
    case 'board':
      return { route: '/board', scrollId: 'section-board-candidates' };
    case 'deal':
      return action.linkedEntityId
        ? { route: `/pipeline/${action.linkedEntityId}`, scrollId: 'section-deal-detail' }
        : { route: '/pipeline', scrollId: 'section-pipeline-board' };
    case 'checklist':
      return {
        route: '/checklist',
        scrollId: action.linkedEntityId ? `checklist-item-${action.linkedEntityId}` : 'section-checklist',
      };
    case 'outreach':
      return { route: '/outreach', scrollId: 'section-outreach' };
    case 'meeting':
      return { route: '/meetings', scrollId: 'section-meetings' };
    default:
      return { route: '/checklist', scrollId: 'section-checklist' };
  }
}

function formatDurationCompact(totalSeconds?: number | null) {
  if (totalSeconds == null) return '—';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes?: number | null) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
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

function navigateToAction(router: ReturnType<typeof useRouter>, action: NextBestAction) {
  const { route, scrollId } = getActionDestination(action);
  const isCurrentPage = typeof window !== 'undefined' && window.location.pathname === route;

  if (isCurrentPage) {
    smoothScrollTo(scrollId);
    return;
  }

  navigateWithScroll(scrollId);
  router.push(route);
}

function HeroAction({ action }: { action: NextBestAction }) {
  const router = useRouter();
  const urgencyColor = { critical: '#D64545', high: '#E6A23C', medium: '#4D7EA8', low: '#737373' };
  const color = urgencyColor[action.urgency] ?? '#737373';

  function handleStartNow() {
    navigateToAction(router, action);
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
  const router = useRouter();
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
              <div className="flex items-center justify-between gap-3 mt-1.5">
                <div className="flex items-center gap-3 text-xs text-[#737373]">
                  <span className="flex items-center gap-1"><Clock size={10} aria-hidden />~{action.estimatedTimeMinutes}min</span>
                  <span className="flex items-center gap-1"><Zap size={10} aria-hidden />{action.recommendedBy}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigateToAction(router, action)}>
                  Open <ArrowRight size={12} aria-hidden />
                </Button>
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

  const overdueCount = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const todayDone = tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;

  function handleComplete(id: string) {
    updateTask(id, { status: 'done', completedAt: nowIso() });
  }

  function handleDefer(task: Task) {
    const next = task.dueDate ? new Date(task.dueDate) : new Date();
    next.setDate(next.getDate() + 1);
    updateTask(task.id, { dueDate: next.toISOString(), updatedAt: nowIso() });
  }

  function handleEscalate(task: Task) {
    updateTask(task.id, { priority: task.priority === 'critical' ? 'critical' : 'critical', updatedAt: nowIso() });
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
        <div className="flex items-center gap-2">
          {overdueCount > 0 && <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-[#D64545]">{overdueCount} overdue</span>}
          <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus size={13} aria-hidden /> Add
          </Button>
        </div>
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

      {overdueCount > 0 && (
        <div className="bg-[#D6454510] border border-[#D6454530] rounded-[8px] px-3 py-2.5 mb-3">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#D64545] mb-1">Task Consequence</div>
          <div className="text-xs text-[#A7A29A]">Overdue tasks mean execution debt. Clear drag before adding new complexity.</div>
        </div>
      )}

      {active.length === 0
        ? <InlineEmpty message="No open tasks. Add one above." />
        : (
          <ul className="space-y-1" role="list">
            {active.map((task) => {
              const overdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <li key={task.id} className={cn(
                  'flex items-center gap-3 bg-[#111111] border rounded-[8px] px-3 py-2.5 transition-colors',
                  overdue ? 'border-[#D6454530] hover:border-[#D64545]' : 'border-[#262626] hover:border-[#333333]'
                )}>
                  <button onClick={() => handleComplete(task.id)} className="flex-shrink-0 text-[#737373] hover:text-[#4CAF50] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A227] rounded" aria-label={`Complete "${task.title}"`}>
                    <Circle size={14} aria-hidden />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#E5E5E5] truncate">{task.title}</div>
                    {task.dueDate && <div className={cn('text-[11px] mt-0.5', overdue ? 'text-[#D64545]' : 'text-[#737373]')}>{overdue ? 'Overdue · ' : ''}{formatDate(task.dueDate)}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleDefer(task)} className="text-[10px] text-[#A7A29A] hover:text-[#E5E5E5] transition-colors">Defer</button>
                    <button onClick={() => handleEscalate(task)} className="text-[10px] text-[#D9A441] hover:text-[#F0C86A] transition-colors">Escalate</button>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: dot[task.priority] }} />
                  </div>
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
  const affirmations      = useAppStore((s) => s.affirmations);
  const settings          = useAppStore((s) => s.settings);
  const idx               = useAppStore((s) => s.currentAffirmationIndex);
  const setIdx            = useAppStore((s) => s.setAffirmationIndex);
  const addAffirmation    = useAppStore((s) => s.addAffirmation);
  const updateAffirmation = useAppStore((s) => s.updateAffirmation);
  const deleteAffirmation = useAppStore((s) => s.deleteAffirmation);
  const updateSettings    = useAppStore((s) => s.updateSettings);

  const [managing, setManaging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ text: '', theme: 'mindset' });
  const [addDraft, setAddDraft] = useState({ text: '', theme: 'mindset' });
  const [adding, setAdding] = useState(false);

  const active = affirmations.filter((a) => a.isActive !== false);
  const total = active.length;

  const isEvening = (() => {
    if (typeof window === 'undefined') return false;
    const hour = new Date().getHours();
    return hour >= 16;
  })();

  const filtered = active.filter((a) => {
    const timeMatch = !a.timeOfDay || a.timeOfDay === 'any' || (isEvening ? a.timeOfDay === 'evening' : a.timeOfDay === 'morning');
    const focusMatch = !a.qlaFocus || settings.qlaAffirmationFocus === 'auto' || a.qlaFocus === settings.qlaAffirmationFocus;
    return timeMatch && focusMatch;
  });

  const pool = filtered.length > 0 ? filtered : active;
  const aff = pool.length > 0 ? pool[idx % pool.length] : null;
  const focusOptions = [
    { key: 'auto', label: 'Auto' },
    { key: 'execution', label: 'Execution' },
    { key: 'board', label: 'Board' },
    { key: 'sourcing', label: 'Sourcing' },
    { key: 'resilience', label: 'Resilience' },
    { key: 'vision', label: 'Vision' },
  ] as const;

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
    <div className="bg-[#111111] border border-[#262626] rounded-[10px] px-5 py-4 space-y-3" style={{ borderLeftWidth: 2, borderLeftColor: '#C9A22760' }}>
      <div className="flex items-center gap-2 flex-wrap">
        {focusOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => updateSettings({ qlaAffirmationFocus: option.key })}
            className={cn(
              'text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded border transition-colors',
              (settings.qlaAffirmationFocus || 'auto') === option.key
                ? 'bg-[#C9A22718] border-[#C9A22755] text-[#C9A227]'
                : 'bg-[#0F0F10] border-[#262626] text-[#737373] hover:text-[#E5E5E5]'
            )}
          >
            {option.label}
          </button>
        ))}
        <Link href="/settings" className="text-[10px] uppercase tracking-[0.12em] text-[#737373] hover:text-[#C9A227] transition-colors">
          Tune in settings →
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A227] mb-1.5">
            {aff!.theme}
            {aff!.qlaFocus ? ` · ${aff!.qlaFocus}` : ''}
            {typeof aff!.intensity === 'number' ? ` · intensity ${aff!.intensity}/3` : ''}
          </div>
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
    </div>
  );
}

// ─── Compact API panels ───────────────────────────────────────────────────────

function PipelinePressurePanel() {
  const [data, setData] = useState<PipelinePressureMetrics | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    performanceSystemsApi.getPipelinePressure().then(setData).catch(() => {});
  }, []);

  async function scan() {
    setScanning(true);
    try {
      setData(await performanceSystemsApi.scanPipelinePressure());
    } finally {
      setScanning(false);
    }
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

  useEffect(() => {
    performanceSystemsApi.getDealVelocity().then(setData).catch(() => {});
  }, []);

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
      performanceSystemsApi.getConversationFunnel(),
      performanceSystemsApi.getFrequencyProgress(),
    ]).then(([f, p]) => {
      setFunnel(f);
      setFreq(p);
    }).catch(() => {});
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
              const signalCompany = c as Company & Record<string, unknown>;
              const sigs = Object.keys(SIGNAL_LABELS).filter((f) => Boolean(signalCompany[f]));
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

function DriftRadarPanel({
  boardOutreachCount,
  sellerOutreachCount,
  targetCount,
  activeDeals,
  dueToday,
}: {
  boardOutreachCount: number;
  sellerOutreachCount: number;
  targetCount: number;
  activeDeals: number;
  dueToday: number;
}) {
  const tasks = useAppStore((s) => s.tasks);
  const deals = useAppStore((s) => s.deals);
  const dailyBriefings = useAppStore((s) => s.dailyBriefings);
  const accountabilityLog = useAppStore((s) => s.accountabilityLog);
  const companies = useAppStore((s) => s.companies);

  const todayKey = new Date().toDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const hasBriefingToday = dailyBriefings.some((entry) => new Date(entry.createdAt).toDateString() === todayKey);
  const hasAccountabilityToday = accountabilityLog.some((entry) => new Date(entry.createdAt).toDateString() === todayKey);
  const newTargetsThisWeek = companies.filter((company) => new Date(company.createdAt) > weekAgo).length;
  const overdueTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'archived' && task.dueDate && new Date(task.dueDate) < new Date()).length;
  const stalledDeals = deals.filter((deal) => deal.status === 'stalled' || (deal.updatedAt && daysSince(deal.updatedAt) > 7)).length;

  const checks = [
    {
      label: 'Board-first discipline',
      detail: boardOutreachCount > 0 ? `${boardOutreachCount} board touches in the last 7 days` : 'No board touches logged in the last 7 days',
      state: boardOutreachCount > 0 ? 'healthy' : 'critical',
    },
    {
      label: 'Sourcing engine',
      detail: sellerOutreachCount > 0 || newTargetsThisWeek > 0
        ? `${sellerOutreachCount} seller touches · ${newTargetsThisWeek} new targets this week`
        : 'No seller touches or new targets logged this week',
      state: sellerOutreachCount > 0 || newTargetsThisWeek > 0 ? 'healthy' : 'critical',
    },
    {
      label: 'Daily operator routine',
      detail: hasBriefingToday && hasAccountabilityToday
        ? 'Today has both a saved brief and accountability check-in'
        : hasBriefingToday || hasAccountabilityToday
        ? 'Only one of today’s operator check-ins is logged'
        : 'No operator brief or accountability check-in logged today',
      state: hasBriefingToday && hasAccountabilityToday ? 'healthy' : hasBriefingToday || hasAccountabilityToday ? 'warning' : 'critical',
    },
    {
      label: 'Pipeline movement',
      detail: activeDeals > 0
        ? `${activeDeals} active deals · ${stalledDeals} stalled · ${dueToday} due today`
        : targetCount > 0
        ? `${targetCount} targets tracked, but no active deals yet`
        : 'No targets or active deals in motion',
      state: activeDeals > 0 && stalledDeals === 0 ? 'healthy' : activeDeals > 0 || targetCount > 0 ? 'warning' : 'critical',
    },
    {
      label: 'Task discipline',
      detail: overdueTasks === 0 ? 'No overdue tasks right now' : `${overdueTasks} overdue task${overdueTasks !== 1 ? 's' : ''} dragging execution`,
      state: overdueTasks === 0 ? 'healthy' : overdueTasks <= 3 ? 'warning' : 'critical',
    },
  ] as const;

  const redFlags = checks.filter((check) => check.state === 'critical').length;
  const warnings = checks.filter((check) => check.state === 'warning').length;
  const score = Math.max(0, 100 - (redFlags * 25) - (warnings * 10));
  const tone = redFlags > 0 ? 'critical' : warnings > 0 ? 'warning' : 'healthy';
  const toneStyles = {
    healthy: { border: '#4CAF5060', text: '#4CAF50', badge: 'Locked in' },
    warning: { border: '#E6A23C60', text: '#E6A23C', badge: 'Watch drift' },
    critical: { border: '#D6454560', text: '#D64545', badge: 'Drift active' },
  } as const;

  const recoveryActions = [
    boardOutreachCount === 0 ? { label: 'Restore board-first discipline', href: '/board#section-board-candidates' } : null,
    sellerOutreachCount === 0 ? { label: 'Push sourcing activity now', href: '/execution/daily#daily-log-form' } : null,
    !hasBriefingToday || !hasAccountabilityToday ? { label: 'Log operator routine', href: '/command-center' } : null,
    overdueTasks > 0 ? { label: 'Clear overdue task drag', href: '/command-center#section-tasks' } : null,
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="bg-[#0F0F10] border rounded-[10px] p-4 space-y-3" style={{ borderColor: toneStyles[tone].border }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.12em] uppercase mb-1" style={{ color: toneStyles[tone].text }}>Anti-Drift Radar</div>
          <div className="text-sm font-medium text-[#E5E5E5]">QLA enforcement score · {score}/100</div>
        </div>
        <Badge variant={tone === 'healthy' ? 'success' : tone === 'warning' ? 'warning' : 'danger'} size="sm">{toneStyles[tone].badge}</Badge>
      </div>

      <ul className="space-y-2">
        {checks.map((check) => (
          <li key={check.label} className="bg-[#111111] border border-[#262626] rounded-[8px] px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[#E5E5E5]">{check.label}</span>
              <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: check.state === 'healthy' ? '#4CAF50' : check.state === 'warning' ? '#E6A23C' : '#D64545' }}>{check.state}</span>
            </div>
            <div className="text-xs text-[#737373] mt-1">{check.detail}</div>
          </li>
        ))}
      </ul>

      {tone !== 'healthy' && (
        <div className="bg-[#0D0D0D] border border-[#D6454530] rounded-[8px] px-3 py-3 space-y-2">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#D64545]">Recovery Actions Required</div>
          <div className="text-xs text-[#A7A29A]">You are not in a clean operating state. Recover before chasing more complexity.</div>
          <div className="flex flex-wrap gap-2">
            {recoveryActions.map((action) => (
              <Link key={action.label} href={action.href} className="px-2.5 py-1.5 rounded-lg border border-[#D6454530] text-xs text-[#E5E5E5] hover:border-[#D64545] transition-colors">
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemStatusPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof dashboardApi.getSystemStatus>> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      setData(await dashboardApi.getSystemStatus());
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  return (
    <section className="bg-[#111111] border border-[#262626] rounded-[10px] p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A227] mb-1.5">System Status</div>
          <h2 className="font-serif text-[22px] font-semibold text-[#E5E5E5] leading-snug">Command Center Runtime Surface</h2>
          <p className="text-sm text-[#737373] mt-1">App health, VPS telemetry, AI activity, automation state, and available workforce visibility.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load()} disabled={refreshing}>
          <RefreshCw size={13} aria-hidden className={cn(refreshing && 'animate-spin')} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {!data ? <Skeleton className="h-48" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="App Status" value={data.app.status.toUpperCase()} sub={`${data.app.environment} · up ${formatDurationCompact(data.app.uptimeSeconds)}`} valueColor={data.app.status === 'ok' ? 'success' : 'warning'} />
            <StatCard label="VPS Load" value={data.vps.loadAverage1m ?? '—'} sub={data.vps.hostname || 'host'} valueColor={data.vps.loadAverage1m != null && data.vps.loadAverage1m >= 2 ? 'warning' : 'gold'} />
            <StatCard label="Agents Active" value={data.workforce.agentsActiveLastHour} sub={`${data.workforce.agentRunsLastHour} runs last hour`} valueColor={data.workforce.agentsActiveLastHour > 0 ? 'success' : 'default'} />
            <StatCard label="Work Now" value={data.workforce.activeWorkNowApprox} sub="recent AI + running jobs" valueColor={data.workforce.activeWorkNowApprox > 0 ? 'success' : 'default'} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]"><Server size={12} aria-hidden /> VPS + App</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Memory" value={data.vps.memory?.usedPercent != null ? `${data.vps.memory.usedPercent}%` : '—'} sub={data.vps.memory ? `${formatBytes(data.vps.memory.usedBytes)} / ${formatBytes(data.vps.memory.totalBytes)}` : 'Unavailable'} valueColor={data.vps.memory?.usedPercent != null && data.vps.memory.usedPercent >= 85 ? 'warning' : 'gold'} />
                  <StatCard label="Node RSS" value={formatBytes(data.vps.node.rssBytes)} sub={`heap ${formatBytes(data.vps.node.heapUsedBytes)}`} valueColor="default" />
                  <StatCard label="Jobs Running" value={data.app.checks.automation.runningJobs} sub={`${data.app.checks.automation.registeredJobs} registered`} valueColor={data.app.checks.automation.runningJobs > 0 ? 'success' : 'default'} />
                  <StatCard label="Failures 1h" value={data.app.checks.automation.failedRunsLastHour} sub={`${data.app.checks.automation.jobsTouchedLastHour} jobs touched`} valueColor={data.app.checks.automation.failedRunsLastHour > 0 ? 'danger' : 'success'} />
                </div>
                <div className="text-xs text-[#737373]">{data.vps.platform || 'Unknown platform'} · host uptime {formatDurationCompact(data.vps.uptimeSeconds)} · Node {data.vps.node.version}</div>
              </div>

              <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]"><Cpu size={12} aria-hidden /> AI + Session Surface</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="AI Runs" value={data.ai.totalRuns} sub="captured in logger" valueColor="gold" />
                  <StatCard label="Failure Rate" value={`${Math.round((data.ai.failureRate || 0) * 100)}%`} sub={`fallback ${Math.round((data.ai.fallbackRate || 0) * 100)}%`} valueColor={data.ai.failureRate > 0.1 ? 'warning' : 'success'} />
                </div>
                <div className="bg-[#111111] border border-[#262626] rounded-[8px] px-3 py-3">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <span className="text-sm text-[#E5E5E5]">Codex / OpenClaw session usage</span>
                    <Badge variant={data.codexSession.available ? 'success' : 'muted'} size="sm">{data.codexSession.status}</Badge>
                  </div>
                  <p className="text-xs text-[#737373] leading-relaxed">{data.codexSession.note}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]"><Bot size={12} aria-hidden /> Agent Workforce</div>
                <div className="grid grid-cols-3 gap-2">
                  <StatCard label="Registered" value={data.workforce.registeredAgents} sub="known agents" />
                  <StatCard label="Active 1h" value={data.workforce.agentsActiveLastHour} sub="by run log" valueColor={data.workforce.agentsActiveLastHour > 0 ? 'success' : 'default'} />
                  <StatCard label="Subagents" value={data.workforce.subagents.available ? 'Live' : 'N/A'} sub="runtime integration" valueColor={data.workforce.subagents.available ? 'success' : 'warning'} />
                </div>
                <div className="space-y-2">
                  {data.workforce.agents.length === 0 ? (
                    <InlineEmpty message="No recent agent executions captured yet." />
                  ) : data.workforce.agents.map((agent) => (
                    <div key={agent.agentName} className="bg-[#111111] border border-[#262626] rounded-[8px] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[#E5E5E5]">{agent.agentName}</span>
                        <Badge variant={agent.status === 'error' ? 'danger' : agent.fallbackUsed ? 'warning' : 'success'} size="sm">
                          {agent.status === 'error' ? 'error' : agent.fallbackUsed ? 'fallback' : 'healthy'}
                        </Badge>
                      </div>
                      <div className="text-xs text-[#737373] mt-1">{agent.latestTask} · {agent.runCount} recent run{agent.runCount !== 1 ? 's' : ''} · {formatRelativeDate(agent.lastRunAt)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-[#737373]">{data.workforce.subagents.note}</div>
              </div>

              <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]"><Workflow size={12} aria-hidden /> Automation + Integrations</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Integrations" value={data.integrations.available ? data.integrations.connected : '—'} sub={data.integrations.available ? `${data.integrations.degraded} degraded` : 'Health job has not reported yet'} valueColor={data.integrations.degraded > 0 ? 'warning' : 'success'} />
                  <StatCard label="Recent Jobs" value={data.workforce.jobs.length} sub={data.integrations.checkedAt ? `checked ${formatRelativeDate(data.integrations.checkedAt)}` : 'waiting for check'} valueColor="default" />
                </div>
                <div className="space-y-2">
                  {data.workforce.jobs.map((job) => (
                    <div key={job.id} className="bg-[#111111] border border-[#262626] rounded-[8px] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-[#E5E5E5]">{job.name}</span>
                        <Badge variant={job.running ? 'info' : job.enabled ? 'success' : 'muted'} size="sm">{job.running ? 'running' : job.enabled ? 'enabled' : 'disabled'}</Badge>
                      </div>
                      <div className="text-xs text-[#737373] mt-1">{job.lastRun ? `Last run ${formatRelativeDate(job.lastRun)}` : 'No run recorded yet'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function SentinelOperatorPanel() {
  const companies = useAppStore((s) => s.companies);
  const interactions = useAppStore((s) => s.interactions);
  const tasks = useAppStore((s) => s.tasks);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const deals = useAppStore((s) => s.deals);
  const settings = useAppStore((s) => s.settings);
  const dailyBriefings = useAppStore((s) => s.dailyBriefings);
  const accountabilityLog = useAppStore((s) => s.accountabilityLog);
  const addDailyBriefing = useAppStore((s) => s.addDailyBriefing);
  const addAccountabilityRecord = useAppStore((s) => s.addAccountabilityRecord);

  const today = new Date().toDateString();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const activeDeals = deals.filter((d) => d.status === 'active').length;
  const targetCount = companies.length;
  const boardReadyCount = boardCandidates.filter((c) => ['engaged', 'responsive', 'confirmed'].includes(c.status)).length;
  const boardOutreachCount = boardCandidates.filter((c) => c.updatedAt && new Date(c.updatedAt) > weekAgo).length;
  const sellerOutreachCount = interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo).length;
  const dueToday = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate).toDateString() === today).length;

  const wakeTime = settings.operatorWakeTime || '05:00';
  const qlaStart = settings.qlaWorkStartTime || '17:00';
  const eveningModeStart = settings.qlaEveningModeStartTime || '16:00';
  const industry = settings.qlaPrimaryIndustry || 'Pest control';
  const goal = settings.qlaPrimaryGoal || 'First acquisition in ~12 months. Three acquisitions in 2 years.';
  const morningStack = settings.qlaMorningStack?.length
    ? settings.qlaMorningStack
    : ['Wake', 'Train', 'Affirmations', 'Read/Study', 'Plan outreach', 'Prepare evening execution block'];
  const sprintSteps = settings.qlaSprintTemplate?.length
    ? settings.qlaSprintTemplate
    : [
        '15 min — review Command Center and confirm the single win',
        '30 min — add or qualify 10 pest control targets',
        '45 min — send board or seller outreach and log it',
        '30 min — advance one task, follow-up, or underwriting item',
      ];

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const parseTimeToMinutes = (value: string) => {
    const [h, m] = value.split(':').map((n) => Number(n) || 0);
    return h * 60 + m;
  };
  const isEveningMode = currentMinutes >= parseTimeToMinutes(eveningModeStart);

  const topActions = [
    { label: 'Build board strength', detail: boardReadyCount > 0 ? `${boardReadyCount} warm board candidates in motion` : 'No warm board candidates yet — start outreach' },
    { label: 'Increase sourcing volume', detail: targetCount > 0 ? `${targetCount} total ${industry.toLowerCase()} targets tracked` : `No ${industry.toLowerCase()} targets loaded — sourcing must start` },
    { label: 'Advance live opportunities', detail: activeDeals > 0 ? `${activeDeals} active deal${activeDeals !== 1 ? 's' : ''} need momentum` : 'No active deals yet — fill the pipeline' },
  ];

  const scorecard = [
    { label: 'Board outreach / week', current: boardOutreachCount, target: settings.qlaBoardOutreachWeeklyTarget || 10 },
    { label: 'Seller outreach / week', current: sellerOutreachCount, target: settings.qlaSellerOutreachWeeklyTarget || 25 },
    { label: 'Targets tracked', current: targetCount, target: settings.qlaTargetCountGoal || 100 },
    { label: 'Tasks due today', current: dueToday, target: 0 },
  ];

  const latestBriefing = dailyBriefings[0] || null;
  const latestAccountability = accountabilityLog[0] || null;

  function saveBriefing() {
    addDailyBriefing({
      id: `brief-${Date.now()}`,
      createdAt: new Date().toISOString(),
      mode: isEveningMode ? 'evening' : 'morning',
      summary: `${isEveningMode ? 'Evening' : 'Morning'} brief for ${industry}. Goal: ${goal}`,
      topActions: topActions.map((x) => x.label),
      sprintSteps,
    });
  }

  function logAccountability() {
    addAccountabilityRecord({
      id: `acct-${Date.now()}`,
      createdAt: new Date().toISOString(),
      wakeComplete: true,
      trainingComplete: !isEveningMode,
      affirmationsComplete: true,
      readingComplete: !isEveningMode,
      outreachComplete: isEveningMode,
      notes: isEveningMode ? 'Evening execution block logged from Command Center.' : 'Morning foundation logged from Command Center.',
    });
  }

  return (
    <section className="bg-[#111111] border border-[#262626] rounded-[10px] p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A227] mb-1.5">Sentinel Operator Layer</div>
          <h2 className="font-serif text-[22px] font-semibold text-[#E5E5E5] leading-snug">
            {isEveningMode ? 'Evening QLA Execution Brief' : 'Morning QLA Command Brief'}
          </h2>
          <p className="text-sm text-[#737373] mt-1">Wake {wakeTime} · QLA block starts {qlaStart} · Evening mode from {eveningModeStart} · Focus: {industry}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="warning" size="sm">Phase 1</Badge>
          <Badge variant={isEveningMode ? 'warning' : 'info'} size="sm">{isEveningMode ? 'Evening Mode' : 'Morning Mode'}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] px-4 py-3">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A22799] mb-1.5">Current Goal</div>
          <p className="text-sm text-[#A3A3A3] leading-relaxed">{goal}</p>
        </div>
        <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] px-4 py-3">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#C9A22799] mb-1.5">Affirmation</div>
          <p className="font-serif italic text-[#A3A3A3] leading-relaxed">I move first, build credibility fast, and create acquisition momentum every day.</p>
        </div>
      </div>

      <DriftRadarPanel
        boardOutreachCount={boardOutreachCount}
        sellerOutreachCount={sellerOutreachCount}
        targetCount={targetCount}
        activeDeals={activeDeals}
        dueToday={dueToday}
      />

      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227] mb-2">{isEveningMode ? 'Morning Foundation' : 'Morning Stack'}</div>
        <div className="flex flex-wrap gap-2">
          {morningStack.map((item) => (
            <span key={item} className="text-[11px] px-2.5 py-1 rounded bg-[#0F0F10] border border-[#262626] text-[#A3A3A3]">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227] mb-2">Operator Jump Links</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { href: '/execution/daily', label: 'Daily Execution', detail: 'Log tonight\'s volume' },
            { href: '/execution/pipeline', label: 'Pipeline Funnel', detail: 'Check 500 → 1 progress' },
            { href: '/execution/board', label: 'Board Strength', detail: 'Recruit operators and advisors' },
            { href: '/settings', label: 'Operator Settings', detail: 'Adjust sprint + targets' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="bg-[#0F0F10] border border-[#262626] rounded-[8px] px-4 py-3 hover:border-[#C9A22750] transition-colors">
              <div className="text-sm font-medium text-[#E5E5E5]">{item.label}</div>
              <div className="text-xs text-[#737373] mt-0.5">{item.detail}</div>
            </Link>
          ))}
        </div>
      </div>

      {boardOutreachCount === 0 && (
        <div className="bg-[#D6454510] border border-[#D6454530] rounded-[10px] px-4 py-3">
          <div className="text-[10px] tracking-[0.12em] uppercase text-[#D64545] mb-1">Board-first failure</div>
          <div className="text-xs text-[#A7A29A]">No board outreach is logged this week. Board-first discipline is broken until that changes.</div>
        </div>
      )}

      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227] mb-2">Top 3 Actions</div>
        <ul className="space-y-2">
          {topActions.map((item) => (
            <li key={item.label} className="bg-[#0F0F10] border border-[#262626] rounded-[8px] px-4 py-3">
              <div className="text-sm font-medium text-[#E5E5E5]">{item.label}</div>
              <div className="text-xs text-[#737373] mt-0.5">{item.detail}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227] mb-2">{isEveningMode ? 'Tonight\'s 2-Hour Sprint' : 'Exact 2-Hour Sprint'}</div>
        <ol className="space-y-2 list-decimal list-inside text-sm text-[#A3A3A3]">
          {sprintSteps.map((step) => (
            <li key={step} className="bg-[#0F0F10] border border-[#262626] rounded-[8px] px-4 py-3 list-none">
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227] mb-2">{isEveningMode ? 'Execution Scorecard' : 'Preparation Scorecard'}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {scorecard.map((item) => {
            const pct = Math.min(100, item.target > 0 ? Math.round((item.current / item.target) * 100) : 0);
            return (
              <div key={item.label} className="bg-[#0F0F10] border border-[#262626] rounded-[8px] px-4 py-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs text-[#737373]">{item.label}</span>
                  <span className="text-xs font-medium text-[#E5E5E5]">{item.current}/{item.target}</span>
                </div>
                <div className="h-1 rounded-full bg-[#262626] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? '#4CAF50' : '#C9A227' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]">Briefing History</div>
            <Button variant="ghost" size="sm" onClick={saveBriefing}>Save Brief</Button>
          </div>
          {latestBriefing ? (
            <div className="space-y-2">
              <div className="text-xs text-[#737373]">Last saved: {formatRelativeDate(latestBriefing.createdAt)} · {latestBriefing.mode}</div>
              <div className="text-sm text-[#A3A3A3]">{latestBriefing.summary}</div>
            </div>
          ) : (
            <InlineEmpty message="No briefing saved yet." />
          )}
        </div>

        <div className="bg-[#0F0F10] border border-[#262626] rounded-[10px] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[#C9A227]">Accountability</div>
            <Button variant="ghost" size="sm" onClick={logAccountability}>Log Check-In</Button>
          </div>
          {latestAccountability ? (
            <div className="space-y-2 text-sm text-[#A3A3A3]">
              <div className="text-xs text-[#737373]">Last logged: {formatRelativeDate(latestAccountability.createdAt)}</div>
              <div>Wake: {latestAccountability.wakeComplete ? 'done' : 'missed'} · Training: {latestAccountability.trainingComplete ? 'done' : 'missed'}</div>
              <div>Affirmations: {latestAccountability.affirmationsComplete ? 'done' : 'missed'} · Reading: {latestAccountability.readingComplete ? 'done' : 'missed'}</div>
              <div>Outreach: {latestAccountability.outreachComplete ? 'done' : 'missed'}</div>
            </div>
          ) : (
            <InlineEmpty message="No accountability check-in logged yet." />
          )}
        </div>
      </div>
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

  // Auto-scroll to a section if navigated here via navigateWithScroll()
  useScrollTarget();

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

      {/* ── System status surface ──────────────────────────────────────── */}
      <SystemStatusPanel />

      {/* ── Sentinel operator layer ─────────────────────────────────────── */}
      <SentinelOperatorPanel />

      {/* ── Zone 2: Priority band ───────────────────────────────────────── */}
      <PriorityBand />

      {/* ── Zone 3: Main work area — actions + tasks/pipeline ───────────── */}
      <div id="section-tasks" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-6">
        <NextActionsQueue actions={actions} />
        <TaskPanel />
      </div>

      {/* ── Zone 4: Pipeline + affirmation ──────────────────────────────── */}
      <div id="section-pipeline-snapshot" className="grid grid-cols-1 lg:grid-cols-2 gap-6 scroll-mt-6">
        <PipelineSnapshot />
        <div className="space-y-4">
          <AffirmationStrip />
          <ConversationKPIWidget />
        </div>
      </div>

      {/* ── Zone 5: Intelligence systems ────────────────────────────────── */}
      <div id="section-intelligence">
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
