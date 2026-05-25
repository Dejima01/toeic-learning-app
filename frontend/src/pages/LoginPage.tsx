import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../lib/authErrors';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(getAuthErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="ログイン" showBack>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            1.ID（メールアドレス）
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-gray-800 bg-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            2.パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-gray-800 bg-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        {error && (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-40 rounded bg-sky-200 py-3 text-lg font-bold text-gray-800 hover:bg-sky-300 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : 'ログイン'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
