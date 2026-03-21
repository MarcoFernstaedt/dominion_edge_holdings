'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { playbookApi } from '@/lib/api';
import {
  Zap,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ArrowLeft,
  TrendingUp,
} from 'lucide-react';
import type { DailyActionPlan, DailyAction } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';

/* ─── skeleton ──────────────────────────────────────────────────── */

function ActionCardSkeleton() {
  return (
    <div className="bg-[var(--color-surface)] border-l-4 border border-[var(--color-border)] rounded-lg p-4">
      <div className="flex items-start gap-3">
        {/* complete circle */}
        <Skeleton className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          {/* title + source badge */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          {/* description */}
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          {/* meta */}
          <div className="flex gap-3 mt-1">
            <Skeleton className="h-2.5 w-14" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaybookTodaySkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading today's actions">
      {/* High priority section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
        <div className="space-y-2.5">
          {[0, 1].map((i) => <ActionCardSkeleton key={i} />)}
        </div>
      </div>
      {/* Standard section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-6 rounded-full" />
        </div>
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => <ActionCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── helpers ───────────────────────────────────────────────────── */

const SOURCE_COLOR: Record<string, string> = {
  playbook: 'text-[#C9A227] bg-[#C9A227]/10 border-[#C9A227]/30',
  alert:    'text-red-400    bg-red-900/10    border-red-800/30',
  momentum: 'text-orange-400 bg-orange-900/10 border-orange-800/30',
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  playbook: <BookOpen    size={12} aria-hidden />,
  alert:    <AlertTriangle size={12} aria-hidden />,
  momentum: <TrendingUp  size={12} aria-hidden />,
};

const PRIORITY_BORDER: Record<string, string> = {
  high:   'border-l-red-500',
  medium: 'border-l-[#C9A227]',
  low:    'border-l-[#3A3A3E]',
};

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-[#C9A227]',
  low:    'bg-[#3A3A3E]',
};

/* ─── action card ────────────────────────────────────────────────── */
function ActionCard({
  action,
  onComplete,
  completing,
  done,
}: {
  action: DailyAction;
  onComplete: (taskId: string) => void;
  completing: string | null;
  done: Set<string>;
}) {
  const taskId    = action.taskId ?? '';
  const isMarked  = done.has(taskId);
  const isBusy    = completing === taskId;
  const canMark   = !!taskId && !isMarked;
  const priority  = (action.priority ?? 'medium') as string;
  const source    = (action.source  ?? 'playbook') as string;

  return (
    <div
      className={`bg-[var(--color-surface)] border-l-4 border border-[var(--color-border)] rounded-lg p-4 transition-opacity ${
        PRIORITY_BORDER[priority] ?? PRIORITY_BORDER.medium
      } ${isMarked ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* complete button */}
        <button
          onClick={() => canMark && onComplete(taskId)}
          disabled={!canMark || isBusy}
          className="mt-0.5 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded-full disabled:cursor-default"
          aria-label={isMarked ? 'Done' : 'Mark complete'}
        >
          {isBusy ? (
            <RefreshCw size={16} className="animate-spin text-[#C9A227]" />
          ) : isMarked ? (
            <CheckCircle2 size={16} className="text-emerald-400" />
          ) : (
            <div className={`w-4 h-4 rounded-full border-2 border-[#3A3A3E] flex items-center justify-center`}>
              <div className={`w-2 h-2 rounded-full ${PRIORITY_DOT[priority]}`} />
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* title row */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-sm font-medium ${
                isMarked
                  ? 'line-through text-[var(--color-text-muted)]'
                  : 'text-[var(--color-text-primary)]'
              }`}
            >
              {action.title}
            </span>
            <span
              className={`flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                SOURCE_COLOR[source] ?? SOURCE_COLOR.playbook
              }`}
            >
              {SOURCE_ICON[source]}
              {source}
            </span>
          </div>

          {/* description */}
          {action.description && (
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              {action.description}
            </p>
          )}

          {/* meta row */}
          <div className="flex flex-wrap items-center gap-3 mt-2">
            {(action.effortMin ?? action.estimatedMinutes) && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Clock size={10} aria-hidden />
                {action.effortMin ?? action.estimatedMinutes} min
              </span>
            )}
            {action.relatedEntity && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                {action.relatedEntity}
              </span>
            )}
            {priority === 'high' && (
              <span className="text-[10px] font-semibold text-red-400">High Priority</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── section ────────────────────────────────────────────────────── */
function ActionSection({
  title,
  icon,
  actions,
  onComplete,
  completing,
  done,
}: {
  title: string;
  icon: React.ReactNode;
  actions: DailyAction[];
  onComplete: (taskId: string) => void;
  completing: string | null;
  done: Set<string>;
}) {
  if (actions.length === 0) return null;
  return (
    <div>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-widest mb-3">
        {icon}
        {title}
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#2A2A2E] text-[var(--color-text-muted)] normal-case tracking-normal">
          {actions.length}
        </span>
      </h2>
      <div className="space-y-2.5">
        {actions.map((a, i) => (
          <ActionCard
            key={a.taskId ?? `${title}-${i}`}
            action={a}
            onComplete={onComplete}
            completing={completing}
            done={done}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────────────── */
export default function PlaybookTodayPage() {
  const [plan,       setPlan]       = useState<DailyActionPlan | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);
  const [done,       setDone]       = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await playbookApi.getToday();
      setPlan(res as DailyActionPlan);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleComplete = async (taskId: string) => {
    setCompleting(taskId);
    try {
      await playbookApi.completeTask(taskId);
      setDone((prev) => new Set(prev).add(taskId));
    } catch { /* silent */ }
    finally { setCompleting(null); }
  };

  const allActions: DailyAction[] = plan?.actions ?? [];
  const highPriority = allActions.filter((a) => a.priority === 'high');
  const playbookActions = allActions.filter((a) => a.source === 'playbook' && a.priority !== 'high');
  const alertActions    = allActions.filter((a) => a.source === 'alert'    && a.priority !== 'high');
  const momentumActions = allActions.filter((a) => a.source === 'momentum' && a.priority !== 'high');

  const doneCount = allActions.filter((a) => a.taskId && done.has(a.taskId)).length;
  const totalCount = allActions.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const dateStr = plan?.date ?? plan?.generatedAt;
  const date = dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="p-6 space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/playbook"
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-4"
        >
          <ArrowLeft size={13} aria-hidden />
          Back to Playbook
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Zap size={22} className="text-[#C9A227]" aria-hidden />
              Today&apos;s Actions
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{date}</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[#3A3A3E] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!loading && totalCount > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              Daily Progress
            </span>
            <span className="text-sm font-bold text-[#C9A227]">
              {doneCount}/{totalCount} done
            </span>
          </div>
          <div
            className="h-2 rounded-full bg-[#2A2A2E] overflow-hidden"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${pct}% of today's tasks complete`}
          >
            <div
              className="h-full rounded-full bg-[#C9A227] transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={12} aria-hidden />
              All tasks complete — great work!
            </p>
          )}
        </div>
      )}

      {/* Stage context */}
      {(plan?.currentStage ?? plan?.stageName) && (
        <div className="bg-[#1A1A1E] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-3">
          <BookOpen size={16} className="text-[#C9A227] flex-shrink-0" aria-hidden />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-semibold">
              Current Stage
            </div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">
              {plan?.currentStage ?? plan?.stageName}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <PlaybookTodaySkeleton />
      ) : allActions.length === 0 ? (
        <div className="text-center py-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto mb-3" aria-hidden />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No actions for today</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Check back tomorrow or sync the playbook to generate new tasks.
          </p>
          <Link
            href="/playbook"
            className="inline-flex items-center gap-1.5 mt-4 px-3 py-1.5 rounded-lg bg-[#C9A227] text-black text-sm font-semibold hover:bg-[#C9A227] transition-colors"
          >
            View Full Playbook
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <ActionSection
            title="Priority Actions"
            icon={<AlertTriangle size={14} className="text-red-400" aria-hidden />}
            actions={highPriority}
            onComplete={handleComplete}
            completing={completing}
            done={done}
          />
          <ActionSection
            title="Playbook Tasks"
            icon={<BookOpen size={14} className="text-[#C9A227]" aria-hidden />}
            actions={playbookActions}
            onComplete={handleComplete}
            completing={completing}
            done={done}
          />
          <ActionSection
            title="Alerts & Reminders"
            icon={<AlertTriangle size={14} className="text-red-400" aria-hidden />}
            actions={alertActions}
            onComplete={handleComplete}
            completing={completing}
            done={done}
          />
          <ActionSection
            title="Deal Momentum"
            icon={<TrendingUp size={14} className="text-orange-400" aria-hidden />}
            actions={momentumActions}
            onComplete={handleComplete}
            completing={completing}
            done={done}
          />
        </div>
      )}

      {/* Footer navigation */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-[var(--color-border)]">
        <Link
          href="/playbook"
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <BookOpen size={14} aria-hidden />
          Full Playbook
        </Link>
        <Link
          href="/execution"
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <TrendingUp size={14} aria-hidden />
          Execution Tracker
        </Link>
      </div>
    </div>
  );
}
