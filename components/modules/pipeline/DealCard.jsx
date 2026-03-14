import { STAGE_COLORS } from '@/lib/data/pipeline';
import { fmtMoney } from '@/lib/utils/format';

export default function DealCard({ deal, onEdit, onDelete }) {
  const color = STAGE_COLORS[deal.stage] ?? '#666';

  return (
    <div style={{
      background: '#111', border: '1px solid #1E1E1E', borderRadius: 8,
      padding: '14px 16px', display: 'grid',
      gridTemplateColumns: '1fr auto auto', gap: '6px 16px', alignItems: 'start',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0' }}>{deal.company}</div>
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 8,
            background: color + '22', color, border: `1px solid ${color}44`,
          }}>
            {deal.stage}
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#555', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {deal.owner && <span>{deal.owner}</span>}
          {deal.revenue && <span>Rev: {fmtMoney(Number(deal.revenue))}</span>}
          {deal.ebitda && <span>EBITDA: {fmtMoney(Number(deal.ebitda))}</span>}
          {deal.trucks && <span>{deal.trucks} trucks</span>}
          {deal.howFound && <span>via {deal.howFound}</span>}
        </div>
        {deal.notes && <div style={{ fontSize: 11, color: '#444', marginTop: 5, lineHeight: 1.5 }}>{deal.notes}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onEdit} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#888', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Edit</button>
        <button onClick={onDelete} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#B44040', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>×</button>
      </div>
    </div>
  );
}
