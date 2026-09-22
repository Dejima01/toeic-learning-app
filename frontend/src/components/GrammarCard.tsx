import type { GrammarQuestion } from '../types/grammar';

const LABELS = ['A', 'B', 'C', 'D'] as const;

interface GrammarCardProps {
  question: GrammarQuestion;
  questionNumber: number;
  /** 選択された選択肢インデックス。未解答は undefined */
  selectedChoice: number | undefined;
  isBookmarked: boolean;
  onSelectChoice: (choiceIndex: number) => void;
  onToggleBookmark: () => void;
}

export function GrammarCard({
  question,
  questionNumber,
  selectedChoice,
  isBookmarked,
  onSelectChoice,
  onToggleBookmark,
}: GrammarCardProps) {
  const isAnswered = selectedChoice !== undefined;
  const correctLabel = LABELS[question.correct_index];

  return (
    <article
      className={`px-4 py-5 border-b border-gray-100 dark:border-gray-700 ${
        isBookmarked
          ? 'bg-yellow-50 dark:bg-amber-900/55'
          : 'bg-white dark:bg-gray-900'
      }`}
    >
      {/* 問題番号 + 復習フラグ */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-base font-bold dark:text-gray-100">{questionNumber}.</span>
        <button
          type="button"
          onClick={onToggleBookmark}
          title={isBookmarked ? '復習マークを外す' : '復習マークを付ける'}
          className="shrink-0"
        >
          {isBookmarked ? (
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
      </div>

      {/* 問題文 */}
      <p className="mb-4 text-base leading-relaxed dark:text-gray-100">{question.question_text}</p>

      {/* 選択肢 2×2 グリッド */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {question.choices.map((choice, i) => (
          <button
            key={i}
            type="button"
            onClick={() => !isAnswered && onSelectChoice(i)}
            className={`rounded bg-sky-200 dark:bg-sky-800 py-3 px-3 text-left text-sm text-gray-800 dark:text-gray-100 transition-all
              ${isAnswered ? 'cursor-default' : 'hover:bg-sky-300 dark:hover:bg-sky-700 active:scale-95'}
              ${selectedChoice === i ? 'ring-2 ring-inset ring-gray-900 dark:ring-gray-100' : ''}
            `}
          >
            {LABELS[i]} : {choice}
          </button>
        ))}
      </div>

      {/* 解説エリア：未解答時は青カバー */}
      {!isAnswered ? (
        <div className="rounded bg-sky-200 dark:bg-sky-800 py-5 text-center text-sm font-bold text-gray-700 dark:text-gray-200">
          選択肢を選ぶと解説が表示されます
        </div>
      ) : (
        <div className="rounded bg-gray-50 dark:bg-gray-800 px-3 py-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          <p className="mb-2">
            <span className="font-bold">({correctLabel})</span> {question.explanation}
          </p>
          <p className="text-gray-500 dark:text-gray-400">【和訳】{question.translation}</p>
        </div>
      )}
    </article>
  );
}
