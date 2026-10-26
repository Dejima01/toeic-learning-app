import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { toDateKey } from './studyLog';

/**
 * 学習の日別記録を書き込む。
 *
 * 日付をドキュメントIDにしているので、同じ日に何度呼んでも1件にまとまる。
 * 採点数は increment で足すため、読み込んでから書く必要がない（競合しない）。
 */

/** アプリを開いたこと、およびその日の出題有無・完了状態を記録する */
export async function recordDayState(
  uid: string,
  state: { hadDue: boolean; completed: boolean },
  now: Date = new Date(),
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid, 'study_days', toDateKey(now)),
      {
        date: toDateKey(now),
        opened: true,
        // 一度でも出題があった日は true のままにする（消化後に false へ戻さない）
        ...(state.hadDue ? { had_due: true } : {}),
        completed: state.completed,
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // 記録は学習の本筋ではないので、失敗しても黙って諦める
  }
}

/** 1問採点したことを記録する */
export async function recordReviewed(
  uid: string,
  mode: 'word' | 'grammar',
  now: Date = new Date(),
): Promise<void> {
  try {
    await setDoc(
      doc(db, 'users', uid, 'study_days', toDateKey(now)),
      {
        date: toDateKey(now),
        opened: true,
        had_due: true,
        [mode === 'word' ? 'word_reviewed' : 'grammar_reviewed']: increment(1),
        updated_at: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // 同上
  }
}
