import type { Client } from '@libsql/client';

export async function initSchema(db: Client): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS games (
      id               TEXT PRIMARY KEY,
      player1_id       TEXT NOT NULL REFERENCES users(id),
      player2_id       TEXT NOT NULL REFERENCES users(id),
      winner_id        TEXT REFERENCES users(id),
      difficulty       TEXT NOT NULL,
      moves_count      INTEGER NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_player1_id ON games(player1_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_player2_id ON games(player2_id)`,
    `CREATE INDEX IF NOT EXISTS idx_games_winner_id ON games(winner_id)`,
  ];

  for (const sql of statements) {
    await db.execute(sql);
  }
}
