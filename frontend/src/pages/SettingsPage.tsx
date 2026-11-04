import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  DAILY_REVIEW_LIMIT_OPTIONS,
  GRAMMAR_REVIEW_LIMIT_OPTIONS,
  normalizeDailyLimit,
  normalizeGrammarDailyLimit,
} from '../lib/srs';
import { MainLayout } from '../components/MainLayout';
import { FeedbackModal } from '../components/FeedbackModal';
import { TutorialModal } from '../components/TutorialModal';
import { useTheme } from '../contexts/ThemeContext';
import {
  ANONYMOUS_NAME,
  NICKNAME_MAX_LENGTH,
  nicknameLength,
  normalizeNickname,
  normalizeRankingState,
} from '../lib/ranking';
import { updateRankingProfile } from '../lib/rankingSync';

export default function SettingsPage() {
  const { isDark, toggle } = useTheme();
  const { user } = useAuth();
  const [dailyLimit, setDailyLimit] = useState(normalizeDailyLimit(undefined));
  const [grammarLimit, setGrammarLimit] = useState(normalizeGrammarDailyLimit(undefined));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // ランキング
  const [savedNickname, setSavedNickname] = useState<string | null>(null);
  const [nicknameInput, setNicknameInput] = useState('');
  const [rankingHidden, setRankingHidden] = useState(false);
  const [rankingRegistered, setRankingRegistered] = useState(false);
  const [nicknameSaving, setNicknameSaving] = useState(false);
  const [rankingMessage, setRankingMessage] = useState<{ text: string; error: boolean } | null>(null);
  const nicknameLoaded = useRef(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, 'users', user.uid), (snap) => {
      setDailyLimit(normalizeDailyLimit(snap.data()?.daily_review_limit));
      setGrammarLimit(normalizeGrammarDailyLimit(snap.data()?.daily_grammar_review_limit));
      const nickname = typeof snap.data()?.nickname === 'string' ? (snap.data()!.nickname as string) : null;
      setSavedNickname(nickname);
      setRankingHidden(snap.data()?.ranking_hidden === true);
      setRankingRegistered(normalizeRankingState(snap.data()?.ranking_state) !== null);
      // 入力中の文字を購読の更新で上書きしないよう、入力欄は最初の1回だけ埋める
      if (!nicknameLoaded.current) {
        nicknameLoaded.current = true;
        setNicknameInput(nickname ?? '');
      }
    });
  }, [user]);

  const nicknameTooLong = nicknameLength(nicknameInput) > NICKNAME_MAX_LENGTH;
  const nicknameUnchanged = normalizeNickname(nicknameInput) === savedNickname;

  async function saveNickname() {
    if (!user || nicknameTooLong || nicknameUnchanged) return;
    setNicknameSaving(true);
    setRankingMessage(null);
    const next = normalizeNickname(nicknameInput);
    try {
      await updateRankingProfile(user.uid, { nickname: next }, rankingRegistered);
      setNicknameInput(next ?? '');
      setRankingMessage({ text: next ? 'ニックネームを保存しました' : `「${ANONYMOUS_NAME}」に戻しました`, error: false });
    } catch (err) {
      console.error('nickname save failed:', err);
      setRankingMessage({ text: '保存できませんでした。時間をおいて再度お試しください', error: true });
    } finally {
      setNicknameSaving(false);
    }
  }

  async function toggleRankingHidden() {
    if (!user) return;
    const next = !rankingHidden;
    setRankingHidden(next);
    setRankingMessage(null);
    try {
      await updateRankingProfile(user.uid, { hidden: next }, rankingRegistered);
    } catch (err) {
      console.error('ranking hidden save failed:', err);
      setRankingHidden(!next);
      setRankingMessage({ text: '切り替えられませんでした。時間をおいて再度お試しください', error: true });
    }
  }

  async function changeDailyLimit(value: number) {
    if (!user) return;
    setDailyLimit(value); // 購読の反映を待たずに即座に見た目を変える
    await setDoc(doc(db, 'users', user.uid), { daily_review_limit: value }, { merge: true });
  }

  async function changeGrammarLimit(value: number) {
    if (!user) return;
    setGrammarLimit(value);
    await setDoc(
      doc(db, 'users', user.uid),
      { daily_grammar_review_limit: value },
      { merge: true },
    );
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

        {/* ランキングのニックネーム */}
        <div className="px-4 py-4">
          <label
            htmlFor="ranking-nickname"
            className="mb-1 block text-base font-medium text-gray-800 dark:text-gray-100"
          >
            ランキングのニックネーム
          </label>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
            未設定のときは「{ANONYMOUS_NAME}」と表示されます。メールアドレスは表示されません。
          </p>
          <div className="flex gap-2">
            <input
              id="ranking-nickname"
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder={ANONYMOUS_NAME}
              autoComplete="off"
              className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-800 outline-none focus:border-sky-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={saveNickname}
              disabled={nicknameSaving || nicknameTooLong || nicknameUnchanged}
              className="shrink-0 rounded bg-sky-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-600 disabled:opacity-40 disabled:hover:bg-sky-500"
            >
              {nicknameSaving ? '保存中…' : '保存'}
            </button>
          </div>
          <p
            className={`mt-1 text-right text-xs tabular-nums ${
              nicknameTooLong ? 'font-bold text-red-500' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {nicknameLength(nicknameInput)} / {NICKNAME_MAX_LENGTH}
          </p>
          {rankingMessage && (
            <p
              role={rankingMessage.error ? 'alert' : 'status'}
              className={`text-sm ${rankingMessage.error ? 'text-red-500' : 'text-sky-700 dark:text-sky-300'}`}
            >
              {rankingMessage.text}
            </p>
          )}
        </div>

        {/* ランキングに表示しない */}
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div>
            <span className="block text-base font-medium text-gray-800 dark:text-gray-100">
              ランキングに表示しない
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              オンにすると、ほかの人のランキングにあなたが出なくなります
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={rankingHidden}
            aria-label="ランキングに表示しない"
            onClick={toggleRankingHidden}
            className={`relative inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
              rankingHidden ? 'bg-sky-400' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform duration-200 ${
                rankingHidden ? 'translate-x-[21px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>

        {/* 1日に出す最大問題数 */}
        <div className="px-4 py-4">
          <p className="mb-3 text-base font-medium text-gray-800 dark:text-gray-100">
            1日に出す最大問題数（単語）
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

        {/* 1日に出す最大問題数（文法） */}
        <div className="px-4 py-4">
          <p className="mb-3 text-base font-medium text-gray-800 dark:text-gray-100">
            1日に出す最大問題数（文法）
          </p>
          <div className="flex gap-2">
            {GRAMMAR_REVIEW_LIMIT_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={grammarLimit === value}
                onClick={() => changeGrammarLimit(value)}
                className={`flex-1 rounded-lg py-2.5 text-base font-bold tabular-nums transition-colors ${
                  grammarLimit === value
                    ? 'bg-sky-500 text-white'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {/* 使い方を見る */}
        <button
          type="button"
          onClick={() => setTutorialOpen(true)}
          className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-base font-medium text-gray-800 dark:text-gray-100">
            使い方を見る
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

      {tutorialOpen && <TutorialModal onClose={() => setTutorialOpen(false)} />}
    </MainLayout>
  );
}
