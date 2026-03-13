import { useState } from 'react';
import { SCRIPTS } from '../data/checklistData';

export default function Scripts() {
  const [copied, setCopied] = useState(null);
  const [open, setOpen] = useState(null);

  const copy = (id, text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 860, margin: '0 auto', color: '#E8E0D0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Scripts</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 28 }}>Word-for-word scripts for every outreach scenario. Memorize. Personalize. Execute.</div>

      <div style={{ display: 'grid', gap: 12 }}>
        {SCRIPTS.map(script => {
          const isOpen = open === script.id;
          return (
            <div key={script.id} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, overflow: 'hidden' }}>
              <div
                style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isOpen ? '#141414' : '#111' }}
                onClick={() => setOpen(isOpen ? null : script.id)}
                onMouseEnter={e => { e.currentTarget.style.background = '#141414'; }}
                onMouseLeave={e => { e.currentTarget.style.background = isOpen ? '#141414' : '#111'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 18 }}>{script.icon}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0' }}>{script.title}</span>
                </div>
                <span style={{ fontSize: 11, color: '#555' }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {isOpen && (
                <div style={{ padding: '0 20px 20px', borderTop: '1px solid #1A1A1A' }}>
                  {/* Script text */}
                  <div style={{ position: 'relative', margin: '16px 0' }}>
                    <pre style={{
                      background: '#0A0A0A', border: '1px solid #1E1E1E', borderRadius: 6,
                      padding: '16px 20px', fontSize: 13, color: '#CCC', lineHeight: 1.8,
                      whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit',
                    }}>
                      {script.text}
                    </pre>
                    <button
                      onClick={() => copy(script.id, script.text)}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        background: copied === script.id ? '#1A3A1A' : '#1A1A1A',
                        border: `1px solid ${copied === script.id ? '#4CAF50' : '#333'}`,
                        color: copied === script.id ? '#4CAF50' : '#888',
                        padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 11,
                      }}
                    >
                      {copied === script.id ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Delivery note */}
                  <div style={{ background: '#0D0D0D', border: '1px solid #C9A84C33', borderLeft: '3px solid #C9A84C', borderRadius: 4, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#C9A84C', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Delivery Note</div>
                    <div style={{ fontSize: 12, color: '#AAA', lineHeight: 1.6 }}>{script.deliveryNote}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
