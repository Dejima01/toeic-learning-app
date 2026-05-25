export interface ExampleSentence {
  sentence: string;
  translation: string;
}

export interface Derivative {
  part: string;
  word: string;
  meaning: string;
}

export interface WordQuestion {
  id: string;
  word: string;
  meaning: string;
  part_of_speech: string;
  level: number;
  chapter_num: number;
  example_sentences: ExampleSentence[];
  derivatives: Derivative[];
}

/** part_of_speech の英語キー → 日本語 */
export function translatePos(pos: string): string {
  const map: Record<string, string> = {
    verb: '動詞',
    noun: '名詞',
    adj: '形容詞',
    adv: '副詞',
    prep: '前置詞',
    conj: '接続詞',
    'noun/verb': '名詞/動詞',
  };
  return map[pos.toLowerCase()] ?? pos;
}

/** derivative の part キー → 日本語 */
export function translateDerivPart(part: string): string {
  const map: Record<string, string> = {
    noun: '名詞',
    adj: '形容詞',
    adv: '副詞',
    verb: '動詞',
  };
  return map[part.toLowerCase()] ?? part;
}
