import { DEAL_STAGES } from '@/lib/data/pipeline';
import { inputStyle } from '@/components/ui/FormField';

export default function FilterBar({ filter, onFilter }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
      <select
        style={{ ...inputStyle, width: 'auto', minWidth: 160 }}
        value={filter.stage}
        onChange={e => onFilter({ ...filter, stage: e.target.value })}
      >
        <option value="">All Stages</option>
        {DEAL_STAGES.map(s => <option key={s}>{s}</option>)}
      </select>
      <input
        style={{ ...inputStyle, width: 220 }}
        placeholder="Search company or owner…"
        value={filter.search}
        onChange={e => onFilter({ ...filter, search: e.target.value })}
      />
    </div>
  );
}
