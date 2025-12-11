/**
 * AuthContext - Provides session and user data across React app
 * Fetches session from PHP backend and makes it available to components
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { fetchSession } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    sessionId: null,
    user: null,
    error: null,
  });

  // Fetch session on mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      setAuthState(prev => ({ ...prev, loading: true, error: null }));

      const sessionData = await fetchSession();

      setAuthState({
        loading: false,
        authenticated: sessionData.authenticated,
        sessionId: sessionData.session_id,
        user: sessionData.user,
        error: null,
      });

      console.log('[AuthContext] Session loaded:', {
        authenticated: sessionData.authenticated,
        sessionId: sessionData.session_id,
        userId: sessionData.user?.userId,
      });
    } catch (error) {
      console.error('[AuthContext] Failed to load session:', error);
      setAuthState({
        loading: false,
        authenticated: false,
        sessionId: null,
        user: null,
        error: error.message,
      });
    }
  };

  const refreshSession = () => {
    loadSession();
  };

  const value = {
    ...authState,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access auth context
 * @returns {Object} Auth state and methods
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
