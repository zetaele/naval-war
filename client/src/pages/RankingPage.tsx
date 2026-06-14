import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RankingEntry } from '@naval-war/types';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';

export function RankingPage() {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/auth', { replace: true }); return; }

    fetch((import.meta.env['VITE_API_URL'] ?? '') + '/api/ranking', {
      headers: { Authorization: `Bearer ${accessToken ?? ''}` },
    })
      .then((r) => r.json())
      .then((data: { success: boolean; data?: { rankings: RankingEntry[] }; error?: string }) => {
        if (data.success && data.data) {
          setRankings(data.data.rankings);
        } else {
          setError(data.error ?? 'Failed to load rankings');
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [user, accessToken, navigate]);

  return (
    <div className="min-h-screen bg-ocean-950 flex flex-col">
      <header className="border-b border-ocean-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Naval War</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
          ← Lobby
        </Button>
      </header>

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold text-white mb-1">Rankings</h2>
        <p className="text-ocean-400 text-sm mb-6">Top 20 admirals by win rate</p>

        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-4 border-ocean-400 border-t-transparent animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center text-red-400 py-8">{error}</div>
        )}

        {!loading && !error && rankings.length === 0 && (
          <div className="text-center text-ocean-500 py-16">
            No games played yet. Be the first!
          </div>
        )}

        {rankings.length > 0 && (
          <div className="bg-ocean-900 rounded-xl border border-ocean-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ocean-700 text-ocean-400 text-xs uppercase">
                  <th className="py-3 px-4 text-left w-10">#</th>
                  <th className="py-3 px-4 text-left">Player</th>
                  <th className="py-3 px-4 text-right">W</th>
                  <th className="py-3 px-4 text-right">L</th>
                  <th className="py-3 px-4 text-right">Games</th>
                  <th className="py-3 px-4 text-right">Win %</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((entry) => {
                  const isMe = entry.userId === user?.id;
                  return (
                    <tr
                      key={entry.userId}
                      className={`border-b border-ocean-800/50 last:border-0 transition-colors ${isMe ? 'bg-ocean-700/30' : 'hover:bg-ocean-800/30'}`}
                    >
                      <td className="py-3 px-4 text-ocean-500 font-mono">{entry.rank}</td>
                      <td className="py-3 px-4 font-medium text-white">
                        {entry.username}
                        {isMe && <span className="ml-2 text-xs text-ocean-400">(you)</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-green-400">{entry.wins}</td>
                      <td className="py-3 px-4 text-right text-red-400">{entry.losses}</td>
                      <td className="py-3 px-4 text-right text-ocean-300">{entry.gamesPlayed}</td>
                      <td className="py-3 px-4 text-right font-mono text-ocean-200">
                        {(entry.winRate * 100).toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
