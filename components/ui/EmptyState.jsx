/** Centered empty-state box used when a list has no items. */
export default function EmptyState({ message }) {
  return (
    <div style={{
      background: '#111', border: '1px solid #1A1A1A', borderRadius: 8,
      padding: '40px', textAlign: 'center', color: '#444', fontSize: 13,
    }}>
      {message}
    </div>
  );
}
