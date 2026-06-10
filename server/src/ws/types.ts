import type WebSocket from 'ws';
import type { Difficulty, RoomState, Ship } from '@naval-war/types';

export interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  username: string;
  roomId: string | null;
}

export interface Room {
  id: string;
  code: string;
  difficulty: Difficulty;
  state: RoomState;
  hostId: string;
  guestId: string | null;
  boards: Map<string, PlayerBoard>;
  currentTurnUserId: string | null;
  moveCount: number;
  startedAt: Date | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
}

export interface PlayerBoard {
  ships: Ship[];
  cells: import('@naval-war/types').CellState[][];
  confirmed: boolean;
}

export interface QueueEntry {
  userId: string;
  difficulty: Difficulty;
  joinedAt: Date;
}
