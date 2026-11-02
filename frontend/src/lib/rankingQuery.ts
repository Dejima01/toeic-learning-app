import {
  collection,
  doc,
  endBefore,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  where,
} from 'firebase/firestore';
import type { DocumentSnapshot, QueryConstraint } from 'firebase/firestore';
import { db } from '../firebase';
import { toDateKey } from './studyLog';
import type { RankChange } from './ranking';
import { assignRanks, dayNumber, displayName, rankChange } from './ranking';

export type RankingKind = 'streak' | 'longest';

export interface RankingRow {
  uid: string;
  name: string;
  value: number;
  rank: number;
  isMe: boolean;
  /** 連続記録のみ。1週間前との比較 */
  change?: RankChange;
}

export interface RankingView {
  top: RankingRow[];
  /** 自分と前後2人。自分が上位10件に入っている・対象外のときは空 */
  around: RankingRow[];
  /** 上位10件と周辺がつながっている（間に「…」を出さない） */
  contiguous: boolean;
  /** 自分の状態 */
  me: 'listed' | 'hidden' | 'outside';
}

const TOP_COUNT = 10;
const NEIGHBOR_COUNT = 2;

function fieldOf(kind: RankingKind) {
  return kind === 'streak'
    ? { value: 'streak', reachedAt: 'streakReachedAt' }
    : { value: 'longest', reachedAt: 'longestReachedAt' };
}

/** 一覧の対象者の条件（記録の下限は呼び出し側で指定） */
function filters(kind: RankingKind, today: Date, minExclusive: number): QueryConstraint[] {
  const { value } = fieldOf(kind);
  const base: QueryConstraint[] = [where('hidden', '==', false), where(value, '>', minExclusive)];
  if (kind === 'streak') {
    // 昨日・今日に活動していない人は連続が切れている（「明日」は時差のある端末向け）
    const t = dayNumber(today);
    base.push(where('lastActiveDay', 'in', [t - 1, t, t + 1]));
  }
  return base;
}

function ordering(kind: RankingKind): QueryConstraint[] {
  const { value, reachedAt } = fieldOf(kind);
  return [orderBy(value, 'desc'), orderBy(reachedAt, 'asc')];
}

function isEligible(kind: RankingKind, data: Record<string, unknown> | undefined, today: Date): boolean {
  if (!data || data.hidden === true) return false;
  const value = data[fieldOf(kind).value];
  if (typeof value !== 'number' || value <= 0) return false;
  if (kind === 'longest') return true;
  const t = dayNumber(today);
  return typeof data.lastActiveDay === 'number' && data.lastActiveDay >= t - 1 && data.lastActiveDay <= t + 1;
}

async function rankOfValue(kind: RankingKind, value: number, today: Date): Promise<number> {
  const col = collection(db, 'leaderboard');
  const snap = await getCountFromServer(query(col, ...filters(kind, today, value)));
  return snap.data().count + 1;
}

async function loadSnapshot(today: Date): Promise<Record<string, number> | null> {
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const snap = await getDoc(doc(db, 'leaderboard_snapshots', toDateKey(weekAgo)));
  const ranks = snap.data()?.ranks;
  return ranks && typeof ranks === 'object' ? (ranks as Record<string, number>) : null;
}

function toRow(kind: RankingKind, snap: DocumentSnapshot, rank: number, myUid: string): RankingRow {
  const data = snap.data() ?? {};
  return {
    uid: snap.id,
    name: displayName(data.nickname as string | null | undefined),
    value: data[fieldOf(kind).value] as number,
    rank,
    isMe: snap.id === myUid,
  };
}

export async function fetchRanking(
  kind: RankingKind,
  myUid: string,
  today: Date = new Date(),
): Promise<RankingView> {
  const col = collection(db, 'leaderboard');
  const minimum = filters(kind, today, 0);

  const [topSnap, meSnap, snapshot] = await Promise.all([
    getDocs(query(col, ...minimum, ...ordering(kind), limit(TOP_COUNT))),
    getDoc(doc(db, 'leaderboard', myUid)),
    kind === 'streak' ? loadSnapshot(today) : Promise.resolve(null),
  ]);

  const topRanks = assignRanks(topSnap.docs.map((d) => d.data()[fieldOf(kind).value] as number));
  const top = topSnap.docs.map((d, i) => toRow(kind, d, topRanks[i], myUid));

  const meData = meSnap.data();
  const withChange = (rows: RankingRow[]) =>
    kind === 'streak' ? rows.map((r) => ({ ...r, change: rankChange(r.rank, snapshot, r.uid) })) : rows;

  if (meData?.hidden === true) {
    return { top: withChange(top), around: [], contiguous: false, me: 'hidden' };
  }
  if (top.some((r) => r.isMe)) {
    return { top: withChange(top), around: [], contiguous: false, me: 'listed' };
  }
  if (!isEligible(kind, meData, today)) {
    return { top: withChange(top), around: [], contiguous: false, me: 'outside' };
  }

  const myValue = meData![fieldOf(kind).value] as number;
  const [myRank, aboveSnap, belowSnap] = await Promise.all([
    rankOfValue(kind, myValue, today),
    getDocs(query(col, ...minimum, ...ordering(kind), endBefore(meSnap), limitToLast(NEIGHBOR_COUNT))),
    getDocs(query(col, ...minimum, ...ordering(kind), startAfter(meSnap), limit(NEIGHBOR_COUNT))),
  ]);

  // 前後の人の順位。自分と同じ記録なら同順位、違えば記録ごとに count を1回
  const rankByValue = new Map<number, number>([[myValue, myRank]]);
  const neighbors = [...aboveSnap.docs, ...belowSnap.docs];
  const values = [...new Set(neighbors.map((d) => d.data()[fieldOf(kind).value] as number))];
  await Promise.all(
    values
      .filter((v) => !rankByValue.has(v))
      .map(async (v) => rankByValue.set(v, await rankOfValue(kind, v, today))),
  );

  const topIds = new Set(top.map((r) => r.uid));
  const rowOf = (d: DocumentSnapshot) =>
    toRow(kind, d, rankByValue.get(d.data()![fieldOf(kind).value] as number)!, myUid);
  const around = [...aboveSnap.docs, meSnap, ...belowSnap.docs]
    .filter((d) => !topIds.has(d.id))
    .map(rowOf);

  return {
    top: withChange(top),
    around: withChange(around),
    contiguous: aboveSnap.docs.some((d) => topIds.has(d.id)),
    me: 'listed',
  };
}
