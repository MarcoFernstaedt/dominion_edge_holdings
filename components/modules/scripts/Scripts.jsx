import { SCRIPTS } from '@/lib/data/scripts';
import ScriptCard from './ScriptCard';

export default function Scripts() {
  return (
    <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>Scripts</h1>
        <div style={{ fontSize: 13, color: '#555' }}>Call scripts and outreach templates</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {SCRIPTS.map(script => <ScriptCard key={script.id} script={script} />)}
      </div>
    </div>
  );
}
