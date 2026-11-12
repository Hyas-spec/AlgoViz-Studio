import { sceneSchema, type Scene, type Step } from '../dsl';

function buildSteps(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const n = a.length;

  const push = (s: {
    caption: string;
    codeLine: number;
    compare?: number | null;
    range?: [number, number];
    doneAll?: boolean;
  }) => {
    steps.push({
      values: [...a],
      pivot: null,
      compare: s.compare ?? null,
      swap: null,
      locked: s.doneAll ? a.map((_, i) => i) : [],
      range: s.range ?? [0, n - 1],
      caption: s.caption,
      codeLine: s.codeLine,
      doneAll: s.doneAll,
    });
  };

  const merge = (l: number, m: number, r: number) => {
    const left = a.slice(l, m + 1);
    const right = a.slice(m + 1, r + 1);
    const range: [number, number] = [l, r];

    push({ caption: `合并 [${l}..${m}] 与 [${m + 1}..${r}]`, codeLine: 5, range });

    let i = 0;
    let j = 0;
    let k = l;

    while (i < left.length && j < right.length) {
      push({
        caption: `比较左段 ${left[i]} 与右段 ${right[j]}`,
        codeLine: 5,
        compare: k,
        range,
      });
      a[k] = left[i] <= right[j] ? left[i++] : right[j++];
      push({ caption: `写入 a[${k}] = ${a[k]}`, codeLine: 6, compare: k, range });
      k++;
    }

    while (i < left.length) {
      a[k] = left[i++];
      push({ caption: `补入左段 ${a[k]} → a[${k}]`, codeLine: 6, compare: k, range });
      k++;
    }

    while (j < right.length) {
      a[k] = right[j++];
      push({ caption: `补入右段 ${a[k]} → a[${k}]`, codeLine: 6, compare: k, range });
      k++;
    }

    push({ caption: `区间 [${l}..${r}] 合并完成`, codeLine: 6, range });
  };

  const sort = (l: number, r: number) => {
    if (l >= r) return;
    const m = (l + r) >> 1;
    sort(l, m);
    sort(m + 1, r);
    merge(l, m, r);
  };

  push({ caption: '归并排序：分成两半，分别排好，再合并', codeLine: 1 });
  sort(0, n - 1);
  push({ caption: '排序完成：整个数组有序。', codeLine: 6, doneAll: true });

  return steps;
}

export function mergeScene(): Scene {
  return sceneSchema.parse({
    id: 'merge',
    title: '归并',
    chapter: 'CH.03 / SORTING — MERGE',
    kicker: 'MERGE SORT',
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
      { label: '二分', value: 'mid' },
      { label: '递归', value: 'divide' },
      { label: '合并', value: 'merge' },
      { label: '写回', value: 'write' },
    ],
    source: 'builtin',
    steps: buildSteps([5, 3, 8, 1, 9, 2, 4, 6, 10, 7]),
  });
}
