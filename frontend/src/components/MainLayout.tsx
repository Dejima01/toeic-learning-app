import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatBot } from './ChatBot';

interface MainLayoutProps {
  title?: string;
  /** ヘッダー中央に任意の要素を置く（指定時は title より優先） */
  titleContent?: ReactNode;
  showBack?: boolean;
  showChatBot?: boolean;
  children: ReactNode;
}

export function MainLayout({
  title,
  titleContent,
  showBack = false,
  showChatBot = false,
  children,
}: MainLayoutProps) {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const showHeader = !!(title || titleContent || showBack || showChatBot);

  return (
    <div className="app-container relative mx-auto flex max-w-sm flex-col bg-white dark:bg-gray-900">
      {/* 固定ヘッダー（title / showBack / showChatBot のいずれかがあれば表示） */}
      {showHeader && (
        <header className="flex shrink-0 items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
          {showBack ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-400 dark:border-gray-600 text-gray-600 dark:text-gray-300"
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
          ) : (
            <div className="w-8" />
          )}

          {titleContent ? (
            <div className="flex flex-1 items-center justify-center">{titleContent}</div>
          ) : (
            <h1 className="flex-1 text-center text-lg font-bold dark:text-gray-100">{title}</h1>
          )}

          {showChatBot ? (
            <button
              type="button"
              onClick={() => setChatOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-900 text-sky-600 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-800"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-5 w-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
                />
              </svg>
            </button>
          ) : (
            <div className="w-8" />
          )}
        </header>
      )}

      {/* スクロール可能なコンテンツエリア */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {showChatBot && <ChatBot isOpen={chatOpen} onClose={() => setChatOpen(false)} />}
    </div>
  );
}
