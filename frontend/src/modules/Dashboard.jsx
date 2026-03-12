import React, { useState } from 'react';
import { PHASES, AFFIRMATIONS } from '../data/checklistData';

export default function Dashboard({
  checklistState,
  overallProgress,
  boardSeatsCommitted,
  activePhase,
  deals,
  setActiveModule,
  boardContacts,
}) {
  const [currentAffirmationIndex, setCurrentAffirmationIndex] = useState(
    () => Math.floor(Math.random() * AFFIRMATIONS.length)
  );

  const handleNextAffirmation = () => {
    setCurrentAffirmationIndex((prev) => (prev + 1) % AFFIRMATIONS.length);
  };

  // Calculate completed / total items across all phases
  const allItems = PHASES.flatMap((phase) => phase.items);
  const totalItems = allItems.length;
  const completedItems = allItems.filter(
    (item) => checklistState[item.id] ?? item.done
  ).length;

  // Per-phase stats
  const phaseStats = PHASES.map((phase) => {
    const total = phase.items.length;
    const completed = phase.items.filter(
      (item) => checklistState[item.id] ?? item.done
    ).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { ...phase, total, completed, pct };
  });

  // Current date string
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Styles ────────────────────────────────────────────────────────────────

  const styles = {
    page: {
      backgroundColor: '#0D0D0D',
      minHeight: '100vh',
      color: '#E8E0D0',
      fontFamily: "'Georgia', serif",
      padding: '0 0 60px 0',
    },
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px',
    },
    header: {
      marginBottom: '32px',
      borderBottom: '1px solid #1F1F1F',
      paddingBottom: '20px',
    },
    headerTitle: {
      fontSize: '32px',
      fontWeight: '700',
      color: '#E8E0D0',
      margin: '0 0 6px 0',
      letterSpacing: '0.02em',
    },
    headerSubtitle: {
      fontSize: '13px',
      color: '#6B6050',
      margin: '0',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    },

    // Affirmation
    affirmationCard: {
      backgroundColor: '#111111',
      border: '1px solid #1F1F1F',
      borderLeft: '4px solid #C9A84C',
      borderRadius: '6px',
      padding: '24px 28px',
      marginBottom: '32px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '20px',
    },
    affirmationLabel: {
      fontSize: '11px',
      color: '#C9A84C',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      marginBottom: '10px',
    },
    affirmationText: {
      fontSize: '19px',
      fontStyle: 'italic',
      color: '#E8E0D0',
      lineHeight: '1.55',
      margin: '0',
    },
    affirmationMeta: {
      fontSize: '11px',
      color: '#4A4035',
      marginTop: '10px',
    },
    affirmationBtn: {
      flexShrink: '0',
      backgroundColor: 'transparent',
      border: '1px solid #C9A84C',
      color: '#C9A84C',
      padding: '8px 16px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
      letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
      alignSelf: 'center',
      transition: 'background-color 0.15s',
    },

    // Stat cards
    statRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px',
      marginBottom: '32px',
    },
    statCard: {
      backgroundColor: '#111111',
      border: '1px solid #1F1F1F',
      borderRadius: '6px',
      padding: '20px 22px',
    },
    statLabel: {
      fontSize: '11px',
      color: '#6B6050',
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      marginBottom: '10px',
    },
    statValue: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#C9A84C',
      lineHeight: '1.1',
      marginBottom: '4px',
    },
    statSub: {
      fontSize: '12px',
      color: '#4A4035',
    },

    // Section headers
    sectionLabel: {
      fontSize: '11px',
      color: '#6B6050',
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
      marginBottom: '14px',
      marginTop: '0',
    },

    // Phase progress
    phaseGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '12px',
      marginBottom: '32px',
    },
    phaseCard: {
      backgroundColor: '#111111',
      border: '1px solid #1F1F1F',
      borderRadius: '6px',
      padding: '14px 16px',
      cursor: 'pointer',
      transition: 'border-color 0.15s',
    },
    phaseCardHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: '8px',
    },
    phaseName: {
      fontSize: '13px',
      fontWeight: '600',
      color: '#E8E0D0',
    },
    phasePct: {
      fontSize: '12px',
      color: '#6B6050',
    },
    progressBarTrack: {
      height: '4px',
      backgroundColor: '#1A1A1A',
      borderRadius: '2px',
      overflow: 'hidden',
    },
    progressBarFill: (color, pct) => ({
      height: '100%',
      width: `${pct}%`,
      backgroundColor: color,
      borderRadius: '2px',
      transition: 'width 0.4s ease',
    }),
    phaseItemCount: {
      fontSize: '11px',
      color: '#4A4035',
      marginTop: '6px',
    },

    // Acquisition target card
    targetCard: {
      backgroundColor: '#111111',
      border: '1px solid #C9A84C',
      borderRadius: '6px',
      padding: '24px 28px',
      marginBottom: '32px',
    },
    targetTitle: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#C9A84C',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: '18px',
    },
    targetGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '16px',
    },
    targetField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    targetFieldLabel: {
      fontSize: '10px',
      color: '#6B6050',
      letterSpacing: '0.10em',
      textTransform: 'uppercase',
    },
    targetFieldValue: {
      fontSize: '14px',
      color: '#E8E0D0',
      fontWeight: '500',
    },

    // Principles
    principlesCard: {
      backgroundColor: '#0F0F0F',
      border: '1px solid #1F1F1F',
      borderRadius: '6px',
      padding: '20px 24px',
    },
    principlesList: {
      listStyle: 'none',
      margin: '0',
      padding: '0',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    },
    principleItem: {
      fontSize: '13px',
      color: '#8A7A65',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '10px',
      lineHeight: '1.4',
    },
    principleDot: {
      color: '#C9A84C',
      flexShrink: '0',
      marginTop: '2px',
    },
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* ── Page Header ── */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Command Center</h1>
          <p style={styles.headerSubtitle}>{dateString}</p>
        </div>

        {/* ── 1. Daily Affirmation ── */}
        <div style={styles.affirmationCard}>
          <div style={{ flex: 1 }}>
            <div style={styles.affirmationLabel}>Daily Affirmation</div>
            <p style={styles.affirmationText}>
              "{AFFIRMATIONS[currentAffirmationIndex]}"
            </p>
            <div style={styles.affirmationMeta}>
              {currentAffirmationIndex + 1} / {AFFIRMATIONS.length}
            </div>
          </div>
          <button
            style={styles.affirmationBtn}
            onClick={handleNextAffirmation}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1A1500';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Next →
          </button>
        </div>

        {/* ── 2. Stat Cards ── */}
        <div style={styles.statRow}>
          <div style={styles.statCard}>
            <div style={styles.statLabel}>Overall Progress</div>
            <div style={styles.statValue}>{overallProgress}%</div>
            <div style={styles.statSub}>
              {completedItems} / {totalItems} steps complete
            </div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Active Phase</div>
            <div
              style={{
                ...styles.statValue,
                fontSize: '22px',
                paddingTop: '3px',
              }}
            >
              {activePhase || '—'}
            </div>
            <div style={styles.statSub}>Current focus area</div>
          </div>

          <div style={styles.statCard}>
            <div style={styles.statLabel}>Board Seats</div>
            <div style={styles.statValue}>{boardSeatsCommitted}/6</div>
            <div style={styles.statSub}>Committed</div>
          </div>
        </div>

        {/* ── 3. Phase Progress Bars ── */}
        <p style={styles.sectionLabel}>Phase Progress</p>
        <div style={styles.phaseGrid}>
          {phaseStats.map((phase) => (
            <div
              key={phase.id}
              style={styles.phaseCard}
              onClick={() => setActiveModule('checklist')}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#333333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#1F1F1F';
              }}
            >
              <div style={styles.phaseCardHeader}>
                <span style={styles.phaseName}>{phase.name}</span>
                <span style={styles.phasePct}>{phase.pct}%</span>
              </div>
              <div style={styles.progressBarTrack}>
                <div style={styles.progressBarFill(phase.color, phase.pct)} />
              </div>
              <div style={styles.phaseItemCount}>
                {phase.completed} / {phase.total} items
              </div>
            </div>
          ))}
        </div>

        {/* ── 4. First Acquisition Target Card ── */}
        <p style={styles.sectionLabel}>First Acquisition Target</p>
        <div style={styles.targetCard}>
          <div style={styles.targetTitle}>Target Profile — Pest Control, Phoenix Metro</div>
          <div style={styles.targetGrid}>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>Industry</span>
              <span style={styles.targetFieldValue}>Pest Control — Phoenix Metro</span>
            </div>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>Revenue</span>
              <span style={styles.targetFieldValue}>$1.5M – $3M</span>
            </div>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>EBITDA</span>
              <span style={styles.targetFieldValue}>$200K – $500K</span>
            </div>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>Price</span>
              <span style={styles.targetFieldValue}>$800K – $2.5M (4–5x SDE)</span>
            </div>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>Financing</span>
              <span style={styles.targetFieldValue}>SBA 7(a) + Seller Note</span>
            </div>
            <div style={styles.targetField}>
              <span style={styles.targetFieldLabel}>Timeline</span>
              <span style={styles.targetFieldValue}>12–18 months</span>
            </div>
          </div>
        </div>

        {/* ── 5. Peña Core Principles ── */}
        <p style={styles.sectionLabel}>Peña Core Principles</p>
        <div style={styles.principlesCard}>
          <ul style={styles.principlesList}>
            {[
              'Board first. Everything else second.',
              'Off-market deals only. BizBuySell is for amateurs.',
              'DSCR ≥ 1.25x. Non-negotiable.',
              'OPM / OPC / OPE. You need none of your own.',
            ].map((principle, i) => (
              <li key={i} style={styles.principleItem}>
                <span style={styles.principleDot}>◆</span>
                <span>{principle}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
