import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { callGemini } from '../lib/proxyClient';
import { MainLayout } from '../components/MainLayout';
import { WordCard } from '../components/WordCard';
import type { WordQuestion, ExampleSentence } from '../types/word';

export default function WordChapterPage() {
  const { level: levelStr, chapter: chapterStr } = useParams();
  const navigate = useNavigate();
  const level = Number(levelStr);
  const chapter = Number(chapterStr);
  const user = auth.currentUser;

  // ── データ ──
  const [words, setWords] = useState<WordQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Step3: 表示済み（青カバーが外れている）単語ID セット
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  // Step4: 復習マーク済みの単語ID セット（Firestore から取得）
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());

  // Step5: リロードで生成した例文（wordId → ExampleSentence）。再マウント時はリセットされる
  const [generatedExamples, setGeneratedExamples] = useState<Map<string, ExampleSentence>>(new Map());

  // Step5: Gemini 呼び出し中の単語ID セット
  const [reloading, setReloading] = useState<Set<string>>(new Set());

  // ── 単語データ取得 ──
  useEffect(() => {
    setLoading(true);
    setRevealed(new Set());   // 章を切り替えたらカバーをリセット
    setGeneratedExamples(new Map());

    getDocs(
      query(
        collection(db, 'word_questions'),
        where('level', '==', String(level)),
        where('chapter_num', '==', chapter),
      ),
    )
      .then((snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as WordQuestion))
          .sort((a, b) => a.id.localeCompare(b.id));
        setWords(list);
      })
      .finally(() => setLoading(false));
  }, [level, chapter]);

  // Step4: 復習マーク（Firestore リアルタイム同期）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      collection(db, 'users', user.uid, 'word_bookmarks'),
      (snap) => setBookmarks(new Set(snap.docs.map((d) => d.id))),
    );
  }, [user]);

  // Step3: 青カバートグル
  const toggleReveal = useCallback((id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Step4: 復習マークトグル
  const toggleBookmark = useCallback(
    async (wordId: string) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'word_bookmarks', wordId);
      if (bookmarks.has(wordId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { added_at: serverTimestamp() });
      }
    },
    [user, bookmarks],
  );

  // Step5: 例文リロード（毎回 Gemini 呼び出し → State のみ更新、Firestore 保存なし）
  const reloadExample = useCallback(async (word: WordQuestion) => {
    console.log('[reload] start:', word.word);
    setReloading((prev) => new Set(prev).add(word.id));
    try {
      const prompt = `英単語 "${word.word}" (${word.part_of_speech}: ${word.meaning}) のTOEICビジネスシーン例文を1つ生成してください。JSONのみで返してください。説明や前置きは一切不要です。形式: {"sentence": "...", "translation": "..."}`;

      const raw = await callGemini(prompt);
      console.log('[reload] raw response:', raw);

      // マークダウンコードブロックがある場合は除去
      const clean = raw.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
      const data = JSON.parse(clean);
      // モデルが配列で返した場合も考慮
      const newExample: ExampleSentence = Array.isArray(data) ? data[0] : data;
      console.log('[reload] parsed:', newExample);

      // State のみ更新（Firestore への書き込みは行わない）
      setGeneratedExamples((prev) => new Map(prev).set(word.id, newExample));
    } catch (err) {
      console.error('[reload] error:', err);
    } finally {
      setReloading((prev) => {
        const next = new Set(prev);
        next.delete(word.id);
        return next;
      });
    }
  }, []);

  return (
    // ヘッダー: 戻るボタン(左) + チャットボットボタン(右)、タイトルなし
    <MainLayout showBack showChatBot>
      {loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : words.length === 0 ? (
        <div className="flex flex-col items-center gap-6 px-6 pt-24">
          <p className="text-3xl">📚</p>
          <p className="text-center text-lg font-bold text-gray-700">この章は現在準備中です</p>
          <p className="text-center text-gray-500">お楽しみに！</p>
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
          {words.map((word) => (
            <WordCard
              key={word.id}
              word={word}
              isRevealed={revealed.has(word.id)}
              isBookmarked={bookmarks.has(word.id)}
              generatedExample={generatedExamples.get(word.id)}
              isReloading={reloading.has(word.id)}
              onToggleReveal={() => toggleReveal(word.id)}
              onToggleBookmark={() => toggleBookmark(word.id)}
              onReload={() => reloadExample(word)}
            />
          ))}
          {/* 最下部の余白 */}
          <div className="h-4" />
        </div>
      )}
    </MainLayout>
  );
}
