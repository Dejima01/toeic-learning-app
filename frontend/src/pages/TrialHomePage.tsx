import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '../components/MainLayout';
import { SignupPromptModal } from '../components/SignupPromptModal';
import { TrialSignupLinks } from '../components/TrialSignupLinks';
import { TRIAL_CHAPTER_LABEL } from '../lib/trialData';

const LOCKED_FEATURES: { label: string; message: string }[] = [
  {
    label: '全1,200問（単語1,000語・文法200問）',
    message: 'アカウントを作ると、600・750・900点台のすべての章を解けます。',
  },
  {
    label: '復習マークと最適な間隔での復習',
    message: 'アカウントを作ると、分からない問題に印を付けて、忘れかけた頃に復習できます。',
  },
  {
    label: 'AIチャットボットと例文の切り替え',
    message: 'アカウントを作ると、分からないことをその場でAIに質問できます。',
  },
  {
    label: 'ランク認定テスト',
    message: 'アカウントを作ると、30問のテストで今の実力を判定してバッジがもらえます。',
  },
  {
    label: 'カレンダーとランキング',
    message: 'アカウントを作ると、続けた日を記録して、ほかの人とランキングで競えます。',
  },
];

export default function TrialHomePage() {
  const [promptMessage, setPromptMessage] = useState<string | null>(null);

  return (
    <MainLayout>
      <div className="flex h-full flex-col gap-5 overflow-y-auto px-5 pb-4 pt-5">
        {/* ログインの案内 */}
        <section className="rounded-xl bg-sky-50 p-4 dark:bg-sky-950">
          <p className="mb-1 text-xs font-bold text-sky-700 dark:text-sky-300">お試し中</p>
          <h1 className="mb-3 text-base font-bold text-gray-800 dark:text-gray-100">
            ログインすると使える機能がもっと増えます
          </h1>
          <TrialSignupLinks />
        </section>

        {/* 試せる問題 */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
            試してみる（{TRIAL_CHAPTER_LABEL}）
          </h2>
          <div className="flex flex-col gap-3">
            <Link
              to="/trial/word"
              className="block rounded bg-sky-200 py-4 text-center text-xl font-bold text-gray-800 transition-colors hover:bg-sky-300 dark:bg-sky-800 dark:text-gray-100 dark:hover:bg-sky-700"
            >
              単語を試す
            </Link>
            <Link
              to="/trial/grammar"
              className="block rounded bg-sky-200 py-4 text-center text-xl font-bold text-gray-800 transition-colors hover:bg-sky-300 dark:bg-sky-800 dark:text-gray-100 dark:hover:bg-sky-700"
            >
              文法を試す
            </Link>
          </div>
        </section>

        {/* ログインで使える機能 */}
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">
            ログインすると使える機能
          </h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {LOCKED_FEATURES.map((feature) => (
              <li key={feature.label}>
                <button
                  type="button"
                  onClick={() => setPromptMessage(feature.message)}
                  className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <span aria-hidden="true">🔒</span>
                  <span>{feature.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <Link to="/" className="self-center text-xs text-gray-400 underline dark:text-gray-500">
          最初の画面へ戻る
        </Link>
      </div>

      {promptMessage && (
        <SignupPromptModal message={promptMessage} onClose={() => setPromptMessage(null)} />
      )}
    </MainLayout>
  );
}
