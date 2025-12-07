import { useState, useEffect, useCallback } from 'react';
import { Routes, Route } from 'react-router-dom';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import './ChatPage.css';

const ChatPage = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatListRefreshTrigger, setChatListRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/me', {
        credentials: 'include'
      });

      const data = await response.json();
      console.log('[ChatPage] User data from /api/me:', data);

      if (data.authenticated && data.user) {
        // Normalize user object to ensure user_id exists
        const user = {
          user_id: data.user.user_id || data.user.id || data.user.userId,
          full_name: data.user.full_name || data.user.fullName || data.user.name || 'User',
          role: data.user.role || 'buyer',
          email: data.user.email,
          ...data.user
        };
        console.log('[ChatPage] Normalized user:', user);
        setCurrentUser(user);
      } else {
        // Not authenticated, use guest user for development
        console.warn('[ChatPage] Not authenticated, using guest user');
        setCurrentUser({
          user_id: 1,
          full_name: 'Guest User',
          role: 'buyer'
        });
      }
    } catch (error) {
      console.error('[ChatPage] Failed to fetch user:', error);
      // Set dummy user for development
      setCurrentUser({
        user_id: 1,
        full_name: 'Guest User',
        role: 'buyer'
      });
    } finally {
      setLoading(false);
    }
  };

  // Callback to refresh chat list when a message is sent
  const handleChatListRefresh = useCallback(() => {
    setChatListRefreshTrigger(prev => prev + 1);
  }, []);

  if (loading) {
    return (
      <div className="chat-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        <ChatList
          currentUser={currentUser}
          refreshTrigger={chatListRefreshTrigger}
        />
      </div>
      <div className="chat-main">
        <Routes>
          <Route
            path="/"
            element={
              <div className="chat-empty-state">
                <div className="empty-content">
                  <svg
                    width="120"
                    height="120"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ccc"
                    strokeWidth="1"
                  >
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  <h2>Select a conversation</h2>
                  <p>Choose a chat from the list to start messaging</p>
                </div>
              </div>
            }
          />
          <Route
            path="/:storeId/:buyerId"
            element={
              <ChatWindow
                currentUser={currentUser}
                onMessageSent={handleChatListRefresh}
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
};

export default ChatPage;
