import { getAuth } from 'firebase/auth';

const BASE_URL = import.meta.env.VITE_PROXY_URL as string;

async function authHeaders(): Promise<Record<string, string>> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('ログインし直してください');
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function callGemini(prompt: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/gemini`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ prompt }),
  });
  if (res.status === 401) throw new Error('ログインし直してください');
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const data = await res.json();
  return data.result as string;
}

export function warmupProxy(): void {
  fetch(`${BASE_URL}/`).catch(() => {});
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function sendChatMessage(
  history: ChatMessage[],
  newMessage: string,
): Promise<string> {
  const lines: string[] = [
    'あなたはTOEIC学習を支援するAIアシスタントです。英語学習に関する質問に日本語で答えてください。回答は必ず150文字以内にしてください。前置きや余分な説明は省き、要点だけを簡潔に答えてください。',
    '',
  ];
  for (const msg of history) {
    lines.push(`${msg.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${msg.content}`);
  }
  lines.push(`ユーザー: ${newMessage}`);
  lines.push('アシスタント:');

  const res = await fetch(`${BASE_URL}/api/gemini`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ prompt: lines.join('\n') }),
  });
  if (res.status === 401) throw new Error('ログインし直してください');
  if (!res.ok) throw new Error(`Proxy error: ${res.status}`);
  const data = await res.json();
  return data.result as string;
}
