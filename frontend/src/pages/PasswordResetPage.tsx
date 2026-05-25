import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { confirmPasswordReset } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthLayout } from '../components/AuthLayout';
import { getAuthErrorMessage } from '../lib/authErrors';

export default function PasswordResetPage() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') ?? '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    if (!oobCode) {
      setError('無効なリンクです。パスワード再設定メールを再送してください');
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(getAuthErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="ID（メールアドレス）再設定">
        <div className="flex flex-col items-center gap-6 pt-8">
          <p className="text-center text-gray-700">パスワードを再設定しました。</p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="w-40 rounded bg-sky-200 py-3 text-lg font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            ログインへ
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="ID（メールアドレス）再設定">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            新しいパスワード
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded border border-gray-800 bg-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            （再確認用）
          </label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
            className="w-36 rounded bg-sky-200 py-3 text-lg font-bold text-gray-800 hover:bg-sky-300 transition-colors disabled:opacity-50"
          >
            {submitting ? '...' : '再設定'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
