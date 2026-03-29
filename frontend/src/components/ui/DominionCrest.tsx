/**
 * DominionCrest — reusable SVG crest for Dominion Edge Holdings.
 *
 * Usage:
 *   <DominionCrest />                  // default 170px wide
 *   <DominionCrest size={80} />        // compact
 *   <DominionCrest idPrefix="sidebar" /> // unique gradient IDs for multi-instance
 */

interface DominionCrestProps {
  /** Width in px; height scales proportionally (200:228 ratio). */
  size?: number;
  /** Prefix for internal SVG gradient/filter IDs — prevent collisions when mounted multiple times. */
  idPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function DominionCrest({
  size = 170,
  idPrefix = 'deh',
  className,
  style,
}: DominionCrestProps) {
  const h = Math.round((size / 200) * 228);

  const goldV  = `${idPrefix}-gold-v`;
  const goldD  = `${idPrefix}-gold-d`;
  const goldHL = `${idPrefix}-gold-hl`;
  const interior = `${idPrefix}-interior`;
  const glow   = `${idPrefix}-glow`;

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 200 228"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Dominion Edge Holdings crest"
      role="img"
      className={className}
      style={style}
    >
      <defs>
        {/* Primary vertical metallic gold — stamped, lit from above */}
        <linearGradient id={goldV} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#EDD68A" />
          <stop offset="22%"  stopColor="#C9A227" />
          <stop offset="58%"  stopColor="#9E7914" />
          <stop offset="82%"  stopColor="#B8941F" />
          <stop offset="100%" stopColor="#C9A84C" />
        </linearGradient>

        {/* Diagonal for shield stroke — catches light on angle */}
        <linearGradient id={goldD} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#EDD68A" />
          <stop offset="42%"  stopColor="#C9A227" />
          <stop offset="100%" stopColor="#7A5E10" />
        </linearGradient>

        {/* Horizontal — used for the corner highlight on top edge */}
        <linearGradient id={goldHL} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#9E7914" stopOpacity="0.5" />
          <stop offset="30%"  stopColor="#EDD68A" stopOpacity="0.9" />
          <stop offset="70%"  stopColor="#EDD68A" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9E7914" stopOpacity="0.5" />
        </linearGradient>

        {/* Shield interior — deep, slightly lit at center-top */}
        <radialGradient id={interior} cx="50%" cy="34%" r="58%">
          <stop offset="0%"   stopColor="#181818" />
          <stop offset="100%" stopColor="#060606" />
        </radialGradient>

        {/* Subtle glow on outer border only — tasteful, not neon */}
        <filter id={glow} x="-15%" y="-15%" width="130%" height="130%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Shield body (fill) ──────────────────────────────────── */}
      <path
        d="M 26 24 L 174 24 L 174 146 L 100 218 L 26 146 Z"
        fill={`url(#${interior})`}
      />

      {/* ── Outer border — main gold stroke with glow ───────────── */}
      <path
        d="M 26 24 L 174 24 L 174 146 L 100 218 L 26 146 Z"
        fill="none"
        stroke={`url(#${goldD})`}
        strokeWidth="1.6"
        filter={`url(#${glow})`}
      />

      {/* ── Top edge highlight (brighter horizontal gradient) ────── */}
      <line
        x1="26" y1="24" x2="174" y2="24"
        stroke={`url(#${goldHL})`}
        strokeWidth="1"
      />

      {/* ── Inner liner ─────────────────────────────────────────── */}
      <path
        d="M 40 38 L 160 38 L 160 144 L 100 206 L 40 144 Z"
        fill="none"
        stroke={`url(#${goldV})`}
        strokeWidth="0.6"
        opacity="0.32"
      />

      {/* ── Top decorative rule ─────────────────────────────────── */}
      <line
        x1="62" y1="58" x2="138" y2="58"
        stroke={`url(#${goldD})`}
        strokeWidth="0.55"
        opacity="0.6"
      />

      {/* Rule end flourishes */}
      <circle cx="62"  cy="58" r="1.1" fill="#C9A227" opacity="0.6" />
      <circle cx="138" cy="58" r="1.1" fill="#C9A227" opacity="0.6" />

      {/* ── DE Monogram ─────────────────────────────────────────── */}
      {/*
        Using SVG <text> with Cormorant Garamond (already loaded via globals.css).
        letter-spacing pushes E to the right — visually balanced with serif strokes.
      */}
      <text
        x="100"
        y="108"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="'Cormorant Garamond', 'Georgia', serif"
        fontSize="74"
        fontWeight="600"
        fill={`url(#${goldV})`}
        letterSpacing="6"
      >
        DE
      </text>

      {/* ── Bottom decorative rule ──────────────────────────────── */}
      <line
        x1="74" y1="186" x2="126" y2="186"
        stroke={`url(#${goldD})`}
        strokeWidth="0.45"
        opacity="0.38"
      />
    </svg>
  );
}
