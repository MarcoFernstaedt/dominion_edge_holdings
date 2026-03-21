'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';

type Phase = 'enter' | 'hold' | 'exit' | 'gone';

// Minimum time (ms) to hold the splash before allowing exit
const MIN_HOLD_MS = 2400;

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('enter');
  const dataReady = useAppStore((s) => s.dataReady);
  const minHoldReached = useRef(false);
  const dataReadyRef = useRef(false);

  // Track refs so the setTimeout callbacks always read current values
  useEffect(() => { dataReadyRef.current = dataReady; }, [dataReady]);

  function tryExit() {
    if (minHoldReached.current && dataReadyRef.current) {
      setPhase('exit');
      setTimeout(() => setPhase('gone'), 800);
    }
  }

  useEffect(() => {
    // Show once per browser session
    if (sessionStorage.getItem('deh_splash_shown')) {
      setPhase('gone');
      return;
    }
    sessionStorage.setItem('deh_splash_shown', '1');

    const t1 = setTimeout(() => setPhase('hold'), 500);

    // After minimum hold, attempt exit (will also need dataReady)
    const t2 = setTimeout(() => {
      minHoldReached.current = true;
      tryExit();
    }, MIN_HOLD_MS);

    // Safety valve — exit after 5s regardless of data state
    const t3 = setTimeout(() => {
      minHoldReached.current = true;
      dataReadyRef.current = true;
      setPhase('exit');
      setTimeout(() => setPhase('gone'), 800);
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When dataReady flips to true, try to exit (min hold may already be reached)
  useEffect(() => {
    if (dataReady) tryExit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  if (phase === 'gone') return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: '#0A0A0A',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    transition: phase === 'exit' ? 'opacity 800ms cubic-bezier(0.4,0,1,1)' : 'opacity 500ms ease',
    opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
    pointerEvents: phase === 'exit' ? 'none' : 'auto',
  };

  const logoStyle: React.CSSProperties = {
    transition: phase === 'exit'
      ? 'transform 800ms cubic-bezier(0.4, 0, 1, 1), opacity 800ms ease'
      : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease',
    transform: phase === 'enter' ? 'scale(0.93)' : phase === 'exit' ? 'scale(1.04)' : 'scale(1)',
    opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
  };

  return (
    <>
      <style>{`
        @keyframes deh-rule-in {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .deh-rule {
          animation: deh-rule-in 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both;
          transform-origin: center;
        }
        @keyframes deh-wordmark-in {
          from { opacity: 0; letter-spacing: 0.55em; }
          to   { opacity: 1; letter-spacing: 0.38em; }
        }
        .deh-wordmark {
          animation: deh-wordmark-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.55s both;
        }
        @keyframes deh-submark-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .deh-submark {
          animation: deh-submark-in 0.6s ease 1s both;
        }
      `}</style>

      <div style={containerStyle}>
        {/* Crest logo */}
        <div style={logoStyle}>
          <svg
            width="170"
            height="204"
            viewBox="0 0 200 240"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Dominion Edge Holdings crest"
          >
            <defs>
              {/* Metallic gold — vertical sweep so it looks stamped */}
              <linearGradient id="spl-gold-v" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#EDD26A" />
                <stop offset="30%"  stopColor="#C9A227" />
                <stop offset="65%"  stopColor="#A8841A" />
                <stop offset="100%" stopColor="#C9A227" />
              </linearGradient>
              {/* Slightly warmer diagonal for shield stroke */}
              <linearGradient id="spl-gold-d" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#EDD26A" />
                <stop offset="50%"  stopColor="#C9A227" />
                <stop offset="100%" stopColor="#8B6914" />
              </linearGradient>
              {/* Shield inner shadow/depth */}
              <radialGradient id="spl-shield-bg" cx="50%" cy="40%" r="65%">
                <stop offset="0%"   stopColor="#141414" />
                <stop offset="100%" stopColor="#080808" />
              </radialGradient>
            </defs>

            {/* ── Shield body ─────────────────────────────── */}
            {/* Outer fill */}
            <path
              d="M 20 24 L 180 24 L 180 154 L 100 228 L 20 154 Z"
              fill="url(#spl-shield-bg)"
            />
            {/* Outer gold border */}
            <path
              d="M 20 24 L 180 24 L 180 154 L 100 228 L 20 154 Z"
              fill="none"
              stroke="url(#spl-gold-d)"
              strokeWidth="1.8"
            />
            {/* Inner inset border */}
            <path
              d="M 33 37 L 167 37 L 167 151 L 100 214 L 33 151 Z"
              fill="none"
              stroke="url(#spl-gold-v)"
              strokeWidth="0.7"
              opacity="0.45"
            />

            {/* ── Decorative top rule ─────────────────────── */}
            <line
              x1="52" y1="56"
              x2="148" y2="56"
              stroke="url(#spl-gold-d)"
              strokeWidth="0.6"
              opacity="0.55"
            />

            {/* ── Monogram: interlocked D + E ─────────────── */}
            {/*
              The two letters share a single center vertical spine.
              D (mirrored, opens LEFT)  — occupies left half
              E (normal, opens RIGHT)   — occupies right half
              Spine belongs to both.
            */}

            {/* Shared spine */}
            <rect x="92" y="82" width="14" height="88" fill="url(#spl-gold-v)" />

            {/* — D: opens left ——————————————————————————— */}
            {/* Top cap: runs from spine left to the curve start */}
            <rect x="46" y="82" width="46" height="10" fill="url(#spl-gold-v)" />
            {/* Bottom cap */}
            <rect x="46" y="160" width="46" height="10" fill="url(#spl-gold-v)" />
            {/* Outer curve (filled closed shape) */}
            <path
              d="M 46 82
                 Q 20 82 20 127
                 Q 20 170 46 170
                 L 46 160
                 Q 30 160 30 127
                 Q 30 92 46 92
                 Z"
              fill="url(#spl-gold-v)"
            />

            {/* — E: opens right ——————————————————————————— */}
            {/* Top bar */}
            <rect x="106" y="82"  width="48" height="10" fill="url(#spl-gold-v)" />
            {/* Middle bar (slightly shorter — classic E proportion) */}
            <rect x="106" y="121" width="37" height="10" fill="url(#spl-gold-v)" />
            {/* Bottom bar */}
            <rect x="106" y="160" width="48" height="10" fill="url(#spl-gold-v)" />

            {/* ── Decorative bottom rule ──────────────────── */}
            <line
              x1="62" y1="190"
              x2="138" y2="190"
              stroke="url(#spl-gold-d)"
              strokeWidth="0.5"
              opacity="0.38"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          className="deh-wordmark"
          style={{
            marginTop: 26,
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.38em',
            color: '#C9A227',
            textTransform: 'uppercase',
          }}
        >
          Dominion Edge Holdings
        </div>

        {/* Sub-tagline */}
        <div
          className="deh-submark"
          style={{
            marginTop: 8,
            fontFamily: "'Inter', sans-serif",
            fontSize: 8.5,
            fontWeight: 400,
            letterSpacing: '0.52em',
            color: '#404040',
            textTransform: 'uppercase',
          }}
        >
          Acquisition OS
        </div>

        {/* Hairline rule below wordmark */}
        <div
          className="deh-rule"
          style={{
            marginTop: 18,
            width: 52,
            height: 1,
            background: 'linear-gradient(90deg, transparent, #C9A22755, transparent)',
          }}
        />
      </div>
    </>
  );
}
