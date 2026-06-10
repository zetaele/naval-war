import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import * as api from '../utils/api';
import { saveTokens, loadTokens, clearTokens, saveAccessToken } from '../utils/storage';

interface AuthUser {
  id: string;
  username: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialState(): AuthState {
  const stored = loadTokens();
  if (stored) {
    return {
      user: { id: stored.userId, username: stored.username },
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      loading: false,
    };
  }
  return { user: null, accessToken: null, refreshToken: null, loading: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(loadInitialState);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    if (!res.success || !res.data) return res.error ?? 'Login failed';

    const { accessToken, refreshToken, user } = res.data;
    saveTokens(accessToken, refreshToken, user.id, user.username);
    setState({ user, accessToken, refreshToken, loading: false });
    return null;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await api.register(username, password);
    if (!res.success || !res.data) return res.error ?? 'Registration failed';

    const { accessToken, refreshToken, user } = res.data;
    saveTokens(accessToken, refreshToken, user.id, user.username);
    setState({ user, accessToken, refreshToken, loading: false });
    return null;
  }, []);

  const logout = useCallback(async () => {
    if (state.accessToken && state.refreshToken) {
      try {
        await api.logout(state.accessToken, state.refreshToken);
      } catch {
        // ignore network errors on logout
      }
    }
    clearTokens();
    setState({ user: null, accessToken: null, refreshToken: null, loading: false });
  }, [state.accessToken, state.refreshToken]);

  const refreshSession = useCallback(async () => {
    if (!state.refreshToken) return false;
    const res = await api.refreshTokens(state.refreshToken);
    if (!res.success || !res.data) {
      clearTokens();
      setState({ user: null, accessToken: null, refreshToken: null, loading: false });
      return false;
    }
    saveTokens(res.data.accessToken, res.data.refreshToken, state.user?.id ?? '', state.user?.username ?? '');
    saveAccessToken(res.data.accessToken);
    setState((prev) => ({
      ...prev,
      accessToken: res.data!.accessToken,
      refreshToken: res.data!.refreshToken,
    }));
    return true;
  }, [state.refreshToken, state.user]);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
