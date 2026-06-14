import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from './Button';

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const onRanking = pathname === '/ranking';

  return (
    <header className="border-b border-ocean-800 px-4 py-3 flex items-center justify-between">
      <h1 className="text-lg font-bold text-white">Naval War</h1>

      <div className="flex items-center gap-2">
        {user ? (
          <>
            {onRanking ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')}>
                ← Lobby
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate('/ranking')}>
                Rankings
              </Button>
            )}
            <span className="text-ocean-400 text-sm px-2">{user.username}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Logout
            </Button>
          </>
        ) : (
          <>
            {onRanking ? (
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
                Login
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => navigate('/ranking')}>
                Rankings
              </Button>
            )}
          </>
        )}
      </div>
    </header>
  );
}
