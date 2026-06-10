import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthForm } from '../components/auth/AuthForm';

export function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/lobby', { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-ocean-950 to-ocean-900">
      <AuthForm />
    </div>
  );
}
