import { useEffect, useState } from 'react';
import { MainLayout } from '../components/MainLayout';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { TrialSignupLinks } from '../components/TrialSignupLinks';
import { WordCard } from '../components/WordCard';
import { loadTrialData, TRIAL_CHAPTER_LABEL } from '../lib/trialData';
import type { WordQuestion } from '../types/word';

const BOOKMARK_MESSAGE = 'アカウントを作ると、この単語が最適な間隔で復習に出てきます。';
const RELOAD_MESSAGE = 'アカウントを作ると、AIが新しい例文を作ってくれます。';

export default function TrialWordPage() {
  const [words, setWords] = useState<WordQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  useEffect(() => {
    loadTrialData()
      .then((data) => setWords(data.words))
      .catch(() => setFailed(true));
  }, []);

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <MainLayout title={`単語：${TRIAL_CHAPTER_LABEL}`} showBack backTo="/trial">
      {failed ? (
        <p className="px-6 pt-16 text-center text-gray-600 dark:text-gray-300">
          問題を読み込めませんでした。通信環境を確認して、もう一度開いてください。
        </p>
      ) : !words ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : (
        <div>
          {words.map((word, idx) => (
            <WordCard
              key={word.id}
              word={word}
              number={idx + 1}
              isRevealed={revealed.has(word.id)}
              isBookmarked={false}
              isReloading={false}
              onToggleReveal={() => toggleReveal(word.id)}
              onToggleBookmark={() => setPromptMessage(BOOKMARK_MESSAGE)}
              onReload={() => setPromptMessage(RELOAD_MESSAGE)}
            />
          ))}
          <section className="px-4 py-6">
            <p className="mb-3 text-center text-sm font-bold text-gray-800 dark:text-gray-100">
              続きを解くにはアカウントを作成してください
            </p>
            <TrialSignupLinks />
          </section>
        </div>
      )}

      {promptMessage && (
        <SignupPromptModal message={promptMessage} onClose={() => setPromptMessage(null)} />
      )}
    </MainLayout>
  );
}
