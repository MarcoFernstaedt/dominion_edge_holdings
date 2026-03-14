/** Single KPI tile used in the Dashboard stats row. */
export default function StatCard({ label, value, sub, color = '#C9A84C' }) {
  return (
    <div style={{
      background: '#111',
      border: '1px solid #1E1E1E',
      borderRadius: 8,
      padding: '16px 20px',
      flex: 1,
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: '#555', letterSpacing: '0.1em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
