import { useState, useRef, useEffect, useCallback } from 'react';
import { AGENT_CONFIGS } from '../data/checklistData';
import { useLocalStorage } from '../hooks/useLocalStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Shared avatar for all assistant messages — extracted to avoid triple duplication
function AgentAvatar() {
  return (
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1A1A1A', border: '1px solid #333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0, marginTop: 2 }}>
      ◆
    </div>
  );
}

function Message({ role, content }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16, justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      {!isUser && <AgentAvatar />}
      <div style={{
        maxWidth: '75%', padding: '10px 14px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? '#C9A84C22' : '#1A1A1A',
        border: `1px solid ${isUser ? '#C9A84C44' : '#2A2A2A'}`,
        fontSize: 13, color: '#E8E0D0', lineHeight: 1.7, whiteSpace: 'pre-wrap',
      }}>
        {content}
      </div>
    </div>
  );
}

function AgentChat({ agent }) {
  const [histories, setHistories] = useLocalStorage('deh_agent_histories', {});
  const messages = histories[agent.id] || [];
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  // Smooth scroll only when a complete message lands (not per-token)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Instant scroll during streaming to track new tokens without animation fighting itself
  useEffect(() => {
    if (streamText) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [streamText]);

  // Cancel in-flight stream when agent changes or component unmounts
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, [agent.id]);

  const setMessages = useCallback((updater) => {
    setHistories(prev => ({
      ...prev,
      [agent.id]: typeof updater === 'function' ? updater(prev[agent.id] || []) : updater,
    }));
  }, [agent.id, setHistories]);

  const clearHistory = () => setMessages([]);

  const send = async (text) => {
    if (!text.trim() || loading) return;

    // Cancel any previous in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg = { role: 'user', content: text };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setLoading(true);
    setStreamText('');

    try {
      const resp = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system: agent.systemPrompt,
          messages: currentMessages,
        }),
      });

      if (!resp.ok) throw new Error(`Server error: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') break;
            let parsed;
            try {
              parsed = JSON.parse(data);
            } catch {
              continue; // Malformed SSE frame — skip, don't swallow API errors below
            }
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) { full += parsed.text; setStreamText(full); }
          }
        }
      } finally {
        reader.releaseLock();
      }

      setMessages(prev => [...prev, { role: 'assistant', content: full }]);
      setStreamText('');
    } catch (err) {
      if (err.name === 'AbortError') return; // Navigated away — not an error
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}. Check that the backend is running and ANTHROPIC_API_KEY is set.` }]);
      setStreamText('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1E1E1E', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: agent.color }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{agent.tagline}</div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#555', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {messages.length === 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Suggested Prompts</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agent.suggestedPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p)}
                  style={{ background: '#111', border: '1px solid #1E1E1E', color: '#AAA', padding: '10px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, textAlign: 'left', lineHeight: 1.4 }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = agent.color + '88'; e.currentTarget.style.color = '#CCC'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#1E1E1E'; e.currentTarget.style.color = '#AAA'; }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => <Message key={i} role={m.role} content={m.content} />)}

        {streamText && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <AgentAvatar />
            <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: '#1A1A1A', border: '1px solid #2A2A2A', fontSize: 13, color: '#E8E0D0', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {streamText}<span style={{ opacity: 0.5, animation: 'blink 1s infinite' }}>▌</span>
            </div>
          </div>
        )}

        {loading && !streamText && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <AgentAvatar />
            <div style={{ padding: '12px 16px', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: '12px 12px 12px 4px', color: '#555', fontSize: 13 }}>Thinking…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={{ padding: '14px 20px', borderTop: '1px solid #1E1E1E', display: 'flex', gap: 10 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder={`Ask ${agent.name}…`}
          style={{ flex: 1, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#E8E0D0', padding: '9px 12px', borderRadius: 6, fontSize: 13, resize: 'none', height: 44, outline: 'none', lineHeight: 1.5 }}
          disabled={loading}
        />
        <button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          style={{ background: loading ? '#1A1A1A' : '#C9A84C', color: loading ? '#555' : '#000', border: 'none', padding: '0 20px', borderRadius: 6, cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function AIAgents() {
  const [activeAgent, setActiveAgent] = useState(AGENT_CONFIGS[0].id);
  const agent = AGENT_CONFIGS.find(a => a.id === activeAgent);

  return (
    <div style={{ display: 'flex', height: '100%', color: '#E8E0D0' }}>
      <div style={{ width: 200, background: '#111', borderRight: '1px solid #1E1E1E', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #1E1E1E' }}>
          <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Agents</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {AGENT_CONFIGS.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveAgent(a.id)}
              style={{
                width: '100%', padding: '12px 16px', background: activeAgent === a.id ? `${a.color}15` : 'transparent',
                border: 'none', borderLeft: `2px solid ${activeAgent === a.id ? a.color : 'transparent'}`,
                color: activeAgent === a.id ? a.color : '#888', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 16, marginBottom: 3 }}>{a.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{a.name}</div>
              <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.3, marginTop: 2 }}>{a.title}</div>
            </button>
          ))}
        </div>
        <div style={{ padding: '12px', borderTop: '1px solid #1E1E1E', fontSize: 10, color: '#333', lineHeight: 1.5 }}>
          Powered by claude-sonnet-4-20250514
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AgentChat key={activeAgent} agent={agent} />
      </div>

      <style>{`@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`}</style>
    </div>
  );
}
