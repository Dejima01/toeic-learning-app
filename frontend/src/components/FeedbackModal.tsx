import { useEffect, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { notifyFeedback } from '../lib/proxyClient';

type FeedbackType = 'bug' | 'request' | 'other';

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'bug', label: '不具合' },
  { value: 'request', label: '要望' },
  { value: 'other', label: 'その他' },
];

const MAX_BODY_LENGTH = 2000;
const COOLDOWN_MS = 60_000;
const LAST_SENT_KEY = 'feedbackLastSentAt';

// localStorage が使えない環境でも、同じタブ内では連続送信を防ぐ
let lastSentAtInMemory = 0;

function getLastSentAt(): number {
  try {
    return Math.max(lastSentAtInMemory, Number(localStorage.getItem(LAST_SENT_KEY)) || 0);
  } catch {
    return lastSentAtInMemory;
  }
}

function markSent(): void {
  lastSentAtInMemory = Date.now();
  try {
    localStorage.setItem(LAST_SENT_KEY, String(lastSentAtInMemory));
  } catch {
    // 保存できなくてもメモリ上の値で防ぐ
  }
}

interface FeedbackModalProps {
  onClose: () => void;
  onSent: () => void;
}

export function FeedbackModal({ onClose, onSent }: FeedbackModalProps) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const [type, setType] = useState<FeedbackType | null>(null);
  const [body, setBody] = useState('');
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [allowContact, setAllowContact] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const cooldownSec = Math.max(0, Math.ceil((getLastSentAt() + COOLDOWN_MS - now) / 1000));
  const coolingDown = cooldownSec > 0;

  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  const trimmedBody = body.trim();
  const tooLong = body.length > MAX_BODY_LENGTH;
  const email = user?.email ?? null;
  const canSubmit =
    !!user && type !== null && trimmedBody.length > 0 && !tooLong && !sending && !coolingDown;

  async function handleSubmit() {
    if (!canSubmit || !user || type === null) return;
    setSending(true);
    setError(null);

    const contactEmail = allowContact ? email : null;
    try {
      const ref = await addDoc(collection(db, 'feedback'), {
        type,
        body: trimmedBody,
        satisfaction,
        contactEmail,
        uid: user.uid,
        createdAt: serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 1000),
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        theme: isDark ? 'dark' : 'light',
      });
      markSent();
      void notifyFeedback({
        feedbackId: ref.id,
        type,
        satisfaction,
        body: trimmedBody,
        hasContact: contactEmail !== null,
      });
      onSent();
    } catch (err) {
      console.error('feedback send failed:', err);
      setError('送信に失敗しました。時間をおいて再度お試しください。');
      setSending(false);
    }
  }

  const sectionLabel = 'mb-2 text-sm font-bold text-gray-800 dark:text-gray-100';
  const requiredBadge = 'ml-1 text-xs font-normal text-red-500';
  const optionalBadge = 'ml-1 text-xs font-normal text-gray-400 dark:text-gray-500';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        className="w-full max-w-sm overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800"
        style={{ maxHeight: '85vh' }}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <h2 id="feedback-title" className="flex-1 text-lg font-bold dark:text-gray-100">
            ご意見・不具合報告
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="閉じる"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-white disabled:opacity-40"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="h-4 w-4"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-5 px-4 pb-5 pt-2">
          {/* 種類 */}
          <div>
            <p className={sectionLabel}>
              種類<span className={requiredBadge}>必須</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  aria-pressed={type === opt.value}
                  className={`rounded py-2 text-sm font-bold transition-colors ${
                    type === opt.value
                      ? 'bg-sky-400 text-white'
                      : 'bg-sky-200 text-gray-800 hover:bg-sky-300 dark:bg-sky-800 dark:text-gray-100 dark:hover:bg-sky-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 本文 */}
          <div>
            <label htmlFor="feedback-body" className={`block ${sectionLabel}`}>
              内容<span className={requiredBadge}>必須</span>
            </label>
            <textarea
              id="feedback-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="気になった点やご要望をご記入ください"
              className="w-full resize-none rounded border border-gray-300 bg-white px-3 py-2 text-base text-gray-800 outline-none focus:border-sky-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
            <p
              className={`mt-1 text-right text-xs ${
                tooLong ? 'font-bold text-red-500' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {body.length} / {MAX_BODY_LENGTH}
            </p>
          </div>

          {/* 満足度 */}
          <div>
            <p className={sectionLabel}>
              このアプリを友人に勧めたいと思いますか？<span className={optionalBadge}>任意</span>
            </p>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSatisfaction((cur) => (cur === n ? null : n))}
                  aria-pressed={satisfaction === n}
                  className={`h-8 rounded text-sm font-bold transition-colors ${
                    satisfaction === n
                      ? 'bg-sky-400 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>勧めない</span>
              <span>勧めたい</span>
            </div>
          </div>

          {/* 返信用の連絡先 */}
          <div>
            <p className={sectionLabel}>
              返信について<span className={optionalBadge}>任意</span>
            </p>
            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={allowContact}
                onChange={(e) => setAllowContact(e.target.checked)}
                disabled={!email}
                className="mt-0.5 h-4 w-4 shrink-0 accent-sky-500"
              />
              <span className="min-w-0 break-all">
                アカウントのメールアドレスに返信してよい
                {email && (
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{email}</span>
                )}
              </span>
            </label>
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded bg-sky-400 py-3 text-center font-bold text-white transition-colors hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-400"
          >
            {sending ? '送信中…' : coolingDown ? `あと${cooldownSec}秒で送信できます` : '送信する'}
          </button>
        </div>
      </div>
    </div>
  );
}
