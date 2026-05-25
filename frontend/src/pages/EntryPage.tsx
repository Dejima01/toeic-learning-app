import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import { useAuth } from '../contexts/AuthContext';

export default function EntryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-white">
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-8">
        <h1 className="text-3xl font-bold tracking-wide">TOEICアプリ</h1>

        <div className="flex w-full flex-col gap-6">
          <Link
            to="/signup"
            className="block w-full rounded py-4 text-center text-xl font-bold text-gray-800 bg-sky-200 hover:bg-sky-300 transition-colors"
          >
            アカウント新規作成
          </Link>

          <Link
            to="/login"
            className="block w-full rounded py-4 text-center text-xl font-bold text-gray-800 bg-sky-200 hover:bg-sky-300 transition-colors"
          >
            ログイン
          </Link>
        </div>

        <Link
          to="/forgot-password"
          className="text-sm text-gray-500 underline"
        >
          ID・パスワードを忘れた方はこちら
        </Link>
      </main>
      <BottomNav />
    </div>
  );
}
