import { v4 as uuidv4 } from 'uuid';
import type WebSocket from 'ws';
import {
  MessageType,
  RoomState,
  CellState,
  DIFFICULTY_CONFIGS,
  type Difficulty,
  type ServerMessage,
} from '@naval-war/types';
import { clients, rooms, codeToRoomId, queue } from './state';
import type { Room, PlayerBoard } from './types';
import { send } from './send';

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function makeEmptyBoard(size: number): CellState[][] {
  return Array.from({ length: size }, () => Array(size).fill(CellState.EMPTY) as CellState[]);
}

export function createRoom(ws: WebSocket, difficulty: Difficulty): void {
  const client = clients.get(ws);
  if (!client) return;

  if (client.roomId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Already in a room' } });
    return;
  }

  let code: string;
  do { code = generateCode(); } while (codeToRoomId.has(code));

  const roomId = uuidv4();
  const boardSize = DIFFICULTY_CONFIGS[difficulty].boardSize;

  const board: PlayerBoard = {
    ships: [],
    cells: makeEmptyBoard(boardSize),
    confirmed: false,
  };

  const room: Room = {
    id: roomId,
    code,
    difficulty,
    state: RoomState.WAITING,
    hostId: client.userId,
    guestId: null,
    boards: new Map([[client.userId, board]]),
    currentTurnUserId: null,
    moveCount: 0,
    startedAt: null,
    disconnectTimers: new Map(),
  };

  rooms.set(roomId, room);
  codeToRoomId.set(code, roomId);
  client.roomId = roomId;

  send(ws, {
    type: MessageType.ROOM_CREATED,
    payload: { roomId, code, difficulty },
  });
}

export function joinRoom(ws: WebSocket, code: string): void {
  const client = clients.get(ws);
  if (!client) return;

  if (client.roomId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Already in a room' } });
    return;
  }

  const roomId = codeToRoomId.get(code.toUpperCase());
  if (!roomId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Room not found' } });
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Room not found' } });
    return;
  }

  if (room.state !== RoomState.WAITING) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Room is not open' } });
    return;
  }

  if (room.hostId === client.userId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Cannot join your own room' } });
    return;
  }

  room.guestId = client.userId;
  client.roomId = roomId;

  const boardSize = DIFFICULTY_CONFIGS[room.difficulty].boardSize;
  room.boards.set(client.userId, {
    ships: [],
    cells: makeEmptyBoard(boardSize),
    confirmed: false,
  });

  // Notify guest
  send(ws, {
    type: MessageType.ROOM_JOINED,
    payload: {
      roomId,
      difficulty: room.difficulty,
      opponentUsername: getUsernameById(room.hostId),
    },
  });

  // Notify host
  const hostWs = getWsByUserId(room.hostId);
  if (hostWs) {
    send(hostWs, {
      type: MessageType.ROOM_JOINED,
      payload: {
        roomId,
        difficulty: room.difficulty,
        opponentUsername: client.username,
      },
    });
  }

  startSetupPhase(room);
}

export function joinQueue(ws: WebSocket, difficulty: Difficulty): void {
  const client = clients.get(ws);
  if (!client) return;

  if (client.roomId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Already in a room' } });
    return;
  }

  // Remove any existing queue entry for this user
  const idx = queue.findIndex((e) => e.userId === client.userId);
  if (idx !== -1) queue.splice(idx, 1);

  // Look for an existing waiter with the same difficulty
  const matchIdx = queue.findIndex(
    (e) => e.difficulty === difficulty && e.userId !== client.userId,
  );

  if (matchIdx !== -1) {
    const [match] = queue.splice(matchIdx, 1);
    const matchWs = getWsByUserId(match.userId);
    if (!matchWs) {
      // Matched player disconnected; just enqueue current player
      enqueue(client.userId, difficulty);
      send(ws, { type: MessageType.QUEUE_JOINED, payload: { difficulty } });
      return;
    }

    // Create a room and put both players in it
    let code: string;
    do { code = generateCode(); } while (codeToRoomId.has(code));
    const roomId = uuidv4();
    const boardSize = DIFFICULTY_CONFIGS[difficulty].boardSize;

    const room: Room = {
      id: roomId,
      code,
      difficulty,
      state: RoomState.WAITING,
      hostId: match.userId,
      guestId: client.userId,
      boards: new Map([
        [match.userId, { ships: [], cells: makeEmptyBoard(boardSize), confirmed: false }],
        [client.userId, { ships: [], cells: makeEmptyBoard(boardSize), confirmed: false }],
      ]),
      currentTurnUserId: null,
      moveCount: 0,
      startedAt: null,
      disconnectTimers: new Map(),
    };

    rooms.set(roomId, room);
    codeToRoomId.set(code, roomId);

    const matchClient = clients.get(matchWs);
    const currentClient = clients.get(ws);
    if (matchClient) matchClient.roomId = roomId;
    if (currentClient) currentClient.roomId = roomId;

    const matchFoundHost: ServerMessage = {
      type: MessageType.MATCH_FOUND,
      payload: {
        roomId,
        difficulty,
        opponentUsername: client.username,
      },
    };
    const matchFoundGuest: ServerMessage = {
      type: MessageType.MATCH_FOUND,
      payload: {
        roomId,
        difficulty,
        opponentUsername: matchClient?.username ?? 'Unknown',
      },
    };

    send(matchWs, matchFoundHost);
    send(ws, matchFoundGuest);

    startSetupPhase(room);
  } else {
    enqueue(client.userId, difficulty);
    send(ws, { type: MessageType.QUEUE_JOINED, payload: { difficulty } });
  }
}

export function leaveQueue(ws: WebSocket): void {
  const client = clients.get(ws);
  if (!client) return;
  const idx = queue.findIndex((e) => e.userId === client.userId);
  if (idx !== -1) queue.splice(idx, 1);
}

function enqueue(userId: string, difficulty: Difficulty): void {
  queue.push({ userId, difficulty, joinedAt: new Date() });
}

function startSetupPhase(room: Room): void {
  room.state = RoomState.SETUP;

  const config = DIFFICULTY_CONFIGS[room.difficulty];
  const msg: ServerMessage = {
    type: MessageType.BOARD_SETUP_PHASE,
    payload: { difficulty: room.difficulty, config },
  };

  broadcastToRoom(room, msg);
}

export function broadcastToRoom(room: Room, msg: ServerMessage): void {
  const participants = [room.hostId, room.guestId].filter(Boolean) as string[];
  for (const uid of participants) {
    const ws = getWsByUserId(uid);
    if (ws) send(ws, msg);
  }
}

export function getWsByUserId(userId: string): WebSocket | undefined {
  for (const [ws, client] of clients) {
    if (client.userId === userId) return ws;
  }
  return undefined;
}

function getUsernameById(userId: string): string {
  for (const client of clients.values()) {
    if (client.userId === userId) return client.username;
  }
  return 'Unknown';
}

export function cleanupRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  // Clear all disconnect timers
  for (const timer of room.disconnectTimers.values()) {
    clearTimeout(timer);
  }

  codeToRoomId.delete(room.code);
  rooms.delete(roomId);
}
