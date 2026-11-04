import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** ログインしていない人だけに見せる画面。ログイン済みならホームへ移す */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
      </div>
    );
  }

  return user ? <Navigate to="/home" replace /> : <>{children}</>;
}
