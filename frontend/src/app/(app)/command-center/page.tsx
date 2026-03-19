'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { AFFIRMATIONS } from '@/data/affirmations';
import { MetricCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { cn, formatDate, formatRelativeDate, daysSince, nowIso, generateId, STAGE_LABELS, formatCurrency } from '@/lib/utils';
import {
  ChevronRight, ChevronLeft, AlertTriangle, Clock, Star, Plus,
  CheckCircle2, Circle, ArrowRight, TrendingUp, Users, KanbanSquare,
  CheckSquare, Bell, Zap, Activity, Target, Flame, BarChart2,
  TrendingDown, MessageSquare, UserCheck, Filter, Radar, BookOpen,
} from 'lucide-react';
import { sourcingRadarApi, meetingPrepApi, dealProbabilityApi } from '@/lib/api';
import { ConversationKPIWidget } from '@/components/modules/ConversationKPIWidget';
import type {
  Task, NextBestAction,
  PipelinePressureMetrics, AcquisitionScoreboard,
  DealVelocityEntry, ConversationFunnel, FrequencyProgress,
  Deal, EmailThread, BoardCandidate, ChecklistPhase,
} from '@/lib/types';
import Link from 'next/link';

function AffirmationCard() {
  const idx = useAppStore((s) => s.currentAffirmationIndex);
  const setIdx = useAppStore((s) => s.setAffirmationIndex);
  const affirmation = AFFIRMATIONS[idx % AFFIRMATIONS.length];

  return (
    <article
      className="bg-[#141414] border-l-4 border-[#D4AF37] border border-[#2A2A2E] rounded-md p-5 flex items-start justify-between gap-4"
      aria-label="Daily affirmation"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] tracking-widest uppercase font-medium text-[#D4AF37] mb-2">
          Daily Affirmation — {affirmation.theme}
        </div>
        <blockquote className="font-serif text-lg italic text-[#E8E6E3] leading-relaxed">
          "{affirmation.text}"
        </blockquote>
        <div className="text-xs text-[#A7A29A] mt-2">
          {idx + 1} of {AFFIRMATIONS.length}
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIdx((idx + 1) % AFFIRMATIONS.length)}
          aria-label="Next affirmation"
        >
          <ChevronRight size={14} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIdx((idx - 1 + AFFIRMATIONS.length) % AFFIRMATIONS.length)}
          aria-label="Previous affirmation"
        >
          <ChevronLeft size={14} aria-hidden />
        </Button>
      </div>
    </article>
  );
}

function TodaysBriefing() {
  const tasks = useAppStore((s) => s.tasks);
  const deals = useAppStore((s) => s.deals);
  const emailThreads = useAppStore((s) => s.emailThreads);
  const checklistPhases = useAppStore((s) => s.checklistPhases);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const totalItems = checklistPhases.flatMap((p) => p.items).length;
  const completedItems = checklistPhases.flatMap((p) => p.items).filter((i) => i.isComplete).length;
  const activePhase = checklistPhases.find((p) => p.items.some((i) => !i.isComplete))?.name ?? 'Complete';

  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()
  );
  const needsReply = emailThreads.filter((t) => t.requiresReply && !t.isSuppressed);
  const stalledDeals = deals.filter(
    (d) => d.status === 'stalled' || (d.updatedAt && daysSince(d.updatedAt) > 7)
  );

  const briefingItems = [
    overdueTasks.length > 0 && `${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''} require attention`,
    needsReply.length > 0 && `${needsReply.length} inbox thread${needsReply.length !== 1 ? 's' : ''} awaiting reply`,
    stalledDeals.length > 0 && `${stalledDeals.length} deal${stalledDeals.length !== 1 ? 's' : ''} stalled or inactive`,
    `Active phase: ${activePhase}`,
    `Checklist: ${completedItems}/${totalItems} steps complete`,
  ].filter(Boolean) as string[];

  return (
    <section aria-labelledby="briefing-heading">
      <h2 id="briefing-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-3">
        Today's Briefing
      </h2>
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
        <div className="text-sm font-medium text-[#D4AF37] mb-3">{today}</div>
        {briefingItems.length === 0 ? (
          <p className="text-sm text-[#A7A29A]">All caught up. Execute your top priorities.</p>
        ) : (
          <ul className="space-y-2">
            {briefingItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#E8E6E3]">
                <span className="text-[#D4AF37] mt-0.5 flex-shrink-0" aria-hidden>◆</span>
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function generateNextBestActions(
  tasks: Task[],
  deals: Deal[],
  emailThreads: EmailThread[],
  boardCandidates: BoardCandidate[],
  checklistPhases: ChecklistPhase[]
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  // Overdue tasks
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()
  ).slice(0, 2);

  overdueTasks.forEach((t) => {
    actions.push({
      id: `task-${t.id}`,
      actionType: 'task',
      title: `Complete: ${t.title}`,
      whyItMatters: `This task is overdue. Delays compound.`,
      estimatedTimeMinutes: 30,
      linkedEntityType: 'task',
      linkedEntityId: t.id,
      urgency: 'critical',
      recommendedBy: 'System',
    });
  });

  // Emails needing reply
  const needsReply = emailThreads.filter((t) => t.requiresReply).slice(0, 2);
  needsReply.forEach((thread) => {
    actions.push({
      id: `email-${thread.id}`,
      actionType: 'email',
      title: `Reply to: ${thread.subject}`,
      whyItMatters: 'Unanswered emails kill deals. Respond within 24 hours.',
      estimatedTimeMinutes: 15,
      linkedEntityType: 'thread',
      linkedEntityId: thread.id,
      urgency: 'high',
      recommendedBy: 'Inbox Agent',
    });
  });

  // Board candidates pending action
  const pendingCandidates = boardCandidates.filter(
    (c) => c.status === 'identified' || c.status === 'researched'
  ).slice(0, 1);
  pendingCandidates.forEach((c) => {
    actions.push({
      id: `board-${c.id}`,
      actionType: 'board',
      title: `Reach out to board candidate: ${c.name}`,
      whyItMatters: 'Board assembly is your most critical early-stage activity.',
      estimatedTimeMinutes: 20,
      linkedEntityType: 'candidate',
      linkedEntityId: c.id,
      urgency: 'high',
      recommendedBy: 'Board Builder',
    });
  });

  // Stalled deals
  const stalledDeals = deals.filter(
    (d) => d.status === 'active' && daysSince(d.updatedAt) > 5
  ).slice(0, 1);
  stalledDeals.forEach((d) => {
    actions.push({
      id: `deal-${d.id}`,
      actionType: 'deal',
      title: `Advance deal: ${d.name}`,
      whyItMatters: `No activity in ${daysSince(d.updatedAt)} days. Stalled deals die.`,
      estimatedTimeMinutes: 45,
      linkedEntityType: 'deal',
      linkedEntityId: d.id,
      urgency: 'medium',
      recommendedBy: 'Deal Analyst',
    });
  });

  // Checklist next item
  const nextChecklistItem = checklistPhases
    .flatMap((p) => p.items)
    .find((i) => !i.isComplete);
  if (nextChecklistItem && actions.length < 6) {
    actions.push({
      id: `checklist-${nextChecklistItem.id}`,
      actionType: 'checklist',
      title: `Next step: ${nextChecklistItem.title}`,
      whyItMatters: nextChecklistItem.whyItMatters || 'Keep the process moving forward.',
      estimatedTimeMinutes: 60,
      linkedEntityType: 'checklist',
      linkedEntityId: nextChecklistItem.id,
      urgency: 'medium',
      recommendedBy: 'Strategy Advisor',
    });
  }

  // Default action if nothing else
  if (actions.length === 0) {
    actions.push({
      id: 'default-1',
      actionType: 'outreach',
      title: 'Send 5 seller outreach emails today',
      whyItMatters: 'Consistent outreach volume is the engine of deal flow.',
      estimatedTimeMinutes: 45,
      urgency: 'high',
      recommendedBy: 'Strategy Advisor',
    });
    actions.push({
      id: 'default-2',
      actionType: 'board',
      title: 'Identify 3 new board candidate prospects',
      whyItMatters: 'Board assembly is your most critical priority.',
      estimatedTimeMinutes: 30,
      urgency: 'high',
      recommendedBy: 'Board Builder',
    });
  }

  const urgencyOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]).slice(0, 7);
}

function NextBestActions() {
  const tasks = useAppStore((s) => s.tasks);
  const deals = useAppStore((s) => s.deals);
  const emailThreads = useAppStore((s) => s.emailThreads);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const checklistPhases = useAppStore((s) => s.checklistPhases);

  const actions = generateNextBestActions(tasks, deals, emailThreads, boardCandidates, checklistPhases);

  const urgencyBadge = (urgency: string) => {
    const map: Record<string, 'danger' | 'warning' | 'info' | 'muted'> = {
      critical: 'danger',
      high: 'warning',
      medium: 'info',
      low: 'muted',
    };
    return map[urgency] ?? 'muted';
  };

  return (
    <section aria-labelledby="nba-heading">
      <h2 id="nba-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-3">
        Next Best Actions
      </h2>
      <ol className="space-y-2">
        {actions.map((action, i) => (
          <li
            key={action.id}
            className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 flex items-start gap-4 hover:border-[#3A3A3E] transition-colors"
          >
            <span
              className="flex-shrink-0 w-6 h-6 rounded-full bg-[#D4AF3710] text-[#D4AF37] flex items-center justify-center text-xs font-bold border border-[#D4AF3730]"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-[#E8E6E3]">{action.title}</span>
                <Badge variant={urgencyBadge(action.urgency)} size="sm">{action.urgency}</Badge>
              </div>
              <p className="text-xs text-[#A7A29A] mt-0.5">{action.whyItMatters}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-[#A7A29A]">
                <span className="flex items-center gap-1">
                  <Clock size={10} aria-hidden />
                  ~{action.estimatedTimeMinutes}min
                </span>
                <span className="flex items-center gap-1">
                  <Zap size={10} aria-hidden />
                  {action.recommendedBy}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TaskPanel() {
  const tasks = useAppStore((s) => s.tasks);
  const updateTask = useAppStore((s) => s.updateTask);
  const addTask = useAppStore((s) => s.addTask);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'high', dueDate: '' });

  const activeTasks = tasks
    .filter((t) => t.status !== 'done' && t.status !== 'archived')
    .sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] ?? 2) - (pOrder[b.priority] ?? 2);
    })
    .slice(0, 8);

  const todayDone = tasks.filter(
    (t) =>
      t.status === 'done' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  ).length;

  function handleComplete(id: string) {
    updateTask(id, {
      status: 'done',
      completedAt: nowIso(),
    });
    const announcer = document.getElementById('status-announcer');
    if (announcer) announcer.textContent = 'Task marked complete';
  }

  function handleAddTask() {
    if (!form.title.trim()) return;
    addTask({
      id: generateId(),
      title: form.title,
      status: 'todo',
      priority: form.priority as Task['priority'],
      dueDate: form.dueDate || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    setForm({ title: '', priority: 'high', dueDate: '' });
    setShowForm(false);
  }

  const priorityColors = { critical: '#C35B5B', high: '#D9A441', medium: '#4D7EA8', low: '#A7A29A' };

  return (
    <section aria-labelledby="tasks-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="tasks-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">
          Tasks — {todayDone} done today
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)} aria-expanded={showForm}>
          <Plus size={13} aria-hidden />
          Add Task
        </Button>
      </div>

      {showForm && (
        <div className="bg-[#141414] border border-[#D4AF3730] rounded-md p-4 mb-3 space-y-3">
          <Input
            label="Task title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What needs to be done?"
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />
            <Input
              label="Due date"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleAddTask}>Save Task</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {activeTasks.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-6 text-center">
          <CheckCircle2 size={24} className="mx-auto text-[#3FA66B] mb-2" aria-hidden />
          <p className="text-sm text-[#A7A29A]">No open tasks. Add tasks above.</p>
        </div>
      ) : (
        <ul className="space-y-1.5" role="list" aria-label="Open tasks">
          {activeTasks.map((task) => {
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
            return (
              <li key={task.id} className="flex items-center gap-3 bg-[#141414] border border-[#2A2A2E] rounded px-3 py-2.5 group hover:border-[#3A3A3E]">
                <button
                  onClick={() => handleComplete(task.id)}
                  className="flex-shrink-0 text-[#A7A29A] hover:text-[#3FA66B] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                  aria-label={`Mark "${task.title}" as complete`}
                >
                  <Circle size={15} aria-hidden />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#E8E6E3] truncate">{task.title}</div>
                  {task.dueDate && (
                    <div className={cn('text-xs mt-0.5', isOverdue ? 'text-[#C35B5B]' : 'text-[#A7A29A]')}>
                      {isOverdue ? 'Overdue · ' : ''}{formatDate(task.dueDate)}
                    </div>
                  )}
                </div>
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: priorityColors[task.priority] }}
                  aria-label={`${task.priority} priority`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ExecutionScoreboard() {
  const tasks = useAppStore((s) => s.tasks);
  const companies = useAppStore((s) => s.companies);
  const deals = useAppStore((s) => s.deals);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const interactions = useAppStore((s) => s.interactions);

  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);

  const targetsThisWeek = companies.filter(
    (c) => new Date(c.createdAt) > thisWeek
  ).length;

  const contactsThisWeek = interactions.filter(
    (i) => i.interactionType === 'email' && i.direction === 'outbound' && new Date(i.createdAt) > thisWeek
  ).length;

  const repliesThisWeek = interactions.filter(
    (i) => i.interactionType === 'email' && i.direction === 'inbound' && new Date(i.createdAt) > thisWeek
  ).length;

  const activeDeals = deals.filter((d) => d.status === 'active').length;

  const boardFilled = boardCandidates.filter((c) => c.status === 'confirmed').length;

  const todayDone = tasks.filter(
    (t) =>
      t.status === 'done' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString()
  ).length;

  const todayOverdue = tasks.filter(
    (t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()
  ).length;

  const metrics = [
    { label: 'Targets Added', value: targetsThisWeek, sub: 'this week' },
    { label: 'Owners Contacted', value: contactsThisWeek, sub: 'this week' },
    { label: 'Replies', value: repliesThisWeek, sub: 'this week' },
    { label: 'Active Deals', value: activeDeals, sub: 'in review' },
    { label: 'Board Filled', value: `${boardFilled}/6`, sub: 'seats committed' },
    { label: 'Tasks Today', value: todayDone, sub: `${todayOverdue} overdue` },
  ];

  return (
    <section aria-labelledby="scoreboard-heading">
      <h2 id="scoreboard-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-3">
        Execution Scoreboard
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list" aria-label="Performance metrics">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4"
            role="listitem"
          >
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">{m.label}</div>
            <div className="text-2xl font-bold font-serif text-[#D4AF37]">{m.value}</div>
            <div className="text-xs text-[#A7A29A] mt-0.5">{m.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PipelineSnapshot() {
  const deals = useAppStore((s) => s.deals);

  const byStage = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});

  if (deals.length === 0) {
    return (
      <section aria-labelledby="pipeline-snap-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="pipeline-snap-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">
            Pipeline Snapshot
          </h2>
          <Link href="/pipeline" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
            View Pipeline <ArrowRight size={10} aria-hidden />
          </Link>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-6 text-center">
          <KanbanSquare size={24} className="mx-auto text-[#A7A29A] mb-2" aria-hidden />
          <p className="text-sm text-[#A7A29A]">No deals yet. <Link href="/pipeline?new=1" className="text-[#D4AF37] hover:underline">Add your first deal</Link>.</p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="pipeline-snap-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="pipeline-snap-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">
          Pipeline — {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </h2>
        <Link href="/pipeline" className="text-xs text-[#D4AF37] hover:underline flex items-center gap-1">
          Full View <ArrowRight size={10} aria-hidden />
        </Link>
      </div>
      <div className="space-y-2">
        {deals.slice(0, 5).map((deal) => (
          <Link
            key={deal.id}
            href={`/pipeline/${deal.id}`}
            className="flex items-center justify-between bg-[#141414] border border-[#2A2A2E] rounded px-4 py-3 hover:border-[#3A3A3E] transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[#E8E6E3] group-hover:text-[#D4AF37] transition-colors truncate">
                {deal.companyName}
              </div>
              <div className="text-xs text-[#A7A29A] mt-0.5">{STAGE_LABELS[deal.stage]}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {deal.estimatedSDE && (
                <span className="text-xs text-[#D4AF37]">{formatCurrency(deal.estimatedSDE)} SDE</span>
              )}
              <StatusBadge status={deal.status} />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Shared panel helpers ─────────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function PressureBadge({ level }: { level?: string }) {
  const map: Record<string, { color: string; label: string }> = {
    active:  { color: '#3FA66B', label: 'Active' },
    cooling: { color: '#D9A441', label: 'Cooling' },
    stalled: { color: '#C35B5B', label: 'Stalled' },
  };
  const cfg = map[level ?? 'active'] ?? map.active;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: cfg.color + '20', color: cfg.color }}>
      <span className="w-1 h-1 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  );
}

// ─── System 1: Pipeline Pressure Panel ───────────────────────────────────────

function PipelinePressurePanel() {
  const [metrics, setMetrics] = useState<PipelinePressureMetrics | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/pipeline-pressure`)
      .then((r) => r.json())
      .then(setMetrics)
      .catch(() => {});
  }, []);

  async function handleScan() {
    setScanning(true);
    try {
      const r = await fetch(`${API_BASE}/api/pipeline-pressure/scan`, { method: 'POST' });
      const data = await r.json();
      setMetrics(data);
    } finally {
      setScanning(false);
    }
  }

  const items = metrics ? [
    { label: 'Stalled Companies', value: metrics.stalledCompaniesCount, color: '#C35B5B' },
    { label: 'Stalled Deals',     value: metrics.stalledDealsCount,     color: '#C35B5B' },
    { label: 'Cooling Contacts',  value: metrics.coolingRelationshipsCount, color: '#D9A441' },
    { label: 'Stalled Contacts',  value: metrics.stalledContactsCount,  color: '#C35B5B' },
  ] : [];

  return (
    <section aria-labelledby="pp-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="pp-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2">
          <Activity size={12} className="text-[#D4AF37]" aria-hidden />
          Pipeline Pressure
        </h2>
        <Button variant="ghost" size="sm" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Run Scan'}
        </Button>
      </div>
      {metrics === null ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">Loading…</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">{item.label}</div>
              <div className="text-2xl font-bold font-serif" style={{ color: item.value > 0 ? item.color : '#3FA66B' }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── System 2: Relationship Intelligence Panel ────────────────────────────────

function RelationshipIntelligencePanel() {
  const contacts = useAppStore((s) => s.contacts);

  const highInfluence = contacts
    .filter((c) => (c.influenceScore ?? 0) >= 7)
    .sort((a, b) => (b.influenceScore ?? 0) - (a.influenceScore ?? 0))
    .slice(0, 5);

  const coolingHighInfluence = highInfluence.filter(
    (c) => c.pipelinePressureLevel === 'cooling' || c.pipelinePressureLevel === 'stalled'
  );

  return (
    <section aria-labelledby="ri-heading">
      <h2 id="ri-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <Users size={12} className="text-[#D4AF37]" aria-hidden />
        Relationship Intelligence
      </h2>
      {highInfluence.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">
          No high-influence contacts yet. Set influenceScore on contacts.
        </div>
      ) : (
        <ul className="space-y-2">
          {highInfluence.map((c) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
            const isCooling = c.pipelinePressureLevel === 'cooling' || c.pipelinePressureLevel === 'stalled';
            return (
              <li key={c.id} className={cn(
                'bg-[#141414] border rounded px-3 py-2.5 flex items-center justify-between gap-3',
                isCooling ? 'border-[#D9A44130]' : 'border-[#2A2A2E]'
              )}>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#E8E6E3] truncate">{name}</div>
                  <div className="text-xs text-[#A7A29A] mt-0.5">
                    {c.relationshipStage ?? 'Unknown stage'} · Influence {c.influenceScore ?? '?'}/10
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isCooling && <AlertTriangle size={12} className="text-[#D9A441]" aria-label="Cooling" />}
                  <PressureBadge level={c.pipelinePressureLevel} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {coolingHighInfluence.length > 0 && (
        <div className="mt-2 text-xs text-[#D9A441] flex items-center gap-1">
          <AlertTriangle size={10} aria-hidden />
          {coolingHighInfluence.length} high-influence contact{coolingHighInfluence.length !== 1 ? 's' : ''} going cold
        </div>
      )}
    </section>
  );
}

// ─── System 3: Seller Signals Panel ──────────────────────────────────────────

function SellerSignalsPanel() {
  const companies = useAppStore((s) => s.companies);

  const highSignal = companies
    .filter((c) => (c.sellerSignalScore ?? 0) >= 3)
    .sort((a, b) => (b.sellerSignalScore ?? 0) - (a.sellerSignalScore ?? 0))
    .slice(0, 6);

  const SIGNAL_LABELS: Record<string, string> = {
    retirementSignal:     'Retirement',
    noWebsiteSignal:      'No Website',
    reviewDeclineSignal:  'Reviews Declining',
    websiteOutdatedSignal:'Outdated Website',
    hiringSlowdownSignal: 'Hiring Slowdown',
    linkedinInactiveSignal:'LinkedIn Inactive',
  };

  return (
    <section aria-labelledby="ss-heading">
      <h2 id="ss-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <Flame size={12} className="text-[#D4AF37]" aria-hidden />
        Seller Signals — Likely Sellers ({highSignal.length})
      </h2>
      {highSignal.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">
          No companies with 3+ seller signals yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {highSignal.map((c) => {
            const activeSignals = Object.keys(SIGNAL_LABELS).filter((f) => (c as any)[f]);
            return (
              <li key={c.id} className="bg-[#141414] border border-[#C35B5B20] rounded px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[#E8E6E3] truncate">{c.name}</span>
                  <span className="flex-shrink-0 text-xs font-bold text-[#C35B5B]">
                    {c.sellerSignalScore ?? activeSignals.length}/6 signals
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {activeSignals.map((sig) => (
                    <span key={sig} className="text-[9px] px-1.5 py-0.5 rounded bg-[#C35B5B15] text-[#C35B5B] uppercase tracking-wider">
                      {SIGNAL_LABELS[sig]}
                    </span>
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

// ─── System 5: Acquisition Scoreboard Panel ───────────────────────────────────

function AcquisitionScoreboardPanel() {
  const [scoreboard, setScoreboard] = useState<AcquisitionScoreboard | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/scoreboard`)
      .then((r) => r.json())
      .then(setScoreboard)
      .catch(() => {});
  }, []);

  if (!scoreboard) {
    return (
      <section aria-labelledby="acq-sb-heading">
        <h2 id="acq-sb-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
          <BarChart2 size={12} className="text-[#D4AF37]" aria-hidden />
          Acquisition Scoreboard
        </h2>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">Loading…</div>
      </section>
    );
  }

  const metrics = [
    { label: 'Targets Found',         value: scoreboard.targetsFound },
    { label: 'Owners Contacted',       value: scoreboard.ownersContacted },
    { label: 'Conversations Started',  value: scoreboard.conversationsStarted },
    { label: 'Meetings Held',          value: scoreboard.meetingsHeld },
    { label: 'Deals Evaluated',        value: scoreboard.dealsEvaluated },
    { label: 'LOIs Submitted',         value: scoreboard.LOIsSubmitted },
    { label: 'Deals Closed',           value: scoreboard.dealsClosed },
  ];

  const replyRate = scoreboard.emailsSentThisWeek > 0
    ? `${((scoreboard.repliesThisWeek / scoreboard.emailsSentThisWeek) * 100).toFixed(1)}%`
    : 'N/A';

  return (
    <section aria-labelledby="acq-sb-heading">
      <h2 id="acq-sb-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <BarChart2 size={12} className="text-[#D4AF37]" aria-hidden />
        Acquisition Scoreboard
      </h2>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {metrics.map((m) => (
          <div key={m.label} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-3">
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1 leading-tight">{m.label}</div>
            <div className="text-xl font-bold font-serif text-[#D4AF37]">{m.value}</div>
          </div>
        ))}
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-3">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1 leading-tight">Reply Rate</div>
          <div className="text-xl font-bold font-serif text-[#D4AF37]">{replyRate}</div>
        </div>
      </div>
    </section>
  );
}

// ─── System 7: Deal Velocity Monitor ─────────────────────────────────────────

function DealVelocityPanel() {
  const [data, setData] = useState<{ deals: DealVelocityEntry[]; slowMovingCount: number } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/deal-velocity`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const STAGE_NAMES: Record<string, string> = {
    discovery: 'Discovery', due_diligence: 'Due Diligence', financing: 'Financing',
    identified: 'Identified', contacted: 'Contacted', financial_review: 'Financial Review',
    loi_discussion: 'LOI Discussion', loi_signed: 'LOI Signed', closing: 'Closing',
  };

  return (
    <section aria-labelledby="dv-heading">
      <h2 id="dv-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <TrendingDown size={12} className="text-[#D4AF37]" aria-hidden />
        Deal Velocity Monitor
        {data && data.slowMovingCount > 0 && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-[#C35B5B20] text-[#C35B5B] uppercase tracking-wider">
            {data.slowMovingCount} slow
          </span>
        )}
      </h2>
      {data === null ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">Loading…</div>
      ) : data.deals.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">No active deals to track.</div>
      ) : (
        <ul className="space-y-2">
          {data.deals.slice(0, 6).map((d) => {
            const pct = d.threshold ? Math.min(100, (d.stageDurationDays / d.threshold) * 100) : null;
            return (
              <li key={d.dealId} className={cn(
                'bg-[#141414] border rounded px-3 py-2.5',
                d.slowMoving ? 'border-[#C35B5B30]' : 'border-[#2A2A2E]'
              )}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-[#E8E6E3] truncate">{d.companyName}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-[#A7A29A]">
                    {d.slowMoving && <AlertTriangle size={11} className="text-[#C35B5B]" aria-label="Slow moving" />}
                    <span>{STAGE_NAMES[d.stage] ?? d.stage}</span>
                    <span className={d.slowMoving ? 'text-[#C35B5B]' : 'text-[#A7A29A]'}>
                      {d.stageDurationDays}d{d.threshold ? ` / ${d.threshold}d` : ''}
                    </span>
                  </div>
                </div>
                {pct !== null && (
                  <div className="h-1 rounded-full bg-[#2A2A2E] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: pct >= 100 ? '#C35B5B' : pct >= 75 ? '#D9A441' : '#3FA66B' }}
                    />
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

// ─── System 8: Conversation Funnel ───────────────────────────────────────────

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
    { label: 'Companies Identified', value: funnel.companiesIdentified },
    { label: 'Owners Contacted',     value: funnel.ownersContacted },
    { label: 'Replies Received',     value: funnel.repliesReceived },
    { label: 'Meetings Scheduled',   value: funnel.meetingsScheduled },
    { label: 'Deals Progressing',    value: funnel.dealsProgressing },
  ] : [];

  const maxVal = funnel ? Math.max(funnel.companiesIdentified, 1) : 1;

  return (
    <section aria-labelledby="cf-heading">
      <h2 id="cf-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <MessageSquare size={12} className="text-[#D4AF37]" aria-hidden />
        Conversation Funnel
      </h2>
      {funnel === null ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">Loading…</div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 space-y-3">
          {steps.map((step, i) => (
            <div key={step.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#A7A29A]">{step.label}</span>
                <span className="font-medium text-[#E8E6E3]">{step.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#2A2A2E] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((step.value / maxVal) * 100)}%`,
                    background: `hsl(${40 - i * 8}, 75%, 55%)`,
                  }}
                />
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#2A2A2E]">
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-wider text-[#A7A29A]">Reply Rate</div>
              <div className="text-lg font-bold font-serif text-[#D4AF37]">{funnel.replyRate}%</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] uppercase tracking-wider text-[#A7A29A]">Meeting Rate</div>
              <div className="text-lg font-bold font-serif text-[#D4AF37]">{funnel.meetingRate}%</div>
            </div>
          </div>
          {/* System 6 — Contact Frequency Targets */}
          {freq && (
            <div className="pt-2 border-t border-[#2A2A2E] space-y-2">
              <div className="text-[9px] uppercase tracking-wider text-[#A7A29A] flex items-center gap-1">
                <UserCheck size={10} aria-hidden /> Weekly Targets
              </div>
              {[freq.ownersContactedPerWeek, freq.followUpsPerDay, freq.boardOutreachPerWeek].map((t) => {
                const pct = Math.min(100, t.target > 0 ? (t.current / t.target) * 100 : 0);
                const met = t.current >= t.target;
                return (
                  <div key={t.label}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-[#A7A29A] text-[10px]">{t.label}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#2A2A2E] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: met ? '#3FA66B' : '#D4AF37' }}
                      />
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

// ─── Sourcing Radar Summary Widget ───────────────────────────────────────────

function SourcingRadarWidget() {
  const [summary, setSummary] = useState<{
    newCandidatesToday: number;
    highPriorityCount: number;
    sourceWarnings: number;
    lastRunAt: string | null;
    lastRunStatus: string | null;
  } | null>(null);

  useEffect(() => {
    sourcingRadarApi.getSourcingSummary()
      .then((r) => setSummary(r as typeof summary))
      .catch(() => {});
  }, []);

  return (
    <section aria-labelledby="sr-widget-heading">
      <h2 id="sr-widget-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <Radar size={12} className="text-[#D4AF37]" aria-hidden />
        Sourcing Radar
      </h2>
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
        {!summary ? (
          <div className="text-xs text-[#A7A29A]">Loading…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-[#E8E6E3]">{summary.newCandidatesToday}</div>
                <div className="text-[10px] text-[#A7A29A]">New today</div>
              </div>
              <div>
                <div className="text-xl font-bold text-[#D4AF37]">{summary.highPriorityCount}</div>
                <div className="text-[10px] text-[#A7A29A]">High priority</div>
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: summary.sourceWarnings > 0 ? '#C35B5B' : '#3FA66B' }}>
                  {summary.sourceWarnings}
                </div>
                <div className="text-[10px] text-[#A7A29A]">Source issues</div>
              </div>
            </div>
            {summary.sourceWarnings > 0 && (
              <div className="text-xs text-[#C35B5B] flex items-center gap-1" role="alert">
                <AlertTriangle size={10} aria-hidden />
                {summary.sourceWarnings} source adapter{summary.sourceWarnings !== 1 ? 's' : ''} need attention.
              </div>
            )}
            {summary.lastRunAt && (
              <div className="text-[10px] text-[#A7A29A]">
                Last scan: {formatRelativeDate(summary.lastRunAt)}
                {' '}
                <span style={{ color: summary.lastRunStatus === 'completed' ? '#3FA66B' : '#D9A441' }}>
                  ({summary.lastRunStatus})
                </span>
              </div>
            )}
            <Link href="/pipeline/sourcing-radar" className="text-xs text-[#4D7EA8] hover:text-[#7EB0D4] underline">
              Open Sourcing Radar →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Meeting Prep Summary Widget ─────────────────────────────────────────────

function MeetingPrepWidget() {
  const [summary, setSummary] = useState<{
    upcomingCount: number;
    missingPrepCount: number;
    highValueMissing: number;
    meetings: Array<{ id: string; title: string; meetingType: string; startsAt: string; hasPrepPacket: boolean }>;
  } | null>(null);

  useEffect(() => {
    meetingPrepApi.getPrepSummary()
      .then((r) => setSummary(r as typeof summary))
      .catch(() => {});
  }, []);

  return (
    <section aria-labelledby="mp-widget-heading">
      <h2 id="mp-widget-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <BookOpen size={12} className="text-[#D4AF37]" aria-hidden />
        Upcoming Meeting Prep
      </h2>
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
        {!summary ? (
          <div className="text-xs text-[#A7A29A]">Loading…</div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xl font-bold text-[#E8E6E3]">{summary.upcomingCount}</div>
                <div className="text-[10px] text-[#A7A29A]">Upcoming</div>
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: summary.missingPrepCount > 0 ? '#D9A441' : '#3FA66B' }}>
                  {summary.missingPrepCount}
                </div>
                <div className="text-[10px] text-[#A7A29A]">Missing prep</div>
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: summary.highValueMissing > 0 ? '#C35B5B' : '#3FA66B' }}>
                  {summary.highValueMissing}
                </div>
                <div className="text-[10px] text-[#A7A29A]">High-value no prep</div>
              </div>
            </div>
            {summary.meetings.length > 0 && (
              <ul className="space-y-1.5">
                {summary.meetings.slice(0, 3).map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-xs">
                    <span className="text-[#E8E6E3] truncate max-w-[200px]">{m.title}</span>
                    <span className={m.hasPrepPacket ? 'text-[#3FA66B]' : 'text-[#D9A441]'} aria-label={m.hasPrepPacket ? 'Prep packet ready' : 'Prep packet missing'}>
                      {m.hasPrepPacket ? '✓ Ready' : '! Missing'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/meetings" className="text-xs text-[#4D7EA8] hover:text-[#7EB0D4] underline">
              Open Meetings →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Deal Probability Widgets ─────────────────────────────────────────────────

function DealProbabilityWidget() {
  const [summary, setSummary] = useState<{
    highProbability: Array<{ id: string; companyName: string; probabilityScore: number; probabilityBand: string; stage: string }>;
    lowProbability: Array<{ id: string; companyName: string; probabilityScore: number; probabilityBand: string; stage: string; mainBlocker: string }>;
    highThreshold: number;
    lowThreshold: number;
  } | null>(null);

  useEffect(() => {
    dealProbabilityApi.getSummary()
      .then((r) => setSummary(r as typeof summary))
      .catch(() => {});
  }, []);

  const bandColor = (score: number) => score >= 60 ? '#3FA66B' : score >= 40 ? '#D9A441' : '#C35B5B';

  return (
    <section aria-labelledby="dp-widget-heading">
      <h2 id="dp-widget-heading" className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] flex items-center gap-2 mb-3">
        <TrendingUp size={12} className="text-[#D4AF37]" aria-hidden />
        Deal Probability
      </h2>
      {!summary ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A]">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* High probability */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
            <div className="text-[9px] uppercase tracking-wider text-[#3FA66B] mb-2 font-medium">
              High Probability (≥{summary.highThreshold})
            </div>
            {summary.highProbability.length === 0 ? (
              <div className="text-xs text-[#A7A29A]">No high-probability deals yet.</div>
            ) : (
              <ul className="space-y-2">
                {summary.highProbability.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <Link href={`/pipeline/${d.id}`} className="text-xs text-[#E8E6E3] hover:text-[#D4AF37] truncate max-w-[200px]">
                      {d.companyName}
                    </Link>
                    <span
                      className="text-xs font-mono font-bold"
                      style={{ color: bandColor(d.probabilityScore) }}
                      aria-label={`Probability: ${d.probabilityScore} out of 100`}
                    >
                      {d.probabilityScore}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Low probability rescue */}
          {summary.lowProbability.length > 0 && (
            <div className="bg-[#141414] border border-[#C35B5B30] rounded-md p-4">
              <div className="text-[9px] uppercase tracking-wider text-[#C35B5B] mb-2 font-medium">
                Rescue Needed (&lt;{summary.lowThreshold})
              </div>
              <ul className="space-y-2">
                {summary.lowProbability.map((d) => (
                  <li key={d.id}>
                    <div className="flex items-center justify-between">
                      <Link href={`/pipeline/${d.id}`} className="text-xs text-[#E8E6E3] hover:text-[#D4AF37] truncate max-w-[180px]">
                        {d.companyName}
                      </Link>
                      <span className="text-xs font-mono text-[#C35B5B]" aria-label={`Probability: ${d.probabilityScore} out of 100`}>
                        {d.probabilityScore}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#A7A29A] mt-0.5 truncate">{d.mainBlocker}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function CommandCenterPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-7">
      {/* Page header */}
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3] mb-1">
          Command Center
        </h1>
        <p className="text-sm text-[#A7A29A]">
          Dominion Edge Holdings · Acquisition Operating System
        </p>
      </header>

      {/* Affirmation */}
      <AffirmationCard />

      {/* Briefing + Scoreboard side by side on large */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodaysBriefing />
        <ExecutionScoreboard />
      </div>

      {/* Next Best Actions */}
      <NextBestActions />

      {/* Tasks + Pipeline side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskPanel />
        <PipelineSnapshot />
      </div>

      {/* ── Performance Systems ── */}
      <div>
        <h2 className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-4 flex items-center gap-2">
          <Activity size={12} className="text-[#D4AF37]" aria-hidden />
          Performance Systems
        </h2>
        {/* Pipeline Pressure + Seller Signals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <PipelinePressurePanel />
          <SellerSignalsPanel />
        </div>
        {/* Acquisition Scoreboard — full width */}
        <div className="mb-6">
          <AcquisitionScoreboardPanel />
        </div>
        {/* Relationship Intelligence + Deal Velocity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RelationshipIntelligencePanel />
          <DealVelocityPanel />
        </div>
        {/* Conversation Funnel + Relationship KPIs — side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ConversationFunnelPanel />
          <ConversationKPIWidget />
        </div>
      </div>

      {/* ── New Systems: Sourcing Radar, Meeting Prep, Deal Probability ── */}
      <div>
        <h2 className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A] mb-4 flex items-center gap-2">
          <Zap size={12} className="text-[#D4AF37]" aria-hidden />
          Discovery &amp; Prioritization
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SourcingRadarWidget />
          <MeetingPrepWidget />
          <DealProbabilityWidget />
        </div>
      </div>
    </div>
  );
}
