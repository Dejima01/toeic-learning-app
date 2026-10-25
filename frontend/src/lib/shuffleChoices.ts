import type { GrammarQuestion } from '../types/grammar';

/** 文字列から 32bit の種を作る */
function seedFrom(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** 種から決まる擬似乱数（mulberry32） */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 選択肢を並べ替えた問題を返す。
 *
 * 復習で同じ問題を周回するとき、並びが同じだと「さっきBで間違えたから
 * B以外」と消去法で当てられてしまい、2周目が練習にならない。
 *
 * 並びは seed から決まるので、再描画しても変わらない。周が変われば
 * seed も変わるので並びも変わる。
 */
export function shuffleChoices(question: GrammarQuestion, seed: string): GrammarQuestion {
  const random = mulberry32(seedFrom(seed));
  const order = question.choices.map((_, i) => i);

  // Fisher-Yates
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    ...question,
    choices: order.map((i) => question.choices[i]),
    correct_index: order.indexOf(question.correct_index),
  };
}
