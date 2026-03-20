'use client';

/**
 * ConversationKPIWidget
 *
 * Reusable dashboard widget displaying the three critical acquisition
 * conversation KPIs: Seller / Board / Investor, with progress bars,
 * target comparisons, and pipeline health alerts.
 *
 * Usage:
 *   <ConversationKPIWidget />            — self-loading
 *   <ConversationKPIWidget kpi={data} /> — pre-loaded data
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { conversationsApi } from '@/lib/api';
import {
  Building2,
  Briefcase,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import type {
  ConversationKPIResult,
  ConversationKPIItem,
  ConversationPipelineAlert,
  ConversationEntityType,
} from '@/lib/types';

// ─── Display config per entity type ──────────────────────────────────────────

const ENTITY_CONFIG: Record<ConversationEntityType, {
  label: string;
  Icon: React.ElementType;
  barColor: string;
  badgeOk: string;
  badgeWarn: string;
  badgeCrit: string;
}> = {
  seller: {
    label:     'Seller Conversations',
    Icon:      Building2,
    barColor:  '#38bdf8',  // sky-400
    badgeOk:   'border-emerald-700/40 bg-emerald-900/20 text-emerald-400',
    badgeWarn: 'border-[#C9A22740]   bg-[#C9A22720]   text-[#C9A227]',
    badgeCrit: 'border-red-700/40     bg-red-900/20     text-red-400',
  },
  board_member: {
    label:     'Board Conversations',
    Icon:      Briefcase,
    barColor:  '#a78bfa',  // violet-400
    badgeOk:   'border-emerald-700/40 bg-emerald-900/20 text-emerald-400',
    badgeWarn: 'border-[#C9A22740]   bg-[#C9A22720]   text-[#C9A227]',
    badgeCrit: 'border-red-700/40     bg-red-900/20     text-red-400',
  },
  investor: {
    label:     'Investor Conversations',
    Icon:      TrendingUp,
    barColor:  '#C9A227',
    badgeOk:   'border-emerald-700/40 bg-emerald-900/20 text-emerald-400',
    badgeWarn: 'border-[#C9A22740]   bg-[#C9A22720]   text-[#C9A227]',
    badgeCrit: 'border-red-700/40     bg-red-900/20     text-red-400',
  },
};

// ─── KPI Row ──────────────────────────────────────────────────────────────────

function KPIRow({ item }: { item: ConversationKPIItem }) {
  const cfg = ENTITY_CONFIG[item.entityType];
  const Icon = cfg.Icon;

  const badgeClass =
    item.status === 'on_target'    ? cfg.badgeOk   :
    item.status === 'at_risk'      ? cfg.badgeWarn :
                                     cfg.badgeCrit;

  const statusLabel =
    item.status === 'on_target'    ? 'On target' :
    item.status === 'at_risk'      ? 'At risk'   :
                                     'Below target';

  return (
    <div className="space-y-1.5" role="group" aria-label={cfg.label}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={13} className="text-[var(--color-text-muted)]" aria-hidden />
          <span className="text-xs text-[var(--color-text-primary)] font-medium">{cfg.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded border ${badgeClass}`}
            aria-label={`${item.count} of ${item.target} — ${statusLabel}`}
          >
            {item.count} / {item.target}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>
      <div
        className="h-1.5 bg-[#2a2a2e] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={item.count}
        aria-valuemin={0}
        aria-valuemax={item.target}
        aria-label={`${cfg.label}: ${item.pct}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${item.pct}%`,
            background: item.status === 'on_target' ? '#10b981'
              : item.status === 'at_risk' ? '#f59e0b'
              : '#ef4444',
          }}
        />
      </div>
    </div>
  );
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: ConversationPipelineAlert }) {
  return (
    <div
      className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
        alert.severity === 'critical'
          ? 'bg-red-900/15 border-red-700/30 text-red-400'
          : 'bg-[#C9A22720]/15 border-[#C9A22730] text-[#C9A227]'
      }`}
      role="alert"
      aria-label={alert.title}
    >
      <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
      <div>
        <span className="font-semibold">{alert.title}</span>
        {' — '}
        <span className="opacity-80">{alert.action}</span>
      </div>
    </div>
  );
}

// ─── Widget ───────────────────────────────────────────────────────────────────

interface Props {
  /** Pre-loaded KPI data. If omitted, the widget loads it autonomously. */
  kpi?: ConversationKPIResult;
  alerts?: ConversationPipelineAlert[];
  /** Show the "View all" link to /conversations. Default true. */
  showLink?: boolean;
}

export function ConversationKPIWidget({ kpi: propKPI, alerts: propAlerts, showLink = true }: Props) {
  const [kpi,     setKPI]     = useState<ConversationKPIResult | null>(propKPI ?? null);
  const [alerts,  setAlerts]  = useState<ConversationPipelineAlert[]>(propAlerts ?? []);
  const [loading, setLoading] = useState(!propKPI);

  useEffect(() => {
    if (propKPI) return; // controlled by parent
    let cancelled = false;
    const load = async () => {
      try {
        const [kpiRes, healthRes] = await Promise.all([
          conversationsApi.getKPI(),
          conversationsApi.getPipelineHealth(),
        ]);
        if (!cancelled) {
          setKPI(kpiRes);
          setAlerts(healthRes.alerts);
        }
      } catch { /* silent — widget degrades gracefully */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [propKPI]);

  const overallOk = kpi?.overallStatus === 'on_target';

  return (
    <section
      aria-label="Relationship Conversations KPI"
      className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          {overallOk
            ? <CheckCircle2 size={14} className="text-emerald-400" aria-hidden />
            : <AlertTriangle size={14} className="text-[#C9A227]" aria-hidden />}
          Conversation KPIs
          <span className="text-[10px] font-normal text-[var(--color-text-muted)]">this week</span>
        </h2>
        {showLink && (
          <Link
            href="/conversations"
            className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[#C9A227] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
            aria-label="View all conversations"
          >
            View all <ArrowUpRight size={10} aria-hidden />
          </Link>
        )}
      </div>

      {/* KPI rows */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <RefreshCw size={12} className="animate-spin" aria-hidden /> Loading…
        </div>
      ) : !kpi ? (
        <p className="text-xs text-[var(--color-text-muted)]">No data available.</p>
      ) : (
        <div className="space-y-3">
          {kpi.items.map((item) => (
            <KPIRow key={item.entityType} item={item} />
          ))}
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-[var(--color-border)]">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </div>
      )}
    </section>
  );
}

export default ConversationKPIWidget;
