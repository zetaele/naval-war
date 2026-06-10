// ─── Enums ────────────────────────────────────────────────────────────────────

export enum CellState {
  EMPTY = 'EMPTY',
  SHIP = 'SHIP',
  HIT = 'HIT',
  MISS = 'MISS',
  SUNK = 'SUNK',
}

export enum Orientation {
  HORIZONTAL = 'HORIZONTAL',
  VERTICAL = 'VERTICAL',
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
}

export enum RoomState {
  WAITING = 'WAITING',
  SETUP = 'SETUP',
  IN_PROGRESS = 'IN_PROGRESS',
  FINISHED = 'FINISHED',
}

export enum MessageType {
  // Room management
  CREATE_ROOM = 'CREATE_ROOM',
  JOIN_ROOM = 'JOIN_ROOM',
  ROOM_CREATED = 'ROOM_CREATED',
  ROOM_JOINED = 'ROOM_JOINED',
  ROOM_ERROR = 'ROOM_ERROR',

  // Matchmaking
  JOIN_QUEUE = 'JOIN_QUEUE',
  LEAVE_QUEUE = 'LEAVE_QUEUE',
  QUEUE_JOINED = 'QUEUE_JOINED',
  MATCH_FOUND = 'MATCH_FOUND',

  // Game lifecycle
  GAME_STARTING = 'GAME_STARTING',
  BOARD_SETUP_PHASE = 'BOARD_SETUP_PHASE',

  // Ship placement
  PLACE_SHIPS = 'PLACE_SHIPS',
  PLACEMENT_CONFIRMED = 'PLACEMENT_CONFIRMED',
  BOTH_READY = 'BOTH_READY',

  // Gameplay
  ATTACK = 'ATTACK',
  ATTACK_RESULT = 'ATTACK_RESULT',
  GAME_STATE_UPDATE = 'GAME_STATE_UPDATE',
  TURN_CHANGE = 'TURN_CHANGE',
  GAME_OVER = 'GAME_OVER',

  // Connection
  PING = 'PING',
  PONG = 'PONG',

  // Auth
  AUTH_SUCCESS = 'AUTH_SUCCESS',
  AUTH_ERROR = 'AUTH_ERROR',

  // Disconnection
  PLAYER_DISCONNECTED = 'PLAYER_DISCONNECTED',
  PLAYER_RECONNECTED = 'PLAYER_RECONNECTED',
}

// ─── Core game types ──────────────────────────────────────────────────────────

export interface Coordinate {
  row: number;
  col: number;
}

export interface Ship {
  id: string;
  size: number;
  orientation: Orientation;
  cells: Coordinate[];
  hits: number;
  sunk: boolean;
}

export interface ShipSpec {
  size: number;
  count: number;
}

export interface DifficultyConfig {
  boardSize: number;
  fleet: ShipSpec[];
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.EASY]: {
    boardSize: 12,
    fleet: [
      { size: 5, count: 1 },
      { size: 4, count: 2 },
      { size: 3, count: 2 },
      { size: 2, count: 2 },
    ],
  },
  [Difficulty.MEDIUM]: {
    boardSize: 16,
    fleet: [
      { size: 6, count: 1 },
      { size: 5, count: 1 },
      { size: 4, count: 2 },
      { size: 3, count: 3 },
      { size: 2, count: 3 },
      { size: 1, count: 2 },
    ],
  },
  [Difficulty.HARD]: {
    boardSize: 20,
    fleet: [
      { size: 6, count: 1 },
      { size: 5, count: 2 },
      { size: 4, count: 3 },
      { size: 3, count: 4 },
      { size: 2, count: 4 },
      { size: 1, count: 4 },
    ],
  },
};

// ─── Board views ──────────────────────────────────────────────────────────────

export interface BoardView {
  size: number;
  cells: CellState[][];
}

export interface OwnBoard extends BoardView {
  ships: Ship[];
}

export interface PlayerGameState {
  roomId: string;
  difficulty: Difficulty;
  phase: RoomState;
  myBoard: OwnBoard;
  opponentBoard: BoardView;
  myTurn: boolean;
  moveCount: number;
  startedAt: string | null;
}

// ─── WebSocket messages: Client → Server ──────────────────────────────────────

export interface CreateRoomMessage {
  type: MessageType.CREATE_ROOM;
  payload: { difficulty: Difficulty };
}

export interface JoinRoomMessage {
  type: MessageType.JOIN_ROOM;
  payload: { code: string };
}

export interface JoinQueueMessage {
  type: MessageType.JOIN_QUEUE;
  payload: { difficulty: Difficulty };
}

export interface LeaveQueueMessage {
  type: MessageType.LEAVE_QUEUE;
  payload: Record<string, never>;
}

export interface PlaceShipsMessage {
  type: MessageType.PLACE_SHIPS;
  payload: { ships: PlacedShipInput[] };
}

export interface PlacedShipInput {
  id: string;
  size: number;
  orientation: Orientation;
  origin: Coordinate;
}

export interface AttackMessage {
  type: MessageType.ATTACK;
  payload: Coordinate;
}

export interface PingMessage {
  type: MessageType.PING;
  payload: Record<string, never>;
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | JoinQueueMessage
  | LeaveQueueMessage
  | PlaceShipsMessage
  | AttackMessage
  | PingMessage;

// ─── WebSocket messages: Server → Client ──────────────────────────────────────

export interface RoomCreatedMessage {
  type: MessageType.ROOM_CREATED;
  payload: { roomId: string; code: string; difficulty: Difficulty };
}

export interface RoomJoinedMessage {
  type: MessageType.ROOM_JOINED;
  payload: { roomId: string; difficulty: Difficulty; opponentUsername: string };
}

export interface RoomErrorMessage {
  type: MessageType.ROOM_ERROR;
  payload: { message: string };
}

export interface QueueJoinedMessage {
  type: MessageType.QUEUE_JOINED;
  payload: { difficulty: Difficulty };
}

export interface MatchFoundMessage {
  type: MessageType.MATCH_FOUND;
  payload: { roomId: string; difficulty: Difficulty; opponentUsername: string };
}

export interface GameStartingMessage {
  type: MessageType.GAME_STARTING;
  payload: { roomId: string; difficulty: Difficulty };
}

export interface BoardSetupPhaseMessage {
  type: MessageType.BOARD_SETUP_PHASE;
  payload: { difficulty: Difficulty; config: DifficultyConfig };
}

export interface PlacementConfirmedMessage {
  type: MessageType.PLACEMENT_CONFIRMED;
  payload: { playerId: string };
}

export interface BothReadyMessage {
  type: MessageType.BOTH_READY;
  payload: { firstTurnPlayerId: string };
}

export interface AttackResultPayload {
  attackerId: string;
  row: number;
  col: number;
  result: 'HIT' | 'MISS' | 'SUNK';
  sunkShipId?: string;
  sunkShipCells?: Coordinate[];
}

export interface AttackResultMessage {
  type: MessageType.ATTACK_RESULT;
  payload: AttackResultPayload;
}

export interface GameStateUpdateMessage {
  type: MessageType.GAME_STATE_UPDATE;
  payload: PlayerGameState;
}

export interface TurnChangeMessage {
  type: MessageType.TURN_CHANGE;
  payload: { currentTurnPlayerId: string };
}

export interface GameOverPayload {
  winnerId: string;
  winnerUsername: string;
  loserId: string;
  loserUsername: string;
  moveCount: number;
  durationSeconds: number;
}

export interface GameOverMessage {
  type: MessageType.GAME_OVER;
  payload: GameOverPayload;
}

export interface PongMessage {
  type: MessageType.PONG;
  payload: Record<string, never>;
}

export interface AuthSuccessMessage {
  type: MessageType.AUTH_SUCCESS;
  payload: { userId: string; username: string };
}

export interface AuthErrorMessage {
  type: MessageType.AUTH_ERROR;
  payload: { message: string };
}

export interface PlayerDisconnectedMessage {
  type: MessageType.PLAYER_DISCONNECTED;
  payload: { userId: string; username: string; resumeDeadlineMs: number };
}

export interface PlayerReconnectedMessage {
  type: MessageType.PLAYER_RECONNECTED;
  payload: { userId: string; username: string };
}

export type ServerMessage =
  | RoomCreatedMessage
  | RoomJoinedMessage
  | RoomErrorMessage
  | QueueJoinedMessage
  | MatchFoundMessage
  | GameStartingMessage
  | BoardSetupPhaseMessage
  | PlacementConfirmedMessage
  | BothReadyMessage
  | AttackResultMessage
  | GameStateUpdateMessage
  | TurnChangeMessage
  | GameOverMessage
  | PongMessage
  | AuthSuccessMessage
  | AuthErrorMessage
  | PlayerDisconnectedMessage
  | PlayerReconnectedMessage;

// ─── REST API types ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RankingEntry {
  rank: number;
  userId: string;
  username: string;
  wins: number;
  losses: number;
  winRate: number;
  gamesPlayed: number;
}

export interface RankingResponse {
  rankings: RankingEntry[];
}
