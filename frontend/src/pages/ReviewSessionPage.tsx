import { useState, useEffect, useCallback } from 'react';
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
import { MainLayout } from '../components/MainLayout';
import { HighlightedSentence } from '../components/HighlightedSentence';
import type { WordQuestion } from '../types/word';
import { translatePos, translateDerivPart } from '../types/word';
import { normalizeReviewItem, planToday, selectReviewedOn, gradeItem, normalizeDailyLimit } from '../lib/srs';
import type { Grade, ReviewItem } from '../lib/srs';

type Phase = 'loading' | 'session' | 'roundEnd' | 'finished';

export default function ReviewSessionPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  /** おさらいモード：今日やった分の流し直し。SRS の箱・期限は動かさない */
  const isPractice = searchParams.get('mode') === 'practice';

  const [phase, setPhase] = useState<Phase>('loading');
  const [words, setWords] = useState<Map<string, WordQuestion>>(new Map());

  /** 最初に出した問題数（結果画面の分母） */
  const [initialCount, setInitialCount] = useState(0);
  /** 今日の上限を超えて明日以降にまわる数（結果画面で知らせる） */
  const [remainingForLaterDays, setRemainingForLaterDays] = useState(0);

  // ── ラウンド制 ──
  // 分母が途中で増えると不自然なので、間違えた問題はその場で挿し込まず次の周にまわす
  const [round, setRound] = useState(1);
  const [roundItems, setRoundItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  /** この周で「覚えていなかった」もの。次の周の出題内容になる */
  const [wrongItems, setWrongItems] = useState<ReviewItem[]>([]);

  /** 現在のカードの採点（未採点は null）。「次へ」を押すまで確定しないので選び直せる */
  const [grade, setGrade] = useState<Grade | null>(null);

  /** 1周目で「覚えていた」だった数（＝記録・集計の対象） */
  const [knownCount, setKnownCount] = useState(0);

  // ── 出題キューを作る（セッション中は固定したいので getDocs で1回だけ） ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const [snap, userSnap] = await Promise.all([
        getDocs(collection(db, 'users', user.uid, 'word_bookmarks')),
        getDoc(doc(db, 'users', user.uid)),
      ]);
      const items = snap.docs.map((d) => normalizeReviewItem(d.id, d.data()));
      const now = new Date();
      const dailyLimit = normalizeDailyLimit(userSnap.data()?.daily_review_limit);

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
        target.map((item) => getDoc(doc(db, 'word_questions', item.id))),
      );
      if (cancelled) return;

      const wordMap = new Map<string, WordQuestion>();
      docs.forEach((d) => {
        if (d.exists()) wordMap.set(d.id, { id: d.id, ...d.data() } as WordQuestion);
      });

      // マスターデータを引けなかったものは出しようがないので除外する
      const queue = target.filter((item) => wordMap.has(item.id));
      setWords(wordMap);
      setRoundItems(queue);
      setInitialCount(queue.length);
      setPhase(queue.length === 0 ? 'finished' : 'session');
    })();

    return () => {
      cancelled = true;
    };
  }, [user, isPractice]);

  const current = roundItems[index];
  const currentWord = current ? words.get(current.id) : undefined;
  const example = currentWord?.example_sentences[0];
  const isLastInRound = index + 1 >= roundItems.length;

  // ── 「次へ」で採点を確定して進む ──
  const handleNext = useCallback(async () => {
    if (!current || !grade || !user) return;

    // 記録するのは1周目の採点だけ。
    // 2周目以降は「1周目で思い出せなかった」事実を上書きしてしまうため触らない
    if (round === 1) {
      if (!isPractice) {
        const result = gradeItem(current, grade, new Date());
        const ref = doc(db, 'users', user.uid, 'word_bookmarks', current.id);
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
      if (grade === 'known') setKnownCount((n) => n + 1);
    }

    const nextWrong = grade === 'unknown' ? [...wrongItems, current] : wrongItems;
    setWrongItems(nextWrong);
    setGrade(null);

    if (!isLastInRound) {
      setIndex((i) => i + 1);
    } else {
      setPhase(nextWrong.length > 0 ? 'roundEnd' : 'finished');
    }
  }, [current, grade, user, round, isPractice, wrongItems, isLastInRound]);

  const startNextRound = useCallback(() => {
    setRoundItems(wrongItems);
    setWrongItems([]);
    setIndex(0);
    setRound((r) => r + 1);
    setGrade(null);
    setPhase('session');
  }, [wrongItems]);

  // ──────────────── 描画 ────────────────

  if (phase === 'loading') {
    return (
      <MainLayout showBack>
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      </MainLayout>
    );
  }

  // ラウンドの区切り。間違えた分だけで次の周に入る
  if (phase === 'roundEnd') {
    return (
      <MainLayout showBack>
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
          <p className="text-4xl">🔁</p>
          <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
            {round}周目が終わりました
          </p>
          <p className="text-center text-base text-gray-500 dark:text-gray-400">
            覚えていなかった{' '}
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {wrongItems.length}
            </span>
            問を、もう一度出します
          </p>
          <button
            type="button"
            onClick={startNextRound}
            className="mt-2 w-full max-w-xs rounded-full bg-sky-400 py-3 text-base font-bold text-white hover:bg-sky-500"
          >
            {round + 1}周目へ進む
          </button>
          <Link to="/home" className="text-base text-gray-500 dark:text-gray-400 underline">
            今日はここまでにする
          </Link>
        </div>
      </MainLayout>
    );
  }

  if (phase === 'finished') {
    return (
      <MainLayout showBack>
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
          <p className="text-4xl">{initialCount === 0 ? '🌱' : '🎉'}</p>
          {initialCount === 0 ? (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                {isPractice ? '今日やった単語はありません' : '今日の復習はありません'}
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                単語モードで復習マークを付けると、翌日から復習に出てきます。
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                {isPractice ? 'おさらいが終わりました' : '今日の復習が終わりました'}
              </p>
              <p className="text-center text-2xl font-bold dark:text-gray-100">
                {initialCount}問中 {knownCount}問
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                最初から覚えていました
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

  if (!current || !currentWord) return null;

  const isRevealed = grade !== null;
  const wrongAfterThis = grade === 'unknown' ? wrongItems.length + 1 : wrongItems.length;
  const nextLabel = !isLastInRound ? '次へ' : wrongAfterThis > 0 ? 'この周を終える' : '結果を見る';

  return (
    <MainLayout
      showBack
      showChatBot
      titleContent={
        <span className="text-base font-bold tabular-nums dark:text-gray-100">
          {round > 1 && (
            <span className="mr-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              {round}周目
            </span>
          )}
          {index + 1} / {roundItems.length}
        </span>
      }
      chatContext={{ kind: 'word', word: currentWord, example }}
    >
      <div className="flex h-full flex-col">
        {/* ── 出題エリア ── */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          {isPractice && (
            <p className="mb-4 rounded bg-emerald-50 dark:bg-emerald-900/30 py-2 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300">
              今日やった単語のおさらい
            </p>
          )}

          <h2 className="mb-5 text-center text-3xl font-bold tracking-wide dark:text-gray-100">
            {currentWord.word}
          </h2>

          {example && (
            <p className="text-center text-base leading-relaxed dark:text-gray-200">
              <HighlightedSentence sentence={example.sentence} word={currentWord.word} />
            </p>
          )}

          {!isRevealed ? (
            <p className="mt-10 text-center text-base text-gray-400 dark:text-gray-500">
              意味を思い出してから、下のボタンを選んでください
            </p>
          ) : (
            <>
              <hr className="my-5 border-gray-300 dark:border-gray-600" />

              <p className="mb-3 text-center text-lg font-bold dark:text-gray-100">
                {translatePos(currentWord.part_of_speech)}：{currentWord.meaning}
              </p>

              {example && (
                <p className="mb-4 text-center text-base leading-relaxed text-gray-700 dark:text-gray-300">
                  {example.translation}
                </p>
              )}

              {currentWord.derivatives.length > 0 && (
                <div className="space-y-1 pl-2 text-base text-gray-600 dark:text-gray-400">
                  {currentWord.derivatives.map((d, i) => (
                    <p key={i}>
                      <span className="text-gray-500 dark:text-gray-500">
                        {translateDerivPart(d.part)}：
                      </span>
                      {d.word}
                      {'　'}
                      {d.meaning}
                    </p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 固定フッター：採点ボタン ── */}
        <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setGrade('known')}
              className={`flex-1 rounded-lg py-4 text-base font-bold transition-colors ${
                grade === 'known'
                  ? 'bg-sky-500 text-white'
                  : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800'
              }`}
            >
              覚えていた
            </button>
            <button
              type="button"
              onClick={() => setGrade('unknown')}
              className={`flex-1 rounded-lg py-4 text-base font-bold transition-colors ${
                grade === 'unknown'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800'
              }`}
            >
              覚えていなかった
            </button>
          </div>

          {/* 採点後に出す。答えを見て考えが変わったら、押す前なら選び直せる */}
          {isRevealed && (
            <button
              type="button"
              onClick={handleNext}
              className="mt-3 w-full rounded-lg bg-gray-800 dark:bg-gray-200 py-3 text-base font-bold text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-300"
            >
              {nextLabel}
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
