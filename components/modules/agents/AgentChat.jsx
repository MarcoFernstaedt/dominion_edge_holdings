'use client';

import { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';

export default function AgentChat({ agent }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streamText, setStreamText] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  // Reset when agent changes
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamText('');
    setInput('');
    setLoading(false);
  }, [agent.id]);

  // Smooth scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Instant scroll during streaming
  useEffect(() => {
    if (streamText) bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [streamText]);

  const send = async (text) => {
    const userMsg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);
    setStreamText('');

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemPrompt: agent.systemPrompt, messages: history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error ?? res.statusText);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              accumulated += parsed.text;
              setStreamText(accumulated);
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') throw e;
          }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
      }
    } finally {
      setStreamText('');
      setLoading(false);
    }
  };

  const handleKey = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (input.trim()) send(input.trim()); }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Agent header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #1A1A1A',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 22, color: agent.color }}>{agent.icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: agent.color }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: '#555' }}>{agent.tagline}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {messages.length === 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: '#444', marginBottom: 10, letterSpacing: '0.08em' }}>SUGGESTED PROMPTS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {agent.suggestedPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => send(p)}
                  style={{
                    background: 'none', border: '1px solid #1E1E1E', borderRadius: 6,
                    padding: '8px 12px', cursor: 'pointer', textAlign: 'left',
                    fontSize: 12, color: '#666', lineHeight: 1.5,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => <MessageBubble key={i} message={msg} agentColor={agent.color} />)}

        {streamText && (
          <MessageBubble message={{ role: 'assistant', content: streamText + '▋' }} agentColor={agent.color} />
        )}

        {loading && !streamText && (
          <div style={{ color: '#444', fontSize: 12, padding: '8px 0' }}>Thinking…</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #1A1A1A', display: 'flex', gap: 8 }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={`Ask ${agent.name}…`}
          style={{
            flex: 1, background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#E8E0D0',
            padding: '9px 12px', borderRadius: 6, fontSize: 13, resize: 'none',
            height: 40, outline: 'none', fontFamily: 'inherit',
          }}
          rows={1}
        />
        <button
          onClick={() => input.trim() && send(input.trim())}
          disabled={loading || !input.trim()}
          style={{
            padding: '0 16px', background: loading ? '#2A2A2A' : '#C9A84C',
            border: 'none', color: loading ? '#444' : '#0A0A0A',
            borderRadius: 6, cursor: loading ? 'default' : 'pointer', fontSize: 13, fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
