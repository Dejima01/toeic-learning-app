/**
 * 間隔反復（SRS）のロジック。
 *
 * 5箱の Leitner 方式。正解したら1つ上の箱へ、間違えたら箱1に戻す。
 * 箱5で正解したら「卒業」とし、復習マーク自体を外す（一覧から消える）。
 *
 * SM-2 ではなく Leitner を採るのは、このアプリが取れる信号が
 * 「覚えていた / 覚えていなかった」の2値しかなく、SM-2 の ease factor に
 * 意味のある入力を与えられないため。
 *
 * このファイルは Firebase に依存しない純粋関数だけで構成する（テスト可能にするため）。
 */

/** 箱N に入ったときの次回までの日数（箱1 = 翌日） */
export const BOX_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;

/** 卒業までの箱の数 */
export const MAX_BOX = BOX_INTERVALS_DAYS.length;

/** 1日に出す問題数の既定値。設定で変更できる */
export const DEFAULT_DAILY_REVIEW_LIMIT = 20;

/** 設定で選べる1日の問題数 */
export const DAILY_REVIEW_LIMIT_OPTIONS = [10, 20, 30, 40] as const;

/** 設定値として妥当な数に丸める（未設定・壊れた値は既定値） */
export function normalizeDailyLimit(value: unknown): number {
  return typeof value === 'number' &&
    (DAILY_REVIEW_LIMIT_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_DAILY_REVIEW_LIMIT;
}

export type Grade = 'known' | 'unknown';

export interface ReviewItem {
  id: string;
  /** 1〜5 */
  box: number;
  /** 次に出題する日時 */
  dueAt: Date;
  correctCount: number;
  wrongCount: number;
  /** 最後に採点した日時（未採点は null） */
  lastReviewedAt: Date | null;
}

export interface GradeResult {
  /** 更新後の項目。卒業した場合は null（＝復習マークを外す） */
  item: ReviewItem | null;
  graduated: boolean;
}

interface TimestampLike {
  toDate: () => Date;
}

function toDate(value: unknown): Date | null {
  if (value && typeof (value as TimestampLike).toDate === 'function') {
    return (value as TimestampLike).toDate();
  }
  if (value instanceof Date) return value;
  return null;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 箱に入った日を基準に次回の期限を出す（その日の 0:00 に揃える） */
export function dueDateForBox(box: number, from: Date): Date {
  const days = BOX_INTERVALS_DAYS[Math.min(Math.max(box, 1), MAX_BOX) - 1];
  return startOfDay(addDays(from, days));
}

/**
 * Firestore のブックマークドキュメントを ReviewItem に正規化する。
 *
 * SRS 導入前に付けられたマーク（added_at しか無い）は「箱1・期限は今日」とみなす。
 * これにより移行スクリプトなしで既存データがそのまま SRS に合流する。
 */
export function normalizeReviewItem(id: string, data: Record<string, unknown> | undefined): ReviewItem {
  const box = typeof data?.box === 'number' && data.box >= 1 && data.box <= MAX_BOX ? data.box : 1;
  // due_at が無い旧データは、付けた日（added_at）を期限とみなして古い順に並ぶようにする
  const dueAt = toDate(data?.due_at) ?? toDate(data?.added_at) ?? new Date(0);
  return {
    id,
    box,
    dueAt,
    correctCount: toCount(data?.correct_count),
    wrongCount: toCount(data?.wrong_count),
    lastReviewedAt: toDate(data?.last_reviewed_at),
  };
}

/** 同じ日か（端末のタイムゾーン基準） */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * その日に採点した項目（＝練習モードで流し直す対象）。
 * 採点した順に並べる。卒業した単語はドキュメントごと消えるので含まれない。
 */
export function selectReviewedOn(items: ReviewItem[], date: Date): ReviewItem[] {
  return items
    .filter((item) => item.lastReviewedAt !== null && isSameDay(item.lastReviewedAt, date))
    .sort((a, b) => (a.lastReviewedAt?.getTime() ?? 0) - (b.lastReviewedAt?.getTime() ?? 0));
}

/** 次の深夜0時（日付またぎで表示を更新するため） */
export function nextMidnight(from: Date): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() + 1);
  return d;
}

/** その項目が今日出題の対象か */
export function isDue(item: ReviewItem, now: Date): boolean {
  return item.dueAt.getTime() <= endOfDay(now).getTime();
}

/**
 * 「今日の復習」に出す項目を選ぶ。
 * 期限が古いものから順に、上限まで。サボって溜まっていても1日分しか出さない。
 */
export function selectDueQueue(
  items: ReviewItem[],
  now: Date,
  limit: number = DEFAULT_DAILY_REVIEW_LIMIT,
): ReviewItem[] {
  return items
    .filter((item) => isDue(item, now))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
}

export interface TodayPlan {
  /** 今から出せる分 */
  queue: ReviewItem[];
  /** 今日が期限（やり残しを含む）の総数 */
  dueTotal: number;
  /** 1日の上限を超えて明日以降にまわる数 */
  remaining: number;
  /** 今日すでに採点した数 */
  reviewedToday: number;
}

/**
 * その日に出す分を決める。
 *
 * 上限は「1回に出す数」ではなく「1日に出す数」。すでに今日採点した分を
 * 差し引くので、上限に達したらその日はもう出てこない。溢れた分は期限が
 * 来たまま残り、翌日以降に古い順から消化される。
 *
 * 注意: 箱5を卒業した単語はドキュメントごと消えるため reviewedToday に
 * 含まれない。その分だけ上限を数問超えることがあるが実害はない。
 */
export function planToday(
  items: ReviewItem[],
  now: Date,
  dailyLimit: number = DEFAULT_DAILY_REVIEW_LIMIT,
): TodayPlan {
  const reviewedToday = items.filter(
    (item) => item.lastReviewedAt !== null && isSameDay(item.lastReviewedAt, now),
  ).length;

  const allowance = Math.max(0, dailyLimit - reviewedToday);
  const due = items
    .filter((item) => isDue(item, now))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const queue = due.slice(0, allowance);

  return {
    queue,
    dueTotal: due.length,
    remaining: due.length - queue.length,
    reviewedToday,
  };
}

/** 採点して次の状態を出す */
export function gradeItem(item: ReviewItem, grade: Grade, now: Date): GradeResult {
  if (grade === 'unknown') {
    return {
      item: {
        ...item,
        box: 1,
        dueAt: dueDateForBox(1, now),
        wrongCount: item.wrongCount + 1,
      },
      graduated: false,
    };
  }

  // 箱5で正解 → 卒業（復習マークを外す）
  if (item.box >= MAX_BOX) {
    return { item: null, graduated: true };
  }

  const nextBox = item.box + 1;
  return {
    item: {
      ...item,
      box: nextBox,
      dueAt: dueDateForBox(nextBox, now),
      correctCount: item.correctCount + 1,
    },
    graduated: false,
  };
}
