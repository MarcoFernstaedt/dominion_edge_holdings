'use client';

import { useState, useEffect } from 'react';
import { AFFIRMATIONS } from '@/lib/data/checklist';

export default function AffirmationCard() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % AFFIRMATIONS.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(201,168,76,0.08) 0%, rgba(201,168,76,0.03) 100%)',
      border: '1px solid rgba(201,168,76,0.2)',
      borderRadius: 8,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      <div style={{ fontSize: 10, color: '#C9A84C', letterSpacing: '0.12em', marginBottom: 10 }}>
        DAILY AFFIRMATION
      </div>
      <div style={{ fontSize: 15, color: '#E8E0D0', lineHeight: 1.6, fontStyle: 'italic' }}>
        "{AFFIRMATIONS[idx]}"
      </div>
      <div style={{ display: 'flex', gap: 4, marginTop: 12 }}>
        {AFFIRMATIONS.map((_, i) => (
          <div
            key={i}
            onClick={() => setIdx(i)}
            style={{
              width: 6, height: 6, borderRadius: '50%', cursor: 'pointer',
              background: i === idx ? '#C9A84C' : '#2A2A2A',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
    </div>
  );
}
