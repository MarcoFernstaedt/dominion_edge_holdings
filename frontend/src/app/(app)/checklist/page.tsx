'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info, FileText, Users, Calendar, Calculator } from 'lucide-react';
import type { ChecklistItem, ChecklistPhase } from '@/lib/types';

const COMPLETION_ICONS: Record<string, React.ReactNode> = {
  manual: null,
  'requires-linked-entity': <Users size={11} aria-label="Requires linked entity" />,
  'requires-document': <FileText size={11} aria-label="Requires document" />,
  'requires-meeting': <Calendar size={11} aria-label="Requires meeting" />,
  'requires-financial-model': <Calculator size={11} aria-label="Requires financial model" />,
};

function ChecklistItemRow({
  item,
  phaseId,
  onToggle,
}: {
  item: ChecklistItem;
  phaseId: string;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = item.description || item.whyItMatters;

  return (
    <li className={cn(
      'border-b border-[#2A2A2E] last:border-0',
      item.isComplete && 'opacity-60'
    )}>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'flex-shrink-0 mt-0.5 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded',
            item.isComplete ? 'text-[#3FA66B]' : 'text-[#A7A29A] hover:text-[#E8E6E3]'
          )}
          aria-label={`${item.isComplete ? 'Uncheck' : 'Complete'}: ${item.title}`}
          aria-checked={item.isComplete}
          role="checkbox"
        >
          {item.isComplete ? (
            <CheckCircle2 size={17} aria-hidden />
          ) : (
            <Circle size={17} aria-hidden />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'text-sm',
              item.isComplete ? 'line-through text-[#A7A29A]' : 'text-[#E8E6E3]'
            )}>
              {item.title}
            </span>
            {item.completionType !== 'manual' && (
              <span className="text-[#A7A29A]" aria-label={`Completion type: ${item.completionType.replace(/-/g, ' ')}`}>
                {COMPLETION_ICONS[item.completionType]}
              </span>
            )}
            {item.autoGenerateTasks && (
              <Badge variant="gold" size="sm">Auto-tasks</Badge>
            )}
          </div>
          {item.completedAt && item.isComplete && (
            <div className="text-xs text-[#A7A29A] mt-0.5">
              Completed {formatDate(item.completedAt)}
            </div>
          )}
          {item.notes && (
            <div className="text-xs text-[#A7A29A] mt-0.5 italic">{item.notes}</div>
          )}
        </div>

        {/* Expand info */}
        {hasDetails && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex-shrink-0 text-[#A7A29A] hover:text-[#E8E6E3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
            aria-label={expanded ? 'Hide details' : 'Show details'}
            aria-expanded={expanded}
          >
            <Info size={14} aria-hidden />
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="px-4 pb-3 ml-8 space-y-2">
          {item.description && (
            <p className="text-xs text-[#A7A29A]">{item.description}</p>
          )}
          {item.whyItMatters && (
            <div className="bg-[#C9A22708] border border-[#C9A22720] rounded p-2.5">
              <div className="text-[9px] tracking-widest uppercase text-[#C9A227] mb-1">Why it matters</div>
              <p className="text-xs text-[#E8E6E3]">{item.whyItMatters}</p>
            </div>
          )}
          {item.completionType !== 'manual' && (
            <div className="text-xs text-[#A7A29A] flex items-center gap-1.5">
              {COMPLETION_ICONS[item.completionType]}
              <span>Requires: {item.completionType.replace(/^requires-/, '').replace(/-/g, ' ')}</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function PhaseAccordion({
  phase,
}: {
  phase: ChecklistPhase;
}) {
  const toggleItem = useAppStore((s) => s.toggleChecklistItem);
  const [open, setOpen] = useState(true);

  const total = phase.items.length;
  const done = phase.items.filter((i) => i.isComplete).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;

  return (
    <section
      aria-labelledby={`phase-${phase.id}-heading`}
      className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden"
    >
      {/* Phase header */}
      <button
        id={`phase-${phase.id}-heading`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-5 py-4 text-left',
          'hover:bg-[#1B1B1D] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]'
        )}
        aria-expanded={open}
        aria-controls={`phase-${phase.id}-items`}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: allDone ? '#3FA66B' : phase.color }}
            aria-hidden="true"
          />
          <span className="font-semibold text-sm text-[#E8E6E3]">{phase.name}</span>
          {allDone && <Badge variant="success" size="sm">Complete</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-[#A7A29A]">{done}/{total}</div>
            <div
              className="w-20 h-1 rounded-full bg-[#2A2A2E] mt-1 overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${phase.name} ${pct}% complete`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: allDone ? '#3FA66B' : phase.color }}
              />
            </div>
          </div>
          {open ? (
            <ChevronUp size={14} className="text-[#A7A29A]" aria-hidden />
          ) : (
            <ChevronDown size={14} className="text-[#A7A29A]" aria-hidden />
          )}
        </div>
      </button>

      {/* Items */}
      {open && (
        <ul
          id={`phase-${phase.id}-items`}
          className="border-t border-[#2A2A2E]"
          role="list"
          aria-label={`${phase.name} checklist items`}
        >
          {phase.items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              phaseId={phase.id}
              onToggle={() => toggleItem(phase.id, item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ChecklistPage() {
  const phases = useAppStore((s) => s.checklistPhases);

  const allItems = phases.flatMap((p) => p.items);
  const totalItems = allItems.length;
  const completedItems = allItems.filter((i) => i.isComplete).length;
  const overallPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const currentPhaseName = phases.find((p) => p.items.some((i) => !i.isComplete))?.name ?? 'Complete';

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3] mb-1">
          Acquisition Checklist
        </h1>
        <p className="text-sm text-[#A7A29A]">
          Complete guided operating system — {phases.length} phases, {totalItems} steps
        </p>
      </header>

      {/* Overall progress */}
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Overall Progress</div>
            <div className="font-serif text-2xl font-bold text-[#C9A227]">{overallPct}%</div>
            <div className="text-xs text-[#A7A29A]">{completedItems} of {totalItems} steps complete</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Active Phase</div>
            <div className="text-sm font-semibold text-[#E8E6E3]">{currentPhaseName}</div>
          </div>
        </div>
        <div
          className="h-2 rounded-full bg-[#2A2A2E] overflow-hidden"
          role="progressbar"
          aria-valuenow={overallPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Overall checklist ${overallPct}% complete`}
        >
          <div
            className="h-full rounded-full bg-[#C9A227] transition-all duration-700"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Phase grid summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {phases.map((phase) => {
          const done = phase.items.filter((i) => i.isComplete).length;
          const total = phase.items.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div
              key={phase.id}
              className="bg-[#141414] border border-[#2A2A2E] rounded px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#E8E6E3] truncate">{phase.name}</span>
                <span className="text-xs text-[#A7A29A]">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-[#2A2A2E] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: pct === 100 ? '#3FA66B' : phase.color }}
                />
              </div>
              <div className="text-[9px] text-[#A7A29A] mt-1">{done}/{total}</div>
            </div>
          );
        })}
      </div>

      {/* Phase accordions */}
      <div className="space-y-3" aria-label="Checklist phases">
        {phases.map((phase) => (
          <PhaseAccordion key={phase.id} phase={phase} />
        ))}
      </div>
    </div>
  );
}
