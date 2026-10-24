/** 単語モードのレベルごとの章数 */
export const WORD_CHAPTERS_PER_LEVEL: Record<number, number> = {
  600: 10,
  750: 6,
  900: 4,
};

/** 指定レベルに次の章があるか */
export function hasNextWordChapter(level: number, chapter: number): boolean {
  return chapter < (WORD_CHAPTERS_PER_LEVEL[level] ?? 0);
}
