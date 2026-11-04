import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { RankingKind, RankingRow, RankingView } from '../lib/rankingQuery';
import { fetchRanking } from '../lib/rankingQuery';
import type { RankChange } from '../lib/ranking';
import { formatRankChange } from '../lib/ranking';

interface RankingListProps {
  kind: RankingKind;
  /** 自分のニックネーム。null なら「名無しさん」として参加中 */
  nickname: string | null;
}

const CHANGE_STYLE: Record<RankChange['kind'], string> = {
  none: 'text-gray-400 dark:text-gray-500',
  new: 'text-sky-600 dark:text-sky-400',
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-500 dark:text-red-400',
  same: 'text-gray-500 dark:text-gray-400',
};

const NOTE: Record<RankingKind, string> = {
  streak: '復習を1問以上解いた日を数えます（復習がない日は維持）。同じ日数は同順位で、先に到達した人が上。先週比は1週間前の順位との比較です。',
  longest: 'これまでで一番長く続いた連続日数です。同じ日数は同順位で、先に到達した人が上です。',
};

function Row({ row, showChange }: { row: RankingRow; showChange: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 px-3 py-2 text-sm ${
        row.isMe
          ? 'bg-sky-100 font-bold text-sky-900 dark:bg-sky-900 dark:text-sky-50'
          : 'text-gray-800 dark:text-gray-200'
      }`}
    >
      <span className="w-9 shrink-0 text-right tabular-nums">{row.rank}位</span>
      <span className="min-w-0 flex-1 truncate">
        {row.name}
        {row.isMe && <span className="ml-1 text-xs font-normal">（あなた）</span>}
      </span>
      <span className="w-12 shrink-0 text-right tabular-nums">{row.value}日</span>
      {showChange && row.change && (
        <span className={`w-11 shrink-0 text-right text-xs font-bold tabular-nums ${CHANGE_STYLE[row.change.kind]}`}>
          {formatRankChange(row.change)}
        </span>
      )}
    </li>
  );
}

export function RankingList({ kind, nickname }: RankingListProps) {
  const { user } = useAuth();
  const [view, setView] = useState<RankingView | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchRanking(kind, user.uid)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch((err) => {
        console.error('ranking load failed:', err);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, user, attempt]);

  const retry = useCallback(() => {
    setError(false);
    setView(null);
    setAttempt((n) => n + 1);
  }, []);

  const showChange = kind === 'streak';
  const unit = kind === 'streak' ? '連続' : '最長';

  let body;
  if (error) {
    body = (
      <div className="px-4 py-8 text-center">
        <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">ランキングを読み込めませんでした</p>
        <button
          type="button"
          onClick={retry}
          className="rounded bg-sky-500 px-4 py-2 text-sm font-bold text-white hover:bg-sky-600"
        >
          もう一度読み込む
        </button>
      </div>
    );
  } else if (!view) {
    body = (
      <div className="flex justify-center py-10">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-400" />
      </div>
    );
  } else if (view.top.length === 0) {
    body = <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">まだ参加者がいません</p>;
  } else {
    body = (
      <>
        <div className="flex items-center gap-2 px-3 pb-1 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-9 shrink-0 text-right">順位</span>
          <span className="flex-1">ニックネーム</span>
          <span className="w-12 shrink-0 text-right">{unit}</span>
          {showChange && <span className="w-11 shrink-0 text-right">先週比</span>}
        </div>
        <ol className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {view.top.map((r) => (
            <Row key={r.uid} row={r} showChange={showChange} />
          ))}
          {view.around.length > 0 && !view.contiguous && (
            <li aria-hidden="true" className="py-0.5 text-center text-gray-400 dark:text-gray-500">…</li>
          )}
          {view.around.map((r) => (
            <Row key={r.uid} row={r} showChange={showChange} />
          ))}
        </ol>
      </>
    );
  }

  const status =
    view?.me === 'hidden'
      ? 'ランキングに表示しない設定になっています'
      : view?.me === 'outside'
        ? kind === 'streak'
          ? 'あなたは今、連続記録がありません。復習を1問以上解くと参加できます'
          : '復習を1問以上解くと、最長記録が付きます'
        : null;

  return (
    <div className="px-4 pb-4 pt-3">
      {body}

      {status && (
        <p className="mt-3 rounded bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
          {status}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{NOTE[kind]}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {nickname === null && view?.me === 'listed' && 'いまは「名無しさん」で表示されています。'}
        ニックネームと表示／非表示は
        <Link to="/settings" className="mx-0.5 font-bold text-sky-600 underline dark:text-sky-400">
          設定
        </Link>
        で変更できます。
      </p>
    </div>
  );
}
