import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';
import { callGemini } from '../lib/proxyClient';
import { MainLayout } from '../components/MainLayout';
import { FilledQuestionText } from '../components/FilledQuestionText';
import { GrammarReviewModal } from '../components/GrammarReviewModal';
import type { WordQuestion, ExampleSentence } from '../types/word';
import { translatePos, translateDerivPart } from '../types/word';
import type { GrammarQuestion } from '../types/grammar';

const MODES = ['word', 'grammar'] as const;
type ReviewMode = (typeof MODES)[number];

const MODE_LABEL: Record<ReviewMode, string> = {
  word: '単語復習',
  grammar: '文法復習',
};

/** 品詞の短縮表記（一覧行用） */
function posShort(pos: string): string {
  const map: Record<string, string> = {
    verb: '動', noun: '名', adj: '形', adv: '副',
    prep: '前', conj: '接', 'noun/verb': '名/動',
  };
  return map[pos.toLowerCase()] ?? pos;
}

/** 例文中の対象単語を太字にする */
function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  const baseWord = word.split(' ')[0];
  const parts = sentence.split(new RegExp(`(${baseWord})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === baseWord.toLowerCase() ? (
          <strong key={i}>{part}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default function ReviewListPage() {
  const user = auth.currentUser;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // 表示モード（単語復習 / 文法復習）
  const initialMode: ReviewMode =
    searchParams.get('mode') === 'grammar' ? 'grammar' : 'word';
  const [mode, setMode] = useState<ReviewMode>(initialMode);

  // 復習マーク済みの単語ID（added_at 昇順）
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  // 単語詳細キャッシュ
  const [words, setWords] = useState<Map<string, WordQuestion>>(new Map());
  const [loading, setLoading] = useState(true);
  // 詳細モーダルで表示中の単語ID
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // リロードで生成した例文（State のみ、Firestore 保存なし）
  const [generatedExamples, setGeneratedExamples] = useState<Map<string, ExampleSentence>>(new Map());
  const [reloading, setReloading] = useState<Set<string>>(new Set());
  // 取得済みIDの重複フェッチ防止
  const fetchedIds = useRef<Set<string>>(new Set());

  // ── 文法復習 ──
  // 復習マーク済みの問題ID（手動マーク・誤答による自動マークの両方。added_at 昇順）
  const [grammarBookmarkIds, setGrammarBookmarkIds] = useState<string[]>([]);
  // 問題詳細キャッシュ
  const [grammarQuestions, setGrammarQuestions] = useState<Map<string, GrammarQuestion>>(new Map());
  const [grammarLoading, setGrammarLoading] = useState(true);
  // 詳細モーダルで表示中の問題（番号は開いた時点の一覧での位置を保持する。
  // モーダル内で復習マークを外すと一覧から消えるため、indexOf では番号が崩れる）
  const [selectedGrammar, setSelectedGrammar] = useState<{ id: string; number: number } | null>(
    null,
  );
  const fetchedGrammarIds = useRef<Set<string>>(new Set());

  // word_bookmarks をリアルタイム監視（added_at 昇順）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, 'users', user.uid, 'word_bookmarks'),
        orderBy('added_at', 'asc'),
      ),
      (snap) => {
        setBookmarkIds(snap.docs.map((d) => d.id));
        setLoading(false);
      },
    );
  }, [user]);

  // bookmarkIds が変わったら未取得の単語詳細をフェッチ
  useEffect(() => {
    if (!user) return;
    const missingIds = bookmarkIds.filter((id) => !fetchedIds.current.has(id));
    if (missingIds.length === 0) return;
    missingIds.forEach((id) => fetchedIds.current.add(id));

    Promise.all(missingIds.map((id) => getDoc(doc(db, 'word_questions', id)))).then((docs) => {
      setWords((prev) => {
        const next = new Map(prev);
        docs.forEach((d) => {
          if (d.exists()) next.set(d.id, { id: d.id, ...d.data() } as WordQuestion);
        });
        return next;
      });
    });
  }, [bookmarkIds, user]);

  // grammar_bookmarks をリアルタイム監視（added_at 昇順）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(db, 'users', user.uid, 'grammar_bookmarks'),
        orderBy('added_at', 'asc'),
      ),
      (snap) => {
        setGrammarBookmarkIds(snap.docs.map((d) => d.id));
        setGrammarLoading(false);
      },
    );
  }, [user]);

  // grammarBookmarkIds が変わったら未取得の問題詳細をフェッチ
  useEffect(() => {
    if (!user) return;
    const missingIds = grammarBookmarkIds.filter((id) => !fetchedGrammarIds.current.has(id));
    if (missingIds.length === 0) return;
    missingIds.forEach((id) => fetchedGrammarIds.current.add(id));

    Promise.all(missingIds.map((id) => getDoc(doc(db, 'grammar_questions', id)))).then((docs) => {
      setGrammarQuestions((prev) => {
        const next = new Map(prev);
        docs.forEach((d) => {
          if (d.exists()) next.set(d.id, { id: d.id, ...d.data() } as GrammarQuestion);
        });
        return next;
      });
    });
  }, [grammarBookmarkIds, user]);

  // 文法の復習マークをトグル
  const toggleGrammarBookmark = useCallback(
    async (questionId: string) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'grammar_bookmarks', questionId);
      if (grammarBookmarkIds.includes(questionId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { source: 'manual', added_at: serverTimestamp() });
      }
    },
    [user, grammarBookmarkIds],
  );

  // モード切り替え（単語モードのレベル切り替えと同じ剰余ロジック）
  const changeMode = useCallback(
    (next: ReviewMode) => {
      setMode(next);
      // 詳細モーダルが開いたまま切り替わるのを防ぐ
      setSelectedId(null);
      setSelectedGrammar(null);
      navigate(`/review?mode=${next}`, { replace: true });
    },
    [navigate],
  );

  const prevMode = useCallback(() => {
    const idx = MODES.indexOf(mode);
    changeMode(MODES[(idx - 1 + MODES.length) % MODES.length]);
  }, [mode, changeMode]);

  const nextMode = useCallback(() => {
    const idx = MODES.indexOf(mode);
    changeMode(MODES[(idx + 1) % MODES.length]);
  }, [mode, changeMode]);

  // 復習マークをトグル
  const toggleBookmark = useCallback(
    async (wordId: string) => {
      if (!user) return;
      const ref = doc(db, 'users', user.uid, 'word_bookmarks', wordId);
      if (bookmarkIds.includes(wordId)) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { added_at: serverTimestamp() });
      }
    },
    [user, bookmarkIds],
  );

  // 例文リロード（毎回 Gemini 呼び出し、State のみ更新）
  const reloadExample = useCallback(async (word: WordQuestion) => {
    setReloading((prev) => new Set(prev).add(word.id));
    try {
      const prompt = `英単語 "${word.word}" (${word.part_of_speech}: ${word.meaning}) のTOEICビジネスシーン例文を1つ生成してください。JSONのみで返してください。説明や前置きは一切不要です。形式: {"sentence": "...", "translation": "..."}`;
      const raw = await callGemini(prompt);
      const clean = raw.replace(/```json\n?/gi, '').replace(/```/g, '').trim();
      const data = JSON.parse(clean);
      const newExample: ExampleSentence = Array.isArray(data) ? data[0] : data;
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

  const selectedGrammarQuestion = selectedGrammar
    ? grammarQuestions.get(selectedGrammar.id)
    : undefined;
  const selectedWord = selectedId ? words.get(selectedId) : undefined;
  const isSelectedBookmarked = selectedId ? bookmarkIds.includes(selectedId) : false;
  const currentExample = selectedWord
    ? (generatedExamples.get(selectedWord.id) ?? selectedWord.example_sentences[0])
    : undefined;

  // ヘッダー中央のモード切り替えバー（単語モードのレベル切り替えと同じ組み方）
  const modeSwitcher = (
    <>
      <button
        type="button"
        onClick={prevMode}
        aria-label="前の復習モード"
        className="px-2 text-xl font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        ◀
      </button>
      <span className="mx-2 text-center text-lg font-bold dark:text-gray-100">
        {MODE_LABEL[mode]}
      </span>
      <button
        type="button"
        onClick={nextMode}
        aria-label="次の復習モード"
        className="px-2 text-xl font-bold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
      >
        ▶
      </button>
    </>
  );

  return (
    <MainLayout titleContent={modeSwitcher} showBack showChatBot>
      {/* ── 文法復習：一覧（問題文の空欄に正解を下線付きで表示） ── */}
      {mode === 'grammar' &&
        (grammarLoading ? (
          <div className="flex justify-center pt-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
          </div>
        ) : grammarBookmarkIds.length === 0 ? (
          <p className="pt-16 text-center text-gray-400 dark:text-gray-500">
            復習マークが付いた文法問題がありません
          </p>
        ) : (
          <div className="flex flex-col gap-3 px-4 py-4">
            {grammarBookmarkIds.map((id, idx) => {
              const question = grammarQuestions.get(id);
              if (!question) {
                return (
                  <div key={id} className="h-14 animate-pulse rounded bg-sky-100 dark:bg-sky-900/30" />
                );
              }
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedGrammar({ id, number: idx + 1 })}
                  className="w-full rounded bg-sky-200 dark:bg-sky-800 px-4 py-3 text-left text-sm leading-relaxed text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
                >
                  <FilledQuestionText
                    questionText={question.question_text}
                    answer={question.choices[question.correct_index]}
                  />
                </button>
              );
            })}
          </div>
        ))}

      {/* ── 単語復習：一覧 ── */}
      {mode === 'word' &&
        (loading ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : bookmarkIds.length === 0 ? (
        <p className="pt-16 text-center text-gray-400 dark:text-gray-500">復習マークが付いた単語がありません</p>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          {bookmarkIds.map((id) => {
            const word = words.get(id);
            if (!word) {
              return <div key={id} className="h-14 animate-pulse rounded bg-sky-100 dark:bg-sky-900/30" />;
            }
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className="w-full rounded bg-sky-200 dark:bg-sky-800 px-4 py-3 text-left hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
              >
                <span className="font-bold dark:text-gray-100">{word.word}</span>
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {word.meaning}({posShort(word.part_of_speech)})
                </span>
              </button>
            );
          })}
        </div>
        ))}

      {/* ── 文法復習：詳細モーダル ── */}
      {selectedGrammarQuestion && selectedGrammar && (
        <GrammarReviewModal
          question={selectedGrammarQuestion}
          questionNumber={selectedGrammar.number}
          isBookmarked={grammarBookmarkIds.includes(selectedGrammar.id)}
          onToggleBookmark={() => toggleGrammarBookmark(selectedGrammar.id)}
          onClose={() => setSelectedGrammar(null)}
        />
      )}

      {/* ── 単語復習：詳細モーダル（モード切り替え時に selectedId をクリアするので単語モード専用） ── */}
      {selectedId && selectedWord && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10"
          onClick={() => setSelectedId(null)}
        >
          <div
            className={`w-full max-w-sm overflow-y-auto rounded-xl shadow-xl ${
              isSelectedBookmarked ? 'bg-yellow-100 dark:bg-amber-950' : 'bg-white dark:bg-gray-800'
            }`}
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ヘッダー行: リロード | 英単語 | 復習フラグ | × */}
            <div className="flex items-center gap-2 px-4 pb-2 pt-4">
              {/* リロードボタン */}
              <button
                type="button"
                onClick={() => reloadExample(selectedWord)}
                disabled={reloading.has(selectedWord.id)}
                title="例文を切り替える"
                className="shrink-0 text-sky-500 disabled:opacity-40"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className={`h-6 w-6 ${reloading.has(selectedWord.id) ? 'animate-spin' : ''}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>

              {/* 英単語 */}
              <h2 className="flex-1 text-center text-2xl font-bold tracking-wide dark:text-gray-100">
                {selectedWord.word}
              </h2>

              {/* 復習フラグボタン */}
              <button
                type="button"
                onClick={() => toggleBookmark(selectedWord.id)}
                title={isSelectedBookmarked ? '復習マークを外す' : '復習マークを付ける'}
                className="shrink-0"
              >
                {isSelectedBookmarked ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-6 w-6 text-yellow-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054A8.25 8.25 0 0 0 18 4.524l3.11-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-2.202.55V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-6 w-6 text-sky-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5"
                    />
                  </svg>
                )}
              </button>

              {/* × 閉じるボタン */}
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-white"
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

            {/* 英語例文 */}
            {currentExample && (
              <p className="px-4 pb-3 text-center text-sm leading-relaxed dark:text-gray-200">
                <HighlightedSentence
                  sentence={currentExample.sentence}
                  word={selectedWord.word}
                />
              </p>
            )}

            <hr className="mx-4 border-gray-300 dark:border-gray-600" />

            <div className="px-4 py-3">
              {/* 品詞：意味 */}
              <p className="mb-2 text-center font-bold dark:text-gray-100">
                {translatePos(selectedWord.part_of_speech)}：{selectedWord.meaning}
              </p>

              {/* 例文の和訳 */}
              {currentExample && (
                <p className="mb-3 text-center text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  {currentExample.translation}
                </p>
              )}

              {/* 派生語 */}
              {selectedWord.derivatives.length > 0 && (
                <div className="space-y-0.5 pl-2 text-sm text-gray-600 dark:text-gray-400">
                  {selectedWord.derivatives.map((d, i) => (
                    <p key={i}>
                      <span className="text-gray-500 dark:text-gray-500">{translateDerivPart(d.part)}：</span>
                      {d.word}　{d.meaning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
