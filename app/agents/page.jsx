'use client';

import AIAgents from '@/components/modules/agents/AIAgents';

export default function AgentsPage() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 32px 0', borderBottom: '1px solid #1A1A1A', paddingBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>AI Agents</h1>
        <div style={{ fontSize: 13, color: '#555' }}>Specialized advisors for every aspect of your acquisition</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AIAgents />
      </div>
    </div>
  );
}
