import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** 自動表示の既読判定に使う版数。ガイドを大きく改訂したら上げると全員に再表示される */
export const TUTORIAL_VERSION = 1;

const FLAG_PATH_SOLID =
  'M3 2.25a.75.75 0 0 1 .75.75v.54l1.838-.46a9.75 9.75 0 0 1 6.725.738l.108.054A8.25 8.25 0 0 0 18 4.524l3.11-.732a.75.75 0 0 1 .917.81 47.784 47.784 0 0 0 .005 10.337.75.75 0 0 1-.574.812l-3.114.733a9.75 9.75 0 0 1-6.594-.77l-.108-.054a8.25 8.25 0 0 0-5.69-.625l-2.202.55V21a.75.75 0 0 1-1.5 0V3A.75.75 0 0 1 3 2.25Z';
const FLAG_PATH_OUTLINE =
  'M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5';

function FlagIcon({ on, className = 'h-5 w-5' }: { on: boolean; className?: string }) {
  return on ? (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`${className} text-yellow-400`}>
      <path fillRule="evenodd" d={FLAG_PATH_SOLID} clipRule="evenodd" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className={`${className} text-sky-400`}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={FLAG_PATH_OUTLINE} />
    </svg>
  );
}

function Arrow() {
  return <span className="shrink-0 text-gray-400 dark:text-gray-500">→</span>;
}

/** 図の下地 */
function Figure({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[176px] items-center justify-center rounded-lg bg-gray-50 px-3 py-4 dark:bg-gray-900">
      {children}
    </div>
  );
}

// ── 各スライドの図 ─────────────────────────────

function WelcomeFigure() {
  const steps = [
    { icon: '📖', label: '単語・文法を\n解く' },
    { icon: '🚩', label: '分からない\n問題に印' },
    { icon: '🔁', label: '毎日の復習で\n定着' },
  ];
  return (
    <Figure>
      <div className="flex w-full items-center justify-between gap-1">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1">
            {i > 0 && <Arrow />}
            <div className="flex w-[76px] flex-col items-center gap-1 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-200 text-2xl dark:bg-sky-800">
                {s.icon}
              </span>
              <span className="whitespace-pre-line text-xs font-bold leading-tight text-gray-700 dark:text-gray-200">
                {s.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Figure>
  );
}

function MiniWordCard({ marked, revealed }: { marked: boolean; revealed: boolean }) {
  return (
    <div
      className={`w-full rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700 ${
        marked ? 'bg-yellow-100 dark:bg-indigo-900' : 'bg-white dark:bg-gray-800'
      }`}
    >
      <div className="mb-1.5 flex items-center">
        <span className="w-5" />
        <span className="flex-1 text-center text-base font-bold dark:text-gray-100">attend</span>
        <FlagIcon on={marked} />
      </div>
      {revealed ? (
        <p className="rounded bg-white/60 py-1.5 text-center text-xs text-gray-700 dark:bg-black/20 dark:text-gray-200">
          出席する、参加する
        </p>
      ) : (
        <p className="rounded bg-sky-200 py-1.5 text-center text-xs font-bold text-gray-700 dark:bg-sky-800 dark:text-gray-200">
          タップで意味を表示
        </p>
      )}
    </div>
  );
}

function BookmarkFigure() {
  return (
    <Figure>
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center gap-2">
          <MiniWordCard marked={false} revealed={false} />
          <Arrow />
          <MiniWordCard marked revealed />
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          旗 <FlagIcon on={false} className="inline h-4 w-4 align-[-3px]" /> をタップ → 黄色いカード{' '}
          <FlagIcon on className="inline h-4 w-4 align-[-3px]" /> になれば復習マーク付き
        </p>
      </div>
    </Figure>
  );
}

function IntervalFigure() {
  const stops = ['当日', '3日', '7日', '14日', '30日'];
  return (
    <Figure>
      <div className="w-full">
        <div className="flex flex-wrap items-center justify-center gap-y-1">
          {stops.map((label, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <span className="mx-0.5 text-[9px] text-emerald-500">▶</span>}
              <span
                className={`rounded-full px-1.5 py-1 text-xs font-bold tabular-nums ${
                  i === 0
                    ? 'bg-sky-500 text-white'
                    : 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100'
                }`}
              >
                {label}
              </span>
            </div>
          ))}
          <div className="flex items-center">
            <span className="mx-0.5 text-[9px] text-emerald-500">▶</span>
            <span className="text-base" aria-label="卒業">🎓</span>
          </div>
        </div>
        <p className="mt-2 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
          ○ 正解するたびに、次に出るまでの日数が延びる
        </p>
        <div className="mt-3 rounded-md border-2 border-dashed border-red-300 px-2 py-1.5 text-center text-xs text-red-600 dark:border-red-800 dark:text-red-300">
          × 間違えたら … 翌日にもう一度出て、最初からやり直し
        </div>
      </div>
    </Figure>
  );
}

function DailyReviewFigure() {
  return (
    <Figure>
      <div className="flex w-full flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-lg bg-sky-500 py-2.5 text-center text-sm font-bold text-white shadow">
            単語復習{'　'}12問
          </span>
          <Arrow />
          <span className="flex-1 rounded-lg border-2 border-emerald-400 py-2 text-center text-sm font-bold text-emerald-700 dark:border-emerald-600 dark:text-emerald-300">
            単語復習 完了！
          </span>
        </div>
        <div className="rounded-md bg-white px-3 py-2 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
          <p className="mb-1 font-bold text-gray-700 dark:text-gray-200">1日に出す最大問題数（設定で変更）</p>
          <div className="flex gap-1">
            {[10, 20, 30, 40].map((n) => (
              <span
                key={n}
                className={`flex-1 rounded py-1 text-center font-bold tabular-nums ${
                  n === 20 ? 'bg-sky-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Figure>
  );
}

function ReviewListFigure() {
  return (
    <Figure>
      <div className="w-full">
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between bg-white px-3 py-1.5 text-xs font-bold dark:bg-gray-800 dark:text-gray-100">
            <span className="text-gray-400">‹</span>
            <span>単語の復習問題</span>
            <span className="text-gray-400">›</span>
          </div>
          {['attend', 'schedule', 'implement'].map((w) => (
            <div
              key={w}
              className="flex items-center justify-between border-t border-gray-100 bg-yellow-100 px-3 py-1.5 text-sm font-bold dark:border-gray-700 dark:bg-indigo-900 dark:text-gray-100"
            >
              {w}
              <FlagIcon on className="h-4 w-4" />
            </div>
          ))}
        </div>
      </div>
    </Figure>
  );
}

const CHAT_ICON_PATH =
  'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z';

function ChatBotFigure() {
  return (
    <Figure>
      <div className="flex w-full flex-col gap-2">
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* 画面右上のチャットボタン（MainLayout と同じ見た目） */}
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 dark:border-gray-700">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
              アプリを離れずに質問
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-600 ring-2 ring-sky-400 dark:bg-sky-900 dark:text-sky-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={CHAT_ICON_PATH} />
              </svg>
            </span>
          </div>
          {/* 開いたチャット欄 */}
          <div className="flex flex-col gap-1.5 px-3 py-2 text-xs leading-snug">
            <span className="max-w-[80%] self-end rounded-2xl bg-sky-200 px-3 py-1.5 text-gray-800 dark:bg-sky-800 dark:text-gray-100">
              この単語の例文をもう1つ教えて
            </span>
            <span className="max-w-[85%] self-start rounded-2xl bg-gray-200 px-3 py-1.5 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              I will attend the meeting tomorrow.
              <br />
              （明日の会議に出席します）
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1 text-[11px]">
          <span className="text-gray-500 dark:text-gray-400">使える画面：</span>
          {['単語モード', '文法モード', '復習問題一覧'].map((label) => (
            <span
              key={label}
              className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-800 dark:bg-sky-900 dark:text-sky-100"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </Figure>
  );
}

function RankTestFigure() {
  const badges = [
    { src: '/badges/rookie.png', label: 'ルーキー', score: '' },
    { src: '/badges/bronze.png', label: 'ブロンズ', score: '600〜' },
    { src: '/badges/silver.png', label: 'シルバー', score: '750〜' },
    { src: '/badges/gold.png', label: 'ゴールド', score: '900〜' },
  ];
  return (
    <Figure>
      <div className="flex w-full flex-col gap-2">
        <div className="flex items-end justify-between">
          {badges.map((b, i) => (
            <div key={b.label} className="flex items-end">
              {i > 0 && <span className="mb-6 text-gray-400 dark:text-gray-500">›</span>}
              <div className="flex w-[64px] flex-col items-center">
                <img src={b.src} alt={b.label} className="h-12 w-12 object-contain" />
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{b.label}</span>
                <span className="h-3.5 text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                  {b.score && `${b.score}点`}
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          単語15問 ＋ 文法15問（600・750・900点レベル）
        </p>
      </div>
    </Figure>
  );
}

function CalendarFigure() {
  // 1週間ぶんの例。金＝全部、銀＝途中、休み＝出題なし、銅＝やらなかった
  const week: { day: number; cls: string }[] = [
    { day: 3, cls: 'metal-gold font-bold' },
    { day: 4, cls: 'metal-gold font-bold' },
    { day: 5, cls: 'metal-silver font-bold' },
    { day: 6, cls: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
    { day: 7, cls: 'metal-gold font-bold' },
    { day: 8, cls: 'metal-copper font-bold' },
    { day: 9, cls: 'metal-gold font-bold calendar-today' },
  ];
  const legend = [
    { cls: 'metal-gold', label: '全部やった' },
    { cls: 'metal-silver', label: '途中でやめた' },
    { cls: 'metal-copper', label: 'やらなかった' },
    { cls: 'bg-gray-200 dark:bg-gray-700', label: '出題がなかった' },
  ];
  return (
    <Figure>
      <div className="flex w-full flex-col gap-2">
        <div className="grid grid-cols-7 gap-1">
          {week.map((d) => (
            <span
              key={d.day}
              className={`flex aspect-square items-center justify-center rounded-md text-xs tabular-nums ${d.cls}`}
            >
              {d.day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {legend.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 shrink-0 rounded ${l.cls}`} />
              <span className="text-[11px] text-gray-600 dark:text-gray-400">{l.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-1 text-xs tabular-nums">
          <span className="rounded-md border-2 border-gray-300 px-1.5 py-0.5 text-gray-500 dark:border-gray-600 dark:text-gray-400">🔥1日</span>
          <span className="rounded-md border-2 border-sky-300 px-1.5 py-0.5 font-bold text-sky-600 dark:border-sky-700 dark:text-sky-400">🔥3日</span>
          <span className="metal-steel rounded-md border-2 border-sky-700/40 px-1.5 py-0.5 font-bold">🔥7日</span>
          <span className="metal-gold rounded-md border-2 border-amber-600/40 px-1.5 py-0.5 font-bold">🔥14日</span>
        </div>
      </div>
    </Figure>
  );
}

// ── スライド定義 ─────────────────────────────

interface Slide {
  title: string;
  figure: ReactNode;
  body: ReactNode;
}

const SLIDES: Slide[] = [
  {
    title: 'ようこそ！',
    figure: <WelcomeFigure />,
    body: (
      <>
        単語モード・文法モードで問題を解き、分からなかった問題に<strong>復習マーク</strong>を付けると、
        あとはアプリが<strong>ちょうどいいタイミング</strong>で復習に出してくれます。
      </>
    ),
  },
  {
    title: '分からない問題に復習マークを付けよう',
    figure: <BookmarkFigure />,
    body: (
      <>
        単語は青いカバーをタップして意味を確認し、自信がなければ右上の旗をタップ。
        文法は<strong>間違えた問題に自動でマーク</strong>が付きます。
        <span className="mt-1 block font-bold text-sky-600 dark:text-sky-400">
          迷ったらどんどん付けてOK！
        </span>
      </>
    ),
  },
  {
    title: 'ちょうどいい間隔で復習に出てくる',
    figure: <IntervalFigure />,
    body: (
      <>
        マークを付けた日にまず出題され、正解するたびに 3日後 → 7日後 → 14日後 → 30日後 と、
        忘れかけた頃にもう一度出てきます。5回続けて正解すると<strong>卒業</strong>して、
        復習マークが自動で外れます。
      </>
    ),
  },
  {
    title: '毎日「復習」ボタンを押すだけ',
    figure: <DailyReviewFigure />,
    body: (
      <>
        ホームの「単語復習」「文法復習」に、今日やる問題の数が出ます。
        1日に出す数は設定で変えられ、多いぶんは翌日以降に回ります。
      </>
    ),
  },
  {
    title: '復習問題一覧',
    figure: <ReviewListFigure />,
    body: (
      <>
        マークを付けた単語・文法をまとめて確認できます。問題をタップすると詳細が開き、
        そのままチャットボットに質問もできます（次のページで紹介）。
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          ※ マークを外すと、その問題の復習の進み具合もリセットされます
        </span>
      </>
    ),
  },
  {
    title: 'AIチャットボットに質問しよう',
    figure: <ChatBotFigure />,
    body: (
      <>
        <span className="mb-1 block font-bold text-sky-600 dark:text-sky-400">
          分からないことがあっても、辞書や検索を開かずにアプリの中で調べ物が完結します。
        </span>
        画面右上の吹き出しボタンから、単語の意味・例文・文法の解説などを日本語で質問できます。
        いま開いている章や問題を踏まえて答えるので、「この単語」「この問題」で通じます。
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          ※ 回答は短め（150文字程度）です。画面を移動すると会話はリセットされます
        </span>
      </>
    ),
  },
  {
    title: 'ランク認定テスト',
    figure: <RankTestFigure />,
    body: (
      <>
        30問で今の実力を判定します。点数に応じてバッジがもらえ、ホームに表示されます。
      </>
    ),
  },
  {
    title: 'カレンダーで続けた日を確認',
    figure: <CalendarFigure />,
    body: (
      <>
        ホーム左上の <strong>🔥◯日</strong> をタップすると、毎日の復習の記録が見られます。
        続けるほど 🔥 の表示が豪華になります。
      </>
    ),
  },
];

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  const goNext = () => setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
  const goPrev = () => setIndex((i) => Math.max(i - 1, 0));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="flex w-full max-w-sm flex-col overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-gray-800"
        style={{ maxHeight: '88vh' }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;
          if (dx < -50) goNext();
          if (dx > 50) goPrev();
        }}
      >
        {/* ヘッダー */}
        <div className="flex min-h-[44px] items-center px-4 pb-1 pt-3">
          <span className="flex-1 text-xs font-bold tabular-nums text-gray-400 dark:text-gray-500">
            使い方 {index + 1} / {SLIDES.length}
          </span>
          {!isLast && (
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              スキップ
            </button>
          )}
        </div>

        {/* 本文 */}
        <div className="flex flex-col gap-3 px-4 pb-3">
          <h2 id="tutorial-title" className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {slide.title}
          </h2>
          {slide.figure}
          <p className="min-h-[96px] text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {slide.body}
          </p>
        </div>

        {/* ドット */}
        <div className="flex justify-center gap-1.5 pb-3">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}枚目へ`}
              aria-current={i === index ? 'step' : undefined}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-5 bg-sky-500' : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        {/* 操作 */}
        <div className="flex gap-3 border-t border-gray-100 px-4 py-3 dark:border-gray-700">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="flex-1 rounded bg-gray-200 py-3 font-bold text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-40 disabled:hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
          >
            戻る
          </button>
          <button
            type="button"
            onClick={isLast ? onClose : goNext}
            className="flex-1 rounded bg-sky-500 py-3 font-bold text-white transition-colors hover:bg-sky-600"
          >
            {isLast ? 'はじめる' : '次へ'}
          </button>
        </div>
      </div>
    </div>
  );
}
