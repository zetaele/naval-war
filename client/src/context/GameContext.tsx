import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';
import {
  MessageType,
  type ServerMessage,
  type PlayerGameState,
  type GameOverPayload,
  type AttackResultPayload,
  type Difficulty,
} from '@naval-war/types';

type LobbyPhase =
  | { name: 'idle' }
  | { name: 'queuing'; difficulty: Difficulty }
  | { name: 'waiting_for_opponent'; roomId: string; code: string; difficulty: Difficulty }
  | { name: 'setup'; roomId: string; difficulty: Difficulty }
  | { name: 'in_game'; roomId: string }
  | { name: 'game_over'; result: GameOverPayload };

interface GameState {
  phase: LobbyPhase;
  gameState: PlayerGameState | null;
  lastAttack: AttackResultPayload | null;
  opponentDisconnected: boolean;
  opponentResumeDeadlineMs: number | null;
  error: string | null;
}

type GameAction =
  | { type: 'ROOM_CREATED'; roomId: string; code: string; difficulty: Difficulty }
  | { type: 'ROOM_JOINED'; roomId: string; difficulty: Difficulty }
  | { type: 'QUEUE_JOINED'; difficulty: Difficulty }
  | { type: 'MATCH_FOUND'; roomId: string; difficulty: Difficulty }
  | { type: 'SETUP_PHASE'; difficulty: Difficulty }
  | { type: 'GAME_STATE_UPDATE'; gameState: PlayerGameState }
  | { type: 'ATTACK_RESULT'; payload: AttackResultPayload }
  | { type: 'GAME_OVER'; payload: GameOverPayload }
  | { type: 'OPPONENT_DISCONNECTED'; userId: string; resumeDeadlineMs: number }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'ERROR'; message: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'RESET' };

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'ROOM_CREATED':
      return {
        ...state,
        phase: {
          name: 'waiting_for_opponent',
          roomId: action.roomId,
          code: action.code,
          difficulty: action.difficulty,
        },
        error: null,
      };

    case 'QUEUE_JOINED':
      return { ...state, phase: { name: 'queuing', difficulty: action.difficulty }, error: null };

    case 'ROOM_JOINED':
    case 'MATCH_FOUND':
      return {
        ...state,
        phase: { name: 'setup', roomId: action.roomId, difficulty: action.difficulty },
        error: null,
      };

    case 'SETUP_PHASE':
      return {
        ...state,
        phase:
          state.phase.name === 'in_game' || state.phase.name === 'game_over'
            ? state.phase
            : { name: 'setup', roomId: (state.phase as { roomId?: string }).roomId ?? '', difficulty: action.difficulty },
      };

    case 'GAME_STATE_UPDATE':
      return {
        ...state,
        gameState: action.gameState,
        phase:
          state.phase.name === 'setup' || state.phase.name === 'in_game'
            ? { name: 'in_game', roomId: action.gameState.roomId }
            : state.phase,
      };

    case 'ATTACK_RESULT':
      return { ...state, lastAttack: action.payload };

    case 'GAME_OVER':
      return { ...state, phase: { name: 'game_over', result: action.payload } };

    case 'OPPONENT_DISCONNECTED':
      return {
        ...state,
        opponentDisconnected: true,
        opponentResumeDeadlineMs: action.resumeDeadlineMs,
      };

    case 'OPPONENT_RECONNECTED':
      return { ...state, opponentDisconnected: false, opponentResumeDeadlineMs: null };

    case 'ERROR':
      return { ...state, error: action.message };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

const initialState: GameState = {
  phase: { name: 'idle' },
  gameState: null,
  lastAttack: null,
  opponentDisconnected: false,
  opponentResumeDeadlineMs: null,
  error: null,
};

interface GameContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  handleServerMessage: (msg: ServerMessage) => void;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case MessageType.ROOM_CREATED:
          dispatch({ type: 'ROOM_CREATED', ...msg.payload });
          break;
        case MessageType.ROOM_JOINED:
          dispatch({ type: 'ROOM_JOINED', roomId: msg.payload.roomId, difficulty: msg.payload.difficulty });
          break;
        case MessageType.QUEUE_JOINED:
          dispatch({ type: 'QUEUE_JOINED', difficulty: msg.payload.difficulty });
          break;
        case MessageType.MATCH_FOUND:
          dispatch({ type: 'MATCH_FOUND', roomId: msg.payload.roomId, difficulty: msg.payload.difficulty });
          break;
        case MessageType.BOARD_SETUP_PHASE:
          dispatch({ type: 'SETUP_PHASE', difficulty: msg.payload.difficulty });
          break;
        case MessageType.GAME_STATE_UPDATE:
          dispatch({ type: 'GAME_STATE_UPDATE', gameState: msg.payload });
          break;
        case MessageType.ATTACK_RESULT:
          dispatch({ type: 'ATTACK_RESULT', payload: msg.payload });
          break;
        case MessageType.GAME_OVER:
          dispatch({ type: 'GAME_OVER', payload: msg.payload });
          break;
        case MessageType.ROOM_ERROR:
          dispatch({ type: 'ERROR', message: msg.payload.message });
          break;
        case MessageType.PLAYER_DISCONNECTED:
          dispatch({
            type: 'OPPONENT_DISCONNECTED',
            userId: msg.payload.userId,
            resumeDeadlineMs: msg.payload.resumeDeadlineMs,
          });
          break;
        case MessageType.PLAYER_RECONNECTED:
          dispatch({ type: 'OPPONENT_RECONNECTED' });
          break;
      }
    },
    [],
  );

  return (
    <GameContext.Provider value={{ state, dispatch, handleServerMessage }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
