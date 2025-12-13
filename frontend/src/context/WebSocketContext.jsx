import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

const WebSocketContext = createContext(null);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef(null);
  const messageHandlers = useRef(new Map());
  const reconnectTimeout = useRef(null);
  const isConnecting = useRef(false);
  const shouldReconnect = useRef(true);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    // Prevent multiple simultaneous connections
    if (isConnecting.current) {
      console.log('⚠️ Connection already in progress');
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('⚠️ Already connected');
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.CONNECTING) {
      console.log('⚠️ Already connecting');
      return;
    }

    isConnecting.current = true;

    try {
      console.log('🔌 Connecting to WebSocket... (attempt', reconnectAttempts.current + 1, ')');
      ws.current = new WebSocket('ws://localhost:5000/ws');

      ws.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        isConnecting.current = false;
        reconnectAttempts.current = 0; // Reset on successful connection
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', data.type);
          console.log('📦 Message data:', data);

          const handlers = messageHandlers.current.get(data.type);
          if (handlers && handlers.size > 0) {
            console.log(`🔔 Calling ${handlers.size} handler(s) for:`, data.type);
            handlers.forEach(handler => {
              try {
                handler(data);
              } catch (error) {
                console.error('❌ Error in message handler:', error);
              }
            });
          } else {
            console.log('⚠️ No handlers registered for:', data.type);
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        isConnecting.current = false;
      };

      ws.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        isConnecting.current = false;
        
        // Only attempt to reconnect if shouldReconnect is true and not exceeded max attempts
        if (shouldReconnect.current && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000); // Exponential backoff
          
          if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
          }
          
          console.log(`🔄 Reconnecting in ${delay}ms...`);
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error('❌ Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      isConnecting.current = false;
    }
  };

  const disconnect = () => {
    console.log('🔌 Disconnecting WebSocket...');
    shouldReconnect.current = false;
    
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
    }
    
    if (ws.current) {
      // Remove event listeners to prevent reconnection
      ws.current.onclose = null;
      ws.current.onerror = null;
      ws.current.close();
      ws.current = null;
    }
    
    setIsConnected(false);
    isConnecting.current = false;
    reconnectAttempts.current = 0;
  };

  const sendMessage = useCallback((type, payload) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected, cannot send:', type);
      return;
    }

    const message = { type, payload };
    console.log('📤 Sending message:', type, payload);
    ws.current.send(JSON.stringify(message));
  }, []);

  const on = useCallback((event, handler) => {
    console.log('👂 Registering handler for:', event);
    
    if (!messageHandlers.current.has(event)) {
      messageHandlers.current.set(event, new Set());
    }
    messageHandlers.current.get(event).add(handler);

    return () => {
      console.log('🔕 Unregistering handler for:', event);
      const handlers = messageHandlers.current.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlers.current.delete(event);
        }
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ connect, disconnect, sendMessage, on, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};
