import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import './ChatWindow.css';

const ChatWindow = ({ currentUser, onMessageSent }) => {
  const { storeId, buyerId } = useParams();

  // Memoize authData to prevent socket reconnections on every render
  const authData = useMemo(() => {
    if (!currentUser) return null;
    return { userId: currentUser.user_id, userRole: currentUser.role };
  }, [currentUser?.user_id, currentUser?.role]);

  const { socket, connected } = useSocket(authData);
  const [chatRoom, setChatRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [typingLingerTimeout, setTypingLingerTimeout] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [otherUserOnline, setOtherUserOnline] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    console.log('[ChatWindow] useEffect triggered - chat changed:', { storeId, buyerId, currentUser: currentUser?.user_id });

    if (storeId && buyerId && currentUser) {
      // Reset state when switching chats
      console.log('[ChatWindow] Resetting state and fetching data');
      setMessages([]);
      setPage(1);
      setHasMore(true);
      setLoading(true);
      setTyping(false);

      // Fetch chat data
      fetchChatRoom();
      fetchMessages();
    } else {
      console.warn('[ChatWindow] Missing storeId, buyerId, or currentUser:', { storeId, buyerId, currentUser: currentUser?.user_id });
    }
  }, [storeId, buyerId, currentUser]);

  useEffect(() => {
    if (connected && socket && storeId && buyerId && currentUser) {
      joinChatRoom();

      return () => {
        leaveChatRoom();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, socket, storeId, buyerId, currentUser?.user_id]);

  useEffect(() => {
    console.log('[ChatWindow] Messages state updated:', messages.length, 'messages');
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchChatRoom = async () => {
    if (!currentUser) return;

    try {
      const response = await fetch(`/api/node/chat/${storeId}/${buyerId}?user_id=${currentUser.user_id}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setChatRoom(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch chat room:', error);
    }
  };

  const fetchMessages = async (pageNum = 1, append = false) => {
    console.log('[ChatWindow] fetchMessages called:', { storeId, buyerId, pageNum, append, currentUser: currentUser?.user_id });

    if (!currentUser) {
      console.warn('[ChatWindow] fetchMessages aborted - no currentUser');
      return;
    }

    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const url = `/api/node/chat/${storeId}/${buyerId}/messages?user_id=${currentUser.user_id}&page=${pageNum}&limit=50`;
      console.log('[ChatWindow] Fetching messages from:', url);

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      console.log('[ChatWindow] Fetch response status:', response.status);
      const data = await response.json();
      console.log('[ChatWindow] Fetch response data:', { ok: data.ok, messageCount: data.data?.length, meta: data.meta });

      if (data.ok) {
        if (append) {
          // Prepend older messages
          setMessages(prev => [...data.data, ...prev]);
        } else {
          console.log('[ChatWindow] Setting messages:', data.data.length, 'messages');
          setMessages(data.data);
        }

        // Check if there are more messages
        if (data.meta) {
          setHasMore(data.meta.currentPage < data.meta.totalPages);
        }

        if (!append) {
          markAsRead();
        }
      } else {
        console.error('[ChatWindow] API returned ok:false');
      }
    } catch (error) {
      console.error('[ChatWindow] Failed to fetch messages:', error);
    } finally {
      if (!append) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  };

  const loadMoreMessages = async () => {
    if (loadingMore || !hasMore) return;

    const nextPage = page + 1;
    setPage(nextPage);

    // Save current scroll position
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    await fetchMessages(nextPage, true);

    // Restore scroll position after loading
    setTimeout(() => {
      if (container) {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop = newScrollHeight - previousScrollHeight;
      }
    }, 100);
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    // Load more when scrolled to top
    if (container.scrollTop === 0 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  const joinChatRoom = () => {
    if (!socket) return;

    socket.emit('chat:join', {
      storeId: parseInt(storeId),
      buyerId: parseInt(buyerId)
    });

    socket.on('chat:joined', (data) => {
      console.log('[Chat] Joined room:', data);
      // Check if other user is already in the room
      // This would require backend to send room participants
    });

    socket.on('chat:user-joined', (data) => {
      console.log('[Chat] User joined:', data);
      if (data.userId !== currentUser.user_id) {
        setOtherUserOnline(true);
      }
    });

    socket.on('chat:user-left', (data) => {
      console.log('[Chat] User left:', data);
      if (data.userId !== currentUser.user_id) {
        setOtherUserOnline(false);
      }
    });

    socket.on('chat:new-message', (message) => {
      console.log('[Chat] New message:', message);

      // Deduplicate: check if message already exists
      setMessages(prev => {
        const exists = prev.some(msg => msg.message_id === message.message_id);
        if (exists) {
          return prev; // Don't add duplicate
        }
        return [...prev, message];
      });

      // Mark as read if not from current user
      if (message.sender_id !== currentUser.user_id) {
        // Clear typing indicator when message is received
        setTyping(false);
        if (typingLingerTimeout) {
          clearTimeout(typingLingerTimeout);
          setTypingLingerTimeout(null);
        }

        markAsRead();

        // Emit delivery confirmation
        socket.emit('chat:message-delivered', {
          storeId: parseInt(storeId),
          buyerId: parseInt(buyerId),
          messageId: message.message_id
        });
      } else {
        // Mark own message as delivered immediately (optimistic update)
        setMessages(prev =>
          prev.map(msg =>
            msg.message_id === message.message_id ? { ...msg, is_delivered: true } : msg
          )
        );
      }
    });

    socket.on('chat:message-delivered', (data) => {
      console.log('[Chat] Message delivered:', data);
      // Update message delivery status
      setMessages(prev =>
        prev.map(msg =>
          msg.message_id === data.messageId ? { ...msg, is_delivered: true } : msg
        )
      );
    });

    socket.on('chat:user-typing', (data) => {
      if (data.userId !== currentUser.user_id) {
        setTyping(true);

        // Clear any existing linger timeout
        if (typingLingerTimeout) {
          clearTimeout(typingLingerTimeout);
          setTypingLingerTimeout(null);
        }
      }
    });

    socket.on('chat:user-stop-typing', (data) => {
      if (data.userId !== currentUser.user_id) {
        // Don't immediately hide, linger for 3 seconds
        const timeout = setTimeout(() => {
          setTyping(false);
        }, 3000);
        setTypingLingerTimeout(timeout);
      }
    });

    socket.on('chat:messages-read', (data) => {
      console.log('[Chat] Messages read by:', data.readBy);

      // Only update if it's for the current chat room
      const isCurrentChat = data.storeId === parseInt(storeId) && data.buyerId === parseInt(buyerId);
      if (!isCurrentChat) {
        return;
      }

      // Update message read status for messages from current user
      setMessages(prev =>
        prev.map(msg =>
          msg.sender_id === currentUser.user_id ? { ...msg, is_read: true } : msg
        )
      );
    });

    socket.on('chat:error', (error) => {
      console.error('[Chat] Error:', error);
    });
  };

  const leaveChatRoom = () => {
    if (!socket) return;

    socket.emit('chat:leave', {
      storeId: parseInt(storeId),
      buyerId: parseInt(buyerId)
    });

    socket.off('chat:joined');
    socket.off('chat:user-joined');
    socket.off('chat:user-left');
    socket.off('chat:new-message');
    socket.off('chat:message-delivered');
    socket.off('chat:user-typing');
    socket.off('chat:user-stop-typing');
    socket.off('chat:messages-read');
    socket.off('chat:error');
  };

  const markAsRead = async () => {
    if (!currentUser) return;

    try {
      await fetch(`/api/node/chat/${storeId}/${buyerId}/read`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          user_id: currentUser.user_id
        })
      });

      if (socket) {
        socket.emit('chat:mark-read', {
          storeId: parseInt(storeId),
          buyerId: parseInt(buyerId)
        });
      }
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleSendMessage = (messageData) => {
    if (!socket) return;

    socket.emit('chat:send-message', {
      storeId: parseInt(storeId),
      buyerId: parseInt(buyerId),
      ...messageData
    }, (response) => {
      if (response.ok) {
        console.log('[Chat] Message sent successfully');
        // Trigger chat list refresh
        if (onMessageSent) {
          onMessageSent();
        }
      } else {
        console.error('[Chat] Failed to send message:', response.error);
      }
    });
  };

  const handleTyping = () => {
    if (!socket) return;

    socket.emit('chat:typing', {
      storeId: parseInt(storeId),
      buyerId: parseInt(buyerId)
    });

    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }

    // Set new timeout to stop typing after 2 seconds
    const timeout = setTimeout(() => {
      socket.emit('chat:stop-typing', {
        storeId: parseInt(storeId),
        buyerId: parseInt(buyerId)
      });
    }, 2000);

    setTypingTimeout(timeout);
  };

  if (loading) {
    return <div className="chat-window-loading">Loading messages...</div>;
  }

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">
            {chatRoom?.store_logo ? (
              <img src={chatRoom.store_logo} alt="" />
            ) : (
              <div className="avatar-placeholder">
                {(chatRoom?.store_name || chatRoom?.buyer_name || '?')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h3>{currentUser?.role === 'buyer' ? chatRoom?.store_name : chatRoom?.buyer_name}</h3>
            <p className="chat-status">{otherUserOnline ? 'Online' : 'Offline'}</p>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loadingMore && (
          <div className="loading-more">
            <div className="skeleton-message">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-content">
                <div className="skeleton-line"></div>
                <div className="skeleton-line short"></div>
              </div>
            </div>
            <div className="skeleton-message">
              <div className="skeleton-avatar"></div>
              <div className="skeleton-content">
                <div className="skeleton-line"></div>
              </div>
            </div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.message_id}
                message={message}
                isOwn={message.sender_id === currentUser?.user_id}
              />
            ))}
            {typing && (
              <div className="message-bubble other">
                <div className="message-content typing-indicator">
                  <div className="typing-sender">{currentUser?.role === 'buyer' ? chatRoom?.store_name : chatRoom?.buyer_name} is typing</div>
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={handleTyping}
        disabled={!connected}
        currentUser={currentUser}
      />
    </div>
  );
};

export default ChatWindow;
