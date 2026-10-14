import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function EntryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-white dark:bg-gray-900">
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <h1 className="text-3xl font-bold tracking-wide dark:text-gray-100">TOEICアプリ</h1>

        <div className="flex w-full flex-col gap-6">
          <Link
            to="/signup"
            className="block w-full rounded py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 bg-sky-200 dark:bg-sky-800 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            アカウント新規作成
          </Link>

          <Link
            to="/login"
            className="block w-full rounded py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 bg-sky-200 dark:bg-sky-800 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            ログイン
          </Link>
        </div>

        <Link
          to="/forgot-password"
          className="text-sm text-gray-500 dark:text-gray-400 underline"
        >
          ID・パスワードを忘れた方はこちら
        </Link>
      </main>
    </div>
  );
}
