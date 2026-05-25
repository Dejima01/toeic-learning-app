import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage } from '../lib/proxyClient';
import type { ChatMessage } from '../lib/proxyClient';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatBot({ isOpen, onClose }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', content: '何でも質問して下さい' },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    const history = messages;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const reply = await sendChatMessage(history, text);
      setMessages((prev) => [...prev, { role: 'model', content: reply }]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'エラーが発生しました。もう一度お試しください。';
      setMessages((prev) => [...prev, { role: 'model', content: msg }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages]);

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-50 flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl"
      style={{ height: '340px', display: isOpen ? 'flex' : 'none' }}
    >
      {/* ヘッダー */}
      <div className="flex shrink-0 items-center px-4 py-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="h-6 w-6 text-gray-500"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21M6.75 19.5h10.5a2.25 2.25 0 0 0 2.25-2.25V9a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 9v8.25a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* メッセージエリア */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed text-gray-800 ${
                msg.role === 'user' ? 'bg-sky-200' : 'bg-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-gray-200 px-4 py-3 text-sm text-gray-400">
              <span className="animate-pulse">…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力エリア */}
      <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 px-4 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSend();
          }}
          placeholder="メッセージ..."
          disabled={sending}
          className="flex-1 rounded-full bg-gray-100 px-4 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-400 text-white transition-colors hover:bg-sky-500 disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
