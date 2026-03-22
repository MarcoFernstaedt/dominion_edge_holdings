'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, FileText,
  Users, Calendar, Calculator, Upload, Send, RefreshCw,
  Star, AlertTriangle, XCircle, TrendingUp, Pencil,
} from 'lucide-react';
import type { ChecklistItem, ChecklistPhase, ChecklistGrade } from '@/lib/types';
import { useScrollTarget } from '@/hooks/useScrollTarget';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ─── Completion-type metadata ─────────────────────────────────────────────────

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; submittable: boolean }> = {
  manual:                     { icon: null,                     label: 'Manual',                submittable: false },
  'requires-linked-entity':   { icon: <Users size={11} />,     label: 'Linked entity required', submittable: false },
  'requires-meeting':         { icon: <Calendar size={11} />,  label: 'Meeting required',       submittable: false },
  'requires-document':        { icon: <FileText size={11} />,  label: 'Submit your work',       submittable: true  },
  'requires-financial-model': { icon: <Calculator size={11} />, label: 'Submit your model',     submittable: true  },
};

// ─── Per-item structured guidelines ──────────────────────────────────────────

const GUIDELINES: Record<string, { prompt: string; sections: string[] }> = {
  foundation_7: {
    prompt: 'Write your 1-page industry thesis. Be specific, be direct, no fluff.',
    sections: [
      'Why this industry? (fragmentation, owner age, lack of professional management)',
      'Why now? (macro tailwinds, seller motivation, financing availability)',
      'Why you? (your edge, your board, your deal-finding advantage)',
      'What does success look like in 3 years?',
    ],
  },
  foundation_8: {
    prompt: 'Document your exact deal criteria. Vague criteria = bad deal flow.',
    sections: [
      'Revenue range (e.g. $1M–$5M) and EBITDA minimum',
      'SDE multiple you will pay — explain your reasoning',
      'Target seller profile: age, years in business, retirement signals',
      'Geography and business characteristics you require',
      'Hard NO-GO criteria (what you will never buy)',
    ],
  },
  board_1: {
    prompt: 'Write your 1-page board pitch. This is how you recruit A-players for 0% cash.',
    sections: [
      'Your acquisition thesis — 1 paragraph, tight',
      'Deal criteria: what you are buying and why',
      'The equity offer: 0.5–2%, no cash, specific vesting terms',
      'What you need from this specific board seat',
      'Your 90-day commitment to this board member',
    ],
  },
  board_2: {
    prompt: 'Write your board invitation email template.',
    sections: [
      'Opening: direct credibility hook (not flattery)',
      'The thesis: 2 sentences on what you are building',
      'The ask: what you want from them specifically',
      'The offer: equity terms, time commitment',
      'The close: specific call to action with a date',
    ],
  },
  board_15: {
    prompt: 'Draft your equity agreement terms and structure.',
    sections: [
      'Equity percentage per seat (0.5–2%, justify each)',
      'Vesting schedule (deal-close trigger vs. time-based)',
      'Role and commitment expectations per seat',
      'Anti-dilution terms and exit provisions',
    ],
  },
  evaluation_2: {
    prompt: 'Calculate true SDE. Show your complete math for each target.',
    sections: [
      'Target company revenue and stated EBITDA',
      'Owner add-backs: salary above market rate, personal expenses, one-time items',
      'Adjustments: capex, rent normalization, working capital',
      'True SDE = EBITDA + add-backs − adjustments (show the math)',
      'SDE multiple you are applying and comparable deal justification',
    ],
  },
  evaluation_3: {
    prompt: 'Build the DSCR model. SBA will not fund below 1.25x — know your number cold.',
    sections: [
      'Annual NOI = adjusted EBITDA (list every adjustment)',
      'SBA 7(a) loan amount, term (10–25 years), current interest rate',
      'Annual debt service = principal + interest (show calculation)',
      'DSCR = Annual NOI ÷ Annual Debt Service — result and pass/fail',
      'Buffer: at what EBITDA does DSCR fall below 1.25x?',
    ],
  },
  evaluation_8: {
    prompt: 'Score this target: GO / CONDITIONAL GO / NO-GO. Justify every point.',
    sections: [
      'Verdict: GO / CONDITIONAL GO / NO-GO (no hedging)',
      'DSCR status (pass / fail)',
      'Seller motivation score (1–10) with rationale',
      'Business quality factors that support or kill the deal',
      'Conditions that must be met for Conditional GO to become GO',
    ],
  },
  loi_2: {
    prompt: 'Draft your LOI. This is a legally significant document — be precise.',
    sections: [
      'Proposed purchase price and structure (asset vs. stock)',
      'Payment terms: cash at close, seller note %, SBA financing %',
      'Earnest money amount and conditions',
      'Exclusivity period (minimum 60 days)',
      'Key due-diligence conditions precedent',
      'Target closing timeline',
    ],
  },
  financing_2: {
    prompt: 'Document your SBA loan application package.',
    sections: [
      'Loan amount requested and use of proceeds',
      'Lender bank and SBA program (7(a) vs. 504)',
      'Personal financial statement summary',
      'Business financial projections (Year 1–3)',
      'Collateral offered and guaranty structure',
    ],
  },
  closing_1: {
    prompt: 'Document your complete due diligence findings.',
    sections: [
      'Financial: 3 years P&L, tax returns, QoE findings',
      'Legal: entity structure, contracts, litigation, IP',
      'Operational: key employees, customers, vendors, systems',
      'Red flags found and how you are mitigating each',
      'Final go / no-go recommendation with rationale',
    ],
  },
  closing_3: {
    prompt: 'Summarize the Purchase Agreement terms.',
    sections: [
      'Final purchase price and structure',
      'Representations and warranties (key items)',
      'Indemnification caps and survival periods',
      'Non-compete and non-solicit terms',
      'Transition support period and terms',
    ],
  },
  post_acquisition_1: {
    prompt: 'Document your 90-day integration plan.',
    sections: [
      'Day 1–7: Employee comms, cash position, top customer outreach',
      'Day 8–30: Vendor contracts, accounting setup, KPI baseline',
      'Day 31–60: Customer retention plan, first board update, quick wins',
      'Day 61–90: 90-day review vs. plan, second deal sourcing begins',
      'Operator transition: timeline and accountability',
    ],
  },
};

const FALLBACK: Record<string, { prompt: string; sections: string[] }> = {
  'requires-document': {
    prompt: 'Write your submission. Be specific, concrete, and defensible.',
    sections: [
      'State your conclusion or deliverable clearly upfront',
      'Support it with specific data, names, or numbers',
      'Identify the top 2–3 risks and how you mitigate them',
      'What specific next action does this unlock?',
    ],
  },
  'requires-financial-model': {
    prompt: 'Show your complete financial model. Every number must be justified.',
    sections: [
      'Inputs: all assumptions with sources',
      'Calculations: show every step of the math',
      'Outputs: key metrics and what they mean',
      'Sensitivity: what happens if the key variable is 20% worse?',
    ],
  },
};

function getGuidelines(item: ChecklistItem) {
  return GUIDELINES[item.id] ?? FALLBACK[item.completionType] ?? FALLBACK['requires-document'];
}

// ─── Grade display ────────────────────────────────────────────────────────────

const GRADE_CFG = {
  elite:      { color: '#3FA66B', bg: 'bg-[#3FA66B10]', border: 'border-[#3FA66B35]', label: 'ELITE',      Icon: Star },
  solid:      { color: '#C9A227', bg: 'bg-[#C9A22710]', border: 'border-[#C9A22735]', label: 'SOLID',      Icon: TrendingUp },
  needs_work: { color: '#E6A23C', bg: 'bg-[#E6A23C10]', border: 'border-[#E6A23C35]', label: 'NEEDS WORK', Icon: AlertTriangle },
  reject:     { color: '#D64545', bg: 'bg-[#D6454510]', border: 'border-[#D6454535]', label: 'REJECTED',   Icon: XCircle },
} as const;

function GradePanel({ grade, onRevise }: { grade: ChecklistGrade; onRevise: () => void }) {
  const cfg  = GRADE_CFG[grade.level];
  const Icon = cfg.Icon;
  return (
    <div className={cn('rounded-md border p-4 space-y-3', cfg.bg, cfg.border)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Icon size={15} style={{ color: cfg.color }} aria-hidden />
          <span className="text-[10px] tracking-widest font-semibold uppercase" style={{ color: cfg.color }}>{cfg.label}</span>
          <span className="font-serif text-lg font-bold" style={{ color: cfg.color }}>{grade.score}/100</span>
        </div>
        <button onClick={onRevise} className="text-[#A7A29A] hover:text-[#E8E6E3] transition-colors text-xs flex items-center gap-1.5">
          <Pencil size={11} aria-hidden /> Revise
        </button>
      </div>

      <p className="text-sm font-semibold text-[#E8E6E3] leading-snug">&ldquo;{grade.headline}&rdquo;</p>
      <p className="text-xs text-[#A7A29A] leading-relaxed">{grade.feedback}</p>

      {grade.improvements.length > 0 && (
        <div>
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1.5">
            {grade.passed ? 'Tighten These' : 'Required Fixes'}
          </div>
          <ul className="space-y-1">
            {grade.improvements.map((imp, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[#A7A29A]">
                <span className="flex-shrink-0 font-bold" style={{ color: cfg.color }}>→</span>
                {imp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {grade.passed && (
        <div className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase text-[#3FA66B]">
          <CheckCircle2 size={11} aria-hidden /> Marked complete
        </div>
      )}
    </div>
  );
}

// ─── Submission panel ─────────────────────────────────────────────────────────

function SubmissionPanel({ item, phaseId, onClose }: { item: ChecklistItem; phaseId: string; onClose: () => void }) {
  const submitItem   = useAppStore((s) => s.submitChecklistItem);
  const guidelines   = getGuidelines(item);
  const isFinancial  = item.completionType === 'requires-financial-model';

  const existing     = item.submission;
  const [text, setText]         = useState(existing?.text ?? '');
  const [fileName, setFileName] = useState(existing?.fileName ?? '');
  const [grading, setGrading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showForm, setShowForm] = useState(!existing?.grade);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleGrade() {
    const body = text.trim();
    if (body.length < 30) { setError('Write at least a few sentences before submitting.'); return; }
    setGrading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/checklist/grade`, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ itemTitle: item.title, completionType: item.completionType, submission: body }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.error?.message ?? `Grade request failed (${res.status})`);
      }
      const { grade } = await res.json();
      submitItem(phaseId, item.id, { text: body, fileName: fileName || undefined, submittedAt: new Date().toISOString(), grade });
      setShowForm(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setGrading(false);
    }
  }

  return (
    <div className="border-t border-[#2A2A2E] bg-[#0D0D0D] px-5 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-widest uppercase font-medium text-[#C9A227]">
          {isFinancial ? 'Financial Model Submission' : 'Written Submission'}
        </div>
        <button onClick={onClose} className="text-[#A7A29A] hover:text-[#E8E6E3] text-xs transition-colors">
          ✕ Close
        </button>
      </div>

      {/* Existing grade */}
      {!showForm && item.submission?.grade && (
        <GradePanel grade={item.submission.grade} onRevise={() => setShowForm(true)} />
      )}

      {/* Form */}
      {showForm && (
        <>
          {/* Structured guidelines */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 space-y-3">
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Guidelines — Dan Peña Standard</div>
            <p className="text-xs font-semibold text-[#E8E6E3] leading-relaxed">{guidelines.prompt}</p>
            <ol className="space-y-2">
              {guidelines.sections.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-[#A7A29A]">
                  <span className="text-[#C9A227] font-mono font-semibold flex-shrink-0">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {/* Text input */}
          <div>
            <label htmlFor={`sub-${item.id}`} className="block text-[9px] tracking-widest uppercase text-[#A7A29A] mb-2">
              Your Submission
            </label>
            <textarea
              id={`sub-${item.id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={11}
              placeholder="Address each guideline above. Be direct and specific — vague answers fail."
              className={cn(
                'w-full rounded-md border border-[#2A2A2E] bg-[#141414] px-4 py-3',
                'text-sm text-[#E8E6E3] placeholder:text-[#525252]',
                'focus:outline-none focus:ring-1 focus:ring-[#C9A227] focus:border-[#C9A227]',
                'resize-y min-h-[200px] transition-colors font-mono leading-relaxed',
              )}
            />
            <div className="flex items-center justify-between mt-1 text-[10px]">
              <span className="text-[#525252]">{text.length.toLocaleString()} chars</span>
              {text.length > 0 && text.length < 80 && (
                <span className="text-[#E6A23C]">Too brief — add more detail</span>
              )}
            </div>
          </div>

          {/* Optional file attach */}
          <div>
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-2">
              Attach Document{' '}
              <span className="normal-case tracking-normal font-normal text-[#525252]">(optional — for your records)</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-xs px-3 py-2 rounded border border-[#2A2A2E] text-[#A7A29A] hover:border-[#C9A22740] hover:text-[#C9A227] transition-colors"
              >
                <Upload size={12} aria-hidden /> Choose file
              </button>
              {fileName && <span className="text-xs text-[#A7A29A] truncate max-w-[200px]">{fileName}</span>}
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.xlsx,.csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) setFileName(f.name); }} />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-[#D6454512] border border-[#D6454530] rounded px-3 py-2 text-xs text-[#D64545]">
              {error}
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleGrade}
              disabled={grading || text.trim().length < 30}
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all bg-[#C9A227] text-[#080808] hover:bg-[#DDB830] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {grading
                ? <><RefreshCw size={13} className="animate-spin" aria-hidden /> Grading…</>
                : <><Send size={13} aria-hidden /> Grade My Work</>}
            </button>
            <span className="text-[10px] text-[#525252]">Graded by Dan Peña standard · Your First Hundred Million</span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function ChecklistItemRow({ item, phaseId, onToggle }: { item: ChecklistItem; phaseId: string; onToggle: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta         = TYPE_META[item.completionType];
  const isSubmittable = meta?.submittable;
  const grade         = item.submission?.grade;

  return (
    <li className={cn('border-b border-[#2A2A2E] last:border-0', item.isComplete && !isSubmittable && 'opacity-60')}>
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className={cn(
            'flex-shrink-0 mt-0.5 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded',
            item.isComplete ? 'text-[#3FA66B]' : 'text-[#A7A29A] hover:text-[#E8E6E3]',
          )}
          aria-label={`${item.isComplete ? 'Uncheck' : 'Complete'}: ${item.title}`}
          aria-checked={item.isComplete}
          role="checkbox"
        >
          {item.isComplete ? <CheckCircle2 size={17} aria-hidden /> : <Circle size={17} aria-hidden />}
        </button>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-sm', item.isComplete ? 'line-through text-[#A7A29A]' : 'text-[#E8E6E3]')}>
              {item.title}
            </span>
            {item.autoGenerateTasks && <Badge variant="gold" size="sm">Auto-tasks</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {item.completedAt && item.isComplete && (
              <span className="text-[10px] text-[#A7A29A]">Completed {formatDate(item.completedAt)}</span>
            )}
            {item.notes && <span className="text-[10px] text-[#A7A29A] italic">{item.notes}</span>}
            {grade && (
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: GRADE_CFG[grade.level].color }}>
                {GRADE_CFG[grade.level].label} · {grade.score}/100
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          {!isSubmittable && item.whyItMatters && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="text-[#A7A29A] hover:text-[#E8E6E3] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded p-0.5"
              aria-label={expanded ? 'Hide' : 'Why it matters'}
            >
              {expanded ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
          )}
          {isSubmittable && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className={cn(
                'flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded border transition-all',
                grade?.passed
                  ? 'border-[#3FA66B30] text-[#3FA66B] hover:border-[#3FA66B60]'
                  : grade
                    ? 'border-[#E6A23C30] text-[#E6A23C] hover:border-[#E6A23C60]'
                    : 'border-[#C9A22730] text-[#C9A227] hover:border-[#C9A22760] hover:bg-[#C9A22708]',
              )}
              aria-expanded={expanded}
            >
              {meta?.icon}
              <span className="ml-0.5">{grade?.passed ? 'View' : grade ? 'Revise' : 'Begin'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Why it matters */}
      {expanded && !isSubmittable && item.whyItMatters && (
        <div className="px-4 pb-3 ml-8">
          <div className="bg-[#C9A22708] border border-[#C9A22720] rounded p-2.5">
            <div className="text-[9px] tracking-widest uppercase text-[#C9A227] mb-1">Why it matters</div>
            <p className="text-xs text-[#E8E6E3]">{item.whyItMatters}</p>
          </div>
        </div>
      )}

      {/* Submission panel */}
      {expanded && isSubmittable && (
        <SubmissionPanel item={item} phaseId={phaseId} onClose={() => setExpanded(false)} />
      )}
    </li>
  );
}

// ─── Phase accordion ──────────────────────────────────────────────────────────

function PhaseAccordion({ phase }: { phase: ChecklistPhase }) {
  const toggleItem = useAppStore((s) => s.toggleChecklistItem);
  const [open, setOpen] = useState(true);

  const total   = phase.items.length;
  const done    = phase.items.filter((i) => i.isComplete).length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const allDone = done === total;

  return (
    <section
      aria-labelledby={`phase-${phase.id}-heading`}
      className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden"
    >
      <button
        id={`phase-${phase.id}-heading`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between px-5 py-4 text-left',
          'hover:bg-[#1B1B1D] transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]',
        )}
        aria-expanded={open}
        aria-controls={`phase-${phase.id}-items`}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: allDone ? '#3FA66B' : phase.color }} aria-hidden />
          <span className="font-semibold text-sm text-[#E8E6E3]">{phase.name}</span>
          {allDone && <Badge variant="success" size="sm">Complete</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-[#A7A29A]">{done}/{total}</div>
            <div className="w-20 h-1 rounded-full bg-[#2A2A2E] mt-1 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: allDone ? '#3FA66B' : phase.color }} />
            </div>
          </div>
          {open ? <ChevronUp size={14} className="text-[#A7A29A]" aria-hidden /> : <ChevronDown size={14} className="text-[#A7A29A]" aria-hidden />}
        </div>
      </button>

      {open && (
        <ul id={`phase-${phase.id}-items`} className="border-t border-[#2A2A2E]" role="list" aria-label={`${phase.name} items`}>
          {phase.items.map((item) => (
            <ChecklistItemRow key={item.id} item={item} phaseId={phase.id} onToggle={() => toggleItem(phase.id, item.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChecklistPage() {
  useScrollTarget();
  const phases = useAppStore((s) => s.checklistPhases);

  const allItems       = phases.flatMap((p) => p.items);
  const totalItems     = allItems.length;
  const completedItems = allItems.filter((i) => i.isComplete).length;
  const overallPct     = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const currentPhase   = phases.find((p) => p.items.some((i) => !i.isComplete))?.name ?? 'Complete';
  const gradedPassed   = allItems.filter((i) => i.submission?.grade?.passed).length;
  const eliteCount     = allItems.filter((i) => i.submission?.grade?.level === 'elite').length;

  return (
    <div id="section-checklist" className="page-container-narrow space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3] mb-1">Acquisition Checklist</h1>
        <p className="text-sm text-[#A7A29A]">
          Complete guided operating system — {phases.length} phases · {totalItems} steps
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
          <div className="flex flex-col items-end gap-1">
            <div className="text-right">
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Active Phase</div>
              <div className="text-sm font-semibold text-[#E8E6E3]">{currentPhase}</div>
            </div>
            {gradedPassed > 0 && (
              <div className="text-[10px] text-[#3FA66B]">
                {gradedPassed} submission{gradedPassed !== 1 ? 's' : ''} graded · {eliteCount} elite
              </div>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-[#2A2A2E] overflow-hidden" role="progressbar" aria-valuenow={overallPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-[#C9A227] transition-all duration-700" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      {/* Phase mini-grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {phases.map((phase) => {
          const done  = phase.items.filter((i) => i.isComplete).length;
          const total = phase.items.length;
          const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
          return (
            <div key={phase.id} className="bg-[#141414] border border-[#2A2A2E] rounded px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-[#E8E6E3] truncate">{phase.name}</span>
                <span className="text-xs text-[#A7A29A]">{pct}%</span>
              </div>
              <div className="h-1 rounded-full bg-[#2A2A2E] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: pct === 100 ? '#3FA66B' : phase.color }} />
              </div>
              <div className="text-[9px] text-[#A7A29A] mt-1">{done}/{total}</div>
            </div>
          );
        })}
      </div>

      {/* Phases */}
      <div className="space-y-3" aria-label="Checklist phases">
        {phases.map((phase) => <PhaseAccordion key={phase.id} phase={phase} />)}
      </div>
    </div>
  );
}
