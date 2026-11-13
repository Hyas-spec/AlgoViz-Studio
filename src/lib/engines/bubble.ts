import { validateScene, type Scene, type Step } from '../dsl';
import { clampInt, sampleArray, type Params } from './common';

interface Marks {
  compare: number;
  swap: number;
  sorted: number;
  nextRound: number;
}

function buildSteps(input: number[]): { steps: Step[]; marks: Marks } {
  const a = [...input];
  const steps: Step[] = [];
  const locked = new Set<number>();
  const marks: Marks = { compare: 0, swap: 0, sorted: 0, nextRound: 0 };
  const recorded = new Set<keyof Marks>();
  const n = a.length;
  let comparisons = 0;
  let swaps = 0;

  const push = (
    s: { compare?: number | null; swap?: [number, number] | null; caption: string; codeLine: number; doneAll?: boolean },
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
        pivot: null,
        compare: s.compare ?? null,
        swap: s.swap ?? null,
        locked: [...locked].sort((x, y) => x - y),
        range: [0, n - 1],
      },
    });
    if (mark && !recorded.has(mark)) {
      recorded.add(mark);
      marks[mark] = steps.length - 1;
    }
  };
  push({ caption: '冒泡排序：每一轮把最大值推到末尾', codeLine: 1 });

  for (let i = 0; i < n - 1; i += 1) {
    for (let j = 0; j < n - 1 - i; j += 1) {
      comparisons += 1;
      push(
        {
          compare: j,
          caption: `比较 a[${j}] = ${a[j]} 与 a[${j + 1}] = ${a[j + 1]}`,
          codeLine: 2,
        },
        i === 0 ? 'compare' : undefined,
      );
      if (a[j] > a[j + 1]) {
        const left = a[j];
        const right = a[j + 1];
        a[j] = right;
        a[j + 1] = left;
        swaps += 1;
        push(
          {
            swap: [j, j + 1],
            caption: `${left} > ${right}，交换 a[${j}] 与 a[${j + 1}]`,
            codeLine: 3,
          },
          i === 0 ? 'swap' : undefined,
        );
      }
    }
    locked.add(n - 1 - i);
    push(
      {
        caption: `第 ${i + 1} 轮结束，a[${n - 1 - i}] = ${a[n - 1 - i]} 已就位`,
        codeLine: 4,
      },
      i === 0 ? 'sorted' : undefined,
    );
  }

  locked.add(0);
  push({ caption: '排序完成：整个数组有序。', codeLine: 4, doneAll: true });

  // 「下一轮」指向第 2 轮第一次比较：从第 1 轮结束往后找。
  if (marks.sorted > 0) {
    const next = steps.findIndex((step, index) => index > marks.sorted && step.caption.startsWith('比较'));
    marks.nextRound = next >= 0 ? next : marks.sorted;
  }

  return { steps, marks };
}

export function bubbleScene(params: Params = {}): Scene {
  const size = clampInt(params.size, 10, 4, 12);
  const { steps, marks } = buildSteps(sampleArray(size));

  return validateScene({
    id: 'bubble',
    title: '冒泡',
    chapter: 'CH.03 / SORTING — BUBBLE',
    section: '第三讲 · 排序与选择',
    kicker: 'BUBBLE SORT',
    figNo: '3.1',
    pages: [10, 11],
    layout: 'array',
    category: 'sort',
    summary: '相邻两两比较，把较大的元素一轮轮推到末尾；第 i 轮结束后，末尾 i + 1 个元素已经就位。',
    body: [
      '每一轮都从前往后扫描未排序区间，相邻两个元素比较、逆序就交换。扫完一轮，当前最大值一定被推到区间末尾。',
      '下一轮就可以少看一个元素。它是稳定的（相等元素不交换），但平均和最坏都是 O(n²)，适合教学，不适合大数据。',
    ],
    formula: 'T(n) = O(n²)',
    complexity: { time: 'O(n²)', space: 'O(1)' },
    code: [
      'for i = 0 to n - 2:',
      '  for j = 0 to n - 2 - i:',
      '    if a[j] > a[j + 1]: swap',
      '  // a[n - 1 - i] 已就位',
    ],
    note: '为什么稳定？只有 a[j] > a[j + 1] 才交换，相等元素不会互换位置。',
    question: '追问一句：冒泡排序为什么是稳定的？',
    figure: 'BUBBLE',
    facts: [
      { label: '稳定性', value: '是' },
      { label: '原地排序', value: '是' },
      { label: '最坏情况', value: 'O(n²)' },
    ],
    outline: [
      { label: '比较相邻', value: 'a[j] / a[j+1]', step: marks.compare },
      { label: '逆序交换', value: 'swap', step: marks.swap },
      { label: '末尾就位', value: 'sorted', step: marks.sorted },
      { label: '下一轮', value: 'i++', step: marks.nextRound },
    ],
    params: [{ key: 'size', label: '数组规模', kind: 'int', default: 10, min: 4, max: 12 }],
    source: 'builtin',
    steps,
  });
}
