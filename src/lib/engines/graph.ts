import { validateScene, type GraphState, type Scene, type Step } from '../dsl';
import { clampInt, type Params } from './common';

interface GraphNode {
  id: string;
  label: string;
}

interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
}

/* ------------------------------------------------------------------ */
/* 两张固定的图：环形排布，边按下标顺序声明，邻居遍历也用这个顺序      */
/* ------------------------------------------------------------------ */

const BFS_NODES: GraphNode[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => ({ id, label: id }));

const BFS_EDGES: GraphEdge[] = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'B', to: 'E' },
  { from: 'C', to: 'F' },
  { from: 'C', to: 'G' },
  { from: 'D', to: 'F' },
];

const DIJKSTRA_NODES: GraphNode[] = ['S', 'A', 'B', 'C', 'D', 'T'].map((id) => ({ id, label: id }));

const DIJKSTRA_EDGES: GraphEdge[] = [
  { from: 'S', to: 'A', weight: 4 },
  { from: 'S', to: 'B', weight: 2 },
  { from: 'S', to: 'T', weight: 10 },
  { from: 'A', to: 'B', weight: 1 },
  { from: 'A', to: 'C', weight: 3 },
  { from: 'B', to: 'C', weight: 3 },
  { from: 'B', to: 'D', weight: 6 },
  { from: 'C', to: 'D', weight: 2 },
  { from: 'D', to: 'T', weight: 1 },
];

/** 无向图的边只存一份；邻接表把两个方向都补齐，渲染器也只画一次。 */
function adjacency(edges: GraphEdge[], id: string): { id: string; weight: number }[] {
  return edges.flatMap((edge) => {
    if (edge.from === id) return [{ id: edge.to, weight: edge.weight ?? 1 }];
    if (edge.to === id) return [{ id: edge.from, weight: edge.weight ?? 1 }];
    return [];
  });
}

/* ------------------------------------------------------------------ */
/* BFS                                                                 */
/* ------------------------------------------------------------------ */

function bfsSteps(nodes: GraphNode[], edges: GraphEdge[], source: string): { steps: Step[]; marks: number[] } {
  const steps: Step[] = [];
  const visited: string[] = [];
  const queue: string[] = [];
  const marks = [-1, -1, -1, -1];
  const labelOf = new Map(nodes.map((node) => [node.id, node.label]));

  const push = (current: string | null, caption: string, codeLine: number, doneAll = false) => {
    const state: GraphState = {
      kind: 'graph',
      nodes: nodes.map((node) => ({ ...node })),
      edges: edges.map((edge) => ({ ...edge })),
      visited: [...visited],
      frontier: [...queue],
      current,
      frontierLabel: '队列',
    };
    steps.push({
      caption,
      codeLine,
      doneAll: doneAll ? true : undefined,
      metrics: [
        { label: '已访问', value: `${visited.length}/${nodes.length}` },
        { label: '队列', value: String(queue.length) },
      ],
      state,
    });
  };

  queue.push(source);
  push(null, `把起点 ${labelOf.get(source)} 放进队列。队列里是「已经发现、还没访问」的节点。`, 2);
  marks[0] = 0;

  while (queue.length > 0) {
    const id = queue.shift() as string;
    visited.push(id);
    const fresh = adjacency(edges, id).filter(
      (neighbor) => !visited.includes(neighbor.id) && !queue.includes(neighbor.id),
    );
    if (marks[1] < 0) marks[1] = steps.length;
    push(
      id,
      fresh.length > 0
        ? `队首 ${labelOf.get(id)} 出队并访问它；邻居里还有 ${fresh.length} 个没被发现。`
        : `队首 ${labelOf.get(id)} 出队并访问它；邻居都访问过或已在队列里，不再入队。`,
      4,
    );

    for (const neighbor of fresh) {
      queue.push(neighbor.id);
      if (marks[2] < 0) marks[2] = steps.length;
      push(id, `发现邻居 ${labelOf.get(neighbor.id)}：还没访问过，入队排到队尾。`, 5);
    }
  }

  push(
    null,
    `队列清空，遍历完成。访问顺序：${visited.map((id) => labelOf.get(id)).join(' → ')}。`,
    6,
    true,
  );
  marks[3] = steps.length - 1;
  return { steps, marks };
}

/* ------------------------------------------------------------------ */
/* Dijkstra                                                            */
/* ------------------------------------------------------------------ */

function dijkstraSteps(
  nodes: GraphNode[],
  edges: GraphEdge[],
  source: string,
  target: string,
): { steps: Step[]; marks: number[] } {
  const steps: Step[] = [];
  const labelOf = new Map(nodes.map((node) => [node.id, node.label]));
  const dist = new Map<string, number>(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  const prev = new Map<string, string | null>();
  const settled: string[] = [];
  const marks = [-1, -1, -1, -1];
  dist.set(source, 0);

  const frontier = () => nodes.filter((node) => !settled.includes(node.id) && Number.isFinite(dist.get(node.id))).map((node) => node.id);

  const push = (current: string | null, caption: string, codeLine: number, doneAll = false) => {
    const state: GraphState = {
      kind: 'graph',
      nodes: nodes.map((node) => ({ ...node })),
      edges: edges.map((edge) => ({ ...edge })),
      visited: [...settled],
      frontier: frontier(),
      current,
      frontierLabel: '待确定',
      dist: nodes.map((node) => ({
        id: node.id,
        value: Number.isFinite(dist.get(node.id)) ? String(dist.get(node.id)) : '∞',
      })),
    };
    steps.push({
      caption,
      codeLine,
      doneAll: doneAll ? true : undefined,
      metrics: [
        { label: '已确定', value: `${settled.length}/${nodes.length}` },
        { label: '待确定', value: String(state.frontier?.length ?? 0) },
      ],
      state,
    });
  };

  push(null, `初始化：起点 ${labelOf.get(source)} 的暂定距离为 0，其余节点先记作 ∞。`, 2);
  marks[0] = 0;

  while (settled.length < nodes.length) {
    const candidates = nodes.filter((node) => !settled.includes(node.id) && Number.isFinite(dist.get(node.id)));
    if (candidates.length === 0) break;
    const current = candidates.reduce((best, node) =>
      (dist.get(node.id) as number) < (dist.get(best.id) as number) ? node : best,
    );
    settled.push(current.id);
    if (marks[1] < 0) marks[1] = steps.length;
    push(
      current.id,
      `待确定里 ${labelOf.get(current.id)} 的暂定距离 ${dist.get(current.id)} 最小，确定它——不会再有更短的走法。`,
      4,
    );

    for (const neighbor of adjacency(edges, current.id)) {
      if (settled.includes(neighbor.id)) continue;
      const old = dist.get(neighbor.id) as number;
      const next = (dist.get(current.id) as number) + neighbor.weight;
      if (next < old) {
        dist.set(neighbor.id, next);
        prev.set(neighbor.id, current.id);
        if (marks[2] < 0) marks[2] = steps.length;
        push(
          current.id,
          `松弛 ${labelOf.get(current.id)}→${labelOf.get(neighbor.id)}：${dist.get(current.id)} + ${neighbor.weight} = ${next} < ${Number.isFinite(old) ? old : '∞'}，更新暂定距离。`,
          6,
        );
      } else {
        push(
          current.id,
          `松弛 ${labelOf.get(current.id)}→${labelOf.get(neighbor.id)}：${dist.get(current.id)} + ${neighbor.weight} = ${next}，不短于 ${old}，保持不变。`,
          6,
        );
      }
    }
  }

  const path: string[] = [];
  let cursor: string | null = target;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  if (path[0] !== source) path.length = 0;

  push(
    null,
    path.length > 0
      ? `从 ${labelOf.get(source)} 到 ${labelOf.get(target)} 的最短距离是 ${dist.get(target)}，路径 ${path.map((id) => labelOf.get(id)).join(' → ')}。`
      : `从 ${labelOf.get(source)} 出发到不了 ${labelOf.get(target)}。`,
    7,
    true,
  );
  marks[3] = steps.length - 1;

  const final = steps[steps.length - 1];
  if (final.state.kind === 'graph') final.state.path = path;
  return { steps, marks };
}

/* ------------------------------------------------------------------ */
/* 左页文案                                                            */
/* ------------------------------------------------------------------ */

interface Spec {
  title: string;
  chapter: string;
  section: string;
  kicker: string;
  figNo: string;
  pages: [number, number];
  summary: string;
  body: string[];
  formula: string;
  complexity: { time: string; space: string };
  code: string[];
  note: string;
  question: string;
  figure: string;
  facts: { label: string; value: string }[];
  outline: { label: string; value: string }[];
}

const BFS_SPEC: Spec = {
  title: '广度优先',
  chapter: 'CH.05 / GRAPHS — BFS',
  section: '第五讲 · 图与最短路',
  kicker: 'BREADTH-FIRST SEARCH',
  figNo: '5.1',
  pages: [22, 23],
  summary: '从起点一圈圈向外扩散：先访问距离 1 的节点，再是距离 2 的；队列保证先发现先访问。',
  body: [
    '图没有「父亲」可以依靠，所以遍历要自己记住哪些节点已经发现。BFS 用队列保存「已发现、还没访问」的节点：每次从队首取出一个访问，再把它所有没见过的邻居放到队尾。',
    '先进先出带来一个关键性质：节点按到起点的边数分层入队，离起点近的一定先入队。所以 BFS 第一次访问某个节点时，走的已经是边数最少的路径。',
  ],
  formula: 'T(V, E) = O(V + E)',
  complexity: { time: 'O(V + E)', space: 'O(V)' },
  code: [
    'function bfs(g, s):',
    '  q = [s]; seen = {s}',
    '  while q not empty:',
    '    u = q.shift(); visit(u)',
    '    for v in g[u]:',
    '      if v not in seen:',
    '        seen.add(v); q.push(v)',
  ],
  note: '为什么 BFS 能求无权图的最短路？队列按层入队，第一次到达某个节点时，之前不可能有更短的路径。',
  question: '追问一句：为什么 BFS 第一次访问节点时，路径一定最短？',
  figure: 'BREADTH-FIRST SEARCH',
  facts: [
    { label: '节点', value: '7' },
    { label: '边', value: '7' },
    { label: '用的结构', value: '队列' },
  ],
  outline: [
    { label: '起点入队', value: 'enqueue' },
    { label: '出队访问', value: 'shift' },
    { label: '邻居入队', value: 'discover' },
    { label: '队列清空', value: 'done' },
  ],
};

const DIJKSTRA_SPEC: Spec = {
  title: 'Dijkstra',
  chapter: 'CH.05 / GRAPHS — SHORTEST PATH',
  section: '第五讲 · 图与最短路',
  kicker: 'SHORTEST PATH',
  figNo: '5.2',
  pages: [24, 25],
  summary: '每轮挑出暂定距离最小的节点确定它，再用它去修正邻居的暂定距离，直到终点被确定。',
  body: [
    'Dijkstra 维护一组暂定距离：起点是 0，其余先当作无穷大。每一轮，从还没确定的节点里挑暂定距离最小的那个——所有边权非负，绕路只会更长，所以它的距离不可能再变小。',
    '确定一个节点后，用它去「松弛」邻居：如果经过它走到邻居更近，就更新邻居的暂定距离。重复挑最小和松弛，直到终点被确定，路径也随之定下来。',
  ],
  formula: 'dist[v] = \\min(dist[v], dist[u] + w(u, v))',
  complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  code: [
    'function dijkstra(g, s):',
    '  dist = {v: ∞}; dist[s] = 0',
    '  pq = [(0, s)]',
    '  while pq not empty:',
    '    (d, u) = pq.popMin(); if d > dist[u]: continue',
    '    for (v, w) in g[u]:',
    '      if dist[u] + w < dist[v]:',
    '        dist[v] = dist[u] + w; pq.push((dist[v], v))',
  ],
  note: '为什么暂定距离最小的节点可以立刻确定？边权非负，任何绕路的走法都只会更长，没有别的路径能超过它。',
  question: '追问一句：为什么 Dijkstra 要求边权非负？',
  figure: 'SHORTEST PATH',
  facts: [
    { label: '节点', value: '6' },
    { label: '边', value: '9' },
    { label: '边权', value: '非负' },
  ],
  outline: [
    { label: '初始化', value: 'init' },
    { label: '选最小', value: 'settle' },
    { label: '松弛邻居', value: 'relax' },
    { label: '最短路径', value: 'path' },
  ],
};

function sceneFor(kind: 'bfs' | 'dijkstra', params: Params): Scene {
  const spec = kind === 'bfs' ? BFS_SPEC : DIJKSTRA_SPEC;
  const start = clampInt(params.start, 0, 0, 1);
  const built =
    kind === 'bfs'
      ? bfsSteps(BFS_NODES, BFS_EDGES, start === 0 ? 'A' : 'D')
      : dijkstraSteps(DIJKSTRA_NODES, DIJKSTRA_EDGES, start === 0 ? 'S' : 'A', 'T');

  return validateScene({
    id: kind,
    title: spec.title,
    chapter: spec.chapter,
    section: spec.section,
    kicker: spec.kicker,
    figNo: spec.figNo,
    pages: spec.pages,
    layout: 'graph',
    category: 'graph',
    summary: spec.summary,
    body: spec.body,
    formula: spec.formula,
    complexity: spec.complexity,
    code: spec.code,
    note: spec.note,
    question: spec.question,
    figure: spec.figure,
    facts: spec.facts,
    outline: spec.outline.map((item, i) => ({ ...item, step: built.marks[i] >= 0 ? built.marks[i] : 0 })),
    params: [
      {
        key: 'start',
        label: '起点',
        kind: 'enum',
        default: 0,
        min: 0,
        max: 1,
        options: kind === 'bfs'
          ? [
              { value: 0, label: 'A' },
              { value: 1, label: 'D' },
            ]
          : [
              { value: 0, label: 'S' },
              { value: 1, label: 'A' },
            ],
      },
    ],
    source: 'builtin',
    steps: built.steps,
  });
}

export const bfsScene = (params: Params = {}) => sceneFor('bfs', params);
export const dijkstraScene = (params: Params = {}) => sceneFor('dijkstra', params);
