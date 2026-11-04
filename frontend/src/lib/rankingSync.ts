import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import type { StudyDay } from './studyLog';
import type { RankingState } from './ranking';
import { dayNumber, initialRankingState, newerState, nextRankingState } from './ranking';

/**
 * ランキング用データ（leaderboard/{uid}）と本人用の写し（users/{uid}.ranking_state）を
 * 同じ writeBatch で書く。片方だけ更新されることはない。
 */

// 直前に書いた状態。同じ画面で何度も呼ばれたとき、古い読み込み結果で計算しないため
const lastWritten = new Map<string, RankingState>();
// 書き込みを1本ずつ順番に流す（登録と更新が同時に走らないように）
const queues = new Map<string, Promise<void>>();

function enqueue(uid: string, task: () => Promise<void>): Promise<void> {
  const prev = queues.get(uid) ?? Promise.resolve();
  const next = prev.then(task, task);
  queues.set(uid, next.catch(() => {}));
  return next;
}

export interface RankingProfile {
  nickname: string | null;
  hidden: boolean;
}

/** 初回登録。カレンダーの記録から今の状態を計算して作る */
export function registerRanking(
  uid: string,
  days: Map<string, StudyDay>,
  profile: RankingProfile,
  now: Date = new Date(),
): Promise<void> {
  return enqueue(uid, async () => {
    if (lastWritten.has(uid)) return;
    const state = initialRankingState(days, now);
    const batch = writeBatch(db);
    batch.set(doc(db, 'leaderboard', uid), {
      nickname: profile.nickname,
      hidden: profile.hidden,
      ...state,
      streakReachedAt: serverTimestamp(),
      longestReachedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), { ranking_state: state }, { merge: true });
    await batch.commit();
    lastWritten.set(uid, state);
  }).catch((err) => console.warn('ranking register failed:', err));
}

/** 学習した日・休みの日を反映する。変化がなければ何も書かない */
export function recordRankingEvent(
  uid: string,
  stored: RankingState | null,
  event: 'study' | 'rest',
  now: Date = new Date(),
): Promise<void> {
  return enqueue(uid, async () => {
    const current = newerState(stored, lastWritten.get(uid) ?? null);
    // 未登録の人はホームを開いたときに登録されるので、ここでは何もしない
    if (!current) return;
    const transition = nextRankingState(current, event, dayNumber(now));
    if (!transition) return;

    const { state, streakChanged, longestChanged } = transition;
    const batch = writeBatch(db);
    batch.update(doc(db, 'leaderboard', uid), {
      ...state,
      ...(streakChanged ? { streakReachedAt: serverTimestamp() } : {}),
      ...(longestChanged ? { longestReachedAt: serverTimestamp() } : {}),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'users', uid), { ranking_state: state }, { merge: true });
    await batch.commit();
    lastWritten.set(uid, state);
  }).catch((err) => console.warn('ranking update failed:', err));
}

/**
 * ニックネーム・非表示の変更。未登録なら users 側だけ保存し、登録時に引き継ぐ。
 * 失敗は呼び出し側で表示するので、例外をそのまま投げる。
 */
export function updateRankingProfile(
  uid: string,
  changes: Partial<RankingProfile>,
  registered: boolean,
): Promise<void> {
  return enqueue(uid, async () => {
    const batch = writeBatch(db);
    batch.set(
      doc(db, 'users', uid),
      {
        ...('nickname' in changes ? { nickname: changes.nickname } : {}),
        ...('hidden' in changes ? { ranking_hidden: changes.hidden } : {}),
      },
      { merge: true },
    );
    if (registered) {
      batch.update(doc(db, 'leaderboard', uid), { ...changes, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  });
}
