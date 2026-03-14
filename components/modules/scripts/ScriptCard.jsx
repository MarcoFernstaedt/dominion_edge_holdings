'use client';

import { useState } from 'react';

export default function ScriptCard({ script }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(script.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      background: '#111',
      border: '1px solid #1E1E1E',
      borderRadius: 8,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 20 }}>{script.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0' }}>{script.title}</div>
        </div>
        <div style={{ fontSize: 11, color: '#444' }}>{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div style={{ borderTop: '1px solid #1A1A1A', padding: '16px 20px' }}>
          <div style={{
            background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.15)',
            borderRadius: 4, padding: '10px 14px', marginBottom: 14,
            fontSize: 12, color: '#C9A84C', lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 600 }}>Delivery: </span>{script.deliveryNote}
          </div>

          <pre style={{
            whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13,
            color: '#C0B89A', lineHeight: 1.7, margin: '0 0 14px',
          }}>
            {script.text}
          </pre>

          <button
            onClick={copy}
            style={{
              padding: '7px 14px', background: copied ? '#2A4A2A' : '#1A1A1A',
              border: `1px solid ${copied ? '#4CAF5055' : '#2A2A2A'}`,
              color: copied ? '#4CAF50' : '#666', borderRadius: 4, cursor: 'pointer', fontSize: 12,
            }}
          >
            {copied ? '✓ Copied' : 'Copy Script'}
          </button>
        </div>
      )}
    </div>
  );
}
