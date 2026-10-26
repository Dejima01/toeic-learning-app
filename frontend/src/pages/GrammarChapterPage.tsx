import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { MainLayout } from '../components/MainLayout';
import { GrammarCard } from '../components/GrammarCard';
import { hasNextGrammarChapter } from '../lib/chapters';
import type { ResumePosition } from '../lib/resumePosition';
import type { GrammarQuestion } from '../types/grammar';

export default function GrammarChapterPage() {
  const { level: levelStr, chapter: chapterStr } = useParams();
  const navigate = useNavigate();
  const level = Number(levelStr);
  const chapter = Number(chapterStr);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('focus');

  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // 解答済み: questionId → 選択した選択肢インデックス
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());

  // 復習マーク済み: questionId のセット（Firestore リアルタイム同期）
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // 「前回の続き」で着地した問題の枠線を、ユーザーが触れたら消すためのフラグ。
  // 表示するかどうかは URL の focus から導出するので、state は「消したか」だけ持つ
  const [dismissedFocusId, setDismissedFocusId] = useState<string | null>(null);
  const highlightedId = focusId && focusId !== dismissedFocusId ? focusId : null;

  // 「前回の続き」位置の書き込みバッファ。直近の1件だけ保持し、
  // 3秒後・離脱時・バックグラウンド化時にまとめて書く
  const pendingResume = useRef<ResumePosition | null>(null);
  const flushTimer = useRef<number | null>(null);

  // 問題データ取得（章切り替え時に解答リセット）
  useEffect(() => {
    setLoading(true);
    setAnswers(new Map());

    getDocs(
      query(
        collection(db, 'grammar_questions'),
        where('level', '==', String(level)),
        where('chapter_num', '==', chapter),
      ),
    )
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as GrammarQuestion))
          .sort((a, b) => a.id.localeCompare(b.id));
        setQuestions(list);
      })
      .finally(() => setLoading(false));
  }, [level, chapter]);

  // 復習マーク（Firestore リアルタイム同期）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, 'users', user.uid, 'grammar_bookmarks'),
      (snap) => setBookmarks(new Set(snap.docs.map((d) => d.id))),
    );
  }, [user]);

  // 「前回の続き」で指定された問題まで画面中央にスクロールする
  useEffect(() => {
    if (!focusId || questions.length === 0) return;
    document.getElementById(`grammar-${focusId}`)?.scrollIntoView({ block: 'center' });
  }, [focusId, questions]);

  // ── 「前回の続き」位置の記録 ──
  const flushResume = useCallback(() => {
    if (flushTimer.current !== null) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const pos = pendingResume.current;
    if (!pos || !user) return;
    pendingResume.current = null;
    setDoc(
      doc(db, 'users', user.uid),
      { last_grammar_position: { ...pos, updated_at: serverTimestamp() } },
      { merge: true },
    ).catch(() => {
      // 位置の記録は学習の本筋ではないので、失敗しても黙って諦める
    });
  }, [user]);

  // 離脱時・バックグラウンド化時に取りこぼしを書き切る
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flushResume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flushResume();
    };
  }, [flushResume]);

  /** 解答した問題から「次に再開すべき位置」を解決してバッファに積む */
  const recordResume = useCallback(
    (questionId: string) => {
      const idx = questions.findIndex((q) => q.id === questionId);
      if (idx === -1) return;

      let pos: ResumePosition;
      if (idx < questions.length - 1) {
        // 章の途中 → その問題自身
        pos = { level, chapter, item_id: questionId };
      } else if (hasNextGrammarChapter(level, chapter)) {
        // 章の最後 → 次の章の先頭（解説は閉じたまま・ハイライトなし）
        pos = { level, chapter: chapter + 1, item_id: null };
      } else {
        // 最終章の最後 → 章一覧へ
        pos = { level, chapter: null, item_id: null };
      }

      pendingResume.current = pos;
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(flushResume, 3000);
    },
    [questions, level, chapter, flushResume],
  );

  // 選択肢タップ：解答を記録 + 不正解なら自動復習マーク
  const handleSelectChoice = useCallback(
    async (question: GrammarQuestion, choiceIndex: number) => {
      setAnswers((prev) => new Map(prev).set(question.id, choiceIndex));

      // 着地した問題に触れた時点で枠線の役目は終わり
      if (question.id === focusId) setDismissedFocusId(question.id);

      // 解答した問題を「前回の続き」として記録（解答は一度きりなので上書きは起きない）
      recordResume(question.id);

      if (!user) return;
      const isWrong = choiceIndex !== question.correct_index;
      if (isWrong && !bookmarks.has(question.id)) {
        await setDoc(doc(db, 'users', user.uid, 'grammar_bookmarks', question.id), {
          source: 'auto',
          added_at: serverTimestamp(),
        });
      }
    },
    [user, bookmarks, focusId, recordResume],
  );

  // 復習マーク手動トグル
  const toggleBookmark = useCallback(
    async (questionId: string) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'grammar_bookmarks', questionId);
      if (bookmarks.has(questionId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { source: 'manual', added_at: serverTimestamp() });
      }
    },
    [user, bookmarks],
  );

  return (
    <MainLayout
      title={`第${chapter}章`}
      showBack
      // ホームの「前回の続き」から来た場合でも章一覧へ戻す
      backTo={`/grammar?level=${level}`}
      showChatBot
      chatContext={{ kind: 'chapter', mode: 'grammar', level: String(level), chapter }}
    >
      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center gap-6 px-6 pt-24">
          <p className="text-3xl">📝</p>
          <p className="text-center text-lg font-bold text-gray-700 dark:text-gray-300">この章は現在準備中です</p>
          <p className="text-center text-gray-500 dark:text-gray-400">お楽しみに！</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 rounded-full bg-sky-400 px-8 py-3 font-bold text-white hover:bg-sky-500"
          >
            章一覧へ戻る
          </button>
        </div>
      ) : (
        <div>
          {questions.map((q, idx) => (
            <GrammarCard
              key={q.id}
              question={q}
              questionNumber={idx + 1}
              selectedChoice={answers.get(q.id)}
              isBookmarked={bookmarks.has(q.id)}
              isHighlighted={highlightedId === q.id}
              onSelectChoice={(choiceIndex) => handleSelectChoice(q, choiceIndex)}
              onToggleBookmark={() => toggleBookmark(q.id)}
            />
          ))}
          <div className="h-4" />
        </div>
      )}
    </MainLayout>
  );
}
