import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

type EntryType = 'word' | 'grammar';

interface EmbeddingEntry {
  id: string;
  type: EntryType;
  embedding: number[];
}

let embeddingsPromise: Promise<EmbeddingEntry[]> | null = null;

export function loadEmbeddings(): Promise<EmbeddingEntry[]> {
  if (!embeddingsPromise) {
    embeddingsPromise = fetch('/embeddings.json')
      .then((res) => {
        if (!res.ok) throw new Error(`embeddings.json: ${res.status}`);
        return res.json() as Promise<EmbeddingEntry[]>;
      })
      .catch((err) => {
        // 失敗はキャッシュせず、次回の質問で再試行させる
        embeddingsPromise = null;
        throw err;
      });
  }
  return embeddingsPromise;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export function topK(
  entries: EmbeddingEntry[],
  queryEmbedding: number[],
  k: number,
): { id: string; type: EntryType }[] {
  return entries
    .map((e) => ({ id: e.id, type: e.type, score: cosineSimilarity(queryEmbedding, e.embedding) }))
    .sort((x, y) => y.score - x.score)
    .slice(0, k)
    .map(({ id, type }) => ({ id, type }));
}

function formatEntry(type: EntryType, data: Record<string, unknown>): string | null {
  if (type === 'word') {
    if (!data.word) return null;
    return `[単語] ${data.word}: ${data.meaning ?? ''}`;
  }
  if (!data.question_text) return null;
  const choices = Array.isArray(data.choices) ? (data.choices as string[]) : [];
  const answer =
    typeof data.correct_index === 'number' ? choices[data.correct_index] : undefined;
  return `[文法] ${data.question_text}${answer ? ` 正解: ${answer}` : ''} 解説: ${data.explanation ?? ''}`;
}

/** 上位 k 件だけ Firestore から取得してコンテキスト文字列を作る（読み取りは最大 k 回） */
export async function buildRagContext(queryEmbedding: number[], k = 3): Promise<string> {
  const entries = await loadEmbeddings();
  const hits = topK(entries, queryEmbedding, k);
  const snaps = await Promise.all(
    hits.map((h) => getDoc(doc(db, `${h.type}_questions`, h.id))),
  );
  return snaps
    .map((snap, i) => (snap.exists() ? formatEntry(hits[i].type, snap.data()) : null))
    .filter((line): line is string => line !== null)
    .join('\n');
}
