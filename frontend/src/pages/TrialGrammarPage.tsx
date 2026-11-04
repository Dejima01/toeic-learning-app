import { useEffect, useState } from 'react';
import { GrammarCard } from '../components/GrammarCard';
import { MainLayout } from '../components/MainLayout';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { TrialSignupLinks } from '../components/TrialSignupLinks';
import { loadTrialData, TRIAL_CHAPTER_LABEL } from '../lib/trialData';
import type { GrammarQuestion } from '../types/grammar';

const BOOKMARK_MESSAGE = 'アカウントを作ると、この問題が最適な間隔で復習に出てきます。';

export default function TrialGrammarPage() {
  const [questions, setQuestions] = useState<GrammarQuestion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    loadTrialData()
      .then((data) => setQuestions(data.grammar))
      .catch(() => setFailed(true));
  }, []);

  return (
    <MainLayout title={`文法：${TRIAL_CHAPTER_LABEL}`} showBack backTo="/trial">
      {failed ? (
        <p className="px-6 pt-16 text-center text-gray-600 dark:text-gray-300">
          問題を読み込めませんでした。通信環境を確認して、もう一度開いてください。
        </p>
      ) : !questions ? (
        <div className="flex justify-center pt-16">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-400" />
        </div>
      ) : (
        <div>
          {questions.map((q, idx) => (
            <GrammarCard
              key={q.id}
              question={q}
              questionNumber={idx + 1}
              selectedChoice={answers.get(q.id)}
              isBookmarked={false}
              onSelectChoice={(choice) => setAnswers((prev) => new Map(prev).set(q.id, choice))}
              onToggleBookmark={() => setPromptOpen(true)}
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

      {promptOpen && (
        <SignupPromptModal message={BOOKMARK_MESSAGE} onClose={() => setPromptOpen(false)} />
      )}
    </MainLayout>
  );
}
