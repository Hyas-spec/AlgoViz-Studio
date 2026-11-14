import { validateScene, type ArrayState, type Scene, type Step } from '../dsl';
import { clampInt, sampleArray, type Params } from './common';

interface Marks {
  divide: number;
  recurse: number;
  merge: number;
  write: number;
}

function buildSteps(input: number[]): { steps: Step[]; marks: Marks } {
  const a = [...input];
  const steps: Step[] = [];
  const marks: Marks = { divide: 0, recurse: 0, merge: 0, write: 0 };
  const recorded = new Set<keyof Marks>();
  const settled = new Set<number>();
  const n = a.length;
  let comparisons = 0;
  let writes = 0;

  const push = (
    s: {
      caption: string;
      codeLine: number;
      range?: [number, number];
      aux?: ArrayState['aux'];
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
        { label: '写入', value: String(writes) },
      ],
      state: {
        kind: 'array',
        values: [...a],
        pivot: null,
        compare: null,
        swap: null,
        locked: s.doneAll ? a.map((_, i) => i) : [...settled].sort((x, y) => x - y),
        range: s.range ?? [0, n - 1],
        aux: s.aux,
      },
    });
    if (mark && !recorded.has(mark)) {
      recorded.add(mark);
      marks[mark] = steps.length - 1;
    }
  };

  const merge = (l: number, m: number, r: number) => {
    const left = a.slice(l, m + 1);
    const right = a.slice(m + 1, r + 1);
    const range: [number, number] = [l, r];

    // 当前区间正在被重写，先取消“已排序”标记；子区间蓝条只在合并前可见。
    for (let index = l; index <= r; index += 1) settled.delete(index);

    push(
      {
        caption: `合并 [${l}..${m}] 与 [${m + 1}..${r}]`,
        codeLine: 5,
        range,
        aux: { left, right, i: 0, j: 0, target: l },
      },
      'merge',
    );

    let i = 0;
    let j = 0;
    let k = l;

    while (i < left.length && j < right.length) {
      comparisons += 1;
      push(
        {
          caption: `比较左段 ${left[i]} 与右段 ${right[j]}`,
          codeLine: 5,
          range,
          aux: { left, right, i, j, target: k },
        },
        'recurse',
      );

      const takeLeft = left[i] <= right[j];
      const value = takeLeft ? left[i] : right[j];
      if (takeLeft) i += 1;
      else j += 1;
      a[k] = value;
      writes += 1;
      push(
        {
          caption: `写入 a[${k}] = ${value}`,
          codeLine: 6,
          range,
          aux: { left, right, i, j, target: k },
        },
        'write',
      );
      k += 1;
    }

    while (i < left.length) {
      a[k] = left[i];
      writes += 1;
      push({
        caption: `补入左段 ${a[k]} → a[${k}]`,
        codeLine: 6,
        range,
        aux: { left, right, i, j, target: k },
      });
      i += 1;
      k += 1;
    }

    while (j < right.length) {
      a[k] = right[j];
      writes += 1;
      push({
        caption: `补入右段 ${a[k]} → a[${k}]`,
        codeLine: 6,
        range,
        aux: { left, right, i, j, target: k },
      });
      j += 1;
      k += 1;
    }

    for (let index = l; index <= r; index += 1) settled.add(index);
    push({
      caption: `区间 [${l}..${r}] 合并完成，这一段已经有序`,
      codeLine: 6,
      range,
      aux: { left, right, i, j, target: k - 1 },
    });
  };

  const sort = (l: number, r: number) => {
    if (l >= r) return;
    const m = (l + r) >> 1;
    sort(l, m);
    sort(m + 1, r);
    merge(l, m, r);
  };

  push({ caption: '归并排序：分成两半，分别排好，再合并', codeLine: 1 }, 'divide');
  sort(0, n - 1);
  push({ caption: '排序完成：整个数组有序。', codeLine: 6, doneAll: true });

  return { steps, marks };
}

export function mergeScene(params: Params = {}): Scene {
  const size = clampInt(params.size, 10, 4, 12);
  const { steps, marks } = buildSteps(sampleArray(size));

  return validateScene({
    id: 'merge',
    title: '归并',
    chapter: 'CH.03 / SORTING — MERGE',
    section: '第三讲 · 排序与选择',
    kicker: 'MERGE SORT',
    figNo: '3.3',
    pages: [14, 15],
    layout: 'array',
    category: 'sort',
    summary: '把区间一分为二，分别排好，再用双指针把两段有序序列合并成一段。',
    body: [
      '归并排序先递归到单个元素，再一层层向上合并。每次合并只做一件事：比较两段当前最小的元素，把更小的那个写回原数组。',
      '它的时间复杂度稳定在 O(n log n)，代价是需要 O(n) 的辅助空间；相等元素先取左段，所以它也是稳定的。',
    ],
    formula: 'T(n) = 2T(n/2) + O(n)',
    complexity: { time: 'O(n log n)', space: 'O(n)' },
    code: [
      'function mergeSort(a, l, r):',
      '  if l >= r return',
      '  m = (l + r) / 2',
      '  mergeSort(a, l, m); mergeSort(a, m + 1, r)',
      '  merge(a, l, m, r)',
      '// merge: 双指针写入 a，区间有序',
    ],
    note: '为什么稳定？合并时 left[i] <= right[j] 取左段，相等元素保持原来的先后顺序。',
    question: '追问一句：归并排序为什么需要 O(n) 额外空间？',
    figure: 'MERGE',
    facts: [
      { label: '稳定性', value: '是' },
      { label: '原地排序', value: '否' },
      { label: '最坏情况', value: 'O(n log n)' },
    ],
    outline: [
      { label: '二分', value: 'mid', step: marks.divide },
      { label: '递归', value: 'divide', step: marks.recurse },
      { label: '合并', value: 'merge', step: marks.merge },
      { label: '写回', value: 'write', step: marks.write },
    ],
    params: [{ key: 'size', label: '数组规模', kind: 'int', default: 10, min: 4, max: 12 }],
    source: 'builtin',
    steps,
  });
}
