import { useEffect, useRef, useCallback, useState } from 'react';
import type { ServerMessage, ClientMessage } from '@naval-war/types';
import { MessageType } from '@naval-war/types';

type MessageHandler = (msg: ServerMessage) => void;

interface UseWebSocketOptions {
  token: string | null;
  onMessage: MessageHandler;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;

export function useWebSocket({
  token,
  onMessage,
  onConnected,
  onDisconnected,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  onMessageRef.current = onMessage;
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    unmountedRef.current = false;

    function connect() {
      if (unmountedRef.current) return;

      const WS_URL = `ws://${window.location.hostname}:3001?token=${encodeURIComponent(token!)}`;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) { ws.close(); return; }
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        onConnectedRef.current?.();
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: MessageType.PING, payload: {} }));
          }
        }, 25_000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as ServerMessage;
          onMessageRef.current(msg);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (ev) => {
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        setConnected(false);
        onDisconnectedRef.current?.();

        // Don't reconnect on explicit auth failure or intentional close
        if (ev.code === 4001 || unmountedRef.current) return;

        const attempts = reconnectAttemptsRef.current;
        if (attempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempts);
          reconnectAttemptsRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [token]);

  return { send, connected };
}
