import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

// WebSocket URL - connects through NGINX proxy
const SOCKET_URL = 'http://localhost';

export const useSocket = (authData = null) => {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection with optional authentication
    const socketOptions = {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    };

    // Add authentication if provided
    if (authData && authData.userId && authData.userRole) {
      socketOptions.auth = {
        userId: authData.userId,
        userRole: authData.userRole
      };
    }

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

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
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
