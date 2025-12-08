import { useEffect, useState, useRef } from 'react';
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
      transports: ['websocket', 'polling']
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
  const emit = (event, data) => {
    if (socketRef.current && connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('[Socket] Cannot emit, socket not connected');
    }
  };

  const on = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  };

  const off = (event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  };

  return {
    socket: socketRef.current,
    connected,
    emit,
    on,
    off
  };
};
