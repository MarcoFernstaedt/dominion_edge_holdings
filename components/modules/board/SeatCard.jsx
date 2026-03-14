/** Compact board seat tile showing role, equity range and priority badge. */
export default function SeatCard({ seat, filled, onClick, active }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `rgba(${hexToRgb(seat.color)},0.08)` : '#111',
        border: `1px solid ${active ? seat.color + '88' : filled ? seat.color + '44' : '#1E1E1E'}`,
        borderRadius: 8,
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: seat.color }}>{seat.role}</div>
        {seat.priority && (
          <span style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 3,
            background: seat.color + '22', color: seat.color, letterSpacing: '0.06em',
          }}>
            {seat.priority}
          </span>
        )}
      </div>
      <div style={{ fontSize: 11, color: '#555' }}>Equity: {seat.equityRange}</div>
      <div style={{ fontSize: 11, color: filled ? '#4CAF50' : '#444', marginTop: 4 }}>
        {filled ? `● ${filled} committed` : '○ Vacant'}
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
