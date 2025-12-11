import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// WebSocket URL - connects through NGINX proxy
const SOCKET_URL = 'http://localhost';

export const useSocket = (authData = null) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Determine authentication method
    // Priority: sessionId (new method) > userId/userRole (legacy)
    let authConfig = null;

    if (authData?.sessionId && authData?.user) {
      // Session-based authentication (preferred)
      authConfig = {
        sessionId: authData.sessionId,
        userId: authData.user.userId,
        userRole: authData.user.userRole
      };
      console.log('[Socket] Using session-based auth:', { sessionId: authData.sessionId, userId: authData.user.userId });
    } else if (authData?.userId && authData?.userRole) {
      // Legacy authentication (fallback)
      authConfig = {
        userId: authData.userId,
        userRole: authData.userRole
      };
      console.log('[Socket] Using legacy auth:', { userId: authData.userId, userRole: authData.userRole });
    } else {
      console.log('[Socket] Waiting for auth data before connecting... Current authData:', authData);
      return;
    }

    console.log('[Socket] Creating socket with auth config:', authConfig);

    // Initialize socket connection with authentication
    const socketOptions = {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      auth: authConfig
    };

    console.log('[Socket] Socket options:', socketOptions);
    socketRef.current = io(SOCKET_URL, socketOptions);

    // Connection event
    socketRef.current.on('connect', () => {
      console.log('[Socket] Connected:', socketRef.current.id);
      setConnected(true);
    });

    // Disconnection event
    socketRef.current.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      setConnected(false);
    });

    // Connection error event
    socketRef.current.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error);
      setConnected(false);
    });

    // Cleanup on unmount or authData change
    return () => {
      if (socketRef.current) {
        console.log('[Socket] Disconnecting socket due to cleanup');
        socketRef.current.disconnect();
      }
    };
  }, [authData]);

  // Helper functions
  const emit = useCallback((event, data, callback) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data, callback);
    } else {
      console.warn('[Socket] Cannot emit, socket not initialized. Event:', event);
      if (callback) {
        callback({ success: false, error: 'Socket not initialized' });
      }
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  return useMemo(() => ({
    socket: socketRef.current,
    connected,
    emit,
    on,
    off
  }), [connected, emit, on, off]);
};
