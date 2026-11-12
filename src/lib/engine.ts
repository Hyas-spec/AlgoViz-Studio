export interface Step {
  values: number[];
  pivot: number | null;
  compare: number | null;
  swap: [number, number] | null;
  locked: number[];
  range: [number, number];
  caption: string;
  codeLine: number;
  doneAll?: boolean;
}

interface PushInput {
  pivot?: number | null;
  compare?: number | null;
  swap?: [number, number] | null;
  range: [number, number];
  caption: string;
  codeLine: number;
  doneAll?: boolean;
  locked?: number[];
}

/**
 * 快速排序（Lomuto 分区，取区间末元素为基准）。
 * 每一步都带完整数组快照，便于前后跳转与导出。
 */
export function buildSteps(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const locked = new Set<number>();

  const push = (s: PushInput) => {
    steps.push({
      values: [...a],
      pivot: s.pivot ?? null,
      compare: s.compare ?? null,
      swap: s.swap ?? null,
      locked: s.locked ? [...s.locked].sort((x, y) => x - y) : [...locked].sort((x, y) => x - y),
      range: s.range,
      caption: s.caption,
      codeLine: s.codeLine,
      doneAll: s.doneAll,
    });
  };

  const partition = (l: number, r: number): number => {
    const pv = a[r];
    push({
      pivot: r,
      range: [l, r],
      caption: `以 ${pv} 为基准，扫描 a[${l}..${r - 1}]`,
      codeLine: 3,
    });

    let i = l - 1;
    for (let j = l; j < r; j++) {
      push({
        pivot: r,
        compare: j,
        range: [l, r],
        caption: `比较 a[${j}] = ${a[j]} 与基准 ${pv}`,
        codeLine: 3,
      });
      if (a[j] <= pv) {
        i++;
        if (i !== j) {
          const left = a[i];
          const right = a[j];
          a[i] = right;
          a[j] = left;
          push({
            pivot: r,
            swap: [i, j],
            range: [l, r],
            caption: `${right} ≤ ${pv}，交换 a[${i}] 与 a[${j}]`,
            codeLine: 4,
          });
        }
      }
    }

    const last = a[r];
    a[r] = a[i + 1];
    a[i + 1] = last;
    locked.add(i + 1);
    push({
      pivot: i + 1,
      swap: [i + 1, r],
      range: [l, r],
      caption: `基准 ${pv} 归位到下标 ${i + 1}`,
      codeLine: 4,
    });

    return i + 1;
  };

  const quickSort = (l: number, r: number) => {
    if (l > r) return;
    if (l === r) {
      locked.add(l);
      push({
        pivot: l,
        range: [l, l],
        caption: `单个元素 ${a[l]} 已就位`,
        codeLine: 2,
      });
      return;
    }
    const p = partition(l, r);
    quickSort(l, p - 1);
    quickSort(p + 1, r);
  };

  quickSort(0, a.length - 1);

  push({
    range: [0, a.length - 1],
    caption: '排序完成：整个数组有序。',
    codeLine: 6,
    doneAll: true,
    locked: a.map((_, i) => i),
  });

  return steps;
}

export const DEFAULT_ARRAY = [5, 3, 8, 1, 9, 2, 4, 6, 10, 7];
