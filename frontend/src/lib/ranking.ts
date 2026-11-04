/**
 * ランキング用の純粋関数（Firebase に依存しない）。
 *
 * 連続日数の数え方は studyLog.ts と共通。ランキングには「0」を書き込まず、
 * 連続が切れたかどうかは lastActiveDay が昨日より前かどうかで判定する。
 */
import type { StudyDay } from './studyLog';
import {
  calcLongestStreak,
  calcStreak,
  countsForStreak,
  fromDateKey,
  keepsStreak,
  rankOf,
} from './studyLog';

export const ANONYMOUS_NAME = '名無しさん';
export const NICKNAME_MAX_LENGTH = 12;

/** 端末のローカル日付を「1970-01-01 からの日数」にする（セキュリティルールで日付の差を計算するため） */
export function dayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export interface RankingState {
  streak: number;
  longest: number;
  /** 最後に学習した日（金・銀） */
  lastStudyDay: number;
  /** 連続をつないだ最後の日（学習日または休みの日） */
  lastActiveDay: number;
}

export function normalizeRankingState(value: unknown): RankingState | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const nums = [v.streak, v.longest, v.lastStudyDay, v.lastActiveDay];
  if (!nums.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)) return null;
  return {
    streak: v.streak as number,
    longest: v.longest as number,
    lastStudyDay: v.lastStudyDay as number,
    lastActiveDay: v.lastActiveDay as number,
  };
}

/** 初回登録用。カレンダーの記録から今の状態を計算する */
export function initialRankingState(days: Map<string, StudyDay>, today: Date): RankingState {
  const todayNum = dayNumber(today);
  let lastStudyDay = 0;
  let lastActiveDay = 0;
  for (const [key, day] of days) {
    const num = dayNumber(fromDateKey(key));
    if (num > todayNum) continue;
    const rank = rankOf(day);
    if (countsForStreak(rank) && num > lastStudyDay) lastStudyDay = num;
    if (keepsStreak(rank) && num > lastActiveDay) lastActiveDay = num;
  }
  return {
    streak: calcStreak(days, today),
    longest: calcLongestStreak(days),
    lastStudyDay,
    lastActiveDay,
  };
}

export interface RankingTransition {
  state: RankingState;
  streakChanged: boolean;
  longestChanged: boolean;
}

/**
 * 1日分の出来事で状態を進める。変化がなければ null（書き込み不要）。
 *   study: 復習を1問以上解いた日 → +1（前日までつながっていなければ 1）
 *   rest:  復習がなかった日 → 連続を維持して lastActiveDay だけ進める
 */
export function nextRankingState(
  state: RankingState,
  event: 'study' | 'rest',
  todayNum: number,
): RankingTransition | null {
  const chainAlive = state.lastActiveDay >= todayNum - 1;

  if (event === 'study') {
    if (state.lastStudyDay >= todayNum) return null;
    const streak = chainAlive ? state.streak + 1 : 1;
    const longest = Math.max(state.longest, streak);
    return {
      state: { streak, longest, lastStudyDay: todayNum, lastActiveDay: todayNum },
      streakChanged: true,
      longestChanged: longest !== state.longest,
    };
  }

  // 途切れている人の休みの日は書き込まない（次に学習した日に 1 から始まる）
  if (state.lastActiveDay >= todayNum || !chainAlive) return null;
  return {
    state: { ...state, lastActiveDay: todayNum },
    streakChanged: false,
    longestChanged: false,
  };
}

/** 新しい方の状態を選ぶ（同じ画面で何度も書くときに、古い読み込み結果で上書きしないため） */
export function newerState(a: RankingState | null, b: RankingState | null): RankingState | null {
  if (!a) return b;
  if (!b) return a;
  if (a.lastStudyDay !== b.lastStudyDay) return a.lastStudyDay > b.lastStudyDay ? a : b;
  return a.lastActiveDay >= b.lastActiveDay ? a : b;
}

/** ニックネームを正規化する。空なら null（名無しさん） */
export function normalizeNickname(input: string): string | null {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** 文字数（絵文字などを1文字として数える） */
export function nicknameLength(input: string): number {
  return Array.from(input.trim()).length;
}

export function displayName(nickname: string | null | undefined): string {
  return nickname && nickname.length > 0 ? nickname : ANONYMOUS_NAME;
}

/** 記録の多い順に並んだ値へ順位を付ける。同じ値は同順位（1, 2, 2, 4） */
export function assignRanks(values: number[], firstRank = 1): number[] {
  const ranks: number[] = [];
  values.forEach((value, i) => {
    if (i > 0 && value === values[i - 1]) ranks.push(ranks[i - 1]);
    else ranks.push(firstRank + i);
  });
  return ranks;
}

export type RankChange =
  | { kind: 'none' }
  | { kind: 'new' }
  | { kind: 'up'; by: number }
  | { kind: 'down'; by: number }
  | { kind: 'same' };

/** 1週間前との比較。snapshot が無ければ「—」（kind: none） */
export function rankChange(
  current: number,
  snapshot: Record<string, number> | null,
  uid: string,
): RankChange {
  if (!snapshot) return { kind: 'none' };
  const before = snapshot[uid];
  if (typeof before !== 'number') return { kind: 'new' };
  if (before > current) return { kind: 'up', by: before - current };
  if (before < current) return { kind: 'down', by: current - before };
  return { kind: 'same' };
}

export function formatRankChange(change: RankChange): string {
  switch (change.kind) {
    case 'none':
      return '—';
    case 'new':
      return 'NEW';
    case 'up':
      return `↑${change.by}`;
    case 'down':
      return `↓${change.by}`;
    case 'same':
      return '→';
  }
}
