/**
 * 「前回の続き」位置。users/{uid}.last_word_position に保存する。
 *
 * 保存時に遷移先まで解決しておく（ホーム画面は単語データを持たないため、
 * 「章の最後の単語だったか」をホーム側では判定できない）。
 *   - chapter === null … その章が最後だった → 章一覧へ
 *   - word_id === null … 次の章の先頭から（ハイライトなし）
 *   - どちらもある   … その単語までスクロールしてハイライト
 */
export interface ResumePosition {
  level: number;
  chapter: number | null;
  word_id: string | null;
}

/** Firestore から読んだ値を ResumePosition として検証する（壊れた値は null） */
export function parseResumePosition(value: unknown): ResumePosition | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.level !== 'number') return null;
  const chapter = typeof v.chapter === 'number' ? v.chapter : null;
  const wordId = typeof v.word_id === 'string' ? v.word_id : null;
  return { level: v.level, chapter, word_id: wordId };
}

/** 「前回の続き」ボタンの遷移先 */
export function resumePath(pos: ResumePosition): string {
  if (pos.chapter === null) return `/word?level=${pos.level}`;
  if (pos.word_id === null) return `/word/${pos.level}/${pos.chapter}`;
  return `/word/${pos.level}/${pos.chapter}?focus=${encodeURIComponent(pos.word_id)}`;
}
