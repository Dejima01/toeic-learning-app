import { CHOICE_LABELS } from '../types/grammar';
import type { GrammarQuestion } from '../types/grammar';
import { FilledQuestionText } from './FilledQuestionText';

interface GrammarReviewModalProps {
  question: GrammarQuestion;
  /** 一覧内での表示番号 */
  questionNumber: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
}

/**
 * 文法復習の詳細モーダル。
 * 文法モードのカードから選択肢ボタンを外し、空欄には正解を下線付きで埋めたもの。
 */
export function GrammarReviewModal({
  question,
  questionNumber,
  isBookmarked,
  onToggleBookmark,
  onClose,
}: GrammarReviewModalProps) {
  const correctLabel = CHOICE_LABELS[question.correct_index];
  const answer = question.choices[question.correct_index];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm overflow-y-auto rounded-xl shadow-xl ${
          isBookmarked ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-white dark:bg-gray-800'
        }`}
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー行: 問題番号 | 復習フラグ | × */}
        <div className="flex items-center gap-2 px-4 pb-2 pt-4">
          <span className="flex-1 text-base font-bold dark:text-gray-100">{questionNumber}.</span>

          {/* 復習フラグボタン */}
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
                className="h-6 w-6 text-yellow-500"
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
            onClick={onClose}
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

        {/* 問題文（空欄に正解を下線付きで表示） */}
        <p className="px-4 pb-4 text-base leading-relaxed dark:text-gray-100">
          <FilledQuestionText questionText={question.question_text} answer={answer} />
        </p>

        {/* 解説・和訳 */}
        <div className="px-4 pb-4">
          <div className="rounded bg-gray-50 dark:bg-gray-800 px-3 py-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            <p className="mb-2">
              <span className="font-bold">({correctLabel})</span> {question.explanation}
            </p>
            <p className="text-gray-500 dark:text-gray-400">【和訳】{question.translation}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
