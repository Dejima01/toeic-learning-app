/** 「前回の続き」の対象モード */
export type ResumeMode = 'word' | 'grammar';

/**
 * 「前回の続き」位置。
 * 単語は users/{uid}.last_word_position、文法は last_grammar_position に保存する。
 *
 * 保存時に遷移先まで解決しておく（ホーム画面は問題データを持たないため、
 * 「章の最後だったか」をホーム側では判定できない）。
 *   - chapter === null … その章が最後だった → 章一覧へ
 *   - item_id === null … 次の章の先頭から（ハイライトなし）
 *   - どちらもある   … その項目までスクロールしてハイライト
 */
export interface ResumePosition {
  level: number;
  chapter: number | null;
  item_id: string | null;
}

/** Firestore から読んだ値を ResumePosition として検証する（壊れた値は null） */
export function parseResumePosition(value: unknown): ResumePosition | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.level !== 'number') return null;
  const chapter = typeof v.chapter === 'number' ? v.chapter : null;
  // word_id は単語版の初期実装で使っていた旧キー
  const rawId = v.item_id ?? v.word_id;
  const itemId = typeof rawId === 'string' ? rawId : null;
  return { level: v.level, chapter, item_id: itemId };
}

/** 「前回の続き」ボタンの遷移先 */
export function resumePath(pos: ResumePosition, mode: ResumeMode): string {
  const base = mode === 'word' ? '/word' : '/grammar';
  if (pos.chapter === null) return `${base}?level=${pos.level}`;
  if (pos.item_id === null) return `${base}/${pos.level}/${pos.chapter}`;
  return `${base}/${pos.level}/${pos.chapter}?focus=${encodeURIComponent(pos.item_id)}`;
}
