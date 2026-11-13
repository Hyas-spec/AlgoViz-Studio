/** 内置引擎共用的参数与随机源。 */

export type Params = Record<string, number>;

export function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** 演示数组：n = 10 时沿用最初的样本，其余规模用固定种子生成，保证可复现。 */
const BASE_ARRAY = [5, 3, 8, 1, 9, 2, 4, 6, 10, 7];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleArray(size: number): number[] {
  if (size === BASE_ARRAY.length) return [...BASE_ARRAY];
  const random = mulberry32(20261113 + size * 97);
  const pool = Array.from({ length: size }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** 满二叉搜索树：3 层 7 个节点，4 层 15 个。 */
const TREE_VALUES = [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];

export function treeValues(levels: number): number[] {
  return levels <= 3 ? TREE_VALUES.slice(0, 7) : [...TREE_VALUES];
}
