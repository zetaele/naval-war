import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageType, CellState, type PlacedShipInput } from '@naval-war/types';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Board } from '../components/game/Board';
import { PlacementBoard } from '../components/game/PlacementBoard';
import { Button } from '../components/ui/Button';
import { motion, AnimatePresence } from 'framer-motion';

export function GamePage() {
  const { user, accessToken } = useAuth();
  const { state, dispatch, handleServerMessage } = useGame();
  const navigate = useNavigate();

  const [hoverCoord, setHoverCoord] = useState<{ row: number; col: number } | null>(null);
  const [sunkAnimation, setSunkAnimation] = useState<Array<{ row: number; col: number }>>([]);
  const sunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { send, connected } = useWebSocket({
    token: accessToken,
    onMessage: handleServerMessage,
    onDisconnected: () => dispatch({ type: 'ERROR', message: 'Connection lost. Attempting to reconnect…' }),
  });

  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  // Track sunk animation
  useEffect(() => {
    const attack = state.lastAttack;
    if (attack?.result === 'SUNK' && attack.sunkShipCells) {
      setSunkAnimation(attack.sunkShipCells);
      if (sunkTimerRef.current) clearTimeout(sunkTimerRef.current);
      sunkTimerRef.current = setTimeout(() => setSunkAnimation([]), 2000);
    }
  }, [state.lastAttack]);

  const handlePlacementConfirm = useCallback(
    (ships: PlacedShipInput[]) => {
      send({ type: MessageType.PLACE_SHIPS, payload: { ships } });
    },
    [send],
  );

  const handleAttack = useCallback(
    (row: number, col: number) => {
      if (!state.gameState?.myTurn) return;
      const cell = state.gameState.opponentBoard.cells[row]?.[col];
      if (cell === CellState.HIT || cell === CellState.MISS || cell === CellState.SUNK) return;
      send({ type: MessageType.ATTACK, payload: { row, col } });
    },
    [send, state.gameState],
  );

  if (!user) return null;

  const phase = state.phase;
  const gs = state.gameState;

  // ─── Setup phase ─────────────────────────────────────────────────────────────
  if (phase.name === 'setup') {
    return (
      <div className="min-h-screen bg-ocean-950 flex flex-col">
        <TopBar connected={connected} username={user.username} />
        <main className="flex-1 flex flex-col items-center justify-start py-6 px-4 gap-6 overflow-auto">
          <div className="text-center">
            <h2 className="text-xl font-bold text-white">Ship Placement</h2>
            <p className="text-ocean-400 text-sm mt-1">
              {state.phase.name === 'setup' ? `Difficulty: ${phase.difficulty}` : ''}
            </p>
          </div>

          {state.error && (
            <ErrorBanner message={state.error} onDismiss={() => dispatch({ type: 'CLEAR_ERROR' })} />
          )}

          <PlacementBoard
            difficulty={phase.difficulty}
            onConfirm={handlePlacementConfirm}
          />
        </main>
      </div>
    );
  }

  // ─── Game over ────────────────────────────────────────────────────────────────
  if (phase.name === 'game_over') {
    const result = phase.result;
    const won = result.winnerId === user.id;
    return (
      <div className="min-h-screen bg-ocean-950 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-ocean-900 border border-ocean-700 rounded-2xl p-8 text-center max-w-sm w-full shadow-2xl"
        >
          <div className="text-5xl mb-4">{won ? '🏆' : '💀'}</div>
          <h2 className={`text-2xl font-bold mb-2 ${won ? 'text-yellow-400' : 'text-red-400'}`}>
            {won ? 'Victory!' : 'Defeated'}
          </h2>
          <p className="text-ocean-300 text-sm mb-1">
            {won ? `You sank all of ${result.loserUsername}'s ships!` : `${result.winnerUsername} sank all your ships.`}
          </p>
          <p className="text-ocean-500 text-xs mb-6">
            {result.moveCount} moves · {result.durationSeconds}s
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => { dispatch({ type: 'RESET' }); navigate('/lobby'); }}>
              Back to Lobby
            </Button>
            <Button variant="secondary" onClick={() => navigate('/ranking')}>
              Rankings
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─── In game ──────────────────────────────────────────────────────────────────
  if (!gs) {
    return (
      <div className="min-h-screen bg-ocean-950 flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-ocean-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  const lastAttack = state.lastAttack
    ? { row: state.lastAttack.row, col: state.lastAttack.col }
    : null;

  const isTouch = window.matchMedia('(hover: none)').matches;

  // Hover preview on opponent board
  const hoverCells =
    !isTouch && hoverCoord && gs.myTurn
      ? [hoverCoord]
      : [];
  const hoverValid =
    hoverCoord
      ? gs.opponentBoard.cells[hoverCoord.row]?.[hoverCoord.col] === CellState.EMPTY
      : true;

  return (
    <div className="min-h-screen bg-ocean-950 flex flex-col">
      <TopBar connected={connected} username={user.username} />

      {/* Turn indicator */}
      <div className={`px-4 py-2 text-center text-sm font-medium transition-colors ${
        gs.myTurn ? 'bg-ocean-600 text-white' : 'bg-ocean-900 text-ocean-400'
      }`}>
        {gs.myTurn ? '⚔️ Your turn — attack!' : '⏳ Opponent\'s turn…'}
      </div>

      {/* Disconnection banner */}
      <AnimatePresence>
        {state.opponentDisconnected && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-yellow-900/80 border-b border-yellow-700 px-4 py-2 text-center text-sm text-yellow-200">
              Opponent disconnected — waiting up to 30s for reconnect…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state.error && (
        <ErrorBanner message={state.error} onDismiss={() => dispatch({ type: 'CLEAR_ERROR' })} />
      )}

      {/* Boards — side-by-side on desktop, stacked on mobile */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 p-4 overflow-auto">
        {/* Opponent board (attack target) */}
        <Board
          size={gs.opponentBoard.size}
          cells={gs.opponentBoard.cells}
          label="Opponent's Waters"
          lastAttackCoord={lastAttack}
          previewCells={hoverCells}
          previewValid={hoverValid}
          sunkShipCells={sunkAnimation}
          onCellClick={gs.myTurn ? handleAttack : undefined}
          onCellHover={(r, c) => { if (gs.myTurn) setHoverCoord({ row: r, col: c }); }}
          onCellLeave={() => setHoverCoord(null)}
          interactive={gs.myTurn}
          dimmed={!gs.myTurn}
        />

        {/* Own board */}
        <Board
          size={gs.myBoard.size}
          cells={gs.myBoard.cells}
          label="Your Waters"
        />
      </main>

      {/* Move counter */}
      <div className="px-4 py-2 text-center text-xs text-ocean-600">
        Move {gs.moveCount}
      </div>
    </div>
  );
}

function TopBar({ connected, username }: { connected: boolean; username: string }) {
  return (
    <header className="border-b border-ocean-800 px-4 py-2 flex items-center justify-between">
      <span className="text-sm font-bold text-white">Naval War</span>
      <span className="text-ocean-300 text-xs">
        {connected ? '🟢' : '🔴'} {username}
      </span>
    </header>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 flex items-center justify-between text-sm text-red-300">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-red-400 hover:text-red-200 ml-4 text-xs">✕</button>
    </div>
  );
}
