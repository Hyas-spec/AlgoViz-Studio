import { sceneSchema, type Scene, type Step } from '../dsl';

function buildSteps(input: number[]): Step[] {
  const a = [...input];
  const steps: Step[] = [];
  const locked = new Set<number>();
  const n = a.length;

  const push = (s: {
    compare?: number | null;
    swap?: [number, number] | null;
    caption: string;
    codeLine: number;
    doneAll?: boolean;
    locked?: number[];
  }) => {
    steps.push({
      values: [...a],
      pivot: null,
      compare: s.compare ?? null,
      swap: s.swap ?? null,
      locked: s.locked ? [...s.locked].sort((x, y) => x - y) : [...locked].sort((x, y) => x - y),
      range: [0, n - 1],
      caption: s.caption,
      codeLine: s.codeLine,
      doneAll: s.doneAll,
    });
  };

  push({ caption: '冒泡排序：每一轮把最大值推到末尾', codeLine: 1 });

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1 - i; j++) {
      push({
        compare: j,
        caption: `比较 a[${j}] = ${a[j]} 与 a[${j + 1}] = ${a[j + 1]}`,
        codeLine: 2,
      });
      if (a[j] > a[j + 1]) {
        const left = a[j];
        const right = a[j + 1];
        a[j] = right;
        a[j + 1] = left;
        push({
          swap: [j, j + 1],
          caption: `${left} > ${right}，交换 a[${j}] 与 a[${j + 1}]`,
          codeLine: 3,
        });
      }
    }
    locked.add(n - 1 - i);
    push({
      caption: `第 ${i + 1} 轮结束，a[${n - 1 - i}] = ${a[n - 1 - i]} 已就位`,
      codeLine: 4,
    });
  }

  locked.add(0);
  push({
    caption: '排序完成：整个数组有序。',
    codeLine: 4,
    doneAll: true,
    locked: a.map((_, i) => i),
  });

  return steps;
}

export function bubbleScene(): Scene {
  return sceneSchema.parse({
    id: 'bubble',
    title: '冒泡',
    chapter: 'CH.03 / SORTING — BUBBLE',
    kicker: 'BUBBLE SORT',
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
      { label: '比较相邻', value: 'a[j] / a[j+1]' },
      { label: '逆序交换', value: 'swap' },
      { label: '末尾就位', value: 'sorted' },
      { label: '下一轮', value: 'i++' },
    ],
    source: 'builtin',
    steps: buildSteps([5, 3, 8, 1, 9, 2, 4, 6, 10, 7]),
  });
}
