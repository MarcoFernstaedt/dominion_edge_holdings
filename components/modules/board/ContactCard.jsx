import StatusBadge from '@/components/ui/StatusBadge';
import { BOARD_SEATS } from '@/lib/data/board';

export default function ContactCard({ contact, onEdit, onDelete }) {
  const seat = BOARD_SEATS.find(s => s.id === contact.seat);

  return (
    <div style={{
      background: '#111', border: '1px solid #1E1E1E', borderRadius: 8,
      padding: '14px 16px', display: 'grid',
      gridTemplateColumns: '1fr auto auto', gap: '8px 16px', alignItems: 'start',
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0', marginBottom: 2 }}>{contact.name}</div>
        <div style={{ fontSize: 11, color: '#666' }}>{contact.role}{contact.company ? ` · ${contact.company}` : ''}</div>
        {seat && <div style={{ fontSize: 11, color: seat.color, marginTop: 3 }}>→ {seat.role}</div>}
        {contact.notes && <div style={{ fontSize: 11, color: '#555', marginTop: 4, lineHeight: 1.5 }}>{contact.notes}</div>}
      </div>
      <StatusBadge status={contact.status} />
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#888', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
        <button onClick={onDelete} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#B44040', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>×</button>
      </div>
    </div>
  );
}
