import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../contexts/AuthContext';
import { getAuthErrorMessage } from '../lib/authErrors';

export default function SignupPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate('/home', { replace: true });
  }, [user, loading, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('パスワードが一致しません');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', credential.user.uid), {
        email: credential.user.email,
        rank_score: 0,
        badge: null,
      });
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(getAuthErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="アカウント新規作成" showBack>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            1.ID（メールアドレス）
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded border border-gray-800 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            2.パスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-gray-800 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            （再確認用）
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="w-full rounded border border-gray-800 dark:border-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        {error && (
          <p className="rounded bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-48 rounded bg-sky-200 dark:bg-sky-800 py-3 text-lg font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : '上記内容で登録'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
