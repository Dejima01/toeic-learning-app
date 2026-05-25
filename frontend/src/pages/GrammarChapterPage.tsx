import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
import { auth } from '../firebase';
import { MainLayout } from '../components/MainLayout';
import { GrammarCard } from '../components/GrammarCard';
import type { GrammarQuestion } from '../types/grammar';

export default function GrammarChapterPage() {
  const { level: levelStr, chapter: chapterStr } = useParams();
  const level = Number(levelStr);
  const chapter = Number(chapterStr);
  const user = auth.currentUser;

  const [questions, setQuestions] = useState<GrammarQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // 解答済み: questionId → 選択した選択肢インデックス
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());

  // 復習マーク済み: questionId のセット（Firestore リアルタイム同期）
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // 問題データ取得（章切り替え時に解答リセット）
  useEffect(() => {
    setLoading(true);
    setAnswers(new Map());

    getDocs(
      query(
        collection(db, 'grammar_questions'),
        where('level', '==', level),
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

  // 選択肢タップ：解答を記録 + 不正解なら自動復習マーク
  const handleSelectChoice = useCallback(
    async (question: GrammarQuestion, choiceIndex: number) => {
      setAnswers((prev) => new Map(prev).set(question.id, choiceIndex));

      if (!user) return;
      const isWrong = choiceIndex !== question.correct_index;
      if (isWrong && !bookmarks.has(question.id)) {
        await setDoc(doc(db, 'users', user.uid, 'grammar_bookmarks', question.id), {
          source: 'auto',
          added_at: serverTimestamp(),
        });
      }
    },
    [user, bookmarks],
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
    <MainLayout showBack showChatBot>
      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : questions.length === 0 ? (
        <p className="pt-16 text-center text-gray-400">問題データがありません</p>
      ) : (
        <div>
          {questions.map((q, idx) => (
            <GrammarCard
              key={q.id}
              question={q}
              questionNumber={idx + 1}
              selectedChoice={answers.get(q.id)}
              isBookmarked={bookmarks.has(q.id)}
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
