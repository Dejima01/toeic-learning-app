import { getAuth } from 'firebase/auth';
import { buildRagContext, loadEmbeddings } from './ragUtils';
import type { WordQuestion, ExampleSentence } from '../types/word';
import { translatePos, translateDerivPart } from '../types/word';
import type { GrammarQuestion } from '../types/grammar';
import { CHOICE_LABELS } from '../types/grammar';

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

export interface FeedbackNotifyPayload {
  feedbackId: string;
  type: 'bug' | 'request' | 'other';
  satisfaction: number | null;
  body: string;
  hasContact: boolean;
}

/** 失敗してもユーザーには見せない（エンドポイント未実装の 404 も含む） */
export async function notifyFeedback(payload: FeedbackNotifyPayload): Promise<void> {
  try {
    const res = await fetch(`${BASE_URL}/api/feedback-notify`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn('feedback-notify failed:', res.status);
  } catch (err) {
    console.warn('feedback-notify failed:', err);
  }
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export type ChatContext =
  | { kind: 'word'; word: WordQuestion; example?: ExampleSentence }
  | { kind: 'grammar'; question: GrammarQuestion }
  | { kind: 'chapter'; mode: 'word' | 'grammar'; level: string; chapter: number };

const MAX_HISTORY_MESSAGES = 10;

function formatChatContext(context: ChatContext): string[] {
  switch (context.kind) {
    case 'word': {
      const { word, example } = context;
      const lines = [
        '【ユーザーが現在見ている問題】',
        `単語: ${word.word}（${translatePos(word.part_of_speech)}）意味: ${word.meaning}`,
      ];
      if (example) lines.push(`表示中の例文: ${example.sentence} ／ ${example.translation}`);
      if (word.derivatives.length > 0) {
        const derivs = word.derivatives
          .map((d) => `${d.word}（${translateDerivPart(d.part)}）${d.meaning}`)
          .join(' / ');
        lines.push(`派生語: ${derivs}`);
      }
      return lines;
    }
    case 'grammar': {
      const { question } = context;
      const label = (i: number) => `(${CHOICE_LABELS[i] ?? i + 1})`;
      return [
        '【ユーザーが現在見ている問題】',
        `問題文: ${question.question_text}`,
        `選択肢: ${question.choices.map((c, i) => `${label(i)} ${c}`).join(' ')}`,
        `正解: ${label(question.correct_index)} ${question.choices[question.correct_index] ?? ''}`,
        `解説: ${question.explanation}`,
        `和訳: ${question.translation}`,
      ];
    }
    case 'chapter':
      return [
        `【ユーザーが現在開いている画面】${context.mode === 'word' ? '単語' : '文法'}モード ${context.level}点レベル 第${context.chapter}章`,
      ];
  }
}

function contextItemId(context: ChatContext | undefined): string | undefined {
  if (context?.kind === 'word') return context.word.id;
  if (context?.kind === 'grammar') return context.question.id;
  return undefined;
}

async function fetchQueryEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${BASE_URL}/api/embed`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ texts: [text], task_type: 'RETRIEVAL_QUERY' }),
  });
  if (!res.ok) throw new Error(`Embed error: ${res.status}`);
  const data = await res.json();
  const embedding = data.embeddings?.[0];
  if (!Array.isArray(embedding)) throw new Error('Embed error: invalid response');
  return embedding as number[];
}

async function retrieveContext(query: string, excludeIds: ReadonlySet<string>): Promise<string> {
  try {
    const [queryEmbedding] = await Promise.all([fetchQueryEmbedding(query), loadEmbeddings()]);
    return await buildRagContext(queryEmbedding, 3, excludeIds);
  } catch (err) {
    console.warn('RAG context unavailable, falling back:', err);
    return '';
  }
}

export async function sendChatMessage(
  history: ChatMessage[],
  newMessage: string,
  chatContext?: ChatContext,
): Promise<string> {
  const viewingId = contextItemId(chatContext);
  const ragContext = await retrieveContext(newMessage, new Set(viewingId ? [viewingId] : []));
  const lines: string[] = [
    'あなたはTOEIC学習を支援するAIアシスタントです。英語学習に関する質問に日本語で答えてください。回答は必ず150文字以内にしてください。前置きや余分な説明は省き、要点だけを簡潔に答えてください。',
    '',
  ];
  if (chatContext) {
    lines.push(...formatChatContext(chatContext));
    lines.push('ユーザーが「この単語」「この問題」「この章」などと言った場合は、上記を指します。');
    lines.push('');
  }
  if (ragContext) {
    lines.push('以下はアプリ内の関連する学習データです。質問に関係する場合のみ参考にしてください:');
    lines.push(ragContext);
    lines.push('');
  }
  for (const msg of history.slice(-MAX_HISTORY_MESSAGES)) {
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
