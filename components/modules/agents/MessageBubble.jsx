export default function MessageBubble({ message, agentColor }) {
  const isUser = message.role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '80%',
        padding: '10px 14px',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? 'rgba(201,168,76,0.12)' : '#161616',
        border: `1px solid ${isUser ? 'rgba(201,168,76,0.25)' : '#1E1E1E'}`,
        fontSize: 13,
        color: '#C0B89A',
        lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
      }}>
        {message.content}
      </div>
    </div>
  );
}
