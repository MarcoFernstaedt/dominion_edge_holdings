'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { playbookApi } from '@/lib/api';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ChevronDown,
  ChevronRight,
  Zap,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import type {
  PlaybookSummary,
  PlaybookStage,
  PlaybookTaskWithProgress,
} from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

/* ─── skeleton ──────────────────────────────────────────────────── */

function PlaybookSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading playbook">
      <Skeleton className="h-3 w-28 mb-1" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
          {/* Stage order circle */}
          <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Name + badge row */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            {/* Task count */}
            <Skeleton className="h-2.5 w-32" />
            {/* Progress bar */}
            <Skeleton className="h-1.5 w-full rounded-full mt-1" />
          </div>
          <Skeleton className="w-3.5 h-3.5 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────────── */

const MODE_LABEL: Record<string, string> = {
  tasks:  'Task-based',
  metrics:'Metric-based',
  hybrid: 'Hybrid',
};

const STATUS_COLOR: Record<string, string> = {
  completed:   'text-emerald-400',
  in_progress: 'text-[#C9A227]',
  skipped:     'text-[var(--color-text-muted)]',
  not_started: 'text-[var(--color-text-muted)]',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed:   <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" aria-hidden />,
  in_progress: <Clock size={16} className="text-[#C9A227] flex-shrink-0" aria-hidden />,
  not_started: <Circle size={16} className="text-[#3A3A3E] flex-shrink-0" aria-hidden />,
  skipped:     <Circle size={16} className="text-[#3A3A3E] flex-shrink-0" aria-hidden />,
};

function StageStatusBadge({ stage }: { stage: PlaybookStage }) {
  if (stage.isComplete) {
    return (
      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
        Complete
      </span>
    );
  }
  if (stage.isCurrent) {
    return (
      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#C9A22720]/40 text-[#C9A227] border border-[#C9A22740]">
        Active
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1F1F23] text-[var(--color-text-muted)] border border-[var(--color-border)]">
      Pending
    </span>
  );
}

/* ─── stage progress bar ─────────────────────────────────────────── */
function StageProgressBar({ pct }: { pct: number }) {
  return (
    <div
      className="h-1.5 rounded-full bg-[#2A2A2E] overflow-hidden mt-2"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[#C9A227] transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ─── task card ──────────────────────────────────────────────────── */
function TaskCard({
  task,
  onComplete,
  completing,
}: {
  task: PlaybookTaskWithProgress;
  onComplete: (taskId: string) => void;
  completing: string | null;
}) {
  const status = task.status ?? 'not_started';
  const isDone = status === 'completed';
  const isBusy = completing === task.task.id;
  const isManual = task.task.completionType === 'manual' || task.task.completionType === 'hybrid';

  return (
    <div
      className={`flex gap-3 p-3 rounded-lg border transition-colors ${
        isDone
          ? 'bg-emerald-900/10 border-emerald-800/30'
          : 'bg-[#1A1A1E] border-[var(--color-border)] hover:border-[#3A3A3E]'
      }`}
    >
      {/* status icon / checkbox */}
      <button
        onClick={() => !isDone && isManual && onComplete(task.task.id)}
        disabled={isDone || !isManual || isBusy}
        className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded-full disabled:cursor-default"
        aria-label={isDone ? 'Task completed' : 'Mark complete'}
      >
        {isBusy ? (
          <RefreshCw size={16} className="animate-spin text-[#C9A227] flex-shrink-0" />
        ) : (
          STATUS_ICON[status]
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <span
            className={`text-sm font-medium leading-snug ${
              isDone ? 'line-through text-[var(--color-text-muted)]' : 'text-[var(--color-text-primary)]'
            }`}
          >
            {task.task.taskTitle}
          </span>
          {task.task.completionType === 'automatic' && (
            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-900/30 text-sky-400 border border-sky-800/30 font-semibold">
              Auto
            </span>
          )}
        </div>
        {task.task.taskDescription && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">
            {task.task.taskDescription}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {task.task.taskCategory}
          </span>
          {task.task.estimatedEffortMinutes && (
            <span className="text-[10px] text-[var(--color-text-muted)] flex items-center gap-1">
              <Clock size={10} aria-hidden />
              {task.task.estimatedEffortMinutes} min
            </span>
          )}
        </div>
      </div>

      {/* manual status label */}
      {!isDone && (
        <span className={`text-[10px] mt-0.5 font-medium flex-shrink-0 ${STATUS_COLOR[status]}`}>
          {status === 'in_progress' ? 'In progress' : ''}
        </span>
      )}
    </div>
  );
}

/* ─── stage row (collapsible) ────────────────────────────────────── */
function StageRow({
  stage,
  expanded,
  onToggle,
  onComplete,
  completing,
}: {
  stage: PlaybookStage & { tasks?: PlaybookTaskWithProgress[] };
  expanded: boolean;
  onToggle: () => void;
  onComplete: (taskId: string) => void;
  completing: string | null;
}) {
  const tasks: PlaybookTaskWithProgress[] = stage.tasks ?? [];
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const totalCount = tasks.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        stage.isComplete
          ? 'border-emerald-800/30 bg-emerald-900/5'
          : stage.isCurrent
          ? 'border-[#C9A22740] bg-[#C9A22720]/5'
          : 'border-[var(--color-border)] bg-[var(--color-surface)]'
      }`}
    >
      {/* header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227] rounded-xl"
      >
        {/* stage order */}
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            stage.isComplete
              ? 'bg-emerald-700/30 text-emerald-400'
              : stage.isCurrent
              ? 'bg-[#C9A227] text-black'
              : 'bg-[#2A2A2E] text-[var(--color-text-muted)]'
          }`}
        >
          {stage.stageOrder}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-medium ${
                stage.isComplete
                  ? 'text-emerald-400'
                  : stage.isCurrent
                  ? 'text-[#C9A227]'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {stage.stageName}
            </span>
            <StageStatusBadge stage={stage} />
          </div>
          {totalCount > 0 && (
            <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
              {completedCount}/{totalCount} tasks · {MODE_LABEL[stage.completionMode] ?? stage.completionMode}
            </div>
          )}
          {totalCount > 0 && <StageProgressBar pct={pct} />}
        </div>

        {expanded ? (
          <ChevronDown size={14} className="text-[var(--color-text-muted)] flex-shrink-0" aria-hidden />
        ) : (
          <ChevronRight size={14} className="text-[var(--color-text-muted)] flex-shrink-0" aria-hidden />
        )}
      </button>

      {/* tasks */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {tasks.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No tasks for this stage.</p>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.task.id}
                task={task}
                onComplete={onComplete}
                completing={completing}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── main page ──────────────────────────────────────────────────── */
export default function PlaybookPage() {
  const [summary,    setSummary]    = useState<PlaybookSummary | null>(null);
  const [stages,     setStages]     = useState<PlaybookStage[]>([]);
  const [stageData,  setStageData]  = useState<Record<string, PlaybookTaskWithProgress[]>>({});
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [loading,    setLoading]    = useState(true);
  const [syncing,    setSyncing]    = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, stagesRes] = await Promise.all([
        playbookApi.getSummary(),
        playbookApi.getStages(),
      ]);
      const s = sumRes as PlaybookSummary;
      setSummary(s);

      // auto-expand current stage
      if (s.currentStage) {
        setExpanded(new Set([s.currentStage.id]));
      }

      // Augment stages with isComplete / isCurrent flags
      const rawStages = (stagesRes as { stages: PlaybookStage[] }).stages ?? [];
      const augmented = rawStages.map((st) => ({
        ...st,
        isComplete: st.completion?.complete ?? false,
        isCurrent: st.id === s.currentStage?.id,
      }));
      setStages(augmented);

      // fetch tasks for all stages in parallel
      const entries = await Promise.all(
        rawStages.map(async (st) => {
          try {
            const r = await playbookApi.getStage(st.id);
            const tasks = ((r as { tasks?: PlaybookTaskWithProgress[] }).tasks) ?? [];
            return [st.id, tasks] as [string, PlaybookTaskWithProgress[]];
          } catch {
            return [st.id, []] as [string, PlaybookTaskWithProgress[]];
          }
        })
      );
      setStageData(Object.fromEntries(entries));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleStage = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await playbookApi.completeTask(taskId);
      await load();
    } catch { /* silent */ }
    finally { setCompleting(null); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await playbookApi.sync();
      await load();
    } catch { /* silent */ }
    finally { setSyncing(false); }
  };

  const currentStage = summary?.currentStage ?? null;
  const overallPct = summary?.overallProgress ?? 0;
  const completedStages = stages.filter((s) => s.isComplete).length;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <BookOpen size={22} className="text-[#C9A227]" aria-hidden />
            Acquisition Playbook
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            17-stage acquisition lifecycle from mindset to repeat acquisitions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/playbook/today"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors"
          >
            <Zap size={14} aria-hidden />
            Today&apos;s Actions
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} aria-hidden />
            Sync
          </button>
        </div>
      </div>

      {/* Overall progress */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">Overall Progress</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {completedStages} of {stages.length} stages complete
            </div>
          </div>
          <div className="text-2xl font-bold text-[#C9A227]">{overallPct}%</div>
        </div>
        <div
          className="h-2.5 rounded-full bg-[#2A2A2E] overflow-hidden"
          role="progressbar"
          aria-valuenow={overallPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${overallPct}% of playbook complete`}
        >
          <div
            className="h-full rounded-full bg-[#C9A227] transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
        </div>

        {/* stage pills */}
        {stages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {stages.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  toggleStage(s.id);
                  // scroll would be nice but KISS
                }}
                title={s.stageName}
                className={`w-6 h-6 rounded text-[9px] font-bold transition-colors ${
                  s.isComplete
                    ? 'bg-emerald-700/40 text-emerald-400 hover:bg-emerald-700/60'
                    : s.isCurrent
                    ? 'bg-[#C9A227] text-black'
                    : 'bg-[#2A2A2E] text-[var(--color-text-muted)] hover:bg-[#3A3A3E]'
                }`}
              >
                {s.stageOrder}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current stage callout */}
      {currentStage && (
        <div className="bg-[#C9A22710] border border-[#C9A22740] rounded-xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-[#C9A227] font-semibold mb-0.5">
              Current Stage
            </div>
            <div className="text-base font-semibold text-[var(--color-text-primary)]">
              Stage {currentStage.stageOrder}: {currentStage.stageName}
            </div>
            {currentStage.description && (
              <p className="text-xs text-[var(--color-text-muted)] mt-1 line-clamp-2">
                {currentStage.description}
              </p>
            )}
          </div>
          <button
            onClick={() => toggleStage(currentStage.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A22740] text-[#C9A227] text-sm hover:bg-[#C9A22720] transition-colors flex-shrink-0"
          >
            View tasks <ArrowRight size={13} aria-hidden />
          </button>
        </div>
      )}

      {/* Stage list */}
      {loading ? (
        <PlaybookSkeleton />
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-widest">
            All Stages
          </h2>
          {stages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={{ ...stage, tasks: stageData[stage.id] ?? [] }}
              expanded={expanded.has(stage.id)}
              onToggle={() => toggleStage(stage.id)}
              onComplete={handleComplete}
              completing={completing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
