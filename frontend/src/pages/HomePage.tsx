import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MainLayout } from '../components/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { parseResumePosition, resumePath } from '../lib/resumePosition';
import type { ResumePosition } from '../lib/resumePosition';
import {
  normalizeReviewItem,
  planToday,
  nextMidnight,
  normalizeDailyLimit,
  normalizeGrammarDailyLimit,
} from '../lib/srs';
import type { ReviewItem } from '../lib/srs';
import type { StudyDay, StreakTier } from '../lib/studyLog';
import { normalizeStudyDay, calcStreak, streakTier } from '../lib/studyLog';
import { recordDayState } from '../lib/recordStudy';
import { StudyCalendar } from '../components/StudyCalendar';

type Badge = 'bronze' | 'silver' | 'gold' | null;

const BADGE_LABEL: Record<string, string> = {
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
};

/** 連続日数のチップ。続くほど見た目が豪華になる（3/7/14/30日で変化） */
const STREAK_STYLE: Record<StreakTier, string> = {
  // どの段階でも枠を出す（押せることが分かるように）
  plain: 'border-2 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400',
  blue: 'border-2 border-sky-300 dark:border-sky-700 text-sky-600 dark:text-sky-400 font-bold',
  bordered: 'border-2 border-sky-400 dark:border-sky-500 text-sky-700 dark:text-sky-300 font-bold',
  gold: 'border-2 border-amber-600/40 metal-gold font-bold',
  radiant: 'border-2 border-amber-600/40 metal-gold font-bold streak-radiant',
};

/** 今日の復習ボタン。出題がある日は件数、やり切った日は「完了！」を出す */
function ReviewButton({
  to,
  label,
  count,
  done,
  compact,
}: {
  to: string;
  label: string;
  count: number;
  done: boolean;
  compact: boolean;
}) {
  const base = 'flex-1 block rounded-lg py-4 text-center font-bold transition-colors';
  const size = compact ? 'text-base' : 'text-xl';

  if (count > 0) {
    return (
      <Link to={to} className={`${base} ${size} bg-sky-500 text-white shadow hover:bg-sky-600`}>
        {label}{'　'}{count}問
      </Link>
    );
  }
  if (done) {
    return (
      <Link
        to={to}
        className={`${base} ${size} border-2 border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30`}
      >
        {label} 完了！
      </Link>
    );
  }
  return (
    <div
      className={`${base} ${size} border-2 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600`}
    >
      {label}{'　'}なし
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<Badge>(null);
  const [wordResume, setWordResume] = useState<ResumePosition | null>(null);
  const [grammarResume, setGrammarResume] = useState<ResumePosition | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  /** 日付をまたいだときに件数を数え直すためのトリガー */
  const [nowTick, setNowTick] = useState(0);
  const [grammarItems, setGrammarItems] = useState<ReviewItem[]>([]);
  const [dailyLimit, setDailyLimit] = useState(normalizeDailyLimit(undefined));
  const [grammarLimit, setGrammarLimit] = useState(normalizeGrammarDailyLimit(undefined));
  const [studyDays, setStudyDays] = useState<Map<string, StudyDay>>(new Map());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Firestoreからバッジ・前回の続き位置をリアルタイム取得（同じドキュメントなので購読は1本）
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data();
      setBadge((data?.badge as Badge) ?? null);
      setWordResume(parseResumePosition(data?.last_word_position));
      setGrammarResume(parseResumePosition(data?.last_grammar_position));
      setDailyLimit(normalizeDailyLimit(data?.daily_review_limit));
      setGrammarLimit(normalizeGrammarDailyLimit(data?.daily_grammar_review_limit));
    });
  }, [user]);

  // 復習マーク（数十〜数百件程度なので全件読んで手元で数える）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', user.uid, 'word_bookmarks'), (snap) => {
      setReviewItems(snap.docs.map((d) => normalizeReviewItem(d.id, d.data())));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', user.uid, 'grammar_bookmarks'), (snap) => {
      setGrammarItems(snap.docs.map((d) => normalizeReviewItem(d.id, d.data())));
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', user.uid, 'study_days'), (snap) => {
      setStudyDays(new Map(snap.docs.map((d) => [d.id, normalizeStudyDay(d.id, d.data())])));
    });
  }, [user]);

  // 日付またぎの対応。件数は new Date() に依存するが Firestore が変わらない限り
  // 再計算されないので、復帰時と深夜0時に数え直す
  useEffect(() => {
    const recount = () => setNowTick((n) => n + 1);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recount();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const msUntilMidnight = nextMidnight(new Date()).getTime() - Date.now() + 1000;
    const timer = window.setTimeout(recount, msUntilMidnight);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(timer);
    };
  }, [nowTick]);

  // 今日出せる件数と、今日すでに採点した件数
  // nowTick は日付またぎで数え直すためのトリガー
  const plan = useMemo(
    () => planToday(reviewItems, new Date(), dailyLimit),
    [reviewItems, dailyLimit, nowTick],
  );
  const grammarPlan = useMemo(
    () => planToday(grammarItems, new Date(), grammarLimit),
    [grammarItems, grammarLimit, nowTick],
  );

  const dueCount = plan.queue.length;
  const reviewedTodayCount = plan.reviewedToday;
  const grammarDueCount = grammarPlan.queue.length;
  const grammarReviewedToday = grammarPlan.reviewedToday;

  // 復習マークが1件も無いモードはボタン自体を出さない（死んだボタンを並べないため）
  const showWord = reviewItems.length > 0;
  const showGrammar = grammarItems.length > 0;

  const streak = calcStreak(studyDays, new Date());
  const tier = streakTier(streak);

  // 「今日やることがあったか」と「やり切ったか」を記録する。
  // 出題0の日を銅（サボり）と区別するために hadDue が要る
  const hadDue = dueCount > 0 || grammarDueCount > 0 || reviewedTodayCount > 0 || grammarReviewedToday > 0;
  const completed = hadDue && dueCount === 0 && grammarDueCount === 0;

  useEffect(() => {
    if (!user) return;
    recordDayState(user.uid, { hadDue, completed });
  }, [user, hadDue, completed]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/', { replace: true });
  }

  return (
    // ホーム画面はヘッダーなし（ランク表示・設定ボタンがコンテンツ内に入る）
    <MainLayout>
      <div className="flex h-full flex-col overflow-y-auto px-5 pt-4 pb-2">

        {/* ── 上部: 連続日数（左）と設定（右） ── */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCalendarOpen(true)}
            className={`rounded-lg px-3 py-1.5 text-sm tabular-nums transition-colors ${STREAK_STYLE[tier]}`}
          >
            🔥 {streak}日
          </button>
          <Link
            to="/settings"
            className="rounded-lg bg-sky-200 dark:bg-sky-800 px-5 py-2 text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            設定
          </Link>
        </div>

        {/* ── ランクバッジサークル（中央） ── */}
        <div className="flex justify-center pt-4 pb-3">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full text-center">
            {badge ? (
              <img
                src={`/badges/${badge}.png`}
                alt={BADGE_LABEL[badge]}
                className="h-24 w-24 object-contain"
              />
            ) : (
              <img
                src="/badges/rookie.png"
                alt="ルーキー"
                className="h-24 w-24 object-contain"
              />
            )}
          </div>
        </div>

        {/* ── 今日の復習（毎日最初に押すボタンなので最上段・大きめ） ──
             復習マークがあるモードだけ出す。両方あれば1行を半分ずつ使うので行は増えない */}
        {showWord || showGrammar ? (
          <div className="mb-4 flex gap-3">
            {showWord && (
              <ReviewButton
                to={dueCount > 0 ? '/review/today' : '/review/today?mode=practice'}
                label="単語復習"
                count={dueCount}
                done={dueCount === 0 && reviewedTodayCount > 0}
                compact={showGrammar}
              />
            )}
            {showGrammar && (
              <ReviewButton
                to={
                  grammarDueCount > 0
                    ? '/review/today/grammar'
                    : '/review/today/grammar?mode=practice'
                }
                label="文法復習"
                count={grammarDueCount}
                done={grammarDueCount === 0 && grammarReviewedToday > 0}
                compact={showWord}
              />
            )}
          </div>
        ) : (
          <p className="mb-4 text-center text-base text-gray-400 dark:text-gray-500">
            今日の復習はありません
          </p>
        )}

        {/* ── 中央: モードボタン ── */}
        <div className="flex flex-1 flex-col items-stretch justify-center gap-4">
          {/* 前回の続き（記録があるものだけ出す。2つ並んでも縦1行に収める） */}
          {(wordResume || grammarResume) && (
            <div className="flex gap-3">
              {wordResume && (
                <Link
                  to={resumePath(wordResume, 'word')}
                  className="flex-1 rounded border-2 border-sky-400 dark:border-sky-500 py-3 text-center text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/40 transition-colors"
                >
                  単語：前回の続き
                </Link>
              )}
              {grammarResume && (
                <Link
                  to={resumePath(grammarResume, 'grammar')}
                  className="flex-1 rounded border-2 border-sky-400 dark:border-sky-500 py-3 text-center text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/40 transition-colors"
                >
                  文法：前回の続き
                </Link>
              )}
            </div>
          )}

          <Link
            to="/word"
            className="block rounded bg-sky-200 dark:bg-sky-800 py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            単語モード
          </Link>
          <Link
            to="/grammar"
            className="block rounded bg-sky-200 dark:bg-sky-800 py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            文法モード
          </Link>
        </div>

        {/* ── 下部: ランク認定テスト・復習問題一覧 ── */}
        <div className="flex gap-3">
          <Link
            to="/rank-test"
            className="flex-1 rounded bg-sky-200 dark:bg-sky-800 py-3 text-center text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            ランク認定テスト
          </Link>
          <Link
            to="/review"
            className="flex-1 rounded bg-sky-200 dark:bg-sky-800 py-3 text-center text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            復習問題一覧
          </Link>
        </div>

        {/* 開発用ログアウトボタン（フェーズ3確認用） */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 text-xs text-gray-400 dark:text-gray-500 underline self-center"
        >
          ログアウト
        </button>
      </div>

      {calendarOpen && (
        <StudyCalendar days={studyDays} onClose={() => setCalendarOpen(false)} />
      )}
    </MainLayout>
  );
}
