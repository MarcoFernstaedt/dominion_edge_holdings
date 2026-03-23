'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';

// Three.js requires browser APIs — never run on the server.
const SplashCrest3D = dynamic(() => import('./SplashCrest3D'), { ssr: false });

type Phase = 'hold' | 'exit' | 'gone';

// 3D shield animation is ~2.8s; hold at least that long.
const MIN_HOLD_MS = 2900;
// Exit fade duration
const EXIT_MS = 540;
// Hard cap — dismiss regardless of data state
const SAFETY_MS = 6000;

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('hold');
  const dataReady = useAppStore((s) => s.dataReady);
  const minHoldReached = useRef(false);
  const dataReadyRef   = useRef(false);
  const reducedMotion  = useRef(false);

  useEffect(() => { dataReadyRef.current = dataReady; }, [dataReady]);

  function tryExit() {
    if (minHoldReached.current && dataReadyRef.current) {
      setPhase('exit');
      setTimeout(() => setPhase('gone'), EXIT_MS);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      reducedMotion.current = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
    }

    // Reduced-motion path — short hold, no animation
    if (reducedMotion.current) {
      const t = setTimeout(() => {
        setPhase('exit');
        setTimeout(() => setPhase('gone'), 200);
      }, 600);
      return () => clearTimeout(t);
    }

    // Normal path — allow exit only after MIN_HOLD_MS
    const t2 = setTimeout(() => {
      minHoldReached.current = true;
      tryExit();
    }, MIN_HOLD_MS);

    // Safety valve
    const t3 = setTimeout(() => {
      minHoldReached.current = true;
      dataReadyRef.current   = true;
      setPhase('exit');
      setTimeout(() => setPhase('gone'), EXIT_MS);
    }, SAFETY_MS);

    return () => { clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (dataReady) tryExit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  if (phase === 'gone') return null;

  const isExiting = phase === 'exit';
  const rm = reducedMotion.current;

  /* ── Container — full screen, fades on exit ── */
  const containerStyle: React.CSSProperties = {
    position:       'fixed',
    inset:          0,
    zIndex:         9999,
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    pointerEvents:  isExiting ? 'none' : 'auto',
    backgroundImage:
      'radial-gradient(ellipse 80% 65% at 50% 42%, #121212 0%, #060606 100%)',
    transition: isExiting
      ? `opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`
      : undefined,
    opacity: isExiting ? 0 : 1,
  };

  /* ── Crest wrapper — slight scale on exit; no overflow:hidden (3D canvas needs room) ── */
  const crestWrapStyle: React.CSSProperties = {
    position:   'relative',
    transition: isExiting
      ? `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${EXIT_MS}ms ease`
      : undefined,
    transform: isExiting ? 'scale(1.03)' : 'scale(1)',
    opacity:   isExiting ? 0 : 1,
  };

  return (
    <>
      <style>{`
        /* ── Wordmark letter-spacing settle (starts at ~2.1s — after 3D shield rises) ── */
        @keyframes deh-wordmark {
          from { opacity: 0; letter-spacing: 0.52em; }
          to   { opacity: 1; letter-spacing: 0.40em; }
        }
        .deh-wordmark {
          animation: deh-wordmark 0.9s cubic-bezier(0.16, 1, 0.3, 1) 2.1s both;
        }

        /* ── Hairline rule reveal ── */
        @keyframes deh-rule-in {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .deh-rule {
          animation: deh-rule-in 1.0s cubic-bezier(0.16, 1, 0.3, 1) 2.0s both;
          transform-origin: center;
        }

        /* ── Sub-tagline fade ── */
        @keyframes deh-sub {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .deh-sub {
          animation: deh-sub 0.7s ease 2.35s both;
        }

        /* ── Reduced-motion overrides ── */
        @media (prefers-reduced-motion: reduce) {
          .deh-wordmark,
          .deh-rule,
          .deh-sub {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            letter-spacing: 0.40em !important;
          }
        }
      `}</style>

      <div style={containerStyle} role="status" aria-label="Loading Dominion Edge Holdings">

        {/* ── 3D Metallic Shield ── */}
        <div style={crestWrapStyle}>
          <SplashCrest3D
            size={220}
            reducedMotion={rm}
          />
        </div>

        {/* ── Hairline rule ── */}
        <div
          className="deh-rule"
          aria-hidden="true"
          style={{
            marginTop:  8,
            width:      52,
            height:     1,
            background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.55), transparent)',
          }}
        />

        {/* ── Wordmark ── */}
        <div
          className="deh-wordmark"
          style={{
            marginTop:     10,
            fontFamily:    "'Cormorant Garamond', Georgia, serif",
            fontSize:      13,
            fontWeight:    600,
            letterSpacing: '0.40em',
            color:         '#C9A227',
            textTransform: 'uppercase',
            userSelect:    'none',
            textRendering: 'optimizeLegibility',
          }}
        >
          Dominion Edge Holdings
        </div>

        {/* ── Sub-tagline ── */}
        <div
          className="deh-sub"
          style={{
            marginTop:     8,
            fontFamily:    "'Inter', system-ui, sans-serif",
            fontSize:      8,
            fontWeight:    400,
            letterSpacing: '0.54em',
            color:         '#4a4a4a',
            textTransform: 'uppercase',
            userSelect:    'none',
          }}
        >
          Acquisition OS
        </div>
      </div>
    </>
  );
}
