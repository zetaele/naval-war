import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Difficulty, MessageType } from '@naval-war/types';
import { useAuth } from '../context/AuthContext';
import { useGame } from '../context/GameContext';
import { useWebSocket } from '../hooks/useWebSocket';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  [Difficulty.EASY]: 'Easy (8×8)',
  [Difficulty.MEDIUM]: 'Medium (16×16)',
  [Difficulty.HARD]: 'Hard (20×20)',
};

export function LobbyPage() {
  const { user, accessToken, logout } = useAuth();
  const { state, dispatch, handleServerMessage } = useGame();
  const navigate = useNavigate();

  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.EASY);
  const [joinCode, setJoinCode] = useState('');
  const [tab, setTab] = useState<'solo' | 'queue' | 'create' | 'join'>('solo');

  const { send, connected } = useWebSocket({
    token: accessToken,
    onMessage: handleServerMessage,
  });

  // Redirect to game/setup when a room is ready
  useEffect(() => {
    const phase = state.phase;
    if (phase.name === 'setup' || phase.name === 'in_game') {
      navigate(`/game/${phase.roomId}`);
    }
  }, [state.phase, navigate, send]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) navigate('/auth', { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  const phase = state.phase;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ocean-950 to-ocean-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-ocean-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Naval War</h1>
        <div className="flex items-center gap-3">
          <span className="text-ocean-300 text-sm">
            {connected ? '🟢' : '🔴'} {user.username}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/ranking')}>
            Rankings
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Queuing state */}
          {phase.name === 'queuing' && (
            <div className="bg-ocean-900 rounded-2xl border border-ocean-700 p-8 text-center">
              <div className="h-12 w-12 mx-auto mb-4 rounded-full border-4 border-ocean-400 border-t-transparent animate-spin" />
              <h2 className="text-xl font-bold mb-2">Searching for opponent…</h2>
              <p className="text-ocean-400 text-sm mb-6">
                {DIFFICULTY_LABELS[phase.difficulty]}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  send({ type: MessageType.LEAVE_QUEUE, payload: {} });
                  dispatch({ type: 'RESET' });
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Waiting for opponent in private room */}
          {phase.name === 'waiting_for_opponent' && (
            <div className="bg-ocean-900 rounded-2xl border border-ocean-700 p-8 text-center">
              <h2 className="text-xl font-bold mb-2">Room Created</h2>
              <p className="text-ocean-400 text-sm mb-6">Share this code with your friend</p>
              <div className="bg-ocean-950 rounded-xl py-4 px-6 text-4xl font-mono font-bold tracking-widest text-ocean-200 mb-6 border border-ocean-700">
                {phase.code}
              </div>
              <div className="h-8 w-8 mx-auto mb-4 rounded-full border-4 border-ocean-400 border-t-transparent animate-spin" />
              <p className="text-ocean-400 text-sm">Waiting for opponent…</p>
            </div>
          )}

          {/* Idle — show tabs */}
          {phase.name === 'idle' && (
            <div className="bg-ocean-900 rounded-2xl border border-ocean-700 shadow-2xl shadow-black/50 overflow-hidden">
              <div className="flex border-b border-ocean-700">
                {(['solo', 'queue', 'create', 'join'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); dispatch({ type: 'CLEAR_ERROR' }); }}
                    className={`flex-1 py-3 text-sm font-medium capitalize transition-colors ${
                      tab === t ? 'bg-ocean-700 text-white' : 'text-ocean-400 hover:text-ocean-200 hover:bg-ocean-800'
                    }`}
                  >
                    {t === 'solo' ? 'Solo' : t === 'queue' ? 'Matchmaking' : t === 'create' ? 'Create Room' : 'Join Room'}
                  </button>
                ))}
              </div>

              <div className="p-6 flex flex-col gap-4">
                {/* Difficulty picker (shared by solo, create + queue) */}
                {tab !== 'join' && (
                  <div>
                    <p className="text-sm font-medium text-ocean-200 mb-2">Difficulty</p>
                    <div className="flex flex-col gap-2">
                      {Object.values(Difficulty).map((d) => (
                        <label
                          key={d}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                            difficulty === d
                              ? 'border-ocean-400 bg-ocean-800 text-white'
                              : 'border-ocean-700 text-ocean-400 hover:border-ocean-500'
                          }`}
                        >
                          <input
                            type="radio"
                            name="difficulty"
                            value={d}
                            checked={difficulty === d}
                            onChange={() => setDifficulty(d)}
                            className="accent-ocean-400"
                          />
                          {DIFFICULTY_LABELS[d]}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {tab === 'join' && (
                  <Input
                    id="code"
                    label="Room Code"
                    placeholder="ABC123"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono tracking-widest text-center text-xl uppercase"
                  />
                )}

                {state.error && (
                  <p className="text-sm text-red-400 text-center bg-red-950/50 rounded-lg py-2 px-3 border border-red-800">
                    {state.error}
                  </p>
                )}

                <Button
                  onClick={() => {
                    dispatch({ type: 'CLEAR_ERROR' });
                    if (tab === 'solo') {
                      send({ type: MessageType.START_SOLO, payload: { difficulty } });
                    } else if (tab === 'queue') {
                      send({ type: MessageType.JOIN_QUEUE, payload: { difficulty } });
                    } else if (tab === 'create') {
                      send({ type: MessageType.CREATE_ROOM, payload: { difficulty } });
                    } else {
                      send({ type: MessageType.JOIN_ROOM, payload: { code: joinCode } });
                    }
                  }}
                  disabled={!connected || (tab === 'join' && joinCode.length !== 6)}
                  size="lg"
                >
                  {tab === 'solo' ? 'Play Solo' : tab === 'queue' ? 'Find Match' : tab === 'create' ? 'Create Room' : 'Join Room'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
