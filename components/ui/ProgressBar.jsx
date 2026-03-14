/** Horizontal progress bar. height defaults to 4px. */
export default function ProgressBar({ pct, color = '#C9A84C', height = 4, className }) {
  return (
    <div style={{ background: '#1A1A1A', borderRadius: height / 2, height, overflow: 'hidden' }} className={className}>
      <div style={{
        width: `${Math.min(100, Math.max(0, pct))}%`,
        height: '100%',
        background: color,
        borderRadius: height / 2,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
