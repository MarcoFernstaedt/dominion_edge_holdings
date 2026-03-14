import Timeline from './Timeline';
import ResourceLinks from './ResourceLinks';

export default function Resources() {
  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>Resources</h1>
        <div style={{ fontSize: 13, color: '#555' }}>Timeline, tools, and reference links</div>
      </div>
      <Timeline />
      <ResourceLinks />
    </div>
  );
}
