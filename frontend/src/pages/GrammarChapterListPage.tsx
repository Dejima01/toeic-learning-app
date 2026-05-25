import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const LEVELS = [600, 750, 900] as const;
type Level = (typeof LEVELS)[number];

export default function GrammarChapterListPage() {
  const navigate = useNavigate();
  const [level, setLevel] = useState<Level>(750);
  const [chapters, setChapters] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDocs(query(collection(db, 'grammar_questions'), where('level', '==', level)))
      .then((snap) => {
        const nums = [...new Set(snap.docs.map((d) => d.data().chapter_num as number))].sort(
          (a, b) => a - b,
        );
        setChapters(nums);
      })
      .finally(() => setLoading(false));
  }, [level]);

  function prevLevel() {
    const idx = LEVELS.indexOf(level);
    setLevel(LEVELS[(idx - 1 + LEVELS.length) % LEVELS.length]);
  }
  function nextLevel() {
    const idx = LEVELS.indexOf(level);
    setLevel(LEVELS[(idx + 1) % LEVELS.length]);
  }

  return (
    <div className="mx-auto flex h-screen max-w-sm flex-col bg-white">
      {/* ヘッダー：戻るボタン */}
      <div className="px-4 pt-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-400 text-gray-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* レベル切り替えバー */}
      <div className="flex items-center justify-center border-b border-gray-200 px-4 py-3">
        <button
          type="button"
          onClick={prevLevel}
          className="px-2 text-xl font-bold text-gray-600 hover:text-gray-900"
        >
          ◀
        </button>
        <span className="mx-4 min-w-[160px] text-center text-xl font-bold">
          文法：{level}点台
        </span>
        <button
          type="button"
          onClick={nextLevel}
          className="px-2 text-xl font-bold text-gray-600 hover:text-gray-900"
        >
          ▶
        </button>
      </div>

      {/* チャプターリスト */}
      <main className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex justify-center pt-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
          </div>
        ) : chapters.length === 0 ? (
          <p className="pt-12 text-center text-gray-400">データがありません</p>
        ) : (
          <div className="flex flex-col gap-4">
            {chapters.map((ch) => (
              <Link
                key={ch}
                to={`/grammar/${level}/${ch}`}
                className="block rounded bg-sky-200 py-4 text-center text-lg font-bold text-gray-800 hover:bg-sky-300 transition-colors"
              >
                第{ch}章
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
