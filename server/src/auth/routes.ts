import { Router } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/client';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
} from './jwt';
import { requireAuth, type AuthRequest } from './middleware';
import type { AuthResponse, RefreshResponse, ApiResponse } from '@naval-war/types';

const router = Router();
const BCRYPT_ROUNDS = 12;

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
}

interface RefreshTokenRow {
  id: string;
  user_id: string;
  expires_at: string;
}

router.post('/register', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    const response: ApiResponse<never> = { success: false, error: 'Username and password required' };
    res.status(400).json(response);
    return;
  }

  if (username.length < 3 || username.length > 20) {
    const response: ApiResponse<never> = { success: false, error: 'Username must be 3–20 characters' };
    res.status(400).json(response);
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    const response: ApiResponse<never> = { success: false, error: 'Username may only contain letters, numbers, _ and -' };
    res.status(400).json(response);
    return;
  }

  if (password.length < 6) {
    const response: ApiResponse<never> = { success: false, error: 'Password must be at least 6 characters' };
    res.status(400).json(response);
    return;
  }

  const db = getDb();
  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  if (existing.rows.length > 0) {
    const response: ApiResponse<never> = { success: false, error: 'Username already taken' };
    res.status(409).json(response);
    return;
  }

  const id = uuidv4();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.execute({ sql: 'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)', args: [id, username, passwordHash] });

  const accessToken = signAccessToken(id, username);
  const refreshToken = signRefreshToken(id);
  const tokenHash = hashToken(refreshToken);

  await db.execute({
    sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [uuidv4(), id, tokenHash, refreshTokenExpiresAt()],
  });

  const response: ApiResponse<AuthResponse> = {
    success: true,
    data: { accessToken, refreshToken, user: { id, username } },
  };
  res.status(201).json(response);
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    const response: ApiResponse<never> = { success: false, error: 'Username and password required' };
    res.status(400).json(response);
    return;
  }

  const db = getDb();
  const result = await db.execute({ sql: 'SELECT id, username, password_hash FROM users WHERE username = ?', args: [username] });
  const user = result.rows[0] as unknown as UserRow | undefined;

  if (!user) {
    const response: ApiResponse<never> = { success: false, error: 'Invalid credentials' };
    res.status(401).json(response);
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    const response: ApiResponse<never> = { success: false, error: 'Invalid credentials' };
    res.status(401).json(response);
    return;
  }

  const accessToken = signAccessToken(user.id, user.username);
  const refreshToken = signRefreshToken(user.id);
  const tokenHash = hashToken(refreshToken);

  await db.execute({
    sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [uuidv4(), user.id, tokenHash, refreshTokenExpiresAt()],
  });

  const response: ApiResponse<AuthResponse> = {
    success: true,
    data: { accessToken, refreshToken, user: { id: user.id, username: user.username } },
  };
  res.json(response);
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };

  if (!refreshToken) {
    const response: ApiResponse<never> = { success: false, error: 'Refresh token required' };
    res.status(400).json(response);
    return;
  }

  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    const response: ApiResponse<never> = { success: false, error: 'Invalid or expired refresh token' };
    res.status(401).json(response);
    return;
  }

  const db = getDb();
  const tokenHash = hashToken(refreshToken);
  const storedResult = await db.execute({ sql: 'SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?', args: [tokenHash] });
  const stored = storedResult.rows[0] as unknown as RefreshTokenRow | undefined;

  if (!stored || new Date(stored.expires_at) < new Date()) {
    const response: ApiResponse<never> = { success: false, error: 'Refresh token revoked or expired' };
    res.status(401).json(response);
    return;
  }

  const userResult = await db.execute({ sql: 'SELECT id, username FROM users WHERE id = ?', args: [payload.sub] });
  const user = userResult.rows[0] as unknown as { id: string; username: string } | undefined;
  if (!user) {
    const response: ApiResponse<never> = { success: false, error: 'User not found' };
    res.status(401).json(response);
    return;
  }

  // Rotate: delete old token, issue new pair
  await db.execute({ sql: 'DELETE FROM refresh_tokens WHERE id = ?', args: [stored.id] });

  const newAccessToken = signAccessToken(user.id, user.username);
  const newRefreshToken = signRefreshToken(user.id);
  await db.execute({
    sql: 'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    args: [uuidv4(), user.id, hashToken(newRefreshToken), refreshTokenExpiresAt()],
  });

  const response: ApiResponse<RefreshResponse> = {
    success: true,
    data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
  };
  res.json(response);
});

router.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    const db = getDb();
    await db.execute({ sql: 'DELETE FROM refresh_tokens WHERE token_hash = ?', args: [hashToken(refreshToken)] });
  }
  res.json({ success: true });
});

router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ success: true, data: { id: req.user?.sub, username: req.user?.username } });
});

export default router;
