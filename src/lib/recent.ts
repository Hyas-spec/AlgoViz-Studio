import { isSceneId, type SceneId } from './engines';

export interface RecentEntry {
  id: SceneId;
  params: Record<string, number>;
  at: number;
}

const KEY = 'algoviz:recent:v1';
const MAX = 6;

function sameParams(a: Record<string, number>, b: Record<string, number>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** localStorage 不可用、内容损坏时一律返回空列表，不阻塞首页。 */
export function loadRecent(): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is RecentEntry => {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry as Partial<RecentEntry>;
        return typeof candidate.id === 'string' && isSceneId(candidate.id) && typeof candidate.at === 'number';
      })
      .map((entry) => ({ ...entry, params: entry.params ?? {} }))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function saveRecent(entry: RecentEntry): RecentEntry[] {
  const list = loadRecent().filter((item) => !(item.id === entry.id && sameParams(item.params, entry.params)));
  const next = [entry, ...list].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 配额满 / 隐私模式：退化为内存态即可
  }
  return next;
}

export function timeAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} 小时前`;
  return `${Math.round(seconds / 86400)} 天前`;
}

/** 把参数压成 `n=8 · 基准=三数` 这样的一行摘要。 */
export function paramsSummary(params: Record<string, number>, id?: SceneId): string {
  const labels: Record<string, string> = { size: 'n', levels: '层', pivot: '基准', start: '起点' };
  const pivotNames = ['末元素', '三数取中'];
  const starts: Partial<Record<SceneId, string[]>> = {
    bfs: ['A', 'D'],
    dijkstra: ['S', 'A'],
  };
  return Object.entries(params)
    .map(([key, value]) => {
      if (key === 'pivot') return `基准 ${pivotNames[value] ?? value}`;
      if (key === 'start') return `起点 ${starts[id ?? 'bfs']?.[value] ?? value}`;
      if (key === 'loss') return `丢包 ${value === 1 ? '开' : '关'}`;
      return `${labels[key] ?? key} ${value}`;
    })
    .join(' · ');
}
