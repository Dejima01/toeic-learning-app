import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';

const LEVELS = [600, 750, 900] as const;
type Level = (typeof LEVELS)[number];

const ALL_CHAPTERS = Array.from({ length: 10 }, (_, i) => i + 1);

function levelLabel(level: Level) {
  return `単語：${level}点台`;
}

export default function WordChapterListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialLevel = (Number(searchParams.get('level')) || 750) as Level;
  const [level, setLevel] = useState<Level>(initialLevel);

  function prevLevel() {
    const idx = LEVELS.indexOf(level);
    const next = LEVELS[(idx - 1 + LEVELS.length) % LEVELS.length];
    setLevel(next);
    navigate(`/word?level=${next}`, { replace: true });
  }
  function nextLevel() {
    const idx = LEVELS.indexOf(level);
    const next = LEVELS[(idx + 1) % LEVELS.length];
    setLevel(next);
    navigate(`/word?level=${next}`, { replace: true });
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
          {levelLabel(level)}
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
        <div className="flex flex-col gap-4">
          {ALL_CHAPTERS.map((ch) => (
            <Link
              key={ch}
              to={`/word/${level}/${ch}`}
              className="block rounded bg-sky-200 py-4 text-center text-lg font-bold text-gray-800 transition-colors hover:bg-sky-300"
            >
              第{ch}章
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
