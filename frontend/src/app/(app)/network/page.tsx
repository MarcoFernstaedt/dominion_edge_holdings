'use client';

import { useState, useEffect, useCallback } from 'react';
import { networkApi, credibilityApi, boardIntelApi, investorScoringApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ShieldCheck, AlertTriangle, AlertCircle, TrendingUp, Users,
  Briefcase, RefreshCw, ChevronRight, Info, ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CredibilityData {
  score: number;
  label: string;
  components: Record<string, number>;
  gaps: string[];
  downstream: Record<string, unknown>;
}

interface NetworkSummary {
  weakest_board_seat: unknown;
  best_board_candidate_to_act_on_now: unknown;
  high_value_relationship_cooling: unknown[];
  best_available_warm_intro_path: unknown | null;
  top_investor_opportunity: unknown | null;
  credibility_index: unknown;
  network_leverage_alerts: unknown[];
  critical_alert_count: number;
  high_alert_count: number;
  total_alert_count: number;
}

interface Alert {
  type: string;
  severity: 'info' | 'watch' | 'important' | 'critical';
  message: string;
  action?: string;
  entity?: unknown;
}

interface ReadinessGaps {
  gaps: string[];
  gap_count: number;
  ready: boolean;
  critical_gaps: string[];
  credibility_score: number;
  credibility_label: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-[#C9A227]';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBarColor(score: number) {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-[#C9A227]';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

function severityIcon(severity: string) {
  if (severity === 'critical')  return <AlertCircle  size={13} className="text-red-400 flex-shrink-0" aria-hidden />;
  if (severity === 'important') return <AlertTriangle size={13} className="text-[#C9A227] flex-shrink-0" aria-hidden />;
  return <Info size={13} className="text-blue-400 flex-shrink-0" aria-hidden />;
}

function labelToDisplay(label: string) {
  return label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function gapToDisplay(gap: string) {
  const MAP: Record<string, string> = {
    industry_veteran_missing:   'Add an industry veteran to board',
    board_not_developing:       'Board readiness score below threshold',
    thesis_not_clear:           'Investment thesis needs clarity (50+ words)',
    assets_incomplete:          'Website, pitch deck, or deal memo missing',
    no_active_deal_pipeline:    'No active deal pipeline',
    capital_connector_weak:     'Capital connector not secured',
    low_meeting_traction:       'Low significant meeting traction',
    no_thesis:                  'No investment thesis defined',
    no_deal:                    'No active deal',
    no_memo:                    'No investor memo created',
    no_traction:                'No banker/capital intro meetings',
    no_ask:                     'Target deal size/ask not set',
    no_intro:                   'No relationship edges in network',
    credibility_below_50:       'Credibility score below 50 — boost before outreach',
  };
  return MAP[gap] ?? labelToDisplay(gap);
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  const ringColor = score >= 70 ? '#4ade80' : score >= 50 ? '#C9A227' : score >= 30 ? '#fb923c' : '#f87171';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#262626" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={radius} fill="none"
            stroke={ringColor} strokeWidth="8"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', scoreColor(score))}>{score}</span>
          <span className="text-[9px] text-[#737373] uppercase tracking-wide">/100</span>
        </div>
      </div>
      <span className={cn('text-xs font-semibold capitalize', scoreColor(score))}>{label.replace(/_/g, ' ')}</span>
    </div>
  );
}

// ─── Component strip ──────────────────────────────────────────────────────────

function ComponentBar({ name, value }: { name: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-[#A7A29A] capitalize">{labelToDisplay(name)}</span>
        <span className={cn('text-[11px] font-medium tabular-nums', scoreColor(value))}>{value}</span>
      </div>
      <div className="h-1 rounded-full bg-[#1A1A1A] overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', scoreBarColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: Alert }) {
  const borderColor =
    alert.severity === 'critical'  ? 'border-l-red-500' :
    alert.severity === 'important' ? 'border-l-[#C9A227]' :
    'border-l-blue-500';

  return (
    <div className={cn('flex items-start gap-3 px-4 py-3 border-l-[3px] border-b border-b-[#1A1A1A]', borderColor)}>
      <div className="mt-0.5">{severityIcon(alert.severity)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#E8E6E3]">{alert.message}</p>
        {alert.action && (
          <p className="text-[11px] text-[#737373] mt-0.5">{alert.action}</p>
        )}
      </div>
    </div>
  );
}

// ─── Board seat health grid ───────────────────────────────────────────────────

function BoardHealthCard({ boardHealth }: { boardHealth: { score: number; label: string; analyzed_seats: unknown[]; alerts: unknown[] } }) {
  const seats = boardHealth.analyzed_seats as Array<{
    seat_type: string;
    health_state: string;
    risk_level: string;
    candidate_count: number;
  }>;

  const healthColor = (state: string) => {
    if (state === 'secured')    return 'text-green-400';
    if (state === 'active')     return 'text-blue-400';
    if (state === 'developing') return 'text-[#C9A227]';
    if (state === 'weak')       return 'text-orange-400';
    return 'text-red-400';
  };

  const healthDot = (state: string) => {
    if (state === 'secured')    return 'bg-green-500';
    if (state === 'active')     return 'bg-blue-500';
    if (state === 'developing') return 'bg-[#C9A227]';
    if (state === 'weak')       return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
        <div className="flex items-center gap-2">
          <Briefcase size={14} className="text-[#737373]" aria-hidden />
          <span className="text-sm font-medium text-[#E8E6E3]">Board Readiness</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-bold tabular-nums', scoreColor(boardHealth.score))}>{boardHealth.score}</span>
          <span className="text-xs text-[#737373] capitalize">{boardHealth.label}</span>
        </div>
      </div>
      <div className="divide-y divide-[#1A1A1A]">
        {seats.map((seat) => (
          <div key={seat.seat_type} className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', healthDot(seat.health_state))} aria-hidden />
              <span className="text-xs text-[#E8E6E3] capitalize">{seat.seat_type.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-[#737373]">{seat.candidate_count} candidate{seat.candidate_count !== 1 ? 's' : ''}</span>
              <span className={cn('text-[11px] font-medium capitalize', healthColor(seat.health_state))}>
                {seat.health_state}
              </span>
              {seat.risk_level === 'critical' && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 uppercase tracking-wide">Critical</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [credibility, setCredibility] = useState<CredibilityData | null>(null);
  const [networkSummary, setNetworkSummary] = useState<NetworkSummary | null>(null);
  const [boardHealth, setBoardHealth] = useState<{ score: number; label: string; analyzed_seats: unknown[]; alerts: unknown[]; components: Record<string, number> } | null>(null);
  const [readinessGaps, setReadinessGaps] = useState<ReadinessGaps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cred, summary, board, gaps] = await Promise.allSettled([
        credibilityApi.get(),
        networkApi.getCommandCenterSummary(),
        boardIntelApi.getSeatHealth(),
        investorScoringApi.getReadinessGaps(),
      ]);

      if (cred.status === 'fulfilled') setCredibility(cred.value as CredibilityData);
      if (summary.status === 'fulfilled') setNetworkSummary(summary.value as NetworkSummary);
      if (board.status === 'fulfilled') setBoardHealth(board.value as typeof boardHealth);
      if (gaps.status === 'fulfilled') setReadinessGaps(gaps.value as ReadinessGaps);
    } catch {
      setError('Failed to load network intelligence data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const alerts = (networkSummary?.network_leverage_alerts ?? []) as Alert[];
  const criticalCount = networkSummary?.critical_alert_count ?? 0;
  const highCount = networkSummary?.high_alert_count ?? 0;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 text-sm text-red-400 flex items-center gap-3">
          <AlertCircle size={14} aria-hidden />
          {error}
          <button onClick={load} className="ml-auto text-red-400 hover:text-red-300 underline text-xs">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Network Intelligence</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            Credibility index, board readiness, investor gaps, and leverage alerts
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={load}>
          <RefreshCw size={13} aria-hidden />
          Refresh
        </Button>
      </header>

      {/* Alert summary bar */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-md text-sm',
          criticalCount > 0
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : 'bg-[#C9A22715] border border-[#C9A22730] text-[#C9A227]'
        )}>
          <AlertCircle size={14} aria-hidden />
          {criticalCount > 0 && <span><strong>{criticalCount} critical</strong> alert{criticalCount !== 1 ? 's' : ''} require immediate action</span>}
          {criticalCount === 0 && highCount > 0 && <span><strong>{highCount} high-priority</strong> alert{highCount !== 1 ? 's' : ''} require attention</span>}
        </div>
      )}

      {/* Top row: Credibility ring + components */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Credibility ring */}
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 self-start">
            <ShieldCheck size={14} className="text-[#737373]" aria-hidden />
            <span className="text-sm font-medium text-[#E8E6E3]">Credibility Index</span>
          </div>
          {credibility ? (
            <>
              <ScoreRing score={credibility.score} label={credibility.label} />
              <div className="w-full">
                <div className="text-[10px] text-[#737373] uppercase tracking-wide mb-2">Downstream</div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[#A7A29A]">Investor readiness</span>
                    <span className="text-[#E8E6E3]">{String(credibility.downstream.investor_readiness_boost ?? '—')}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7A29A]">Intro confidence</span>
                    <span className={cn('capitalize',
                      credibility.downstream.warm_intro_ask_confidence === 'high' ? 'text-green-400' :
                      credibility.downstream.warm_intro_ask_confidence === 'medium' ? 'text-[#C9A227]' : 'text-red-400'
                    )}>{String(credibility.downstream.warm_intro_ask_confidence ?? '—')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A7A29A]">Outreach urgency</span>
                    <span className="text-[#E8E6E3] capitalize">{String(credibility.downstream.board_outreach_urgency ?? '—')}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-[#737373]">No data available</p>
          )}
        </div>

        {/* Credibility components */}
        <div className="lg:col-span-2 bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
          <div className="text-sm font-medium text-[#E8E6E3] mb-4">Score Components</div>
          {credibility ? (
            <div className="space-y-3">
              {Object.entries(credibility.components).map(([name, value]) => (
                <ComponentBar key={name} name={name} value={value} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#737373]">No component data</p>
          )}

          {/* Gaps */}
          {(credibility?.gaps?.length ?? 0) > 0 && (
            <div className="mt-5 pt-4 border-t border-[#2A2A2E]">
              <div className="text-[11px] text-[#737373] uppercase tracking-wide mb-2">Gaps to close</div>
              <div className="space-y-1.5">
                {credibility!.gaps.map((gap) => (
                  <div key={gap} className="flex items-start gap-2">
                    <ChevronRight size={11} className="text-[#737373] mt-0.5 flex-shrink-0" aria-hidden />
                    <span className="text-xs text-[#A7A29A]">{gapToDisplay(gap)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Board health */}
      {boardHealth && (
        <BoardHealthCard boardHealth={boardHealth} />
      )}

      {/* Investor readiness gaps */}
      {readinessGaps && (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[#737373]" aria-hidden />
              <span className="text-sm font-medium text-[#E8E6E3]">Investor Readiness</span>
            </div>
            <div className="flex items-center gap-2">
              {readinessGaps.ready ? (
                <Badge variant="success" size="sm">Ready</Badge>
              ) : (
                <Badge variant="warning" size="sm">{readinessGaps.gap_count} gap{readinessGaps.gap_count !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
          {readinessGaps.gaps.length > 0 ? (
            <div className="p-4 space-y-2">
              {readinessGaps.gaps.map((gap) => (
                <div key={gap} className={cn('flex items-start gap-2 text-xs', readinessGaps.critical_gaps.includes(gap) ? 'text-red-400' : 'text-[#A7A29A]')}>
                  {readinessGaps.critical_gaps.includes(gap)
                    ? <AlertCircle size={11} className="flex-shrink-0 mt-0.5" aria-hidden />
                    : <ChevronRight size={11} className="flex-shrink-0 mt-0.5 text-[#737373]" aria-hidden />
                  }
                  {gapToDisplay(gap)}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-green-400">All investor readiness checks passed.</div>
          )}
        </div>
      )}

      {/* Network leverage alerts */}
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[#737373]" aria-hidden />
            <span className="text-sm font-medium text-[#E8E6E3]">Network Leverage Alerts</span>
          </div>
          {alerts.length > 0 && (
            <span className="text-xs text-[#737373]">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        {alerts.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-[#737373]">
            No network alerts. Add contacts, edges, and board candidates to activate intelligence.
          </div>
        ) : (
          <div>
            {alerts.map((alert, i) => (
              <AlertRow key={`${alert.type}-${i}`} alert={alert} />
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Board seats', href: '/board', icon: Briefcase },
          { label: 'Relationships', href: '/relationships', icon: Users },
          { label: 'Investors', href: '/capital-raising/investors', icon: TrendingUp },
          { label: 'Documents', href: '/documents', icon: ArrowUpRight },
        ].map(({ label, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#141414] border border-[#2A2A2E] rounded-md text-xs text-[#A7A29A] hover:text-[#E8E6E3] hover:border-[#3A3A3E] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Icon size={12} aria-hidden className="text-[#737373]" />
              {label}
            </div>
            <ChevronRight size={11} aria-hidden />
          </a>
        ))}
      </div>
    </div>
  );
}
