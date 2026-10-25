import { useState } from 'react';
import type { WordQuestion, ExampleSentence } from '../types/word';
import { translatePos, translateDerivPart } from '../types/word';
import { HighlightedSentence } from './HighlightedSentence';

interface WordCardProps {
  word: WordQuestion;
  /** 章内での通し番号（1 始まり） */
  number: number;
  /** 「前回の続き」で着地した対象か（枠線＋初回パルス） */
  isHighlighted?: boolean;
  /** Step3: 和訳・派生語エリアを表示しているか */
  isRevealed: boolean;
  /** Step4: 復習マーク済みか */
  isBookmarked: boolean;
  /** Step5: リロードで生成した例文（未生成時は undefined → Firestore のデフォルト例文を表示） */
  generatedExample?: ExampleSentence;
  /** Step5: リロード処理中か */
  isReloading: boolean;
  onToggleReveal: () => void;
  onToggleBookmark: () => void;
  onReload: () => void;
}

export function WordCard({
  word,
  number,
  isHighlighted = false,
  isRevealed,
  isBookmarked,
  generatedExample,
  isReloading,
  onToggleReveal,
  onToggleBookmark,
  onReload,
}: WordCardProps) {
  // リロード生成済みならそちらを表示、未生成なら Firestore のデフォルト例文
  const currentExample = generatedExample ?? word.example_sentences[0];

  // 関連する単語は折りたたんでおく。常時出すとカードが4行伸びるため
  const [similarOpen, setSimilarOpen] = useState(false);
  const similarWords = word.similar_words ?? [];

  return (
    <article
      id={`word-${word.id}`}
      className={`relative px-4 py-5 border-b border-gray-100 dark:border-gray-700 ${
        isBookmarked
          ? 'bg-yellow-100 dark:bg-indigo-900'
          : 'bg-white dark:bg-gray-900'
      } ${
        isHighlighted
          ? 'resume-focus-pulse ring-2 ring-inset ring-sky-400 dark:ring-sky-300'
          : ''
      }`}
    >
      {/* ── ヘッダー行: リロード | 番号 | 英単語 | 復習フラグ ── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Step5: 例文リロードボタン */}
        <button
          type="button"
          onClick={onReload}
          disabled={isReloading}
          title="例文を切り替える"
          className="shrink-0 text-sky-500 disabled:opacity-40"
        >
          {isReloading ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-6 w-6 animate-spin"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-6 w-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
          )}
        </button>

        {/* 章内の通し番号 */}
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-sm font-bold tabular-nums text-gray-600 dark:bg-white/15 dark:text-gray-200">
          {number}
        </span>

        {/* 英単語 */}
        <h2 className="flex-1 text-center text-2xl font-bold tracking-wide dark:text-gray-100">{word.word}</h2>

        {/* 左の番号と幅を揃え、英単語を中央に保つためのスペーサー */}
        <div className="w-7 shrink-0" />

        {/* Step4: 復習フラグボタン */}
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

      {/* 英語例文（対象単語を太字） */}
      {currentExample && (
        <p className="text-center text-base leading-relaxed mb-4 dark:text-gray-200">
          <HighlightedSentence sentence={currentExample.sentence} word={word.word} />
        </p>
      )}

      {/* セパレーター */}
      <hr className="border-gray-300 dark:border-gray-600 mb-3" />

      {/* Step3: 暗記シート（青カバー）or 和訳・派生語 */}
      {!isRevealed ? (
        <button
          type="button"
          onClick={onToggleReveal}
          className="w-full rounded bg-sky-200 dark:bg-sky-800 py-6 text-center font-bold text-gray-700 dark:text-gray-200 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
        >
          タップして意味と和訳を表示
        </button>
      ) : (
        <div onClick={onToggleReveal} className="cursor-pointer">
          {/* 品詞：意味 */}
          <p className="mb-2 text-center font-bold dark:text-gray-100">
            {translatePos(word.part_of_speech)}：{word.meaning}
          </p>

          {/* 例文の和訳 */}
          {currentExample && (
            <p className="mb-3 text-center text-base leading-relaxed text-gray-700 dark:text-gray-300">
              {currentExample.translation}
            </p>
          )}

          {/* 派生語 */}
          {word.derivatives.length > 0 && (
            <div className="space-y-0.5 pl-2 text-base text-gray-600 dark:text-gray-400">
              {word.derivatives.map((d, i) => (
                <p key={i}>
                  <span className="text-gray-500 dark:text-gray-500">{translateDerivPart(d.part)}：</span>
                  {d.word}　{d.meaning}
                </p>
              ))}
            </div>
          )}

          {/* 関連する単語（折りたたみ。カバーを外した後にだけ出す） */}
          {similarWords.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setSimilarOpen((v) => !v)}
                aria-expanded={similarOpen}
                className="flex items-center gap-1 pl-2 text-base text-sky-600 dark:text-sky-400"
              >
                関連する単語
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  className={`h-4 w-4 transition-transform ${similarOpen ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {similarOpen && (
                <div className="mt-1 space-y-0.5 pl-2 text-base text-gray-600 dark:text-gray-400">
                  {similarWords.map((s, i) => (
                    <p key={i}>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{s.word}</span>
                      {'　'}
                      {s.meaning}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}
