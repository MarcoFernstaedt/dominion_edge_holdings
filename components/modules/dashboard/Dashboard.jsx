'use client';

import { useApp } from '@/lib/context/AppContext';
import AffirmationCard from './AffirmationCard';
import StatCard from './StatCard';
import PhaseGrid from './PhaseGrid';
import SectionHeader from '@/components/ui/SectionHeader';

export default function Dashboard() {
  const { overallProgress, completedItems, totalItems, boardSeatsCommitted, activePhase, deals } = useApp();

  const activeDeals = deals.filter(d => !['Closed', 'Dead'].includes(d.stage)).length;
  const closedDeals = deals.filter(d => d.stage === 'Closed').length;

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: 0 }}>
          Dominion Edge Holdings
        </h1>
        <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
          QLA Acquisition Platform · Phoenix, AZ
        </div>
      </div>

      <AffirmationCard />

      <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <StatCard label="OVERALL PROGRESS" value={`${overallProgress}%`} sub={`${completedItems}/${totalItems} steps completed`} />
        <StatCard label="ACTIVE PHASE" value={activePhase} sub="Current focus area" color="#E8E0D0" />
        <StatCard label="BOARD SEATS" value={`${boardSeatsCommitted}/6`} sub="Committed members" color="#5A8DB5" />
        <StatCard label="ACTIVE DEALS" value={activeDeals} sub={`${closedDeals} closed`} color="#4CAF50" />
      </div>

      <SectionHeader>Phase Progress</SectionHeader>
      <PhaseGrid />
    </div>
  );
}
