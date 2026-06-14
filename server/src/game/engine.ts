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
import type { Room } from '../ws/types';

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

    // If the bot goes first, kick off its first attack
    if (room.botUserId && firstTurnId === room.botUserId) {
      scheduleBotAttack(room, room.botUserId, room.hostId);
    }
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
    const loserUsername = room.botUserId === opponentId
      ? 'Bot'
      : (() => { const w = getWsByUserId(opponentId); return w ? (clients.get(w)?.username ?? 'Unknown') : 'Unknown'; })();

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

    if (!room.botUserId) void persistGame(room, client.userId, opponentId, duration);
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

  // If opponent is the bot, schedule its random attack
  if (room.botUserId && opponentId === room.botUserId) {
    scheduleBotAttack(room, room.botUserId, client.userId);
  }
}

function scheduleBotAttack(room: Room, botId: string, playerId: string): void {
  setTimeout(() => {
    const r = rooms.get(room.id);
    if (!r || r.state !== RoomState.IN_PROGRESS) return;
    if (r.currentTurnUserId !== botId) return;

    const playerBoard = r.boards.get(playerId);
    if (!playerBoard) return;

    // Collect all un-attacked cells
    const size = DIFFICULTY_CONFIGS[r.difficulty].boardSize;
    const targets: { row: number; col: number }[] = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const cell = playerBoard.cells[row]?.[col];
        if (cell === CellState.EMPTY || cell === CellState.SHIP) {
          targets.push({ row, col });
        }
      }
    }
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)]!;
    const { result, sunkShip } = applyAttack(playerBoard.cells, playerBoard.ships, target.row, target.col);
    r.moveCount += 1;

    const playerWs = getWsByUserId(playerId);
    if (!playerWs) return;

    send(playerWs, {
      type: MessageType.ATTACK_RESULT,
      payload: {
        attackerId: botId,
        row: target.row,
        col: target.col,
        result,
        sunkShipId: sunkShip?.id,
        sunkShipCells: sunkShip?.cells,
      },
    });

    if (allShipsSunk(playerBoard.ships)) {
      r.state = RoomState.FINISHED;
      const duration = r.startedAt ? Math.floor((Date.now() - r.startedAt.getTime()) / 1000) : 0;
      sendGameState(r, playerId);
      send(playerWs, {
        type: MessageType.GAME_OVER,
        payload: {
          winnerId: botId,
          winnerUsername: 'Bot',
          loserId: playerId,
          loserUsername: getClientUsername(playerId),
          moveCount: r.moveCount,
          durationSeconds: duration,
        },
      });
      cleanupRoom(r.id);
      return;
    }

    r.currentTurnUserId = playerId;
    sendGameState(r, playerId);
    send(playerWs, {
      type: MessageType.TURN_CHANGE,
      payload: { currentTurnPlayerId: playerId },
    });
  }, 600);
}

function getClientUsername(userId: string): string {
  for (const client of clients.values()) {
    if (client.userId === userId) return client.username;
  }
  return 'Unknown';
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

/**
 * Called when a player reconnects (or navigates to a new page that opens a
 * fresh WS). Sends the appropriate room state so the client can restore its UI.
 * The `ws` param is the newly opened socket, not yet stored in `clients` when
 * this runs — so we pass it explicitly instead of looking it up.
 */
export function resendStateToPlayer(userId: string, ws: import('ws').WebSocket): void {
  // Find the room this player is in
  let roomId: string | null = null;
  for (const client of clients.values()) {
    if (client.userId === userId) { roomId = client.roomId; break; }
  }
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  if (room.state === RoomState.SETUP) {
    send(ws, {
      type: MessageType.BOARD_SETUP_PHASE,
      payload: { difficulty: room.difficulty, config: DIFFICULTY_CONFIGS[room.difficulty] },
    });
  } else if (room.state === RoomState.IN_PROGRESS) {
    const opponentId = room.hostId === userId ? room.guestId : room.hostId;
    const myBoard = room.boards.get(userId);
    const oppBoard = room.boards.get(opponentId ?? '');
    if (!myBoard) return;

    const size = DIFFICULTY_CONFIGS[room.difficulty].boardSize;
    const gameState: PlayerGameState = {
      roomId: room.id,
      difficulty: room.difficulty,
      phase: room.state,
      myBoard: { size, cells: myBoard.cells, ships: myBoard.ships },
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
}

function getOpponentId(
  room: { hostId: string; guestId: string | null },
  userId: string,
): string | null {
  return room.hostId === userId ? room.guestId : room.hostId;
}

async function persistGame(
  room: { id: string; hostId: string; guestId: string | null; difficulty: string; moveCount: number; startedAt: Date | null },
  winnerId: string,
  loserId: string,
  duration: number,
): Promise<void> {
  try {
    const db = getDb();
    await db.execute({
      sql: 'INSERT OR IGNORE INTO games (id, player1_id, player2_id, winner_id, difficulty, moves_count, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [room.id, room.hostId, room.guestId ?? loserId, winnerId, room.difficulty, room.moveCount, duration],
    });
  } catch (err) {
    console.error('[game] failed to persist game:', err);
  }
}
