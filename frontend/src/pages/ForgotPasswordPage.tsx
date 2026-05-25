import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthLayout } from '../components/AuthLayout';
import { getAuthErrorMessage } from '../lib/authErrors';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      setError(getAuthErrorMessage(code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="ID・パスワードを忘れた場合" showBack>
      <div className="flex flex-col gap-8">
        {/* Section 1: ID を忘れた場合 */}
        <section>
          <h2 className="mb-3 font-semibold text-gray-800">1.ID（メールアドレス）を忘れた場合</h2>
          <div className="rounded border border-gray-300 p-4 text-sm text-gray-700 leading-relaxed">
            <Link to="/signup" className="text-blue-600 underline">
              アカウント新規登録
            </Link>
            から再登録をしてください。
          </div>
        </section>

        {/* Section 2: パスワードを忘れた場合 */}
        <section>
          <h2 className="mb-3 font-semibold text-gray-800">2.パスワードを忘れた場合</h2>
          <p className="mb-4 text-sm text-gray-700 leading-relaxed">
            登録されたメールアドレスに再設定用のURLを送付します。
            リンク先の手順に従って設定を進めてください。
          </p>

          {sent ? (
            <div className="rounded bg-green-50 px-4 py-3 text-sm text-green-700">
              再設定用メールを送信しました。メールをご確認ください。
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  登録済みのメールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded border border-gray-800 bg-gray-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>

              {error && (
                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
              )}

              <div className="flex justify-center pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-48 rounded bg-sky-200 py-3 text-base font-bold text-gray-800 hover:bg-sky-300 transition-colors disabled:opacity-50"
                >
                  {submitting ? '送信中...' : '再設定用メールを送付'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </AuthLayout>
  );
}
