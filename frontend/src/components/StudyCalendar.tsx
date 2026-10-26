import { useState } from 'react';
import type { StudyDay, DayRank } from '../lib/studyLog';
import {
  rankOf,
  monthGrid,
  toDateKey,
  calcStreak,
  calcLongestStreak,
  earliestDate,
} from '../lib/studyLog';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 達成度ごとのマスの見た目 */
const RANK_STYLE: Record<DayRank, string> = {
  gold: 'metal-gold font-bold',
  silver: 'metal-silver font-bold',
  bronze: 'metal-copper font-bold',
  rest: 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  none: 'text-gray-400 dark:text-gray-600',
};

const LEGEND: { rank: DayRank; label: string }[] = [
  { rank: 'gold', label: 'やり切った' },
  { rank: 'silver', label: '途中まで' },
  { rank: 'bronze', label: '開いただけ' },
  { rank: 'rest', label: 'お休み' },
];

interface StudyCalendarProps {
  days: Map<string, StudyDay>;
  onClose: () => void;
}

export function StudyCalendar({ days, onClose }: StudyCalendarProps) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const [shown, setShown] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const streak = calcStreak(days, today);
  const longest = calcLongestStreak(days);

  // 記録が始まった月より前には戻れない（データが無い月は見ても白紙のため）
  const start = earliestDate(days, today);
  const startMonth = new Date(start.getFullYear(), start.getMonth(), 1);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoBack = shown.getTime() > startMonth.getTime();
  const canGoForward = shown.getTime() < thisMonth.getTime();

  function shiftMonth(delta: number) {
    setShown((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  const cells = monthGrid(shown.getFullYear(), shown.getMonth());

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-y-auto rounded-xl bg-white dark:bg-gray-800 shadow-xl"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 月の切り替え */}
        <div className="flex items-center px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={!canGoBack}
            aria-label="前の月"
            className="px-2 text-xl font-bold text-gray-600 dark:text-gray-300 disabled:opacity-25"
          >
            ◀
          </button>
          <span className="flex-1 text-center text-lg font-bold tabular-nums dark:text-gray-100">
            {shown.getFullYear()}年 {shown.getMonth() + 1}月
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canGoForward}
            aria-label="次の月"
            className="px-2 text-xl font-bold text-gray-600 dark:text-gray-300 disabled:opacity-25"
          >
            ▶
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-700 text-white"
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

        {/* 曜日 */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-1">
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center text-xs font-bold text-gray-500 dark:text-gray-400">
              {w}
            </div>
          ))}
        </div>

        {/* 日付 */}
        <div className="grid grid-cols-7 gap-1 px-4 pb-4">
          {cells.map((key, i) => {
            if (!key) return <div key={`blank-${i}`} />;
            const rank = rankOf(days.get(key));
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`flex aspect-square items-center justify-center rounded-md text-sm tabular-nums ${RANK_STYLE[rank]} ${
                  isToday ? 'calendar-today' : ''
                }`}
              >
                {Number(key.slice(8))}
              </div>
            );
          })}
        </div>

        {/* 色の意味 */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
          {LEGEND.map(({ rank, label }) => (
            <div key={rank} className="flex items-center gap-2">
              <span className={`h-4 w-4 shrink-0 rounded ${RANK_STYLE[rank]}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
            </div>
          ))}
        </div>

        {/* 連続日数 */}
        <div className="flex items-center justify-around border-t border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">連続</p>
            <p className="text-2xl font-bold tabular-nums dark:text-gray-100">🔥 {streak}日</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">最長記録</p>
            <p className="text-2xl font-bold tabular-nums text-gray-600 dark:text-gray-300">
              {longest}日
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
