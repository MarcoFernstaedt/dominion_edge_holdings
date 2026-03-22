'use client';

import { useEffect, useState, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import DominionCrest from './DominionCrest';

type Phase = 'enter' | 'hold' | 'exit' | 'gone';

// Minimum ms in 'hold' before allowing exit (after enter completes)
const MIN_HOLD_MS = 1200;
// Enter phase duration
const ENTER_MS = 380;
// Exit transition duration
const EXIT_MS = 520;
// Absolute safety-valve — dismiss regardless of data state
const SAFETY_MS = 4200;

export default function SplashScreen() {
  const [phase, setPhase] = useState<Phase>('enter');
  const dataReady = useAppStore((s) => s.dataReady);
  const minHoldReached = useRef(false);
  const dataReadyRef   = useRef(false);
  const reducedMotion  = useRef(false);

  // Sync dataReady into a ref so setTimeout callbacks can read it
  useEffect(() => { dataReadyRef.current = dataReady; }, [dataReady]);

  function tryExit() {
    if (minHoldReached.current && dataReadyRef.current) {
      setPhase('exit');
      setTimeout(() => setPhase('gone'), EXIT_MS);
    }
  }

  useEffect(() => {
    // Detect reduced-motion preference
    if (typeof window !== 'undefined') {
      reducedMotion.current = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
    }

    // Show once per browser session
    if (sessionStorage.getItem('deh_splash_shown')) {
      setPhase('gone');
      return;
    }
    sessionStorage.setItem('deh_splash_shown', '1');

    // Reduced-motion path — no animation, short hold, quick exit
    if (reducedMotion.current) {
      setPhase('hold');
      const t = setTimeout(() => {
        setPhase('exit');
        setTimeout(() => setPhase('gone'), 200);
      }, 800);
      return () => clearTimeout(t);
    }

    // Normal animated path
    const t1 = setTimeout(() => setPhase('hold'), ENTER_MS);

    const t2 = setTimeout(() => {
      minHoldReached.current = true;
      tryExit();
    }, ENTER_MS + MIN_HOLD_MS);

    // Safety valve
    const t3 = setTimeout(() => {
      minHoldReached.current = true;
      dataReadyRef.current   = true;
      setPhase('exit');
      setTimeout(() => setPhase('gone'), EXIT_MS);
    }, SAFETY_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When store signals data ready, try to exit
  useEffect(() => {
    if (dataReady) tryExit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  if (phase === 'gone') return null;

  const isEntering = phase === 'enter';
  const isExiting  = phase === 'exit';

  /* ── Container styles (JS-driven for enter/exit opacity + scale) ── */
  const containerStyle: React.CSSProperties = {
    position:        'fixed',
    inset:           0,
    zIndex:          9999,
    background:      '#090909',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    pointerEvents:   isExiting ? 'none' : 'auto',
    transition:      isExiting
      ? `opacity ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1)`
      : `opacity ${ENTER_MS}ms ease`,
    opacity:         isEntering || isExiting ? 0 : 1,
    // Subtle noise texture — tasteful depth without visible pattern
    backgroundImage:
      'radial-gradient(ellipse 80% 60% at 50% 40%, #111111 0%, #070707 100%)',
  };

  /* ── Crest wrapper — scale + fade on enter/exit ── */
  const crestWrapStyle: React.CSSProperties = {
    position:   'relative',
    overflow:   'hidden',
    // Small border-radius clips the sweep to the crest bounds
    borderRadius: 2,
    transition:  isExiting
      ? `transform ${EXIT_MS}ms cubic-bezier(0.4, 0, 1, 1),
         opacity   ${EXIT_MS}ms ease`
      : `transform ${ENTER_MS + 120}ms cubic-bezier(0.16, 1, 0.3, 1),
         opacity   ${ENTER_MS + 120}ms ease`,
    transform:   isEntering ? 'scale(0.93)' : isExiting ? 'scale(1.04)' : 'scale(1)',
    opacity:     isEntering || isExiting ? 0 : 1,
  };

  return (
    <>
      {/*
        All animation keyframes are self-contained here.
        Using 'both' fill-mode so they hold their end state after completing.
        Animations only run during 'hold' (component re-renders to this branch after enter).
      */}
      <style>{`
        /* ── Crest border line-draw (stroke-dashoffset trick) ── */
        @keyframes deh-border-draw {
          from { stroke-dashoffset: 900; opacity: 0.2; }
          to   { stroke-dashoffset: 0;   opacity: 1; }
        }
        .deh-shield-path {
          stroke-dasharray: 900;
          stroke-dashoffset: 900;
          animation: deh-border-draw 1.1s cubic-bezier(0.16, 1, 0.3, 1) 0.08s both;
        }

        /* ── Light sweep across the crest ── */
        @keyframes deh-sweep {
          0%   { transform: translateX(-160%) skewX(-12deg); opacity: 0; }
          18%  { opacity: 1; }
          72%  { opacity: 0.6; }
          100% { transform: translateX(160%) skewX(-12deg); opacity: 0; }
        }
        .deh-sweep {
          animation: deh-sweep 0.75s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.72s both;
        }

        /* ── Wordmark letter-spacing settle ── */
        @keyframes deh-wordmark {
          from { opacity: 0; letter-spacing: 0.55em; }
          to   { opacity: 1; letter-spacing: 0.40em; }
        }
        .deh-wordmark {
          animation: deh-wordmark 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.44s both;
        }

        /* ── Horizontal rule reveal ── */
        @keyframes deh-rule-in {
          from { transform: scaleX(0); opacity: 0; }
          to   { transform: scaleX(1); opacity: 1; }
        }
        .deh-rule {
          animation: deh-rule-in 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.7s both;
          transform-origin: center;
        }

        /* ── Sub-tagline fade ── */
        @keyframes deh-sub {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .deh-sub {
          animation: deh-sub 0.6s ease 0.9s both;
        }

        /* ── Reduce motion overrides ── */
        @media (prefers-reduced-motion: reduce) {
          .deh-shield-path,
          .deh-sweep,
          .deh-wordmark,
          .deh-rule,
          .deh-sub {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
            stroke-dashoffset: 0 !important;
            letter-spacing: 0.40em !important;
          }
        }
      `}</style>

      <div style={containerStyle} role="status" aria-label="Loading Dominion Edge Holdings">
        {/* ── Crest ── */}
        <div style={crestWrapStyle}>
          <DominionCrest
            size={158}
            idPrefix="spl"
            style={{ display: 'block' }}
          />

          {/*
            Light sweep overlay — a diagonal gold-tinted gradient bar that
            travels across the crest once after it fades in.
            Clipped by the parent's overflow:hidden.
          */}
          <div
            className="deh-sweep"
            aria-hidden="true"
            style={{
              position:   'absolute',
              inset:      0,
              background: 'linear-gradient(108deg, transparent 28%, rgba(237,214,138,0.09) 50%, transparent 72%)',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* ── Hairline rule (scales in from center) ── */}
        <div
          className="deh-rule"
          aria-hidden="true"
          style={{
            marginTop:  22,
            width:      48,
            height:     1,
            background: 'linear-gradient(90deg, transparent, rgba(201,162,39,0.5), transparent)',
          }}
        />

        {/* ── Wordmark ── */}
        <div
          className="deh-wordmark"
          style={{
            marginTop:   12,
            fontFamily:  "'Cormorant Garamond', Georgia, serif",
            fontSize:    13,
            fontWeight:  600,
            letterSpacing: '0.40em',
            color:       '#C9A227',
            textTransform: 'uppercase',
            userSelect:  'none',
            textRendering: 'optimizeLegibility',
          }}
        >
          Dominion Edge Holdings
        </div>

        {/* ── Sub-tagline ── */}
        <div
          className="deh-sub"
          style={{
            marginTop:   9,
            fontFamily:  "'Inter', system-ui, sans-serif",
            fontSize:    8,
            fontWeight:  400,
            letterSpacing: '0.54em',
            color:       '#525252',
            textTransform: 'uppercase',
            userSelect:  'none',
          }}
        >
          Acquisition OS
        </div>
      </div>
    </>
  );
}
