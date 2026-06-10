const KEYS = {
  accessToken: 'nw_access_token',
  refreshToken: 'nw_refresh_token',
  userId: 'nw_user_id',
  username: 'nw_username',
} as const;

export function saveTokens(
  accessToken: string,
  refreshToken: string,
  userId: string,
  username: string,
): void {
  localStorage.setItem(KEYS.accessToken, accessToken);
  localStorage.setItem(KEYS.refreshToken, refreshToken);
  localStorage.setItem(KEYS.userId, userId);
  localStorage.setItem(KEYS.username, username);
}

export function loadTokens(): {
  accessToken: string;
  refreshToken: string;
  userId: string;
  username: string;
} | null {
  const accessToken = localStorage.getItem(KEYS.accessToken);
  const refreshToken = localStorage.getItem(KEYS.refreshToken);
  const userId = localStorage.getItem(KEYS.userId);
  const username = localStorage.getItem(KEYS.username);

  if (accessToken && refreshToken && userId && username) {
    return { accessToken, refreshToken, userId, username };
  }
  return null;
}

export function clearTokens(): void {
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
}

export function saveAccessToken(token: string): void {
  localStorage.setItem(KEYS.accessToken, token);
}
