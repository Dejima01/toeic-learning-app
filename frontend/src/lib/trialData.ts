import type { WordQuestion } from '../types/word';
import type { GrammarQuestion } from '../types/grammar';

/**
 * お試しモードの見本データ（600点台 第1章）。
 * Firestore はログインした人しか読めないので、公開してよい分だけ静的ファイルで配る。
 * 中身は scripts/export_trial_data.py で作る。
 */
export interface TrialData {
  words: WordQuestion[];
  grammar: GrammarQuestion[];
}

export const TRIAL_CHAPTER_LABEL = '600点台 第1章';

let trialDataPromise: Promise<TrialData> | null = null;

export function loadTrialData(): Promise<TrialData> {
  if (!trialDataPromise) {
    trialDataPromise = fetch('/trial.json')
      .then((res) => {
        if (!res.ok) throw new Error(`trial.json: ${res.status}`);
        return res.json() as Promise<TrialData>;
      })
      .catch((err) => {
        // 失敗はキャッシュせず、次に開いたときに取り直す
        trialDataPromise = null;
        throw err;
      });
  }
  return trialDataPromise;
}
