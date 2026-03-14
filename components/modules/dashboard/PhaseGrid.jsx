'use client';

import ProgressBar from '@/components/ui/ProgressBar';
import { useApp } from '@/lib/context/AppContext';
import { PHASES } from '@/lib/data/checklist';

export default function PhaseGrid() {
  const { checklistState } = useApp();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
      {PHASES.map(phase => {
        const total = phase.items.length;
        const done = phase.items.filter(i => checklistState[i.id]).length;
        const pct = Math.round((done / total) * 100);
        return (
          <div key={phase.id} style={{
            background: '#111',
            border: `1px solid ${pct === 100 ? phase.color + '44' : '#1E1E1E'}`,
            borderRadius: 8,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? phase.color : '#888', marginBottom: 8 }}>
              {phase.name}
            </div>
            <ProgressBar pct={pct} color={phase.color} height={3} />
            <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
              {done}/{total} steps · {pct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
