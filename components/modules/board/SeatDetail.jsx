import SectionHeader from '@/components/ui/SectionHeader';
import { OBJECTIONS } from '@/lib/data/board';

export default function SeatDetail({ seat }) {
  const rows = [
    { label: 'WHY THIS SEAT', text: seat.why },
    { label: 'WHERE TO FIND THEM', text: seat.whereTo },
    { label: 'PITCH SCRIPT', text: seat.pitch },
  ];

  return (
    <div style={{
      background: '#111',
      border: `1px solid ${seat.color}44`,
      borderRadius: 8,
      padding: '20px 24px',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: seat.color, marginBottom: 4 }}>{seat.role}</div>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 16 }}>Equity: {seat.equityRange}</div>

      <div style={{ fontSize: 13, color: '#C0B89A', lineHeight: 1.6, marginBottom: 20 }}>
        {seat.description}
      </div>

      {rows.map(({ label, text }) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <SectionHeader>{label}</SectionHeader>
          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{text}</div>
        </div>
      ))}

      <SectionHeader style={{ marginTop: 24 }}>OBJECTION HANDLING</SectionHeader>
      {OBJECTIONS.map((obj, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#C9A84C' }}>{obj.q}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4, lineHeight: 1.6 }}>{obj.a}</div>
        </div>
      ))}
    </div>
  );
}
