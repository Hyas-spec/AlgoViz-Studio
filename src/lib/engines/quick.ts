import { validateScene, type Scene, type Step } from '../dsl';
import { clampInt, sampleArray, type Params } from './common';

interface Marks {
  pivot: number;
  compare: number;
  swap: number;
  recurse: number;
}

interface BuildResult {
  steps: Step[];
  marks: Marks;
}

function buildSteps(input: number[], pivotMode: number): BuildResult {
  const a = [...input];
  const steps: Step[] = [];
  const locked = new Set<number>();
  const marks: Marks = { pivot: 0, compare: 0, swap: 0, recurse: 0 };
  const recorded = new Set<keyof Marks>();
  let comparisons = 0;
  let swaps = 0;

  const push = (
    s: {
      pivot?: number | null;
      compare?: number | null;
      swap?: [number, number] | null;
      range: [number, number];
      caption: string;
      codeLine: number;
      doneAll?: boolean;
    },
    mark?: keyof Marks,
  ) => {
    steps.push({
      caption: s.caption,
      codeLine: s.codeLine,
      doneAll: s.doneAll,
      metrics: [
        { label: '比较', value: String(comparisons) },
        { label: '交换', value: String(swaps) },
        { label: '已就位', value: String(locked.size) },
      ],
      state: {
        kind: 'array',
        values: [...a],
        pivot: s.pivot ?? null,
        compare: s.compare ?? null,
        swap: s.swap ?? null,
        locked: [...locked].sort((x, y) => x - y),
        range: s.range,
      },
    });
    if (mark && !recorded.has(mark)) {
      recorded.add(mark);
      marks[mark] = steps.length - 1;
    }
  };

  const partition = (l: number, r: number): number => {
    if (pivotMode === 1 && l < r) {
      const mid = (l + r) >> 1;
      const [min, median, max] = [l, mid, r].sort((x, y) => a[x] - a[y]);
      push(
        {
          pivot: median,
          range: [l, r],
          caption: `三数取中：a[${min}]=${a[min]}、a[${median}]=${a[median]}、a[${max}]=${a[max]}，选 ${a[median]} 作基准`,
          codeLine: 3,
        },
        'pivot',
      );
      if (median !== r) {
        const left = a[median];
        a[median] = a[r];
        a[r] = left;
        swaps += 1;
        push({ pivot: r, swap: [median, r], range: [l, r], caption: `把基准 ${a[r]} 换到区间末尾`, codeLine: 4 }, 'swap');
      }
    }

    const pv = a[r];
    push({ pivot: r, range: [l, r], caption: `以 ${pv} 为基准，扫描 a[${l}..${r - 1}]`, codeLine: 3 }, 'pivot');

    let i = l - 1;
    for (let j = l; j < r; j += 1) {
      comparisons += 1;
      push({ pivot: r, compare: j, range: [l, r], caption: `比较 a[${j}] = ${a[j]} 与基准 ${pv}`, codeLine: 3 }, 'compare');
      if (a[j] <= pv) {
        i += 1;
        if (i !== j) {
          const left = a[i];
          const right = a[j];
          a[i] = right;
          a[j] = left;
          swaps += 1;
          push({ pivot: r, swap: [i, j], range: [l, r], caption: `${right} ≤ ${pv}，交换 a[${i}] 与 a[${j}]`, codeLine: 4 }, 'swap');
        }
      }
    }

    const last = a[r];
    a[r] = a[i + 1];
    a[i + 1] = last;
    swaps += 1;
    locked.add(i + 1);
    push({ pivot: i + 1, swap: [i + 1, r], range: [l, r], caption: `基准 ${pv} 归位到下标 ${i + 1}`, codeLine: 4 });

    return i + 1;
  };

  const quickSort = (l: number, r: number) => {
    if (l > r) return;
    if (l === r) {
      locked.add(l);
      push({ pivot: l, range: [l, l], caption: `单个元素 ${a[l]} 已就位`, codeLine: 2 }, 'recurse');
      return;
    }
    const p = partition(l, r);
    push({ pivot: p, range: [l, r], caption: `${a[p]} 归位，左右两段继续递归`, codeLine: 5 }, 'recurse');
    quickSort(l, p - 1);
    quickSort(p + 1, r);
  };

  quickSort(0, a.length - 1);
  a.forEach((_, i) => locked.add(i));
  push({ range: [0, a.length - 1], caption: '排序完成：整个数组有序。', codeLine: 6, doneAll: true });

  return { steps, marks };
}

export function quickScene(params: Params = {}): Scene {
  const size = clampInt(params.size, 10, 4, 16);
  const pivotMode = clampInt(params.pivot, 0, 0, 1);
  const { steps, marks } = buildSteps(sampleArray(size), pivotMode);

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
    note: '为什么取末元素？随机数据下平均性能最好；但面对有序数组会退化成 O(n²)。三数取中就是为这种情况准备的。',
    question: '追问一句：为什么不选第一个元素当基准？',
    figure: 'PARTITION',
    facts: [
      { label: '稳定性', value: '否' },
      { label: '原地排序', value: '是' },
      { label: '最坏情况', value: 'O(n²)' },
    ],
    outline: [
      { label: '选基准', value: 'pivot', step: marks.pivot },
      { label: '扫描', value: 'compare', step: marks.compare },
      { label: '交换', value: 'swap', step: marks.swap },
      { label: '递归', value: 'divide', step: marks.recurse },
    ],
    params: [
      { key: 'size', label: '数组规模', kind: 'int', default: 10, min: 4, max: 16 },
      {
        key: 'pivot',
        label: '基准策略',
        kind: 'enum',
        default: 0,
        min: 0,
        max: 1,
        options: [
          { value: 0, label: '末元素' },
          { value: 1, label: '三数取中' },
        ],
      },
    ],
    source: 'builtin',
    steps,
  });
}
