'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { capitalRaisingApi } from '@/lib/api';
import { Users, Layers, FileText, MessageSquare, Presentation, TrendingUp } from 'lucide-react';

interface DashboardData {
  pipeline: {
    identified: number;
    contacted: number;
    conversations: number;
    meetings: number;
    commitments: number;
  };
  capital: {
    purchasePrice: number;
    equityRequired: number;
    equityCommitted: number;
    equityRemaining: number;
  };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const NAV_TILES = [
  {
    href: '/capital-raising/investors',
    icon: Users,
    title: 'Investor CRM',
    description: 'Track relationships, check sizes, and investor pipeline',
  },
  {
    href: '/capital-raising/capital-stack',
    icon: Layers,
    title: 'Capital Stack',
    description: 'Build acquisition financing structures',
  },
  {
    href: '/capital-raising/memos',
    icon: FileText,
    title: 'Investor Memos',
    description: 'Generate structured deal summaries',
  },
  {
    href: '/capital-raising/messaging',
    icon: MessageSquare,
    title: 'Mission & Thesis',
    description: 'Define your firm mission and investment thesis',
  },
  {
    href: '/capital-raising/pitch-deck',
    icon: Presentation,
    title: 'Pitch Deck',
    description: 'Generate investor pitch deck outlines',
  },
];

export default function CapitalRaisingPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await capitalRaisingApi.getDashboard();
      setData(result as DashboardData);
    } catch {
      // dashboard unavailable — show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const pipeline = data?.pipeline;
  const capital  = data?.capital;

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Capital Raising</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Investor pipeline, capital stack, and deal communication tools
        </p>
      </div>

      {/* Dashboard panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Investor Pipeline */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="font-medium text-[var(--color-text-primary)]">Investor Pipeline</h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <dl className="space-y-2">
              {[
                ['Investors identified', pipeline?.identified ?? 0],
                ['Investors contacted',  pipeline?.contacted  ?? 0],
                ['Active conversations', pipeline?.conversations ?? 0],
                ['Meetings held',        pipeline?.meetings   ?? 0],
                ['Committed investors',  pipeline?.commitments ?? 0],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between items-center text-sm">
                  <dt className="text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="font-semibold text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Capital Stack Tracker */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="font-medium text-[var(--color-text-primary)]">Capital Stack Tracker</h2>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
          ) : (
            <dl className="space-y-2">
              {[
                ['Purchase price',   fmt(capital?.purchasePrice  ?? 0)],
                ['Equity required',  fmt(capital?.equityRequired ?? 0)],
                ['Equity committed', fmt(capital?.equityCommitted ?? 0)],
                ['Equity remaining', fmt(capital?.equityRemaining ?? 0)],
              ].map(([label, value]) => (
                <div key={label as string} className="flex justify-between items-center text-sm">
                  <dt className="text-[var(--color-text-muted)]">{label}</dt>
                  <dd className="font-semibold text-[var(--color-text-primary)]">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* Navigation tiles */}
      <div>
        <h2 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
          Tools
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NAV_TILES.map(({ href, icon: Icon, title, description }) => (
            <Link
              key={href}
              href={href}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-accent)] transition-colors group"
            >
              <Icon className="w-5 h-5 text-[var(--color-accent)] mb-3" />
              <h3 className="font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                {title}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
