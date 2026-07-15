import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import type { WordQuestion } from '../types/word';
import type { GrammarQuestion } from '../types/grammar';

// ── 型定義 ─────────────────────────────────────────
type Phase = 'loading' | 'questions' | 'explanation' | 'result';
type QuestionLevel = 600 | 750 | 900;
type Badge = 'bronze' | 'silver' | 'gold';

interface TestWordQuestion {
  type: 'word';
  id: string;
  word: string;
  level: QuestionLevel;
  choices: string[];
  correct_index: number;
}

interface TestGrammarQuestion {
  type: 'grammar';
  id: string;
  question_text: string;
  choices: string[];
  correct_index: number;
  explanation: string;
  translation: string;
  level: QuestionLevel;
}

type TestQuestion = TestWordQuestion | TestGrammarQuestion;

// ── 定数 ───────────────────────────────────────────
const LABELS = ['A', 'B', 'C', 'D'] as const;
const POINTS: Record<QuestionLevel, number> = { 600: 20, 750: 35, 900: 44 };
const BADGE_ORDER: Record<Badge, number> = { bronze: 1, silver: 2, gold: 3 };
const BADGE_LABEL: Record<Badge, string> = { bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド' };

// ── ユーティリティ ─────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function calcScore(questions: TestQuestion[], answers: Map<string, number>): number {
  return questions.reduce(
    (sum, q) => sum + (answers.get(q.id) === q.correct_index ? POINTS[q.level] : 0),
    0,
  );
}

function scoreToBadge(score: number): Badge | null {
  if (score >= 900) return 'gold';
  if (score >= 750) return 'silver';
  if (score >= 600) return 'bronze';
  return null;
}

function scoreLabel(score: number): string {
  const band = Math.floor(score / 100) * 100;
  if (band < 100) return '100点未満';
  if (band >= 990) return '990点台';
  return `${band}点台`;
}

// ── メインコンポーネント ───────────────────────────
export default function RankTestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());

  // 問題データ生成
  useEffect(() => {
    async function load() {
      const wordsByLevel: Partial<Record<QuestionLevel, WordQuestion[]>> = {};
      const grammarByLevel: Partial<Record<QuestionLevel, GrammarQuestion[]>> = {};

      for (const level of [600, 750, 900] as QuestionLevel[]) {
        const wSnap = await getDocs(
          query(collection(db, 'word_questions'), where('level', '==', String(level))),
        );
        wordsByLevel[level] = wSnap.docs.map((d) => ({ id: d.id, ...d.data() } as WordQuestion));

        const gSnap = await getDocs(
          query(collection(db, 'grammar_questions'), where('level', '==', level)),
        );
        grammarByLevel[level] = gSnap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as GrammarQuestion),
        );
      }

      const testQuestions: TestQuestion[] = [];

      // 単語問題（前半15問）
      for (const level of [600, 750, 900] as QuestionLevel[]) {
        const words = wordsByLevel[level] ?? [];
        const selected = shuffleArray(words).slice(0, 5);
        const others = words.filter((w) => !selected.find((s) => s.id === w.id));

        for (const word of selected) {
          const wrongPool = shuffleArray(others)
            .slice(0, 3)
            .map((w) => w.meaning);
          const allChoices = shuffleArray([word.meaning, ...wrongPool]);
          testQuestions.push({
            type: 'word',
            id: word.id,
            word: word.word,
            level,
            choices: allChoices,
            correct_index: allChoices.indexOf(word.meaning),
          });
        }
      }

      // 文法問題（後半15問）
      for (const level of [600, 750, 900] as QuestionLevel[]) {
        const grammars = grammarByLevel[level] ?? [];
        const selected = shuffleArray(grammars).slice(0, 5);
        for (const g of selected) {
          testQuestions.push({
            type: 'grammar',
            id: g.id,
            question_text: g.question_text,
            choices: g.choices,
            correct_index: g.correct_index,
            explanation: g.explanation,
            translation: g.translation,
            level,
          });
        }
      }

      setQuestions(testQuestions);
      setPhase('questions');
    }

    load().catch((err) => console.error('問題データ取得失敗:', err));
  }, []);

  const handleSelectAnswer = useCallback((questionId: string, choiceIndex: number) => {
    setAnswers((prev) => new Map(prev).set(questionId, choiceIndex));
  }, []);

  const handleFinishTest = useCallback(() => {
    setPhase('explanation');
    window.scrollTo(0, 0);
  }, []);

  const handleShowResult = useCallback(async () => {
    setPhase('result');
    window.scrollTo(0, 0);

    if (!user) return;
    const score = calcScore(questions, answers);
    const newBadge = scoreToBadge(score);
    if (!newBadge) return;

    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const currentBadge = userSnap.data()?.badge as Badge | null;
      const shouldUpdate =
        !currentBadge || BADGE_ORDER[newBadge] > BADGE_ORDER[currentBadge];
      if (shouldUpdate) {
        await setDoc(doc(db, 'users', user.uid), { badge: newBadge }, { merge: true });
      }
    } catch (err) {
      console.error('バッジ保存失敗:', err);
    }
  }, [user, questions, answers]);

  // ── ローディング ──────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="mx-auto flex h-screen max-w-sm flex-col items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        <p className="mt-3 text-sm text-gray-500">問題を準備しています…</p>
      </div>
    );
  }

  // ── 結果画面 ──────────────────────────────────────
  if (phase === 'result') {
    const score = calcScore(questions, answers);
    const earnedBadge = scoreToBadge(score);
    const wordCorrect = questions
      .slice(0, 15)
      .filter((q) => answers.get(q.id) === q.correct_index).length;
    const grammarCorrect = questions
      .slice(15)
      .filter((q) => answers.get(q.id) === q.correct_index).length;
    const totalCorrect = wordCorrect + grammarCorrect;

    return (
      <div className="mx-auto flex h-screen max-w-sm flex-col bg-white">
        <header className="flex shrink-0 items-center border-b border-gray-200 px-4 py-3">
          <div className="w-8" />
          <h1 className="flex-1 text-center text-lg font-bold">ランク認定テスト：結果</h1>
          <div className="w-8" />
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          {/* バッジ画像 */}
          {earnedBadge && (
            <img
              src={`/badges/${earnedBadge}.png`}
              alt={BADGE_LABEL[earnedBadge]}
              className="h-32 w-32 object-contain"
            />
          )}

          {/* 認定バナー */}
          <div className="w-full rounded bg-sky-200 py-2 text-center text-xl font-bold text-gray-800">
            {earnedBadge ? `${BADGE_LABEL[earnedBadge]}認定！` : 'もう少し！'}
          </div>

          {/* 合計スコア */}
          <p className="text-lg text-gray-700">合計：{totalCorrect} / 30</p>

          {/* 内訳 */}
          <div className="text-center text-base text-gray-700 leading-relaxed">
            <p>単語：{wordCorrect} / 15</p>
            <p>文法：{grammarCorrect} / 15</p>
          </div>

          {/* 点数帯 */}
          <div className="text-center">
            <p className="text-base text-gray-500">現在</p>
            <p className="text-4xl font-bold text-gray-800">{scoreLabel(score)}</p>
            <p className="text-base text-gray-500">の実力があります</p>
          </div>

          {/* ホームへ */}
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full rounded bg-gray-200 py-3 text-center font-bold text-gray-800 hover:bg-gray-300 transition-colors"
          >
            ホームへ
          </button>
        </main>
      </div>
    );
  }

  // ── 問題画面 / 解説画面 ────────────────────────────
  const isExplanation = phase === 'explanation';

  return (
    <div className="mx-auto flex h-screen max-w-sm flex-col bg-white">
      <header className="flex shrink-0 items-center border-b border-gray-200 px-4 py-3">
        <div className="w-8" />
        <h1 className="flex-1 text-center text-lg font-bold">
          {isExplanation ? 'ランク認定テスト：解説' : 'ランク認定テスト'}
        </h1>
        <div className="w-8" />
      </header>

      <main className="flex-1 overflow-y-auto">
        {questions.map((q, idx) => {
          const selectedChoice = answers.get(q.id);
          const isCorrect = selectedChoice === q.correct_index;

          return (
            <div key={q.id} className="border-b border-gray-100 px-4 py-5">
              {/* 問題番号 + 正誤マーク（解説時） */}
              <div className="mb-3 flex items-center gap-2">
                <span className="font-bold">{idx + 1}.</span>
                {isExplanation && (
                  <span
                    className={`text-lg font-bold ${
                      isCorrect ? 'text-sky-500' : 'text-red-500'
                    }`}
                  >
                    {isCorrect ? '〇' : '×'}
                  </span>
                )}
              </div>

              {/* 問題本文 */}
              {q.type === 'word' ? (
                <h2 className="mb-4 text-center text-3xl font-bold">{q.word}</h2>
              ) : (
                <p className="mb-4 pl-2 text-sm leading-relaxed text-gray-800">
                  {q.question_text}
                </p>
              )}

              {/* 選択肢 2×2 */}
              <div className="grid grid-cols-2 gap-2">
                {q.choices.map((choice, ci) => {
                  let ringClass = '';
                  if (isExplanation) {
                    if (ci === q.correct_index) ringClass = 'ring-2 ring-inset ring-red-500';
                    else if (ci === selectedChoice) ringClass = 'ring-2 ring-inset ring-gray-900';
                  } else {
                    if (ci === selectedChoice) ringClass = 'ring-2 ring-inset ring-gray-900';
                  }

                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => !isExplanation && handleSelectAnswer(q.id, ci)}
                      className={`rounded bg-sky-200 px-3 py-3 text-left text-sm text-gray-800 transition-all
                        ${isExplanation ? 'cursor-default' : 'hover:bg-sky-300 active:scale-95'}
                        ${ringClass}
                      `}
                    >
                      {LABELS[ci]} : {choice}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 下部ボタン */}
        <div className="px-4 py-6">
          {isExplanation ? (
            <button
              type="button"
              onClick={handleShowResult}
              className="w-full rounded bg-gray-200 py-4 text-center font-bold text-gray-800 hover:bg-gray-300 transition-colors"
            >
              結果を見る
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishTest}
              className="w-full rounded bg-gray-200 py-4 text-center font-bold text-gray-800 hover:bg-gray-300 transition-colors"
            >
              テストを終了する
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
