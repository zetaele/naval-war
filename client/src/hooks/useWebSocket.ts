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

  // Keep refs up-to-date without reconnecting
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

    const WS_URL = `ws://${window.location.hostname}:3001?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
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

    ws.onclose = () => {
      setConnected(false);
      onDisconnectedRef.current?.();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };

    ws.onerror = () => {
      ws.close();
    };

    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      ws.close();
    };
  }, [token]);

  return { send, connected };
}
