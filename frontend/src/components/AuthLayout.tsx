import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface AuthLayoutProps {
  title?: string;
  showBack?: boolean;
  children: ReactNode;
}

export function AuthLayout({ title, showBack = false, children }: AuthLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col bg-white dark:bg-gray-900">
      {title && (
        <header className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          {showBack && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <h1 className="flex-1 text-center text-lg font-bold dark:text-gray-100" style={{ marginRight: showBack ? '2rem' : '0' }}>
            {title}
          </h1>
        </header>
      )}
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
