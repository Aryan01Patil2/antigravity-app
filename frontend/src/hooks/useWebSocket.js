import { useEffect, useRef, useState, useCallback } from 'react';

// ── Secure Protocol Detection ──────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// Convert http/https to ws/wss automatically
const WS_URL = API_BASE.replace(/^http/, 'ws') + '/ws/analyze-stream';

export function useWebSocket() {
  const ws = useRef(null);
  const [connected, setConnected] = useState(false);
  const [liveData, setLiveData] = useState(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    // Only attempt connection if not already connecting/open
    if (ws.current?.readyState === WebSocket.OPEN || ws.current?.readyState === WebSocket.CONNECTING) return;

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
        // Attempt reconnect after 3s if component is still mounted
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.current.onerror = (err) => {
        console.error('WebSocket Error:', err);
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
