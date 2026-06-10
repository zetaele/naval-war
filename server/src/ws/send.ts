import type WebSocket from 'ws';
import type { ServerMessage } from '@naval-war/types';

export function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}
