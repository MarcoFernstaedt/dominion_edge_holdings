const PALETTE = {
  Committed:        { bg: 'rgba(201,168,76,0.15)',  text: '#C9A84C', border: '#C9A84C55' },
  Passed:           { bg: 'rgba(180,60,60,0.1)',    text: '#B44040', border: '#B4404055' },
  'Meeting Set':    { bg: 'rgba(90,141,181,0.1)',   text: '#5A8DB5', border: '#5A8DB555' },
  'Pitch Delivered':{ bg: 'rgba(90,141,181,0.1)',   text: '#5A8DB5', border: '#5A8DB555' },
  Closed:           { bg: 'rgba(76,175,80,0.12)',   text: '#4CAF50', border: '#4CAF5055' },
  Dead:             { bg: 'rgba(80,80,80,0.1)',     text: '#555',    border: '#33333355' },
};

const DEFAULT = { bg: 'rgba(80,80,80,0.1)', text: '#888', border: '#33333355' };

/** Pill badge that colours itself based on a status string. */
export default function StatusBadge({ status }) {
  const { bg, text, border } = PALETTE[status] ?? DEFAULT;
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 10,
      background: bg, color: text, border: `1px solid ${border}`,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}
