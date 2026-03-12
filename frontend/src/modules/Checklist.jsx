import { useState } from 'react';
import { PHASES } from '../data/checklistData';

const st = {
  page: { padding: '28px 32px', maxWidth: 900, margin: '0 auto', color: '#E8E0D0' },
  title: { fontSize: 22, fontWeight: 700, color: '#E8E0D0', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#555', marginBottom: 28 },
  phaseBlock: { marginBottom: 12 },
  phaseHeader: (open, color) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#111', border: '1px solid #1E1E1E', borderLeft: `3px solid ${color}`,
    borderRadius: open ? '6px 6px 0 0' : 6, padding: '12px 16px', cursor: 'pointer',
    transition: 'border-color 0.15s',
  }),
  phaseTitle: { fontSize: 14, fontWeight: 600, color: '#E8E0D0' },
  phaseStats: { display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#666' },
  phasePct: (color) => ({ color, fontWeight: 700 }),
  phaseBody: { background: '#0F0F0F', border: '1px solid #1E1E1E', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '8px 0' },
  item: (done) => ({
    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px',
    cursor: 'pointer', opacity: done ? 0.4 : 1, transition: 'opacity 0.2s, background 0.15s',
    borderBottom: '1px solid #141414',
  }),
  checkbox: (done, color) => ({
    width: 16, height: 16, borderRadius: 3, border: `1px solid ${done ? color : '#333'}`,
    background: done ? color : 'transparent', flexShrink: 0, marginTop: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#000',
  }),
  itemText: { fontSize: 13, color: '#CCC', lineHeight: 1.5 },
  progressBar: (pct, color) => ({
    display: 'inline-block', width: `${pct}%`, height: 3, background: color,
    borderRadius: 2, marginLeft: 8, verticalAlign: 'middle', transition: 'width 0.3s',
  }),
};

export default function Checklist({ checklistState, setChecklistState }) {
  const [openPhases, setOpenPhases] = useState(() => {
    const open = {};
    PHASES.forEach((p, i) => { open[p.id] = i === 0; });
    return open;
  });

  const toggle = (id) => setChecklistState(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePhase = (id) => setOpenPhases(prev => ({ ...prev, [id]: !prev[id] }));

  const totalDone = Object.values(checklistState).filter(Boolean).length;
  const totalAll = Object.keys(checklistState).length;

  return (
    <div style={st.page}>
      <div style={st.title}>QLA Checklist</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <span style={{ fontSize: 13, color: '#555' }}>Complete start-to-exit roadmap — {totalDone} of {totalAll} steps done</span>
        <div style={{ flex: 1, background: '#1A1A1A', borderRadius: 4, height: 4, maxWidth: 200 }}>
          <div style={{ width: `${Math.round(totalDone / totalAll * 100)}%`, height: '100%', background: '#C9A84C', borderRadius: 4, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#C9A84C' }}>{Math.round(totalDone / totalAll * 100)}%</span>
      </div>

      {PHASES.map((phase) => {
        const total = phase.items.length;
        const done = phase.items.filter(i => checklistState[i.id]).length;
        const pct = Math.round((done / total) * 100);
        const open = openPhases[phase.id];

        return (
          <div key={phase.id} style={st.phaseBlock}>
            <div
              style={st.phaseHeader(open, phase.color)}
              onClick={() => togglePhase(phase.id)}
              onMouseEnter={e => { e.currentTarget.style.background = '#161616'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#111'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={st.phaseTitle}>{phase.name}</span>
                <span style={{ display: 'inline-block', width: 80, height: 3, background: '#1A1A1A', borderRadius: 2, overflow: 'hidden' }}>
                  <span style={st.progressBar(pct, phase.color)} />
                </span>
              </div>
              <div style={st.phaseStats}>
                <span style={st.phasePct(phase.color)}>{pct}%</span>
                <span>{done}/{total}</span>
                <span style={{ fontSize: 10, color: '#444' }}>{open ? '▲' : '▼'}</span>
              </div>
            </div>

            {open && (
              <div style={st.phaseBody}>
                {phase.items.map((item, idx) => {
                  const done = checklistState[item.id] ?? item.done;
                  return (
                    <div
                      key={item.id}
                      style={{ ...st.item(done), background: 'transparent' }}
                      onClick={() => toggle(item.id)}
                      onMouseEnter={e => { e.currentTarget.style.background = '#131313'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={st.checkbox(done, phase.color)}>
                        {done && '✓'}
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: '#444', marginRight: 8 }}>{idx + 1}.</span>
                        <span style={{ fontSize: 13, color: done ? '#555' : '#CCC', lineHeight: 1.5, textDecoration: done ? 'line-through' : 'none' }}>
                          {item.text}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
