import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import { normalizeReviewItem, selectDueQueue, gradeItem } from '../lib/srs';
import type { Grade, ReviewItem } from '../lib/srs';

/** キューの1件。同一セッション内の再出題は isRetry = true（採点は書き込まない） */
interface QueueEntry {
  item: ReviewItem;
  isRetry: boolean;
}

export default function ReviewSessionPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [words, setWords] = useState<Map<string, WordQuestion>>(new Map());
  const [index, setIndex] = useState(0);

  /** 現在のカードの採点（未採点は null）。「次へ」を押すまで確定しないので選び直せる */
  const [grade, setGrade] = useState<Grade | null>(null);

  const [knownCount, setKnownCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  /** 同一セッションで採点済みのID（再出題で二重に箱を動かさないため） */
  const [gradedIds, setGradedIds] = useState<Set<string>>(new Set());

  // ── 今日の復習キューを作る（セッション中は固定したいので getDocs で1回だけ） ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const snap = await getDocs(collection(db, 'users', user.uid, 'word_bookmarks'));
      const items = snap.docs.map((d) => normalizeReviewItem(d.id, d.data()));
      const due = selectDueQueue(items, new Date());

      const docs = await Promise.all(
        due.map((item) => getDoc(doc(db, 'word_questions', item.id))),
      );
      if (cancelled) return;

      const wordMap = new Map<string, WordQuestion>();
      docs.forEach((d) => {
        if (d.exists()) wordMap.set(d.id, { id: d.id, ...d.data() } as WordQuestion);
      });

      // マスターデータを引けなかったものは出しようがないので除外する
      setWords(wordMap);
      setQueue(due.filter((item) => wordMap.has(item.id)).map((item) => ({ item, isRetry: false })));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const current = queue[index];
  const currentWord = current ? words.get(current.item.id) : undefined;
  const isFinished = !loading && (queue.length === 0 || index >= queue.length);
  const totalCards = queue.length;
  const example = currentWord?.example_sentences[0];

  // ── 「次へ」で採点を確定して進む ──
  const handleNext = useCallback(async () => {
    if (!current || !grade || !user) return;

    // 再出題（同日中の2回目）は箱を動かさない。初回の採点だけが記録になる
    if (!gradedIds.has(current.item.id)) {
      const result = gradeItem(current.item, grade, new Date());
      const ref = doc(db, 'users', user.uid, 'word_bookmarks', current.item.id);

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

      setGradedIds((prev) => new Set(prev).add(current.item.id));
      setReviewedCount((n) => n + 1);
      if (grade === 'known') setKnownCount((n) => n + 1);
    }

    // 「覚えていなかった」は同じセッションの最後にもう一度だけ出す
    if (grade === 'unknown' && !current.isRetry) {
      setQueue((prev) => [...prev, { item: current.item, isRetry: true }]);
    }

    setGrade(null);
    setIndex((i) => i + 1);
  }, [current, grade, user, gradedIds]);

  // ──────────────── 描画 ────────────────

  if (loading) {
    return (
      <MainLayout showBack>
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      </MainLayout>
    );
  }

  if (isFinished) {
    return (
      <MainLayout showBack>
        <div className="flex h-full flex-col items-center justify-center gap-5 px-6">
          <p className="text-4xl">{queue.length === 0 ? '🌱' : '🎉'}</p>
          {queue.length === 0 ? (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                今日の復習はありません
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                単語モードで復習マークを付けると、翌日から復習に出てきます。
              </p>
            </>
          ) : (
            <>
              <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-200">
                今日の復習が終わりました
              </p>
              <p className="text-center text-2xl font-bold dark:text-gray-100">
                {reviewedCount}問中 {knownCount}問
              </p>
              <p className="text-center text-base text-gray-500 dark:text-gray-400">
                覚えていました
              </p>
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

  return (
    <MainLayout
      showBack
      showChatBot
      titleContent={
        <span className="text-base font-bold tabular-nums dark:text-gray-100">
          {index + 1} / {totalCards}
        </span>
      }
      chatContext={{ kind: 'word', word: currentWord, example }}
    >
      <div className="flex h-full flex-col">
        {/* ── 出題エリア ── */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
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
                      {d.word}{'　'}{d.meaning}
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
              {index + 1 >= totalCards ? '結果を見る' : '次へ'}
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
