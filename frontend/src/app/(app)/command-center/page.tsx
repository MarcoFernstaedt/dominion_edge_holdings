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
  CheckSquare, Bell, Zap
} from 'lucide-react';
import type { Task, NextBestAction } from '@/lib/types';
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
  deals: ReturnType<typeof useAppStore>['deals'],
  emailThreads: ReturnType<typeof useAppStore>['emailThreads'],
  boardCandidates: ReturnType<typeof useAppStore>['boardCandidates'],
  checklistPhases: ReturnType<typeof useAppStore>['checklistPhases']
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
    </div>
  );
}
