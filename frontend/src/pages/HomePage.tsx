import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { MainLayout } from '../components/MainLayout';
import { useAuth } from '../contexts/AuthContext';

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

  // Firestoreからバッジ情報をリアルタイム取得
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'users', user.uid);
    return onSnapshot(ref, (snap) => {
      setBadge((snap.data()?.badge as Badge) ?? null);
    });
  }, [user]);

  async function handleLogout() {
    await signOut(auth);
    navigate('/', { replace: true });
  }

  return (
    // ホーム画面はヘッダーなし（ランク表示・設定ボタンがコンテンツ内に入る）
    <MainLayout>
      <div className="flex h-full flex-col px-5 pt-5 pb-3">

        {/* ── 右上: 設定ボタン ── */}
        <div className="flex justify-end">
          <Link
            to="/settings"
            className="rounded-lg bg-sky-200 px-5 py-2 text-sm font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            設定
          </Link>
        </div>

        {/* ── ランクバッジサークル（中央） ── */}
        <div className="flex justify-center pt-10 pb-6">
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-sky-200 text-center">
            {badge ? (
              <img
                src={`/badges/${badge}.png`}
                alt={BADGE_LABEL[badge]}
                className="h-[106px] w-[106px] object-contain"
              />
            ) : (
              <span className="text-sm font-medium leading-snug text-gray-700">
                ランク
                <br />
                表示
              </span>
            )}
          </div>
        </div>

        {/* ── 中央: モードボタン ── */}
        <div className="flex flex-1 flex-col items-stretch justify-center gap-5">
          <Link
            to="/word"
            className="block rounded bg-sky-200 py-5 text-center text-xl font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            単語モード
          </Link>
          <Link
            to="/grammar"
            className="block rounded bg-sky-200 py-5 text-center text-xl font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            文法モード
          </Link>
        </div>

        {/* ── 下部: ランク認定テスト・復習問題一覧 ── */}
        <div className="flex gap-3">
          <Link
            to="/rank-test"
            className="flex-1 rounded bg-sky-200 py-3 text-center text-sm font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            ランク認定テスト
          </Link>
          <Link
            to="/review"
            className="flex-1 rounded bg-sky-200 py-3 text-center text-sm font-bold text-gray-800 hover:bg-sky-300 transition-colors"
          >
            復習問題一覧
          </Link>
        </div>

        {/* 開発用ログアウトボタン（フェーズ3確認用） */}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 text-xs text-gray-400 underline self-center"
        >
          ログアウト
        </button>
      </div>
    </MainLayout>
  );
}
