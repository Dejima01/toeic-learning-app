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

/** 1回の「今日の復習」で出す上限。溢れた分は翌日以降にまわす */
export const DAILY_REVIEW_LIMIT = 20;

export type Grade = 'known' | 'unknown';

export interface ReviewItem {
  id: string;
  /** 1〜5 */
  box: number;
  /** 次に出題する日時 */
  dueAt: Date;
  correctCount: number;
  wrongCount: number;
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
  };
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
  limit: number = DAILY_REVIEW_LIMIT,
): ReviewItem[] {
  return items
    .filter((item) => isDue(item, now))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, limit);
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
