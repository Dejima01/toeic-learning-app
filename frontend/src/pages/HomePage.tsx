import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MainLayout } from '../components/MainLayout';
import { useAuth } from '../contexts/AuthContext';
import { parseResumePosition, resumePath } from '../lib/resumePosition';
import type { ResumePosition } from '../lib/resumePosition';
import { normalizeReviewItem, selectDueQueue } from '../lib/srs';

type Badge = 'bronze' | 'silver' | 'gold' | null;

const BADGE_LABEL: Record<string, string> = {
  bronze: 'ブロンズ',
  silver: 'シルバー',
  gold: 'ゴールド',
};

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [badge, setBadge] = useState<Badge>(null);
  const [wordResume, setWordResume] = useState<ResumePosition | null>(null);
  const [grammarResume, setGrammarResume] = useState<ResumePosition | null>(null);
  const [dueCount, setDueCount] = useState(0);

  // Firestoreからバッジ・前回の続き位置をリアルタイム取得（同じドキュメントなので購読は1本）
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      const data = snap.data();
      setBadge((data?.badge as Badge) ?? null);
      setWordResume(parseResumePosition(data?.last_word_position));
      setGrammarResume(parseResumePosition(data?.last_grammar_position));
    });
  }, [user]);

  // 今日の復習に出る件数（復習マークは数十〜数百件程度なので全件読んで数える）
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, 'users', user.uid, 'word_bookmarks'), (snap) => {
      const items = snap.docs.map((d) => normalizeReviewItem(d.id, d.data()));
      setDueCount(selectDueQueue(items, new Date()).length);
    });
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/', { replace: true });
  }

  return (
    // ホーム画面はヘッダーなし（ランク表示・設定ボタンがコンテンツ内に入る）
    <MainLayout>
      <div className="flex h-full flex-col overflow-y-auto px-5 pt-4 pb-2">

        {/* ── 右上: 設定ボタン ── */}
        <div className="flex justify-end">
          <Link
            to="/settings"
            className="rounded-lg bg-sky-200 dark:bg-sky-800 px-5 py-2 text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            設定
          </Link>
        </div>

        {/* ── ランクバッジサークル（中央） ── */}
        <div className="flex justify-center pt-4 pb-3">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full text-center">
            {badge ? (
              <img
                src={`/badges/${badge}.png`}
                alt={BADGE_LABEL[badge]}
                className="h-24 w-24 object-contain"
              />
            ) : (
              <img
                src="/badges/rookie.png"
                alt="ルーキー"
                className="h-24 w-24 object-contain"
              />
            )}
          </div>
        </div>

        {/* ── 今日の復習（このアプリで毎日最初に押すボタンなので最上段・大きめ） ── */}
        {dueCount > 0 && (
          <Link
            to="/review/today"
            className="mb-4 block rounded-lg bg-sky-500 py-4 text-center text-xl font-bold text-white shadow hover:bg-sky-600 transition-colors"
          >
            今日の復習{'　'}{dueCount}問
          </Link>
        )}

        {/* ── 中央: モードボタン ── */}
        <div className="flex flex-1 flex-col items-stretch justify-center gap-4">
          {/* 前回の続き（記録があるものだけ出す。2つ並んでも縦1行に収める） */}
          {(wordResume || grammarResume) && (
            <div className="flex gap-3">
              {wordResume && (
                <Link
                  to={resumePath(wordResume, 'word')}
                  className="flex-1 rounded border-2 border-sky-400 dark:border-sky-500 py-3 text-center text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/40 transition-colors"
                >
                  単語：前回の続き
                </Link>
              )}
              {grammarResume && (
                <Link
                  to={resumePath(grammarResume, 'grammar')}
                  className="flex-1 rounded border-2 border-sky-400 dark:border-sky-500 py-3 text-center text-sm font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/40 transition-colors"
                >
                  文法：前回の続き
                </Link>
              )}
            </div>
          )}

          <Link
            to="/word"
            className="block rounded bg-sky-200 dark:bg-sky-800 py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            単語モード
          </Link>
          <Link
            to="/grammar"
            className="block rounded bg-sky-200 dark:bg-sky-800 py-4 text-center text-xl font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            文法モード
          </Link>
        </div>

        {/* ── 下部: ランク認定テスト・復習問題一覧 ── */}
        <div className="flex gap-3">
          <Link
            to="/rank-test"
            className="flex-1 rounded bg-sky-200 dark:bg-sky-800 py-3 text-center text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            ランク認定テスト
          </Link>
          <Link
            to="/review"
            className="flex-1 rounded bg-sky-200 dark:bg-sky-800 py-3 text-center text-sm font-bold text-gray-800 dark:text-gray-100 hover:bg-sky-300 dark:hover:bg-sky-700 transition-colors"
          >
            復習問題一覧
          </Link>
        </div>

        {/* 開発用ログアウトボタン（フェーズ3確認用） */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 text-xs text-gray-400 dark:text-gray-500 underline self-center"
        >
          ログアウト
        </button>
      </div>
    </MainLayout>
  );
}
