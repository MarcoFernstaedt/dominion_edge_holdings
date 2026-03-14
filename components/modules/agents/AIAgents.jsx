'use client';

import { useState } from 'react';
import { AGENT_CONFIGS } from '@/lib/data/agents';
import AgentSidebar from './AgentSidebar';
import AgentChat from './AgentChat';

export default function AIAgents() {
  const [activeId, setActiveId] = useState(AGENT_CONFIGS[0].id);
  const agent = AGENT_CONFIGS.find(a => a.id === activeId);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <AgentSidebar activeId={activeId} onSelect={setActiveId} />
      <AgentChat key={activeId} agent={agent} />
    </div>
  );
}
