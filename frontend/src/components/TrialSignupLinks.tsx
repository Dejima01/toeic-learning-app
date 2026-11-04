import { Link } from 'react-router-dom';

/** お試しモードの「アカウント作成」「ログイン」ボタン */
export function TrialSignupLinks() {
  return (
    <div className="flex gap-2">
      <Link
        to="/signup"
        className="flex-1 rounded-lg bg-sky-500 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-sky-600"
      >
        無料でアカウント作成
      </Link>
      <Link
        to="/login"
        className="flex-1 rounded-lg border-2 border-sky-400 py-2 text-center text-sm font-bold text-sky-700 transition-colors hover:bg-sky-50 dark:border-sky-500 dark:text-sky-300 dark:hover:bg-sky-900/40"
      >
        ログイン
      </Link>
    </div>
  );
}
