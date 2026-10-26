import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { recordReviewed } from '../lib/recordStudy';
import { MainLayout } from '../components/MainLayout';
import { GrammarCard } from '../components/GrammarCard';
import type { GrammarQuestion } from '../types/grammar';
import {
  normalizeReviewItem,
  planToday,
  selectReviewedOn,
  gradeItem,
  normalizeGrammarDailyLimit,
} from '../lib/srs';
import { useRoundQueue } from '../lib/useRoundQueue';
import { shuffleChoices } from '../lib/shuffleChoices';

export default function GrammarReviewSessionPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  /** おさらいモード：今日やった分の流し直し。SRS の箱・期限は動かさない */
  const isPractice = searchParams.get('mode') === 'practice';

  const queue = useRoundQueue();
  const [questions, setQuestions] = useState<Map<string, GrammarQuestion>>(new Map());
  const [remainingForLaterDays, setRemainingForLaterDays] = useState(0);

  /** この問題で選んだ選択肢（未解答は undefined）。解答すると解説が開く */
  const [selectedChoice, setSelectedChoice] = useState<number | undefined>(undefined);
  /** 1周目で正解した数（＝記録・集計の対象） */
  const [knownCount, setKnownCount] = useState(0);

  // ── 出題キューを作る（セッション中は固定したいので getDocs で1回だけ） ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [snap, userSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'grammar_bookmarks')),
        getDoc(doc(db, 'users', user.uid)),
      ]);
      const items = snap.docs.map((d) => normalizeReviewItem(d.id, d.data()));
      const now = new Date();
      const dailyLimit = normalizeGrammarDailyLimit(userSnap.data()?.daily_grammar_review_limit);

      let target;
      if (isPractice) {
        target = selectReviewedOn(items, now);
        setRemainingForLaterDays(0);
      } else {
        const plan = planToday(items, now, dailyLimit);
        target = plan.queue;
        setRemainingForLaterDays(plan.remaining);
      }

      const docs = await Promise.all(
        target.map((item) => getDoc(doc(db, 'grammar_questions', item.id))),
      );
      if (cancelled) return;

      const map = new Map<string, GrammarQuestion>();
      docs.forEach((d) => {
        if (d.exists()) map.set(d.id, { id: d.id, ...d.data() } as GrammarQuestion);
      });

      setQuestions(map);
      queue.start(target.filter((item) => map.has(item.id)));
    })();

    return () => {
      cancelled = true;
    };
    // queue.start は useCallback で安定している
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isPractice]);

  const current = queue.current;
  const baseQuestion = current ? questions.get(current.id) : undefined;

  // 周ごとに選択肢を並べ替える。並びが同じだと「さっきBで間違えたからB以外」と
  // 消去法で当てられてしまい、2周目が練習にならないため
  const question = useMemo(
    () =>
      baseQuestion ? shuffleChoices(baseQuestion, `${baseQuestion.id}-r${queue.round}`) : undefined,
    [baseQuestion, queue.round],
  );

  const isAnswered = selectedChoice !== undefined;
  const isCorrect = question !== undefined && selectedChoice === question.correct_index;

  // ── 「次へ」で採点を確定して進む ──
  const handleNext = useCallback(async () => {
    if (!current || !question || !isAnswered || !user) return;

    // 記録するのは1周目の採点だけ。
    // 2周目以降は「1周目で解けなかった」事実を上書きしてしまうため触らない
    if (queue.round === 1) {
      if (!isPractice) {
        const result = gradeItem(current, isCorrect ? 'known' : 'unknown', new Date());
        const ref = doc(db, 'users', user.uid, 'grammar_bookmarks', current.id);
        try {
          if (result.item === null) {
            // 箱5をクリア＝卒業。復習マークを外して一覧から消す
            await deleteDoc(ref);
          } else {
            await setDoc(
              ref,
              {
                box: result.item.box,
                due_at: Timestamp.fromDate(result.item.dueAt),
                correct_count: result.item.correctCount,
                wrong_count: result.item.wrongCount,
                last_reviewed_at: serverTimestamp(),
              },
              { merge: true },
            );
          }
        } catch {
          // 記録に失敗してもセッションは進める（次回また期限切れとして拾われる）
        }
      }
      if (isCorrect) setKnownCount((n) => n + 1);
      // 学習の日別記録（カレンダーとストリークの材料）
      void recordReviewed(user.uid, 'grammar');
    }

    setSelectedChoice(undefined);
    queue.advance(!isCorrect);
  }, [current, question, isAnswered, isCorrect, user, queue, isPractice]);

  // ──────────────── 描画 ────────────────

  if (queue.phase === 'loading') {
    return (
      <MainLayout showBack>
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      </MainLayout>
    );
  }

  if (queue.phase === 'roundEnd') {
    return (
      <MainLayout showBack>
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
          <p className="text-4xl">🔁</p>
          <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
            {queue.round}周目が終わりました
          </p>
          <p className="text-center text-base text-gray-500 dark:text-gray-400">
            間違えた{' '}
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {queue.wrongItems.length}
            </span>
            問を、もう一度出します
          </p>

          {remainingForLaterDays > 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              残り{remainingForLaterDays}問は明日以降に出ます
            </p>
          )}

          <button
            type="button"
            onClick={() => {
              setSelectedChoice(undefined);
              queue.startNextRound();
            }}
            className="mt-2 w-full max-w-xs rounded-full bg-sky-400 py-3 text-base font-bold text-white hover:bg-sky-500"
          >
            {queue.round + 1}周目へ進む
          </button>
          <Link to="/home" className="text-base text-gray-500 dark:text-gray-400 underline">
            今日はここまでにする
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (queue.phase === 'finished') {
    return (
      <MainLayout showBack>
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
          <p className="text-4xl">{queue.initialCount === 0 ? '🌱' : '🎉'}</p>
          {queue.initialCount === 0 ? (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                {isPractice ? '今日やった問題はありません' : '今日の文法復習はありません'}
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                文法モードで間違えるか復習マークを付けると、翌日から復習に出てきます。
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                {isPractice ? 'おさらいが終わりました' : '今日の文法復習が終わりました'}
              </p>
              <p className="text-center text-2xl font-bold dark:text-gray-100">
                {queue.initialCount}問中 {knownCount}問
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                1周目で正解しました
              </p>
              {remainingForLaterDays > 0 && (
                <p className="text-center text-base text-gray-500 dark:text-gray-400">
                  残り{remainingForLaterDays}問は明日以降に出ます
                </p>
              )}
            </>
          )}
          <Link
            to="/home"
            className="mt-2 rounded-full bg-sky-400 px-8 py-3 font-bold text-white hover:bg-sky-500"
          >
            ホームへ戻る
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (!current || !question) return null;

  return (
    <MainLayout
      showBack
      showChatBot
      titleContent={
        <span className="text-base font-bold tabular-nums dark:text-gray-100">
          {queue.round > 1 && (
            <span className="mr-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              {queue.round}周目
            </span>
          )}
          {queue.index + 1} / {queue.roundItems.length}
        </span>
      }
      chatContext={{ kind: 'grammar', question }}
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto">
          {isPractice && (
            <p className="mx-4 mt-4 rounded bg-emerald-50 dark:bg-emerald-900/30 py-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
              今日やった問題のおさらい
            </p>
          )}

          <GrammarCard
            question={question}
            questionNumber={queue.index + 1}
            selectedChoice={selectedChoice}
            isBookmarked={false}
            onSelectChoice={(choiceIndex) => {
              if (selectedChoice === undefined) setSelectedChoice(choiceIndex);
            }}
            onToggleBookmark={() => {}}
          />
        </div>

        {/* 解答すると解説が開き、ここで次へ進める */}
        {isAnswered && (
          <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
            <button
              type="button"
              onClick={handleNext}
              className="w-full rounded-lg bg-gray-800 dark:bg-gray-200 py-3 text-base font-bold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300"
            >
              {queue.isLastInRound ? 'この周を終える' : '次へ'}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
