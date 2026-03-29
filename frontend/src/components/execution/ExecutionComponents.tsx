'use client';

/**
 * Shared UI components for the QLA Execution Tracker module.
 */

import type { ExecutionAlert, MomentumRiskLevel } from '@/lib/types';

// ─── ExecutionProgressBar ────────────────────────────────────────────────────

interface ProgressBarProps {
  label: string;
  actual: number;
  target: number;
  unit?: string;
  color?: string;
}

export function ExecutionProgressBar({ label, actual, target, unit = '', color }: ProgressBarProps) {
  const pct     = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const met     = actual >= target;
  const barColor = color || (met ? '#3FA66B' : pct >= 60 ? '#D9A441' : '#C35B5B');

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-sm">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className={`font-semibold ${met ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}`}>
          {actual.toLocaleString()}{unit} / {target.toLocaleString()}{unit}
        </span>
      </div>
      <div className="h-2 bg-[var(--color-bg)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <div className="text-xs text-[var(--color-text-muted)] text-right">{pct.toFixed(0)}%</div>
    </div>
  );
}

// ─── ExecutionMetricCard ─────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: number | string;
  target?: number;
  sublabel?: string;
  accent?: boolean;
}

export function ExecutionMetricCard({ label, value, target, sublabel, accent }: MetricCardProps) {
  const num     = typeof value === 'number' ? value : null;
  const met     = num !== null && target !== undefined ? num >= target : false;

  return (
    <div className={`bg-[var(--color-surface)] border rounded-xl p-4 ${accent ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
      <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${met ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {target !== undefined && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Target: {target.toLocaleString()}</p>
      )}
      {sublabel && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// ─── PipelineFunnel ──────────────────────────────────────────────────────────

interface FunnelStage {
  label: string;
  actual: number;
  target: number;
}

export function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.target), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, i) => {
        const targetWidth = (stage.target / max) * 100;
        const actualWidth = Math.min((stage.actual / Math.max(stage.target, 1)) * 100, 100);
        const met = stage.actual >= stage.target;

        return (
          <div key={i} className="space-y-1">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[var(--color-text-muted)] w-44 truncate">{stage.label}</span>
              <span className={`font-semibold text-sm ${met ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}`}>
                {stage.actual.toLocaleString()} <span className="text-[var(--color-text-muted)] font-normal">/ {stage.target.toLocaleString()}</span>
              </span>
            </div>
            {/* Target bar (background) */}
            <div
              className="relative h-6 bg-[var(--color-bg)] rounded overflow-hidden"
              style={{ width: `${targetWidth}%` }}
            >
              {/* Actual bar */}
              <div
                className="absolute inset-y-0 left-0 rounded transition-all duration-500"
                style={{
                  width: `${actualWidth}%`,
                  backgroundColor: met ? '#3FA66B' : actualWidth >= 60 ? '#D9A441' : '#4D7EA8',
                }}
              />
              <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium">
                {Math.round(actualWidth)}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AlertBanner ─────────────────────────────────────────────────────────────

export function AlertBanner({ alerts }: { alerts: ExecutionAlert[] }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
            alert.level === 'critical'
              ? 'bg-red-950/40 border border-red-800/50 text-red-300'
              : 'bg-[#C9A22715] border border-[#C9A22740] text-[#C9A227]'
          }`}
        >
          <span className="shrink-0">{alert.level === 'critical' ? '🚨' : '⚠️'}</span>
          {alert.message}
        </div>
      ))}
    </div>
  );
}

// ─── RiskBadge ───────────────────────────────────────────────────────────────

const RISK_STYLES: Record<MomentumRiskLevel, string> = {
  healthy: 'bg-emerald-900/60 text-emerald-300',
  warming: 'bg-[#C9A22720]/60 text-[#C9A227]',
  cooling: 'bg-orange-900/60 text-orange-300',
  stalled: 'bg-red-900/60 text-red-300',
};

const RISK_LABELS: Record<MomentumRiskLevel, string> = {
  healthy: 'Healthy',
  warming: 'Warming',
  cooling: 'Cooling',
  stalled: 'Stalled',
};

export function RiskBadge({ level }: { level: MomentumRiskLevel }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_STYLES[level]}`}>
      {RISK_LABELS[level]}
    </span>
  );
}

// ─── MomentumScoreRing ────────────────────────────────────────────────────────

export function MomentumScoreRing({ score }: { score: number }) {
  const color =
    score >= 75 ? '#3FA66B' :
    score >= 50 ? '#D9A441' :
    score >= 25 ? '#D97B4D' :
    '#C35B5B';

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--color-bg)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeDasharray={`${(score / 100) * 125.7} 125.7`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── ExecutionSummaryPanel ────────────────────────────────────────────────────

interface SummaryPanelProps {
  title: string;
  metrics: { label: string; value: number | string; target?: number }[];
}

export function ExecutionSummaryPanel({ title, metrics }: SummaryPanelProps) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <h3 className="font-medium text-[var(--color-text-primary)] mb-4">{title}</h3>
      <dl className="space-y-3">
        {metrics.map(({ label, value, target }) => (
          <div key={label}>
            <div className="flex justify-between items-center text-sm mb-1">
              <dt className="text-[var(--color-text-muted)]">{label}</dt>
              <dd className={`font-semibold ${target !== undefined && Number(value) >= target ? 'text-emerald-400' : 'text-[var(--color-text-primary)]'}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
                {target !== undefined && (
                  <span className="text-[var(--color-text-muted)] font-normal"> / {target.toLocaleString()}</span>
                )}
              </dd>
            </div>
            {target !== undefined && typeof value === 'number' && (
              <div className="h-1 bg-[var(--color-bg)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((value / target) * 100, 100)}%`,
                    backgroundColor: value >= target ? '#3FA66B' : '#4D7EA8',
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}
