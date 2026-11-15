import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScene } from '../engines';
import { answerSchema, answerToScene, generateAnswer } from './answer';
import {
  clearAiHistory,
  loadAiHistory,
  removeAiHistoryEntry,
  saveAiHistoryEntry,
  type AiHistoryEntry,
} from './history';

const answer = {
  title: '为什么快速排序最坏是 O(n²)？',
  summary: '每次划分都极不均衡时，递归深度退化为 n。',
  points: ['分区代价 O(n)。', '每次只缩小一个元素。', '总代价 O(n²)。'],
  formula: 'T(n)=T(n-1)+O(n)',
  followups: ['随机基准为什么能避免最坏情况？', '三数取中怎么降低概率？'],
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function entry(overrides: Partial<AiHistoryEntry> = {}): AiHistoryEntry {
  const now = Date.now();
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    prompt: '测试问题',
    createdAt: now,
    updatedAt: now,
    mode: 'scene',
    title: '三次握手',
    source: 'ai',
    scene: createScene('handshake'),
    ...overrides,
  };
}

describe('AI answer and history', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    clearAiHistory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates and converts an answer into a scene-like left page', () => {
    const parsed = answerSchema.parse(answer);
    const scene = answerToScene(parsed, '为什么快速排序最坏是 O(n²)？');
    expect(scene.layout).toBe('sequence');
    expect(scene.title).toBe(answer.title);
    expect(scene.body).toHaveLength(3);
    expect(scene.outline).toHaveLength(4);
    expect(scene.steps).toHaveLength(1);
  });

  it('repairs an invalid answer payload once', async () => {
    let calls = 0;
    const replies = ['not json', JSON.stringify(answer)];
    const result = await generateAnswer('为什么快速排序最坏是 O(n²)？', {
      complete: async () => {
        const reply = replies[calls];
        calls += 1;
        if (!reply) throw new Error('unexpected extra call');
        return reply;
      },
    });
    expect(calls).toBe(2);
    expect(result.repaired).toBe(true);
    expect(result.answer.points).toHaveLength(3);
  });

  it('persists scene and answer entries, dedupes by prompt+mode, and caps at 20', () => {
    saveAiHistoryEntry(entry({ prompt: '相同问题', mode: 'scene' }));
    saveAiHistoryEntry(entry({ prompt: '相同问题', mode: 'answer', answer, title: answer.title }));
    const two = loadAiHistory();
    expect(two).toHaveLength(2);
    expect(two.map((item) => item.mode).sort()).toEqual(['answer', 'scene']);

    for (let i = 0; i < 25; i += 1) {
      saveAiHistoryEntry(entry({ prompt: `问题 ${i}` }));
    }
    expect(loadAiHistory()).toHaveLength(20);
  });

  it('removes one entry and clears all', () => {
    const first = entry({ prompt: '保留' });
    const second = entry({ prompt: '删除' });
    saveAiHistoryEntry(first);
    saveAiHistoryEntry(second);
    expect(loadAiHistory()).toHaveLength(2);
    removeAiHistoryEntry(second.id);
    expect(loadAiHistory().map((item) => item.prompt)).toEqual(['保留']);
    clearAiHistory();
    expect(loadAiHistory()).toEqual([]);
  });
});
