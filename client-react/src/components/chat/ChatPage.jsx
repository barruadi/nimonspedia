import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';

const ChatPage = () => {
  const { connected, emit, on, off } = useSocket();
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUser, setTypingUser] = useState(null);
  const messagesEndRef = useRef(null);

  const chatId = 'test-chat-1'; // Mockup chat ID

  // Fetch user session
  useEffect(() => {
    fetch('/api/me')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setUser(data.user);
        }
      })
      .catch(err => console.error('Failed to fetch user:', err));
  }, []);

  // Join chat room when connected
  useEffect(() => {
    if (connected) {
      console.log('[Chat] Joining chat room:', chatId);
      emit('chat:join', chatId);

      // Listen for chat data
      on('chat:joined', (data) => {
        console.log('[Chat] Joined:', data);
        setMessages(data.mockData.messages);
      });

      // Listen for new messages
      on('chat:new-message', (message) => {
        console.log('[Chat] New message:', message);
        setMessages(prev => [...prev, message]);
      });

      // Listen for typing indicators
      on('chat:user-typing', (data) => {
        setTypingUser(data.userName);
      });

      on('chat:user-stop-typing', () => {
        setTypingUser(null);
      });

      return () => {
        emit('chat:leave', chatId);
        off('chat:joined');
        off('chat:new-message');
        off('chat:user-typing');
        off('chat:user-stop-typing');
      };
    }
  }, [connected, chatId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    emit('chat:send-message', {
      chatId,
      userId: user?.id || 'guest',
      userName: user?.name || 'Guest',
      message: inputMessage
    });

    setInputMessage('');
    emit('chat:stop-typing', { chatId, userName: user?.name || 'Guest' });
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);

    if (e.target.value) {
      emit('chat:typing', { chatId, userName: user?.name || 'Guest' });
    } else {
      emit('chat:stop-typing', { chatId, userName: user?.name || 'Guest' });
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Chat Page (WebSocket Mockup)</h1>

      {/* Connection Status */}
      <div style={{
        padding: '10px',
        marginBottom: '20px',
        backgroundColor: connected ? '#d4edda' : '#f8d7da',
        border: `1px solid ${connected ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '4px'
      }}>
        Status: {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      {/* User Info */}
      {user && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
          <strong>User:</strong> {user.name} ({user.role})
        </div>
      )}

      {/* Chat Messages */}
      <div style={{
        height: '400px',
        overflowY: 'auto',
        padding: '15px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        marginBottom: '10px',
        backgroundColor: '#f8f9fa'
      }}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              padding: '10px',
              marginBottom: '10px',
              backgroundColor: msg.userId === user?.id ? '#007bff' : '#fff',
              color: msg.userId === user?.id ? '#fff' : '#000',
              borderRadius: '4px',
              maxWidth: '70%',
              marginLeft: msg.userId === user?.id ? 'auto' : '0',
              marginRight: msg.userId === user?.id ? '0' : 'auto'
            }}
          >
            <div style={{ fontSize: '0.85em', marginBottom: '5px', opacity: 0.8 }}>
              <strong>{msg.userName}</strong> • {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
            <div>{msg.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUser && (
        <div style={{ marginBottom: '10px', fontStyle: 'italic', color: '#666' }}>
          {typingUser} is typing...
        </div>
      )}

      {/* Message Input */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          type="text"
          value={inputMessage}
          onChange={handleTyping}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          disabled={!connected}
          style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}
        />
        <button
          onClick={handleSendMessage}
          disabled={!connected || !inputMessage.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: connected && inputMessage.trim() ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connected && inputMessage.trim() ? 'pointer' : 'not-allowed'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
