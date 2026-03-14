import { AGENT_CONFIGS } from '@/lib/data/agents';

export default function AgentSidebar({ activeId, onSelect }) {
  return (
    <div style={{
      width: 200,
      flexShrink: 0,
      borderRight: '1px solid #1A1A1A',
      padding: '12px 0',
    }}>
      {AGENT_CONFIGS.map(agent => (
        <button
          key={agent.id}
          onClick={() => onSelect(agent.id)}
          style={{
            width: '100%', background: activeId === agent.id ? `${agent.color}12` : 'none',
            border: 'none', borderLeft: `2px solid ${activeId === agent.id ? agent.color : 'transparent'}`,
            cursor: 'pointer', padding: '10px 14px', textAlign: 'left',
            transition: 'background 0.15s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: agent.color }}>{agent.icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: activeId === agent.id ? agent.color : '#888' }}>
                {agent.name}
              </div>
              <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{agent.title}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
