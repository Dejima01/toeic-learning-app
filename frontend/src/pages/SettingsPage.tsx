import { MainLayout } from '../components/MainLayout';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const { isDark, toggle } = useTheme();

  return (
    <MainLayout title="設定" showBack>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {/* ダークモード トグル */}
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-base font-medium text-gray-800 dark:text-gray-100">ダークモード</span>
          <button
            type="button"
            role="switch"
            aria-checked={isDark}
            onClick={toggle}
            className={`relative inline-flex h-[26px] w-[44px] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
              isDark ? 'bg-sky-400' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow transition-transform duration-200 ${
                isDark ? 'translate-x-[21px]' : 'translate-x-[3px]'
              }`}
            />
          </button>
        </div>
      </div>
    </MainLayout>
  );
}
