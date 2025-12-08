import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import './ChatList.css';

const ChatList = ({ currentUser, refreshTrigger }) => {
  const [chatRooms, setChatRooms] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Setup socket for realtime updates
  const authData = useMemo(() => {
    if (!currentUser) return null;
    return { userId: currentUser.user_id, userRole: currentUser.role };
  }, [currentUser?.user_id, currentUser?.role]);

  const { socket } = useSocket(authData);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchChatRooms();
  }, [currentUser]);

  // Refetch chat rooms when refresh is triggered
  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchChatRooms();
    }
  }, [refreshTrigger]);

  // Setup realtime chat list updates
  useEffect(() => {
    if (!socket || !currentUser) return;

    // Listen for new messages in any chat room
    socket.on('chat:new-message', (message) => {
      updateChatListOnNewMessage(message);
    });

    // Listen for messages being read
    socket.on('chat:messages-read', (data) => {
      updateUnreadCount(data);
    });

    return () => {
      socket.off('chat:new-message');
      socket.off('chat:messages-read');
    };
  }, [socket, currentUser]);

  const fetchChatRooms = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/node/chats?user_id=${currentUser.user_id}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setChatRooms(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch chat rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    if (!currentUser) return;

    try {
      const response = await fetch(`/api/node/chat/stores?user_id=${currentUser.user_id}`, {
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await response.json();
      if (data.ok) {
        setStores(data.data);
      } else {
        console.error('Failed to fetch stores:', data.error);
      }
    } catch (error) {
      console.error('Failed to fetch stores:', error);
    }
  };

  const handleNewChat = async () => {
    if (currentUser?.role === 'buyer') {
      await fetchStores();
      setShowNewChat(true);
    }
  };

  const handleCreateChat = async (storeId) => {
    if (!currentUser) return;

    try {
      const response = await fetch('/api/node/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          storeId,
          user_id: currentUser.user_id
        })
      });

      const data = await response.json();
      if (data.ok) {
        setShowNewChat(false);
        navigate(`/chat/${storeId}/${currentUser.user_id}`);
      } else {
        console.error('Failed to create chat:', data.error);
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleChatClick = (chatRoom) => {
    navigate(`/chat/${chatRoom.store_id}/${chatRoom.buyer_id}`);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    // Less than 1 minute
    if (diff < 60000) return 'Just now';

    // Less than 1 hour - show minutes
    if (diff < 3600000) {
      const mins = Math.floor(diff / 60000);
      return `${mins} ${mins === 1 ? 'min' : 'mins'} ago`;
    }

    // Less than 24 hours - show hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Less than 7 days - show day name
    if (diff < 604800000) {
      return date.toLocaleDateString('en-US', { weekday: 'long' });
    }

    // This year - show date without year
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    }

    // Older - show full date
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const updateChatListOnNewMessage = (message) => {
    setChatRooms(prevRooms => {
      const roomIndex = prevRooms.findIndex(
        room => room.store_id === message.store_id && room.buyer_id === message.buyer_id
      );

      if (roomIndex === -1) {
        // New chat room, refetch the list
        fetchChatRooms();
        return prevRooms;
      }

      // Update existing room
      const updatedRooms = [...prevRooms];
      const room = { ...updatedRooms[roomIndex] };

      room.last_message = message;
      room.last_message_at = message.created_at;

      // Increment unread count if message is not from current user
      if (message.sender_id !== currentUser?.user_id) {
        // Ensure unread_count is a number by parsing it
        const currentCount = parseInt(room.unread_count) || 0;
        room.unread_count = currentCount + 1;
      }

      // Remove from current position and add to top
      updatedRooms.splice(roomIndex, 1);
      updatedRooms.unshift(room);

      return updatedRooms;
    });
  };

  const updateUnreadCount = (data) => {
    setChatRooms(prevRooms =>
      prevRooms.map(room => {
        if (room.store_id === data.storeId && room.buyer_id === data.buyerId) {
          return { ...room, unread_count: 0 };
        }
        return room;
      })
    );
  };

  // Get active room from URL
  const getActiveRoomId = () => {
    const match = location.pathname.match(/\/chat\/(\d+)\/(\d+)/);
    if (match) {
      return `${match[1]}-${match[2]}`; // storeId-buyerId
    }
    return null;
  };

  // Filter and sort chat rooms
  const filteredAndSortedRooms = useMemo(() => {
    let filtered = chatRooms;

    // Filter by search query
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(room => {
        const name = currentUser?.role === 'buyer' ? room.store_name : room.buyer_name;
        return name?.toLowerCase().includes(query);
      });
    }

    // Sort by last_message_at (most recent first)
    return [...filtered].sort((a, b) => {
      const dateA = a.last_message_at ? new Date(a.last_message_at) : new Date(0);
      const dateB = b.last_message_at ? new Date(b.last_message_at) : new Date(0);
      return dateB - dateA;
    });
  }, [chatRooms, debouncedSearch, currentUser]);

  if (loading) {
    return <div className="chat-list-loading">Loading chats...</div>;
  }

  const activeRoomId = getActiveRoomId();

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <h2>Messages</h2>
        {currentUser?.role === 'buyer' && (
          <button className="new-chat-btn" onClick={handleNewChat}>
            + New Chat
          </button>
        )}
      </div>

      {/* Search Box */}
      <div className="chat-search-container">
        <input
          type="text"
          className="chat-search-input"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="chat-search-clear"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        )}
      </div>

      {filteredAndSortedRooms.length === 0 ? (
        <div className="empty-state">
          <p>No conversations yet</p>
          {currentUser?.role === 'buyer' && (
            <button className="start-chat-btn" onClick={handleNewChat}>
              Start a conversation
            </button>
          )}
        </div>
      ) : (
        <div className="chat-rooms-list">
          {filteredAndSortedRooms.map((room) => {
            const roomId = `${room.store_id}-${room.buyer_id}`;
            const isActive = roomId === activeRoomId;

            return (
              <div
                key={roomId}
                className={`chat-room-item ${room.unread_count > 0 ? 'unread' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => handleChatClick(room)}
              >
              <div className="chat-room-avatar">
                {room.store_logo ? (
                  <img src={room.store_logo} alt="" />
                ) : (
                  <div className="avatar-placeholder">
                    {(room.store_name || room.buyer_name || '?')[0].toUpperCase()}
                  </div>
                )}
              </div>

              <div className="chat-room-content">
                <div className="chat-room-header">
                  <h3 className="chat-room-name">
                    {currentUser?.role === 'buyer' ? room.store_name : room.buyer_name}
                  </h3>
                  <span className="chat-room-time">
                    {formatTime(room.last_message_at)}
                  </span>
                </div>

                <div className="chat-room-preview">
                  <p className="last-message">
                    {room.last_message?.message_type === 'text' && room.last_message?.content}
                    {room.last_message?.message_type === 'image' && '📷 Photo'}
                    {room.last_message?.message_type === 'item_preview' && '🏷️ Product'}
                    {!room.last_message && 'No messages yet'}
                  </p>
                  {room.unread_count > 0 && (
                    <span className="unread-badge">{room.unread_count}</span>
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {showNewChat && (
        <div className="new-chat-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Start a new conversation</h3>
              <button className="close-btn" onClick={() => setShowNewChat(false)}>
                ×
              </button>
            </div>
            <div className="stores-list">
              {stores.map((store) => (
                <div
                  key={store.store_id}
                  className="store-item"
                  onClick={() => handleCreateChat(store.store_id)}
                >
                  <div className="store-avatar">
                    {store.logo_path ? (
                      <img src={store.logo_path} alt="" />
                    ) : (
                      <div className="avatar-placeholder">
                        {store.store_name[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="store-info">
                    <h4>{store.store_name}</h4>
                    <p>{store.owner_name} • {store.product_count} products</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatList;
