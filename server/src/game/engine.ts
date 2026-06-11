import type WebSocket from 'ws';
import {
  MessageType,
  RoomState,
  CellState,
  DIFFICULTY_CONFIGS,
  type PlacedShipInput,
  type PlayerGameState,
} from '@naval-war/types';
import { clients, rooms } from '../ws/state';
import { send } from '../ws/send';
import { broadcastToRoom, getWsByUserId, cleanupRoom } from '../ws/rooms';
import { validateAndBuildBoard, applyAttack, allShipsSunk, maskBoard } from './board';
import { getDb } from '../db/client';

export function handlePlaceShips(ws: WebSocket, ships: PlacedShipInput[]): void {
  const client = clients.get(ws);
  if (!client?.roomId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Not in a room' } });
    return;
  }

  const room = rooms.get(client.roomId);
  if (!room || room.state !== RoomState.SETUP) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Not in setup phase' } });
    return;
  }

  const board = room.boards.get(client.userId);
  if (!board) return;

  if (board.confirmed) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Already confirmed placement' } });
    return;
  }

  const result = validateAndBuildBoard(ships, room.difficulty);
  if (!result.valid) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: result.error } });
    return;
  }

  board.ships = result.ships;
  board.cells = result.cells;
  board.confirmed = true;

  broadcastToRoom(room, {
    type: MessageType.PLACEMENT_CONFIRMED,
    payload: { playerId: client.userId },
  });

  // Check if both players are ready
  const participants = [room.hostId, room.guestId].filter(Boolean) as string[];
  const allReady = participants.every((uid) => room.boards.get(uid)?.confirmed);

  if (allReady && room.guestId) {
    // Choose random first turn
    const firstTurnId = Math.random() < 0.5 ? room.hostId : room.guestId;
    room.currentTurnUserId = firstTurnId;
    room.state = RoomState.IN_PROGRESS;
    room.startedAt = new Date();

    broadcastToRoom(room, {
      type: MessageType.BOTH_READY,
      payload: { firstTurnPlayerId: firstTurnId },
    });

    // Send each player their initial game state
    sendGameState(room, room.hostId);
    sendGameState(room, room.guestId);
  }
}

export function handleAttack(ws: WebSocket, row: number, col: number): void {
  const client = clients.get(ws);
  if (!client?.roomId) return;

  const room = rooms.get(client.roomId);
  if (!room || room.state !== RoomState.IN_PROGRESS) return;

  if (room.currentTurnUserId !== client.userId) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Not your turn' } });
    return;
  }

  const config = DIFFICULTY_CONFIGS[room.difficulty];
  if (row < 0 || row >= config.boardSize || col < 0 || col >= config.boardSize) {
    send(ws, { type: MessageType.ROOM_ERROR, payload: { message: 'Attack out of bounds' } });
    return;
  }

  const opponentId = room.hostId === client.userId ? room.guestId : room.hostId;
  if (!opponentId) return;

  const opponentBoard = room.boards.get(opponentId);
  if (!opponentBoard) return;

  const { result, sunkShip } = applyAttack(opponentBoard.cells, opponentBoard.ships, row, col);

  room.moveCount += 1;

  broadcastToRoom(room, {
    type: MessageType.ATTACK_RESULT,
    payload: {
      attackerId: client.userId,
      row,
      col,
      result,
      sunkShipId: sunkShip?.id,
      sunkShipCells: sunkShip?.cells,
    },
  });

  if (allShipsSunk(opponentBoard.ships)) {
    room.state = RoomState.FINISHED;
    const duration = room.startedAt
      ? Math.floor((Date.now() - room.startedAt.getTime()) / 1000)
      : 0;

    const winnerUsername = client.username;
    const loserWs = getWsByUserId(opponentId);
    const loserUsername = loserWs ? (clients.get(loserWs)?.username ?? 'Unknown') : 'Unknown';

    // Send final board state before game-over notification
    sendGameState(room, room.hostId);
    if (room.guestId) sendGameState(room, room.guestId);

    broadcastToRoom(room, {
      type: MessageType.GAME_OVER,
      payload: {
        winnerId: client.userId,
        winnerUsername,
        loserId: opponentId,
        loserUsername,
        moveCount: room.moveCount,
        durationSeconds: duration,
      },
    });

    persistGame(room, client.userId, opponentId, duration);
    cleanupRoom(room.id);
    return;
  }

  // Advance turn BEFORE sending game state so myTurn flags are correct
  room.currentTurnUserId = opponentId;

  sendGameState(room, room.hostId);
  if (room.guestId) sendGameState(room, room.guestId);

  broadcastToRoom(room, {
    type: MessageType.TURN_CHANGE,
    payload: { currentTurnPlayerId: opponentId },
  });
}

function sendGameState(
  room: {
    id: string;
    hostId: string;
    guestId: string | null;
    difficulty: import('@naval-war/types').Difficulty;
    state: RoomState;
    boards: Map<string, { ships: import('@naval-war/types').Ship[]; cells: CellState[][]; confirmed: boolean }>;
    currentTurnUserId: string | null;
    moveCount: number;
    startedAt: Date | null;
  },
  userId: string,
): void {
  if (!userId) return;
  const ws = getWsByUserId(userId);
  if (!ws) return;

  const opponentId = getOpponentId(room, userId);

  const myBoard = room.boards.get(userId);
  const oppBoard = room.boards.get(opponentId ?? '');

  if (!myBoard) return;

  const size = DIFFICULTY_CONFIGS[room.difficulty].boardSize;

  const gameState: PlayerGameState = {
    roomId: room.id,
    difficulty: room.difficulty,
    phase: room.state,
    myBoard: {
      size,
      cells: myBoard.cells,
      ships: myBoard.ships,
    },
    opponentBoard: {
      size,
      cells: oppBoard ? maskBoard(oppBoard.cells) : Array.from({ length: size }, () =>
        Array<CellState>(size).fill(CellState.EMPTY),
      ),
    },
    myTurn: room.currentTurnUserId === userId,
    moveCount: room.moveCount,
    startedAt: room.startedAt?.toISOString() ?? null,
  };

  send(ws, { type: MessageType.GAME_STATE_UPDATE, payload: gameState });
}

function getOpponentId(
  room: { hostId: string; guestId: string | null },
  userId: string,
): string | null {
  return room.hostId === userId ? room.guestId : room.hostId;
}

function persistGame(
  room: { id: string; hostId: string; guestId: string | null; difficulty: string; moveCount: number; startedAt: Date | null },
  winnerId: string,
  loserId: string,
  duration: number,
): void {
  try {
    const db = getDb();
    db.prepare(
      'INSERT OR IGNORE INTO games (id, player1_id, player2_id, winner_id, difficulty, moves_count, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(room.id, room.hostId, room.guestId ?? loserId, winnerId, room.difficulty, room.moveCount, duration);
  } catch (err) {
    console.error('[game] failed to persist game:', err);
  }
}
