import type { IncomingMessage } from 'http';
import type WebSocket from 'ws';
import type { WebSocketServer } from 'ws';
import { verifyAccessToken } from '../auth/jwt';
import { clients, rooms, queue, userRooms } from './state';
import { handleMessage } from './handler';
import { broadcastToRoom, cleanupRoom, getWsByUserId } from './rooms';
import { MessageType, RoomState, DIFFICULTY_CONFIGS } from '@naval-war/types';
import { send } from './send';
import { resendStateToPlayer } from '../game/engine';

const RECONNECT_TIMEOUT_MS = 30_000;

export function attachWebSocketServer(wss: WebSocketServer): void {
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const token = url.searchParams.get('token');

    if (!token) {
      send(ws, { type: MessageType.AUTH_ERROR, payload: { message: 'No token provided' } });
      ws.close(4001, 'Unauthorized');
      return;
    }

    let payload: { sub: string; username: string };
    try {
      payload = verifyAccessToken(token) as { sub: string; username: string };
    } catch {
      send(ws, { type: MessageType.AUTH_ERROR, payload: { message: 'Invalid token' } });
      ws.close(4001, 'Unauthorized');
      return;
    }

    // Handle reconnection: if player was in a room, restore their client state.
    // userRooms persists the userId→roomId mapping even after the old WS closes,
    // so page navigation (which reopens a fresh WS) restores the room correctly.
    const existingEntry = findExistingClient(payload.sub);
    const roomId = userRooms.get(payload.sub) ?? existingEntry?.roomId ?? null;

    if (existingEntry) {
      // Kill old dead socket entry
      clients.delete(existingEntry.ws);
    }

    clients.set(ws, {
      ws,
      userId: payload.sub,
      username: payload.username,
      roomId,
    });

    send(ws, { type: MessageType.AUTH_SUCCESS, payload: { userId: payload.sub, username: payload.username } });

    // Cancel any pending disconnect timer and notify opponent of reconnect
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        const timer = room.disconnectTimers.get(payload.sub);
        if (timer) {
          clearTimeout(timer);
          room.disconnectTimers.delete(payload.sub);
          broadcastToRoom(room, {
            type: MessageType.PLAYER_RECONNECTED,
            payload: { userId: payload.sub, username: payload.username },
          });
        }

        // Always resend current room state so the client can restore its UI
        // (happens on every navigate, since each page opens a fresh WS connection)
        resendStateToPlayer(payload.sub, ws);
      }
    }

    ws.on('message', (data) => {
      handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (!client) return;

      clients.delete(ws);

      // Remove from queue if waiting
      const qIdx = queue.findIndex((e) => e.userId === client.userId);
      if (qIdx !== -1) queue.splice(qIdx, 1);

      if (!client.roomId) return;

      const room = rooms.get(client.roomId);
      if (!room || room.state === RoomState.FINISHED || room.state === RoomState.WAITING) {
        if (room) cleanupRoom(room.id);
        return;
      }

      const opponentId = getOpponentId(room, client.userId);

      // Notify opponent
      if (opponentId) {
        const oppWs = getWsByUserId(opponentId);
        if (oppWs) {
          send(oppWs, {
            type: MessageType.PLAYER_DISCONNECTED,
            payload: {
              userId: client.userId,
              username: client.username,
              resumeDeadlineMs: Date.now() + RECONNECT_TIMEOUT_MS,
            },
          });
        }
      }

      // Start reconnect timer
      const timer = setTimeout(() => {
        const r = rooms.get(client.roomId!);
        if (!r) return;

        // Award win to opponent if game was in progress
        if (r.state === RoomState.IN_PROGRESS && opponentId) {
          const oppWs = getWsByUserId(opponentId);
          if (oppWs) {
            const duration = r.startedAt ? Math.floor((Date.now() - r.startedAt.getTime()) / 1000) : 0;
            send(oppWs, {
              type: MessageType.GAME_OVER,
              payload: {
                winnerId: opponentId,
                winnerUsername: getUsernameFromRoom(r, opponentId),
                loserId: client.userId,
                loserUsername: client.username,
                moveCount: r.moveCount,
                durationSeconds: duration,
              },
            });
          }

          // Persist the game result
          void persistGame(r, opponentId);
        }

        cleanupRoom(r.id);
      }, RECONNECT_TIMEOUT_MS);

      room.disconnectTimers.set(client.userId, timer);
    });

    ws.on('error', (err) => {
      console.error(`[ws] error for ${payload.username}:`, err.message);
    });
  });
}

function findExistingClient(userId: string): { ws: WebSocket; roomId: string | null } | null {
  for (const [ws, client] of clients) {
    if (client.userId === userId) return { ws, roomId: client.roomId };
  }
  return null;
}

function getOpponentId(room: { hostId: string; guestId: string | null }, userId: string): string | null {
  if (room.hostId === userId) return room.guestId;
  return room.hostId;
}

function getUsernameFromRoom(room: { hostId: string; guestId: string | null }, userId: string): string {
  for (const client of clients.values()) {
    if (client.userId === userId) return client.username;
  }
  return 'Unknown';
}

async function persistGame(
  room: { id: string; hostId: string; guestId: string | null; difficulty: string; moveCount: number; startedAt: Date | null },
  winnerId: string,
): Promise<void> {
  try {
    const { getDb } = await import('../db/client');
    const db = getDb();
    const duration = room.startedAt ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000) : 0;
    db.prepare(
      'INSERT OR IGNORE INTO games (id, player1_id, player2_id, winner_id, difficulty, moves_count, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      room.id,
      room.hostId,
      room.guestId ?? room.hostId,
      winnerId,
      room.difficulty,
      room.moveCount,
      duration,
    );
  } catch (err) {
    console.error('[ws] failed to persist game:', err);
  }
}
