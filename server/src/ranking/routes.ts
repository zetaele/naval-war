import { Router } from 'express';
import { getDb } from '../db/client';
import type { ApiResponse, RankingResponse, RankingEntry } from '@naval-war/types';

const router = Router();

router.get('/', (_req, res) => {
  const db = getDb();

  const rows = db.prepare<[], {
    user_id: string;
    username: string;
    wins: number;
    losses: number;
    games_played: number;
  }>(`
    SELECT
      u.id        AS user_id,
      u.username,
      COUNT(CASE WHEN g.winner_id = u.id THEN 1 END)     AS wins,
      COUNT(CASE WHEN g.winner_id IS NOT NULL
                  AND g.winner_id != u.id THEN 1 END)    AS losses,
      COUNT(g.id)                                         AS games_played
    FROM users u
    LEFT JOIN games g
      ON (g.player1_id = u.id OR g.player2_id = u.id)
      AND g.winner_id IS NOT NULL
    GROUP BY u.id
    HAVING games_played > 0
    ORDER BY wins DESC, losses ASC
    LIMIT 20
  `).all();

  const rankings: RankingEntry[] = rows.map((row, i) => ({
    rank: i + 1,
    userId: row.user_id,
    username: row.username,
    wins: row.wins,
    losses: row.losses,
    gamesPlayed: row.games_played,
    winRate: row.games_played > 0 ? Math.round((row.wins / row.games_played) * 100) / 100 : 0,
  }));

  const response: ApiResponse<RankingResponse> = {
    success: true,
    data: { rankings },
  };
  res.json(response);
});

export default router;
