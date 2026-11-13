import { validateScene, type Scene, type Step } from '../dsl';

function buildSteps(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const locked = new Set<number>();

  const push = (s: {
    pivot?: number | null;
    compare?: number | null;
    swap?: [number, number] | null;
    range: [number, number];
    caption: string;
    codeLine: number;
    doneAll?: boolean;
    locked?: number[];
  }) => {
    steps.push({
      caption: s.caption,
      codeLine: s.codeLine,
      doneAll: s.doneAll,
      state: {
        kind: 'array',
        values: [...a],
        pivot: s.pivot ?? null,
        compare: s.compare ?? null,
        swap: s.swap ?? null,
        locked: s.locked ? [...s.locked].sort((x, y) => x - y) : [...locked].sort((x, y) => x - y),
        range: s.range,
      },
    });
  };

  const partition = (l: number, r: number): number => {
    const pv = a[r];
    push({ pivot: r, range: [l, r], caption: `以 ${pv} 为基准，扫描 a[${l}..${r - 1}]`, codeLine: 3 });

    let i = l - 1;
    for (let j = l; j < r; j++) {
      push({ pivot: r, compare: j, range: [l, r], caption: `比较 a[${j}] = ${a[j]} 与基准 ${pv}`, codeLine: 3 });
      if (a[j] <= pv) {
        i++;
        if (i !== j) {
          const left = a[i];
          const right = a[j];
          a[i] = right;
          a[j] = left;
          push({ pivot: r, swap: [i, j], range: [l, r], caption: `${right} ≤ ${pv}，交换 a[${i}] 与 a[${j}]`, codeLine: 4 });
        }
      }
    }

    const last = a[r];
    a[r] = a[i + 1];
    a[i + 1] = last;
    locked.add(i + 1);
    push({ pivot: i + 1, swap: [i + 1, r], range: [l, r], caption: `基准 ${pv} 归位到下标 ${i + 1}`, codeLine: 4 });

    return i + 1;
  };

  const quickSort = (l: number, r: number) => {
    if (l > r) return;
    if (l === r) {
      locked.add(l);
      push({ pivot: l, range: [l, l], caption: `单个元素 ${a[l]} 已就位`, codeLine: 2 });
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

export function quickScene(): Scene {
  return validateScene({
    id: 'quick',
    title: '分区',
    chapter: 'CH.03 / SORTING — QUICKSORT',
    section: '第三讲 · 排序与选择',
    kicker: 'QUICKSORT',
    figNo: '3.2',
    pages: [12, 13],
    layout: 'array',
    category: 'sort',
    summary: '把小于基准的放左边，大于的放右边，再对两侧递归。整个快速排序，本质上就是这一件事。',
    body: [
      '分区结束后，基准落在它的最终位置：左区每个元素都不大于它，右区每个元素都大于它。接下来对两侧递归；区间缩到 1 或 0 时自然结束。',
      '这就是分治：一次划分把问题切成两个更小的同类问题，而基准本身再也不需要移动。',
    ],
    formula: 'T(n) = 2T(n/2) + O(n)',
    complexity: { time: 'O(n log n)', space: 'O(log n)' },
    code: [
      'function quickSort(a, l, r):',
      '  if l >= r return',
      '  p = partition(a, l, r)',
      '  swap(a[p], a[r])   // 基准归位',
      '  quickSort(a, l, p - 1)',
      '  quickSort(a, p + 1, r)',
    ],
    note: '为什么取末元素？随机数据下平均性能最好；但面对有序数组会退化成 O(n²)，所以工程里常用随机基准或三数取中。',
    question: '追问一句：为什么不选第一个元素当基准？',
    figure: 'PARTITION',
    facts: [
      { label: '稳定性', value: '否' },
      { label: '原地排序', value: '是' },
      { label: '最坏情况', value: 'O(n²)' },
    ],
    outline: [
      { label: '选基准', value: 'pivot' },
      { label: '扫描', value: 'compare' },
      { label: '交换', value: 'swap' },
      { label: '递归', value: 'divide' },
    ],
    source: 'builtin',
    steps: buildSteps([5, 3, 8, 1, 9, 2, 4, 6, 10, 7]),
  });
}
