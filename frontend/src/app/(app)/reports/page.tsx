'use client';

import { useAppStore } from '@/lib/store';
import { cn, formatDate, formatCurrency, daysSince, STAGE_LABELS } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { BarChart3, TrendingUp, Users, KanbanSquare, CheckSquare, Send } from 'lucide-react';

function ProgressBar({ value, max, color = '#C9A227' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-[#2A2A2E] rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-[#A7A29A] flex-shrink-0 w-8 text-right">{value}</span>
    </div>
  );
}

export default function ReportsPage() {
  const companies = useAppStore((s) => s.companies);
  const contacts = useAppStore((s) => s.contacts);
  const deals = useAppStore((s) => s.deals);
  const tasks = useAppStore((s) => s.tasks);
  const interactions = useAppStore((s) => s.interactions);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const checklistPhases = useAppStore((s) => s.checklistPhases);
  const documents = useAppStore((s) => s.documents);
  const underwritingScenarios = useAppStore((s) => s.underwritingScenarios);

  const thisWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Tasks
  const completedTasksWeek = tasks.filter((t) => t.status === 'done' && t.completedAt && new Date(t.completedAt) > thisWeek).length;
  const overdueTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < new Date()).length;
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'archived').length;

  // Companies
  const companiesThisWeek = companies.filter((c) => new Date(c.createdAt) > thisWeek).length;
  const interestedCompanies = companies.filter((c) => ['interested', 'conversation', 'diligence', 'under_loi', 'under_contract'].includes(c.status)).length;

  // Interactions
  const outboundThisWeek = interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > thisWeek).length;
  const inboundThisWeek = interactions.filter((i) => i.direction === 'inbound' && new Date(i.createdAt) > thisWeek).length;

  // Deals
  const activeDeals = deals.filter((d) => d.status === 'active').length;
  const stalledDeals = deals.filter((d) => d.status === 'active' && daysSince(d.updatedAt) > 7).length;
  const dealsByStage = deals.reduce<Record<string, number>>((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {});

  // Checklist
  const allItems = checklistPhases.flatMap((p) => p.items);
  const completedItems = allItems.filter((i) => i.isComplete).length;
  const progressPct = allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;

  // Board
  const confirmedCandidates = boardCandidates.filter((c) => c.status === 'confirmed').length;
  const boardPipeline = boardCandidates.filter((c) => ['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating'].includes(c.status)).length;

  // Best DSCR scenario
  const bestScenario = underwritingScenarios.reduce<typeof underwritingScenarios[0] | null>((best, s) => {
    if (!best || s.dscr > best.dscr) return s;
    return best;
  }, null);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Reports</h1>
        <p className="text-sm text-[#A7A29A] mt-1">
          Performance snapshot · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </header>

      {/* Summary metrics */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Executive Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Overall Progress', value: `${progressPct}%`, sub: `${completedItems}/${allItems.length} steps`, icon: <CheckSquare size={16} /> },
            { label: 'Active Deals', value: activeDeals, sub: `${stalledDeals} stalled`, icon: <KanbanSquare size={16} /> },
            { label: 'Board Seats', value: `${confirmedCandidates}/6`, sub: `${boardPipeline} in pipeline`, icon: <Users size={16} /> },
            { label: 'Outreach (7d)', value: outboundThisWeek, sub: `${inboundThisWeek} replies`, icon: <Send size={16} /> },
          ].map((m) => (
            <div key={m.label} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <div className="flex items-center gap-2 text-[#A7A29A] mb-2">
                {m.icon}
                <span className="text-[9px] tracking-widest uppercase">{m.label}</span>
              </div>
              <div className="text-2xl font-bold font-serif text-[#C9A227]">{m.value}</div>
              <div className="text-xs text-[#A7A29A] mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks */}
        <section aria-labelledby="tasks-report">
          <h2 id="tasks-report" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Task Performance</h2>
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Completed this week</span>
              <span className="text-[#3FA66B] font-semibold">{completedTasksWeek}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Currently open</span>
              <span className="text-[#E8E6E3] font-semibold">{openTasks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Overdue</span>
              <span className={cn('font-semibold', overdueTasks > 0 ? 'text-[#C35B5B]' : 'text-[#A7A29A]')}>{overdueTasks}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Total tasks</span>
              <span className="text-[#E8E6E3]">{tasks.length}</span>
            </div>
          </div>
        </section>

        {/* CRM */}
        <section aria-labelledby="crm-report">
          <h2 id="crm-report" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">CRM Activity</h2>
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Total companies</span>
              <span className="text-[#E8E6E3] font-semibold">{companies.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Added this week</span>
              <span className="text-[#C9A227] font-semibold">{companiesThisWeek}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Interested / active</span>
              <span className="text-[#3FA66B] font-semibold">{interestedCompanies}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Total contacts</span>
              <span className="text-[#E8E6E3] font-semibold">{contacts.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Total interactions</span>
              <span className="text-[#E8E6E3] font-semibold">{interactions.length}</span>
            </div>
          </div>
        </section>

        {/* Pipeline */}
        <section aria-labelledby="pipeline-report">
          <h2 id="pipeline-report" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Pipeline by Stage</h2>
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-2.5">
            {deals.length === 0 ? (
              <p className="text-sm text-[#A7A29A]">No deals yet.</p>
            ) : (
              Object.entries(dealsByStage).map(([stage, count]) => (
                <div key={stage}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#A7A29A]">{STAGE_LABELS[stage] ?? stage}</span>
                    <span className="text-[#E8E6E3]">{count}</span>
                  </div>
                  <ProgressBar value={count} max={deals.length} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Underwriting */}
        <section aria-labelledby="uw-report">
          <h2 id="uw-report" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Underwriting</h2>
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Scenarios saved</span>
              <span className="text-[#E8E6E3] font-semibold">{underwritingScenarios.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Scenarios passing DSCR ≥ 1.25x</span>
              <span className={cn('font-semibold', underwritingScenarios.filter((s) => s.dscr >= 1.25).length > 0 ? 'text-[#3FA66B]' : 'text-[#A7A29A]')}>
                {underwritingScenarios.filter((s) => s.dscr >= 1.25).length}
              </span>
            </div>
            {bestScenario && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A7A29A]">Best DSCR</span>
                  <Badge variant={bestScenario.dscr >= 1.25 ? 'success' : 'danger'} size="sm">{bestScenario.dscr.toFixed(2)}x</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A7A29A]">Best scenario</span>
                  <span className="text-[#E8E6E3] text-xs">{bestScenario.scenarioName}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-[#A7A29A]">Documents generated</span>
              <span className="text-[#E8E6E3] font-semibold">{documents.length}</span>
            </div>
          </div>
        </section>
      </div>

      {/* Checklist breakdown */}
      <section aria-labelledby="checklist-report">
        <h2 id="checklist-report" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Checklist Phase Breakdown</h2>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-3">
          {checklistPhases.map((phase) => {
            const total = phase.items.length;
            const done = phase.items.filter((i) => i.isComplete).length;
            return (
              <div key={phase.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: done === total ? '#3FA66B' : phase.color }} aria-hidden />
                    <span className="text-sm text-[#E8E6E3]">{phase.name}</span>
                    {done === total && <Badge variant="success" size="sm">Complete</Badge>}
                  </div>
                  <span className="text-xs text-[#A7A29A]">{done}/{total}</span>
                </div>
                <ProgressBar value={done} max={total} color={done === total ? '#3FA66B' : phase.color} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
