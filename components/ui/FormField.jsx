/** Label + input/select/textarea combo. Accepts any input-like element as children. */
export function FormField({ label, span, children }) {
  return (
    <div style={span ? { gridColumn: `span ${span}` } : undefined}>
      <label style={{ fontSize: 11, color: '#666', marginBottom: 4, display: 'block', letterSpacing: '0.06em' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** Common inline style for all form inputs/selects/textareas. */
export const inputStyle = {
  background: '#1A1A1A',
  border: '1px solid #2A2A2A',
  color: '#E8E0D0',
  padding: '7px 10px',
  borderRadius: 4,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};
