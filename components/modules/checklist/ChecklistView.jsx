'use client';

import { useApp } from '@/lib/context/AppContext';
import { PHASES } from '@/lib/data/checklist';
import PhaseAccordion from './PhaseAccordion';
import ProgressBar from '@/components/ui/ProgressBar';

export default function ChecklistView() {
  const { overallProgress, completedItems, totalItems } = useApp();

  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>
          QLA Checklist
        </h1>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>
          Dan Peña's Quantum Leap Acquisition framework
        </div>
        <div style={{
          background: '#111', border: '1px solid #1E1E1E', borderRadius: 8,
          padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>OVERALL PROGRESS</div>
            <ProgressBar pct={overallProgress} height={6} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#C9A84C', whiteSpace: 'nowrap' }}>
            {overallProgress}%
          </div>
          <div style={{ fontSize: 12, color: '#555', whiteSpace: 'nowrap' }}>
            {completedItems}/{totalItems}
          </div>
        </div>
      </div>

      {PHASES.map(phase => <PhaseAccordion key={phase.id} phase={phase} />)}
    </div>
  );
}
