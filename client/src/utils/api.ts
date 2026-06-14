import type { ApiResponse, AuthResponse, RefreshResponse } from '@naval-war/types';

const BASE = (import.meta.env['VITE_API_URL'] ?? '') + '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json() as Promise<ApiResponse<T>>;
}

export async function register(
  username: string,
  password: string,
): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function login(
  username: string,
  password: string,
): Promise<ApiResponse<AuthResponse>> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export async function refreshTokens(
  refreshToken: string,
): Promise<ApiResponse<RefreshResponse>> {
  return request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logout(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ refreshToken }),
  });
}
