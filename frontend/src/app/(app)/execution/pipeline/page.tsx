'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { executionApi } from '@/lib/api';
import { PipelineFunnel, ExecutionMetricCard } from '@/components/execution/ExecutionComponents';
import type { AcquisitionPipelineStat, QlaTargets } from '@/lib/types';

function convRate(a: number, b: number) {
  if (!b) return '—';
  return `${((a / b) * 100).toFixed(1)}%`;
}

export default function PipelinePage() {
  const [pipeline, setPipeline] = useState<AcquisitionPipelineStat | null>(null);
  const [targets,  setTargets]  = useState<QlaTargets | null>(null);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await executionApi.getPipeline();
      const { pipeline: p, targets: t } = res as { pipeline: AcquisitionPipelineStat; targets: QlaTargets };
      setPipeline(p);
      setTargets(t);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const funnelStages = pipeline && targets ? [
    { label: 'Companies identified',   actual: pipeline.totalCompanies,       target: targets.pipeline_companies           },
    { label: 'Owners contacted',       actual: pipeline.ownersContacted,      target: targets.pipeline_owners_contacted    },
    { label: 'Conversations had',      actual: pipeline.ownerConversations,   target: targets.pipeline_conversations       },
    { label: 'Serious opportunities',  actual: pipeline.seriousOpportunities, target: targets.pipeline_opportunities       },
    { label: 'LOIs sent',              actual: pipeline.loisSent,             target: targets.pipeline_lois                },
    { label: 'Deals closed',           actual: pipeline.dealsClosed,          target: targets.pipeline_closed              },
  ] : [];

  const biggestGap = useMemo(() => {
    if (!pipeline || !targets) return null;
    const metrics = [
      { label: 'Companies identified', actual: pipeline.totalCompanies, target: targets.pipeline_companies, href: '/pipeline/sourcing-radar', prompt: 'Top-of-funnel volume fixes downstream weakness.' },
      { label: 'Owners contacted', actual: pipeline.ownersContacted, target: targets.pipeline_owners_contacted, href: '/execution/daily', prompt: 'Contact volume is the pipeline engine.' },
      { label: 'Conversations had', actual: pipeline.ownerConversations, target: targets.pipeline_conversations, href: '/pipeline', prompt: 'Conversations convert outreach into real opportunity.' },
      { label: 'LOIs sent', actual: pipeline.loisSent, target: targets.pipeline_lois, href: '/execution/monthly', prompt: 'Without LOIs, the funnel is decorative.' },
    ];
    return metrics
      .map((item) => ({ ...item, gap: Math.max(0, item.target - item.actual) }))
      .sort((a, b) => b.gap - a.gap)[0];
  }, [pipeline, targets]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Pipeline Progress</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          QLA acquisition funnel — 500 companies → 1 closed deal
        </p>
      </div>

      {!loading && biggestGap && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--color-accent)] mb-1">Pipeline Pressure</div>
              <p className="text-sm text-[var(--color-text-primary)]">Biggest gap: {biggestGap.label} ({biggestGap.actual}/{biggestGap.target})</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">{biggestGap.prompt}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={biggestGap.href} className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[#C9A227] transition-colors">Open Fix</Link>
              <Link href="/command-center" className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] hover:border-[#C9A227] transition-colors">Command Center</Link>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : (
        <div className="space-y-6">
          {/* Key pipeline metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <ExecutionMetricCard label="Companies"      value={pipeline?.totalCompanies ?? 0}       target={targets?.pipeline_companies} />
            <ExecutionMetricCard label="Contacted"      value={pipeline?.ownersContacted ?? 0}      target={targets?.pipeline_owners_contacted} />
            <ExecutionMetricCard label="Conversations"  value={pipeline?.ownerConversations ?? 0}   target={targets?.pipeline_conversations} />
            <ExecutionMetricCard label="Opportunities"  value={pipeline?.seriousOpportunities ?? 0} target={targets?.pipeline_opportunities} />
            <ExecutionMetricCard label="LOIs Sent"      value={pipeline?.loisSent ?? 0}             target={targets?.pipeline_lois} />
            <ExecutionMetricCard label="Closed"         value={pipeline?.dealsClosed ?? 0}          target={targets?.pipeline_closed} accent={!!pipeline?.dealsClosed} />
          </div>

          {/* Funnel visualization */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
            <h2 className="font-medium text-[var(--color-text-primary)] mb-6">QLA Acquisition Funnel</h2>
            {funnelStages.length > 0 ? (
              <PipelineFunnel stages={funnelStages} />
            ) : (
              <p className="text-sm text-[var(--color-text-muted)]">No pipeline data available.</p>
            )}
          </div>

          {/* Conversion rates */}
          {pipeline && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
              <h2 className="font-medium text-[var(--color-text-primary)] mb-4">Conversion Rates</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Identified → Contacted',    a: pipeline.ownersContacted,      b: pipeline.totalCompanies,       qlaBenchmark: '40%' },
                  { label: 'Contacted → Conversation',  a: pipeline.ownerConversations,   b: pipeline.ownersContacted,      qlaBenchmark: '25%' },
                  { label: 'Conversation → LOI',        a: pipeline.loisSent,             b: pipeline.ownerConversations,   qlaBenchmark: '6%' },
                  { label: 'LOI → Closed',              a: pipeline.dealsClosed,          b: pipeline.loisSent,             qlaBenchmark: '33%' },
                ].map(({ label, a, b, qlaBenchmark }) => (
                  <div key={label} className="bg-[var(--color-bg)] rounded-lg p-4 text-center">
                    <p className="text-xs text-[var(--color-text-muted)] mb-1">{label}</p>
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{convRate(a, b)}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">QLA: {qlaBenchmark}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QLA expected ratios info */}
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl p-5">
            <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-3">QLA Expected Ratios</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              {[
                ['500 companies identified', 'Starting pool'],
                ['200 owners contacted',     '40% of identified'],
                ['50 conversations',         '25% of contacted'],
                ['10 opportunities',         '20% of conversations'],
                ['3 LOIs sent',              '30% of opportunities'],
                ['1 deal closed',            '33% of LOIs'],
              ].map(([stat, note]) => (
                <div key={stat} className="flex flex-col">
                  <span className="font-medium text-[var(--color-text-primary)]">{stat}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
