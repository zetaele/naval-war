import { Router } from 'express';
import { getDb } from '../db/client';
import type { ApiResponse, RankingResponse, RankingEntry } from '@naval-war/types';

const router = Router();

router.get('/', async (_req, res) => {
  const db = getDb();

  const result = await db.execute(`
    SELECT
      u.id        AS user_id,
      u.username,
      COUNT(CASE WHEN g.winner_id = u.id THEN 1 END)                      AS wins,
      COUNT(CASE WHEN g.winner_id IS NOT NULL
                  AND g.winner_id != u.id THEN 1 END)                     AS losses,
      COUNT(g.id)                                                           AS games_played
    FROM users u
    LEFT JOIN games g
      ON (g.player1_id = u.id OR g.player2_id = u.id)
      AND g.winner_id IS NOT NULL
    GROUP BY u.id
    HAVING games_played > 0
    ORDER BY wins DESC, losses ASC
    LIMIT 20
  `);

  const rankings: RankingEntry[] = result.rows.map((row, i) => ({
    rank: i + 1,
    userId: String(row['user_id']),
    username: String(row['username']),
    wins: Number(row['wins']),
    losses: Number(row['losses']),
    gamesPlayed: Number(row['games_played']),
    winRate:
      Number(row['games_played']) > 0
        ? Math.round((Number(row['wins']) / Number(row['games_played'])) * 100) / 100
        : 0,
  }));

  const response: ApiResponse<RankingResponse> = { success: true, data: { rankings } };
  res.json(response);
});

export default router;
