import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function AuthForm() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const err =
      mode === 'login'
        ? await login(username, password)
        : await register(username, password);

    setLoading(false);
    if (err) {
      setError(err);
    } else {
      navigate('/lobby');
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-3xl font-bold text-center mb-2 text-white">Naval War</h1>
      <p className="text-ocean-400 text-center mb-8 text-sm">Real-time multiplayer Battleship</p>

      <div className="bg-ocean-900 rounded-2xl border border-ocean-700 p-6 shadow-2xl shadow-black/50">
        <div className="flex rounded-lg overflow-hidden border border-ocean-700 mb-6">
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-ocean-600 text-white'
                : 'text-ocean-400 hover:text-ocean-200 hover:bg-ocean-800'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-ocean-600 text-white'
                : 'text-ocean-400 hover:text-ocean-200 hover:bg-ocean-800'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="Username"
            type="text"
            placeholder="admiral42"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <p className="text-sm text-red-400 text-center bg-red-950/50 rounded-lg py-2 px-3 border border-red-800">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="mt-1">
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
