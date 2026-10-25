import { useCallback, useState } from 'react';
import type { ReviewItem } from './srs';

/**
 * 「今日の復習」の周回を管理する。単語と文法で挙動を揃えるために共有する。
 *
 * 1周をやり切ってから、間違えた分だけで次の周に入る。間違えた問題を
 * その場でキューに挿し込むと分母が 1/5 → 4/7 と増えて不自然になるため。
 *
 * Firestore への記録は呼び出し側の責務（コレクションが単語・文法で違うため）。
 * このフックは「何周目の何問目か」と「次に誰を出すか」だけを持つ。
 */
export type RoundPhase = 'loading' | 'session' | 'roundEnd' | 'finished';

export interface RoundQueue {
  phase: RoundPhase;
  /** 1 始まり */
  round: number;
  /** 現在の周の出題リスト */
  roundItems: ReviewItem[];
  /** 現在の周での位置（0 始まり） */
  index: number;
  /** 現在の問題。無ければ undefined */
  current: ReviewItem | undefined;
  /** 現在の周の最後の問題か */
  isLastInRound: boolean;
  /** この周で「覚えていなかった」もの。次の周の出題内容になる */
  wrongItems: ReviewItem[];
  /** 最初に出した問題数（結果画面の分母） */
  initialCount: number;

  /** 読み込み完了時に呼ぶ。空なら finished に入る */
  start: (items: ReviewItem[]) => void;
  /** 1問終えたときに呼ぶ。周の終わりなら roundEnd か finished に移る */
  advance: (wasWrong: boolean) => void;
  /** 次の周を始める */
  startNextRound: () => void;
}

export function useRoundQueue(): RoundQueue {
  const [phase, setPhase] = useState<RoundPhase>('loading');
  const [round, setRound] = useState(1);
  const [roundItems, setRoundItems] = useState<ReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [wrongItems, setWrongItems] = useState<ReviewItem[]>([]);
  const [initialCount, setInitialCount] = useState(0);

  const start = useCallback((items: ReviewItem[]) => {
    setRoundItems(items);
    setInitialCount(items.length);
    setPhase(items.length === 0 ? 'finished' : 'session');
  }, []);

  const current = roundItems[index];
  const isLastInRound = index + 1 >= roundItems.length;

  const advance = useCallback(
    (wasWrong: boolean) => {
      if (!current) return;
      const nextWrong = wasWrong ? [...wrongItems, current] : wrongItems;
      setWrongItems(nextWrong);

      if (!isLastInRound) {
        setIndex((i) => i + 1);
      } else {
        setPhase(nextWrong.length > 0 ? 'roundEnd' : 'finished');
      }
    },
    [current, wrongItems, isLastInRound],
  );

  const startNextRound = useCallback(() => {
    setRoundItems(wrongItems);
    setWrongItems([]);
    setIndex(0);
    setRound((r) => r + 1);
    setPhase('session');
  }, [wrongItems]);

  return {
    phase,
    round,
    roundItems,
    index,
    current,
    isLastInRound,
    wrongItems,
    initialCount,
    start,
    advance,
    startNextRound,
  };
}
