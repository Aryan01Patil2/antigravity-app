import { useEffect, useRef, useState, useCallback } from 'react';

const WS_URL = 'ws://localhost:8000/ws/analyze-stream';

export function useWebSocket() {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      ws.current = new WebSocket(WS_URL);

      ws.current.onopen = () => {
        setConnected(true);
        clearTimeout(reconnectTimer.current);
      };

      ws.current.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type !== 'ping') {
            setLiveData(data);
          }
        } catch { /* ignore parse errors */ }
      };

      ws.current.onclose = () => {
        setConnected(false);
        // Reconnect after 3s
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    } catch (e) {
      console.warn('WebSocket connection failed:', e.message);
    }
  }, []);

  const send = useCallback((code, language = 'auto') => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ code, language }));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    ws.current?.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return { connected, liveData, send, reconnect: connect, disconnect };
}
