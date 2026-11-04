import { TrialSignupLinks } from './TrialSignupLinks';

interface SignupPromptModalProps {
  /** 押した機能に合わせた説明 */
  message: string;
  onClose: () => void;
}

/** お試しモードで、ログインが必要な機能を押したときの案内 */
export function SignupPromptModal({ message, onClose }: SignupPromptModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-prompt-title"
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="signup-prompt-title" className="mb-2 text-lg font-bold text-gray-800 dark:text-gray-100">
          ログインすると使えます
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{message}</p>
        <TrialSignupLinks />
        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full py-2 text-center text-sm text-gray-500 dark:text-gray-400"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
