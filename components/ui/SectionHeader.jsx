/** Uppercase section label used throughout modules. */
export default function SectionHeader({ children, style }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: '#666',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  );
}
