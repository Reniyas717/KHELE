import { createContext, useContext, useEffect, useRef, useState } from 'react';

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
          console.log('📨 Received:', data.type);

          // Call all registered handlers for this message type
          const handlers = messageHandlers.current.get(data.type) || [];
          handlers.forEach(handler => {
            try {
              handler(data.payload);
            } catch (error) {
              console.error('Error in message handler:', error);
            }
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
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

  const sendMessage = (type, payload) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      // Add username to all messages
      const username = localStorage.getItem('username');
      const messagePayload = { ...payload, username };
      
      ws.current.send(JSON.stringify({ type, payload: messagePayload }));
      console.log('📤 Sent:', type, messagePayload);
    } else {
      console.error('❌ WebSocket not connected, cannot send:', type);
    }
  };

  const on = (messageType, handler) => {
    if (!messageHandlers.current.has(messageType)) {
      messageHandlers.current.set(messageType, []);
    }
    messageHandlers.current.get(messageType).push(handler);

    // Return cleanup function
    return () => {
      const handlers = messageHandlers.current.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  };

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
