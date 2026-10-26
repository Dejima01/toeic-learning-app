/**
 * 学習の日別記録。users/{uid}/study_days/{YYYY-MM-DD} に1日1件持たせる。
 *
 * 日付をドキュメントIDにしているので、同じ日に何度書いても1件にまとまる。
 * 色とストリークの判定はここに集約し、Firebase に依存しない純粋関数にしてある。
 */

/** 1日の達成度。カレンダーの色に対応する */
export type DayRank = 'gold' | 'silver' | 'bronze' | 'rest' | 'none';

export interface StudyDay {
  /** YYYY-MM-DD（端末のローカル日付） */
  date: string;
  opened: boolean;
  wordReviewed: number;
  grammarReviewed: number;
  /** その日に出題があったか。無ければ「お休み」扱いにする */
  hadDue: boolean;
  /** その日の出題をすべて完了したか */
  completed: boolean;
}

interface TimestampLike {
  toDate: () => Date;
}

function toBool(value: unknown): boolean {
  return value === true;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
}

/** 端末のローカル日付を YYYY-MM-DD にする */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD をその日の 0:00 の Date にする */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function normalizeStudyDay(date: string, data: Record<string, unknown> | undefined): StudyDay {
  return {
    date,
    opened: toBool(data?.opened),
    wordReviewed: toCount(data?.word_reviewed),
    grammarReviewed: toCount(data?.grammar_reviewed),
    hadDue: toBool(data?.had_due),
    completed: toBool(data?.completed),
  };
}

/**
 * その日の達成度を決める。
 *
 *   金   出題があり、すべて完了した
 *   銀   やったが完了に至らなかった（途中でやめた・片方だけやった）
 *   銅   開いたが1問もやらなかった（出題はあった）
 *   休み 出題が0問だった日。サボりではないのでストリークは切らない
 *   なし 開いていない
 */
export function rankOf(day: StudyDay | undefined): DayRank {
  if (!day || !day.opened) return 'none';
  if (!day.hadDue) return 'rest';
  if (day.completed) return 'gold';
  if (day.wordReviewed + day.grammarReviewed > 0) return 'silver';
  return 'bronze';
}

/** ストリークが続く達成度か */
export function keepsStreak(rank: DayRank): boolean {
  return rank === 'gold' || rank === 'silver' || rank === 'rest';
}

/**
 * 今日から遡って連続日数を数える。
 *
 * 今日がまだ「なし」や「銅」でも、昨日までの連続は生きているとみなす。
 * 朝いちばんに開いた時点で 0日 と出ると、積み上げが消えたように見えるため。
 */
export function calcStreak(days: Map<string, StudyDay>, today: Date): number {
  let streak = 0;
  const cursor = new Date(today);

  const todayRank = rankOf(days.get(toDateKey(cursor)));
  if (keepsStreak(todayRank)) {
    streak += 1;
  } else if (todayRank === 'bronze') {
    // 開いたのに何もしていない日は、その時点で途切れている
    return 0;
  }

  // 今日の結果にかかわらず、昨日から遡って数える
  cursor.setDate(cursor.getDate() - 1);
  while (keepsStreak(rankOf(days.get(toDateKey(cursor))))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** 記録全体での最長連続日数 */
export function calcLongestStreak(days: Map<string, StudyDay>): number {
  const keys = [...days.keys()].sort();
  if (keys.length === 0) return 0;

  let longest = 0;
  let run = 0;
  const cursor = fromDateKey(keys[0]);
  const last = fromDateKey(keys[keys.length - 1]);

  while (cursor.getTime() <= last.getTime()) {
    if (keepsStreak(rankOf(days.get(toDateKey(cursor))))) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

/** ストリークの見た目の段階。3日目で最初の変化が来るようにしてある */
export type StreakTier = 'plain' | 'blue' | 'bordered' | 'gold' | 'radiant';

export function streakTier(streak: number): StreakTier {
  if (streak >= 30) return 'radiant';
  if (streak >= 14) return 'gold';
  if (streak >= 7) return 'bordered';
  if (streak >= 3) return 'blue';
  return 'plain';
}

/** カレンダーに出す月のマス（前後の空白を含む） */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];

  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toDateKey(new Date(year, month, d)));
  return cells;
}

/** 記録のうち最も古い日（カレンダーをそれより前に戻さないため） */
export function earliestDate(days: Map<string, StudyDay>, fallback: Date): Date {
  const keys = [...days.keys()].sort();
  return keys.length > 0 ? fromDateKey(keys[0]) : fallback;
}

/** Firestore の Timestamp などから Date を取り出す */
export function toDate(value: unknown): Date | null {
  if (value && typeof (value as TimestampLike).toDate === 'function') {
    return (value as TimestampLike).toDate();
  }
  if (value instanceof Date) return value;
  return null;
}
