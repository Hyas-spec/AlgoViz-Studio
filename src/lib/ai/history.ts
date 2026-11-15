import type { Scene } from '../dsl';
import { answerSchema, type AnswerPayload } from './answer';

export type AiMode = 'scene' | 'answer';
export type AiSource = 'ai' | 'ai-repaired';

export interface AiHistoryEntry {
  id: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
  mode: AiMode;
  title: string;
  source: AiSource;
  layout?: string;
  stepCount?: number;
  scene?: Scene;
  answer?: AnswerPayload;
}

const KEY = 'algoviz:ai-history:v1';
const MAX = 20;

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is AiHistoryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<AiHistoryEntry>;
  if (typeof entry.id !== 'string' || typeof entry.prompt !== 'string') return false;
  if (entry.mode !== 'scene' && entry.mode !== 'answer') return false;
  if (entry.source !== 'ai' && entry.source !== 'ai-repaired') return false;
  if (typeof entry.title !== 'string' || !entry.title.trim()) return false;
  if (entry.mode === 'scene') {
    return Boolean(
      entry.scene &&
        typeof entry.scene === 'object' &&
        typeof entry.scene.title === 'string' &&
        Array.isArray(entry.scene.steps) &&
        entry.scene.steps.length > 0,
    );
  }
  return answerSchema.safeParse(entry.answer).success;
}

function write(entries: AiHistoryEntry[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage 满时丢掉最旧的一半，再试一次
    try {
      store.setItem(KEY, JSON.stringify(entries.slice(0, Math.max(1, Math.floor(entries.length / 2)))));
    } catch {
      // 忽略：历史不是关键路径
    }
  }
}

export function loadAiHistory(): AiHistoryEntry[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isEntry)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveAiHistoryEntry(entry: AiHistoryEntry): AiHistoryEntry[] {
  const existing = loadAiHistory();
  const prompt = entry.prompt.trim();
  const next = [
    entry,
    ...existing.filter(
      (item) =>
        item.id !== entry.id &&
        !(item.prompt.trim() === prompt && item.mode === entry.mode),
    ),
  ].slice(0, MAX);
  write(next);
  return next;
}

export function removeAiHistoryEntry(id: string): AiHistoryEntry[] {
  const next = loadAiHistory().filter((entry) => entry.id !== id);
  write(next);
  return next;
}

export function clearAiHistory(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function findAiHistory(id: string): AiHistoryEntry | null {
  return loadAiHistory().find((entry) => entry.id === id) ?? null;
}

export function newAiHistoryId(): string {
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
