import { z } from 'zod';

/**
 * Scene DSL v2：一步 = 讲解文本 + 一份「图版状态」。
 * 图版状态按 kind 判别，数组 / 树 / 图 / 时序共用同一套播放器与标尺。
 */

/** 有限数值（挡住 NaN / Infinity 进画布）。 */
const finiteNumber = z.number().min(-1e6).max(1e6);

const identifier = z.string().min(1).max(24);
const shortLabel = z.string().min(1).max(12);

/* ------------------------------------------------------------------ */
/* 四种图版状态                                                        */
/* ------------------------------------------------------------------ */

export const arrayStateSchema = z.object({
  kind: z.literal('array'),
  values: z.array(finiteNumber).min(2).max(64),
  pivot: z.number().int().nullable(),
  compare: z.number().int().nullable(),
  swap: z.tuple([z.number().int(), z.number().int()]).nullable(),
  locked: z.array(z.number().int()).max(64),
  range: z.tuple([z.number().int(), z.number().int()]),
  /** 归并排序的左右辅助段：values 是被写回的原数组，这里给出两段来源与指针。 */
  aux: z
    .object({
      left: z.array(finiteNumber).max(64),
      right: z.array(finiteNumber).max(64),
      i: z.number().int().min(0).max(64),
      j: z.number().int().min(0).max(64),
      target: z.number().int().min(0).max(63),
    })
    .optional(),
});

export const treeNodeSchema = z.object({
  id: identifier,
  label: shortLabel,
  parent: identifier.nullable(),
  side: z.enum(['L', 'R']).optional(),
});

export const treeStateSchema = z.object({
  kind: z.literal('tree'),
  nodes: z.array(treeNodeSchema).min(1).max(31),
  order: z.array(identifier).max(31).optional(),
  current: identifier.nullable().optional(),
  frontier: z.array(identifier).max(31).optional(),
  frontierLabel: z.string().min(1).max(8).optional(),
});

export const graphStateSchema = z.object({
  kind: z.literal('graph'),
  nodes: z.array(z.object({ id: identifier, label: shortLabel })).min(1).max(20),
  edges: z
    .array(
      z.object({
        from: identifier,
        to: identifier,
        weight: finiteNumber.positive().optional(),
        directed: z.boolean().optional(),
      }),
    )
    .max(64),
  visited: z.array(identifier).max(20).optional(),
  frontier: z.array(identifier).max(20).optional(),
  path: z.array(identifier).max(20).optional(),
  current: identifier.nullable().optional(),
  /** 节点旁的小字（Dijkstra 的暂定距离）。value 用字符串，好放 ∞。 */
  dist: z.array(z.object({ id: identifier, value: z.string().min(1).max(6) })).max(20).optional(),
  /** 底部游标条的标题：队列 / 已确定 / 待确定。 */
  frontierLabel: z.string().min(1).max(8).optional(),
});

export const sequenceStateSchema = z.object({
  kind: z.literal('sequence'),
  lanes: z.array(z.object({ id: z.string().min(1).max(16), label: z.string().min(1).max(16) })).min(2).max(5),
  messages: z
    .array(
      z.object({
        id: identifier,
        from: z.string().min(1).max(16),
        to: z.string().min(1).max(16),
        label: z.string().min(1).max(24),
        tone: z.enum(['syn', 'ack', 'data', 'fin', 'lost']).optional(),
        lost: z.boolean().optional(),
      }),
    )
    .max(12),
  active: z.string().nullable().optional(),
  notes: z.array(z.object({ lane: z.string().min(1).max(16), text: z.string().min(1).max(40) })).max(5).optional(),
});

export const stepStateSchema = z.discriminatedUnion('kind', [
  arrayStateSchema,
  treeStateSchema,
  graphStateSchema,
  sequenceStateSchema,
]);

export const stepSchema = z.object({
  caption: z.string().min(1).max(160),
  codeLine: z.number().int().min(0),
  durationMs: z.number().int().min(200).max(5000).optional(),
  state: stepStateSchema,
  metrics: z
    .array(z.object({ label: z.string().min(1).max(8), value: z.string().min(1).max(12) }))
    .max(3)
    .optional(),
  doneAll: z.boolean().optional(),
});

/** 参数注记：内置引擎按参数即时重算；enum 用 options 表示。 */
export const paramSpecSchema = z.object({
  key: z.string().min(1).max(12),
  label: z.string().min(1).max(12),
  kind: z.enum(['int', 'enum']),
  default: z.number().int(),
  min: z.number().int(),
  max: z.number().int(),
  options: z.array(z.object({ value: z.number().int(), label: z.string().min(1).max(12) })).min(2).max(4).optional(),
});

export const outlineItemSchema = z.object({
  label: z.string().min(1).max(16),
  value: z.string().min(1).max(24),
  step: z.number().int().min(0).optional(),
});

export const sceneSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().min(1).max(40),
  chapter: z.string().min(1).max(60),
  section: z.string().min(1).max(60),
  kicker: z.string().min(1).max(40),
  figNo: z.string().min(1).max(10),
  pages: z.tuple([z.number().int().min(1), z.number().int().min(2)]),
  layout: z.enum(['array', 'tree', 'graph', 'sequence']),
  category: z.enum(['sort', 'search', 'tree', 'graph', 'network', 'other']),
  summary: z.string().min(1).max(160),
  body: z.array(z.string().min(1).max(400)).min(1).max(4),
  formula: z.string().min(1).max(120),
  complexity: z.object({ time: z.string().min(1).max(24), space: z.string().min(1).max(24) }),
  code: z.array(z.string().min(1).max(120)).min(1).max(12),
  note: z.string().min(1).max(400),
  question: z.string().min(1).max(160),
  figure: z.string().min(1).max(40),
  facts: z.array(z.object({ label: z.string().min(1).max(16), value: z.string().min(1).max(24) })).length(3),
  /** 缩写注释：给零基础读者的术语表，协议 / 网络场景用。 */
  glossary: z
    .array(z.object({ term: z.string().min(1).max(16), text: z.string().min(1).max(60) }))
    .max(10)
    .optional(),
  outline: z.array(outlineItemSchema).length(4),
  steps: z.array(stepSchema).min(1).max(120),
  params: z.array(paramSpecSchema).max(4),
  source: z.enum(['builtin', 'ai']),
});

export type ArrayState = z.infer<typeof arrayStateSchema>;
export type TreeNode = z.infer<typeof treeNodeSchema>;
export type TreeState = z.infer<typeof treeStateSchema>;
export type GraphState = z.infer<typeof graphStateSchema>;
export type SequenceState = z.infer<typeof sequenceStateSchema>;
export type StepState = z.infer<typeof stepStateSchema>;
export type Step = z.infer<typeof stepSchema>;
export type ParamSpec = z.infer<typeof paramSpecSchema>;
export type Scene = z.infer<typeof sceneSchema>;

/** 结构化校验错误：path + message，可直接回喂模型做修复。 */
export interface SceneIssue {
  path: string;
  message: string;
}

export class SceneIssueError extends Error {
  readonly issues: SceneIssue[];

  constructor(issues: SceneIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
    this.name = 'SceneIssueError';
    this.issues = issues;
  }
}

/* ------------------------------------------------------------------ */
/* 业务规则：Schema 管结构，这里管引用完整性与几何合法性               */
/* ------------------------------------------------------------------ */

function checkIndexes(state: ArrayState, path: string, issues: SceneIssue[]): void {
  const n = state.values.length;
  const check = (index: number, label: string) => {
    if (!Number.isInteger(index) || index < 0 || index >= n) {
      issues.push({ path: `${path}.${label}`, message: `下标 ${index} 超出 [0, ${n - 1}]` });
    }
  };

  if (state.pivot !== null) check(state.pivot, 'pivot');
  if (state.compare !== null) check(state.compare, 'compare');
  state.locked.forEach((index, k) => check(index, `locked[${k}]`));
  if (state.swap) {
    check(state.swap[0], 'swap[0]');
    check(state.swap[1], 'swap[1]');
  }

  const [l, r] = state.range;
  if (l < 0 || r >= n || l > r) {
    issues.push({ path: `${path}.range`, message: `区间 [${l}, ${r}] 非法（要求 0 ≤ l ≤ r ≤ ${n - 1}）` });
  }

  if (state.aux) {
    const { left, right, i, j, target } = state.aux;
    if (i > left.length) {
      issues.push({ path: `${path}.aux.i`, message: `左段指针 ${i} 超出 [0, ${left.length}]` });
    }
    if (j > right.length) {
      issues.push({ path: `${path}.aux.j`, message: `右段指针 ${j} 超出 [0, ${right.length}]` });
    }
    check(target, 'aux.target');
  }
}

function checkTree(state: TreeState, path: string, issues: SceneIssue[]): void {
  const ids = new Set<string>();
  state.nodes.forEach((node, k) => {
    if (ids.has(node.id)) {
      issues.push({ path: `${path}.nodes[${k}].id`, message: `节点 id 重复：${node.id}` });
    }
    ids.add(node.id);
  });

  const roots = state.nodes.filter((node) => node.parent === null);
  if (roots.length !== 1) {
    issues.push({ path: `${path}.nodes`, message: `根节点必须唯一，当前 ${roots.length} 个` });
  }

  const slots = new Set<string>();
  state.nodes.forEach((node, k) => {
    if (node.parent === null) {
      if (node.side) {
        issues.push({ path: `${path}.nodes[${k}].side`, message: '根节点不应有 side' });
      }
      return;
    }
    if (!node.side) {
      issues.push({ path: `${path}.nodes[${k}].side`, message: `节点 ${node.id} 缺少 side（L/R）` });
    } else {
      const key = `${node.parent}:${node.side}`;
      if (slots.has(key)) {
        issues.push({ path: `${path}.nodes[${k}].side`, message: `父节点 ${node.parent} 的 ${node.side} 子位重复占用` });
      }
      slots.add(key);
    }
    if (!ids.has(node.parent)) {
      issues.push({ path: `${path}.nodes[${k}].parent`, message: `父节点 ${node.parent} 不存在` });
    }
  });

  state.nodes.forEach((node) => {
    const seen = new Set<string>();
    let cursor: string | null = node.id;
    while (cursor) {
      if (seen.has(cursor)) {
        issues.push({ path: `${path}.nodes`, message: `检测到环：${node.id} 的父链回到自身` });
        return;
      }
      seen.add(cursor);
      const parent: string | null = state.nodes.find((candidate) => candidate.id === cursor)?.parent ?? null;
      cursor = parent;
    }
  });

  const ref = (id: string | null | undefined, label: string) => {
    if (id && !ids.has(id)) {
      issues.push({ path: `${path}.${label}`, message: `引用了不存在的节点 ${id}` });
    }
  };
  ref(state.current, 'current');
  state.frontier?.forEach((id, k) => ref(id, `frontier[${k}]`));
  state.order?.forEach((id, k) => ref(id, `order[${k}]`));
}

function checkGraph(state: GraphState, path: string, issues: SceneIssue[]): void {
  const ids = new Set<string>();
  state.nodes.forEach((node, k) => {
    if (ids.has(node.id)) {
      issues.push({ path: `${path}.nodes[${k}].id`, message: `节点 id 重复：${node.id}` });
    }
    ids.add(node.id);
  });

  state.edges.forEach((edge, k) => {
    if (!ids.has(edge.from)) {
      issues.push({ path: `${path}.edges[${k}].from`, message: `边的起点 ${edge.from} 不存在` });
    }
    if (!ids.has(edge.to)) {
      issues.push({ path: `${path}.edges[${k}].to`, message: `边的终点 ${edge.to} 不存在` });
    }
    if (edge.from === edge.to) {
      issues.push({ path: `${path}.edges[${k}]`, message: '不允许自环' });
    }
  });

  const ref = (id: string | null | undefined, label: string) => {
    if (id && !ids.has(id)) {
      issues.push({ path: `${path}.${label}`, message: `引用了不存在的节点 ${id}` });
    }
  };
  ref(state.current, 'current');
  state.visited?.forEach((id, k) => ref(id, `visited[${k}]`));
  state.frontier?.forEach((id, k) => ref(id, `frontier[${k}]`));
  state.path?.forEach((id, k) => ref(id, `path[${k}]`));

  const seenDist = new Set<string>();
  state.dist?.forEach((entry, k) => {
    ref(entry.id, `dist[${k}].id`);
    if (seenDist.has(entry.id)) {
      issues.push({ path: `${path}.dist[${k}].id`, message: `距离重复标注了节点 ${entry.id}` });
    }
    seenDist.add(entry.id);
  });
}

function checkSequence(state: SequenceState, path: string, issues: SceneIssue[]): void {
  const laneIds = new Set<string>();
  state.lanes.forEach((lane, k) => {
    if (laneIds.has(lane.id)) {
      issues.push({ path: `${path}.lanes[${k}].id`, message: `泳道 id 重复：${lane.id}` });
    }
    laneIds.add(lane.id);
  });

  const messageIds = new Set<string>();
  state.messages.forEach((message, k) => {
    if (messageIds.has(message.id)) {
      issues.push({ path: `${path}.messages[${k}].id`, message: `消息 id 重复：${message.id}` });
    }
    messageIds.add(message.id);
    if (!laneIds.has(message.from)) {
      issues.push({ path: `${path}.messages[${k}].from`, message: `消息起点 ${message.from} 不在泳道里` });
    }
    if (!laneIds.has(message.to)) {
      issues.push({ path: `${path}.messages[${k}].to`, message: `消息终点 ${message.to} 不在泳道里` });
    }
  });

  if (state.active && !messageIds.has(state.active)) {
    issues.push({ path: `${path}.active`, message: `active 指向不存在的消息 ${state.active}` });
  }
  state.notes?.forEach((note, k) => {
    if (!laneIds.has(note.lane)) {
      issues.push({ path: `${path}.notes[${k}].lane`, message: `注记泳道 ${note.lane} 不存在` });
    }
  });
}

function collectIssues(scene: Scene): SceneIssue[] {
  const issues: SceneIssue[] = [];
  let arrayLength: number | null = null;
  let previousTree: Map<string, string | null> | null = null;

  const paramKeys = new Set<string>();
  scene.params.forEach((param, i) => {
    const path = `params[${i}]`;
    if (paramKeys.has(param.key)) {
      issues.push({ path: `${path}.key`, message: `参数 key 重复：${param.key}` });
    }
    paramKeys.add(param.key);

    if (param.kind === 'enum') {
      if (!param.options || param.options.length < 2) {
        issues.push({ path: `${path}.options`, message: 'enum 参数至少需要 2 个选项' });
      } else if (!param.options.some((option) => option.value === param.default)) {
        issues.push({ path: `${path}.default`, message: `默认值 ${param.default} 不在 options 里` });
      }
    } else {
      if (param.min > param.max) {
        issues.push({ path, message: `min ${param.min} 大于 max ${param.max}` });
      }
      if (param.default < param.min || param.default > param.max) {
        issues.push({ path: `${path}.default`, message: `默认值 ${param.default} 不在 [${param.min}, ${param.max}]` });
      }
    }
  });

  scene.outline.forEach((item, i) => {
    if (item.step !== undefined && (item.step < 0 || item.step >= scene.steps.length)) {
      issues.push({ path: `outline[${i}].step`, message: `步骤下标 ${item.step} 超出 0..${scene.steps.length - 1}` });
    }
  });

  const glossaryTerms = new Set<string>();
  scene.glossary?.forEach((item, i) => {
    const key = item.term.toLowerCase();
    if (glossaryTerms.has(key)) {
      issues.push({ path: `glossary[${i}].term`, message: `术语重复：${item.term}` });
    }
    glossaryTerms.add(key);
  });

  scene.steps.forEach((step, i) => {
    const path = `steps[${i}].state`;
    const state = step.state;

    if (state.kind !== scene.layout) {
      issues.push({ path: `${path}.kind`, message: `场景 layout 是 ${scene.layout}，这一步却是 ${state.kind}` });
      return;
    }

    switch (state.kind) {
      case 'array': {
        checkIndexes(state, path, issues);
        if (arrayLength === null) {
          arrayLength = state.values.length;
        } else if (state.values.length !== arrayLength) {
          issues.push({ path: `${path}.values`, message: `数组长度从 ${arrayLength} 变成了 ${state.values.length}` });
        }
        break;
      }
      case 'tree': {
        checkTree(state, path, issues);
        const current = new Map(state.nodes.map((node) => [node.id, node.parent]));
        if (previousTree) {
          previousTree.forEach((_parent, id) => {
            // 允许旋转/插入改变 parent、side，也允许新增节点；旧节点不能凭空消失。
            if (!current.has(id)) {
              issues.push({ path: `${path}.nodes`, message: `第 ${i} 步缺少之前出现过的节点 ${id}` });
            }
          });
        }
        previousTree = current;
        break;
      }
      case 'graph':
        checkGraph(state, path, issues);
        break;
      case 'sequence':
        checkSequence(state, path, issues);
        break;
    }
  });

  return issues;
}

/** 结构校验 + 业务规则；失败抛 SceneIssueError（带 path/message 列表）。 */
export function validateScene(input: unknown): Scene {
  const scene = sceneSchema.parse(input);
  const issues = collectIssues(scene);
  if (issues.length > 0) {
    throw new SceneIssueError(issues);
  }
  return scene;
}

/** 只跑业务规则（场景已通过结构校验时用）。 */
export function inspectScene(scene: Scene): SceneIssue[] {
  return collectIssues(scene);
}
