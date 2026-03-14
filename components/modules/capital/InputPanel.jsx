import { FormField, inputStyle } from '@/components/ui/FormField';

export default function InputPanel({ vals, onChange }) {
  const set = (k, v) => onChange({ ...vals, [k]: v });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <FormField label="EBITDA ($)">
        <input style={inputStyle} type="number" value={vals.ebitda} onChange={e => set('ebitda', e.target.value)} placeholder="300000" />
      </FormField>
      <FormField label="ACQUISITION MULTIPLE (x EBITDA)">
        <input style={inputStyle} type="number" step="0.1" value={vals.multiple} onChange={e => set('multiple', e.target.value)} placeholder="3.5" />
      </FormField>
      <FormField label="DOWN PAYMENT (%)">
        <input style={inputStyle} type="number" step="1" value={vals.downPct} onChange={e => set('downPct', e.target.value)} placeholder="10" />
      </FormField>
      <FormField label="SBA INTEREST RATE (%)">
        <input style={inputStyle} type="number" step="0.01" value={vals.ratePct} onChange={e => set('ratePct', e.target.value)} placeholder="11.25" />
      </FormField>
      <FormField label="LOAN TERM (MONTHS)">
        <input style={inputStyle} type="number" value={vals.termMonths} onChange={e => set('termMonths', e.target.value)} placeholder="120" />
      </FormField>
      <FormField label="ANNUAL NOI / EBITDA ($)">
        <input style={inputStyle} type="number" value={vals.noi} onChange={e => set('noi', e.target.value)} placeholder="Same as EBITDA if no adjustments" />
      </FormField>
    </div>
  );
}
