import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { DAILY_REVIEW_LIMIT_OPTIONS, normalizeDailyLimit } from '../lib/srs';
import { MainLayout } from '../components/MainLayout';
import { FeedbackModal } from '../components/FeedbackModal';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const { isDark, toggle } = useTheme();
  const { user } = useAuth();
  const [dailyLimit, setDailyLimit] = useState(normalizeDailyLimit(undefined));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setDailyLimit(normalizeDailyLimit(snap.data()?.daily_review_limit));
    });
  }, [user]);

  async function changeDailyLimit(value: number) {
    if (!user) return;
    setDailyLimit(value); // 購読の反映を待たずに即座に見た目を変える
    await setDoc(doc(db, 'users', user.uid), { daily_review_limit: value }, { merge: true });
  }

  function handleFeedbackSent() {
    setFeedbackOpen(false);
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 4000);
  }

  return (
    <MainLayout title="設定" showBack>
      {feedbackSent && (
        <p
          role="status"
          className="mx-4 mt-3 rounded bg-sky-100 px-3 py-2 text-sm text-sky-800 dark:bg-sky-900 dark:text-sky-100"
        >
          送信しました。ご意見ありがとうございます
        </p>
      )}

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {/* ダークモード トグル */}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-base font-medium text-gray-800 dark:text-gray-100">ダークモード</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggle}
            className={`relative inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
              isDark ? 'bg-sky-400' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform duration-200 ${
                isDark ? 'translate-x-[21px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>

        {/* 1日に出す最大問題数 */}
        <div className="px-4 py-4">
          <p className="mb-3 text-base font-medium text-gray-800 dark:text-gray-100">
            1日に出す最大問題数
          </p>
          <div className="flex gap-2">
            {DAILY_REVIEW_LIMIT_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={dailyLimit === value}
                onClick={() => changeDailyLimit(value)}
                className={`flex-1 rounded-lg py-2.5 text-base font-bold tabular-nums transition-colors ${
                  dailyLimit === value
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* ご意見・不具合報告 */}
        <button
          type="button"
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-base font-medium text-gray-800 dark:text-gray-100">
            ご意見・不具合報告
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4 text-gray-400 dark:text-gray-500"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {feedbackOpen && (
        <FeedbackModal onClose={() => setFeedbackOpen(false)} onSent={handleFeedbackSent} />
      )}
    </MainLayout>
  );
}
