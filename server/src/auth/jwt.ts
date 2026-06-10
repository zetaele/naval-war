import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
}

const JWT_SECRET = process.env['JWT_SECRET'];
const REFRESH_SECRET = process.env['REFRESH_TOKEN_SECRET'];
const JWT_EXPIRES_IN = process.env['JWT_EXPIRES_IN'] ?? '15m';
const REFRESH_EXPIRES_IN = process.env['REFRESH_TOKEN_EXPIRES_IN'] ?? '7d';

function requireSecret(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export function signAccessToken(userId: string, username: string): string {
  const secret = requireSecret(JWT_SECRET, 'JWT_SECRET');
  return jwt.sign({ sub: userId, username }, secret, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const secret = requireSecret(JWT_SECRET, 'JWT_SECRET');
  return jwt.verify(token, secret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string): string {
  const secret = requireSecret(REFRESH_SECRET, 'REFRESH_TOKEN_SECRET');
  return jwt.sign({ sub: userId, jti: uuidv4() }, secret, {
    expiresIn: REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyRefreshToken(token: string): { sub: string } {
  const secret = requireSecret(REFRESH_SECRET, 'REFRESH_TOKEN_SECRET');
  return jwt.verify(token, secret) as { sub: string };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(): string {
  const days = parseInt(REFRESH_EXPIRES_IN.replace('d', ''), 10) || 7;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
