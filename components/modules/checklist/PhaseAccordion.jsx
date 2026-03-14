'use client';

import { useState } from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { useApp } from '@/lib/context/AppContext';

export default function PhaseAccordion({ phase }) {
  const { checklistState, setChecklistState } = useApp();
  const [open, setOpen] = useState(false);

  const total = phase.items.length;
  const done = phase.items.filter(i => checklistState[i.id]).length;
  const pct = Math.round((done / total) * 100);
  const complete = pct === 100;

  const toggle = id => setChecklistState(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${complete ? phase.color + '44' : '#1E1E1E'}`,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: phase.color, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: complete ? phase.color : '#E8E0D0' }}>
            {phase.name}
          </div>
          <ProgressBar pct={pct} color={phase.color} height={2} />
        </div>
        <div style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>
          {done}/{total}
        </div>
        <div style={{ fontSize: 11, color: '#444', marginLeft: 4 }}>{open ? '▲' : '▼'}</div>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #1A1A1A', padding: '8px 16px 12px' }}>
          {phase.items.map(item => (
            <label key={item.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0',
              cursor: 'pointer', borderBottom: '1px solid #141414',
            }}>
              <input
                type="checkbox"
                checked={!!checklistState[item.id]}
                onChange={() => toggle(item.id)}
                style={{ marginTop: 2, accentColor: phase.color, flexShrink: 0 }}
              />
              <span style={{
                fontSize: 13, color: checklistState[item.id] ? '#555' : '#C0B89A',
                textDecoration: checklistState[item.id] ? 'line-through' : 'none',
                lineHeight: 1.5,
              }}>
                {item.text}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
