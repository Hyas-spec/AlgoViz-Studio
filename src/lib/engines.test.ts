import { describe, expect, it } from 'vitest';
import {
  createScene,
  isSceneId,
  routeScene,
  SCENE_GROUPS,
  SCENE_LABEL,
  SCENE_ORDER,
  sceneDefaults,
  type SceneId,
} from './engines';
import { SceneIssueError, sceneSchema, validateScene, type Scene, type Step } from './dsl';

const SORT_IDS = ['quick', 'bubble', 'merge'] as const;
const TREE_IDS = ['levelorder', 'preorder', 'inorder'] as const;

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const arrayState = (step: Step) => {
  if (step.state.kind !== 'array') throw new Error('expected array state');
  return step.state;
};

const treeState = (step: Step) => {
  if (step.state.kind !== 'tree') throw new Error('expected tree state');
  return step.state;
};

const issueMessages = (scene: unknown): string[] => {
  try {
    validateScene(scene);
  } catch (error) {
    if (error instanceof SceneIssueError) return error.issues.map((issue) => `${issue.path} ${issue.message}`);
    return [String(error)];
  }
  return [];
};

describe('built-in scenes', () => {
  it('exposes six scenes in two groups', () => {
    expect(SCENE_ORDER).toHaveLength(6);
    expect(SCENE_GROUPS.map((group) => group.scenes.length)).toEqual([3, 3]);
    for (const id of SCENE_ORDER) {
      expect(isSceneId(id)).toBe(true);
      expect(SCENE_LABEL[id].length).toBeGreaterThan(0);
    }
    expect(isSceneId('nope')).toBe(false);
    expect(isSceneId(null)).toBe(false);
  });

  it.each(SCENE_ORDER)('%s: default params produce a valid scene', (id) => {
    const scene = createScene(id);
    expect(() => sceneSchema.parse(scene)).not.toThrow();
    expect(scene.layout === 'tree' ? 'tree' : 'array').toBe(scene.steps[0].state.kind);
    expect(scene.steps.length).toBeLessThanOrEqual(120);
    expect(scene.params.length).toBeGreaterThan(0);
  });

  it.each(SCENE_ORDER)('%s: outline steps point inside the scene', (id) => {
    const scene = createScene(id);
    for (const item of scene.outline) {
      expect(item.step).toBeGreaterThanOrEqual(0);
      expect(item.step).toBeLessThan(scene.steps.length);
    }
  });
});

describe('sorting scenes and parameters', () => {
  it.each(SORT_IDS)('%s: default size ends sorted', (id) => {
    const scene = createScene(id);
    const last = scene.steps[scene.steps.length - 1];
    const state = arrayState(last);
    expect(last.doneAll).toBe(true);
    expect(state.values).toEqual([...state.values].sort((a, b) => a - b));
    expect(state.values).toHaveLength(10);
  });

  it.each(SORT_IDS)('%s: every supported size sorts and stays within the step limit', (id) => {
    const spec = createScene(id).params.find((param) => param.key === 'size');
    if (!spec) throw new Error('missing size param');
    for (let size = spec.min; size <= spec.max; size += 1) {
      const scene = createScene(id, { size });
      expect(scene.steps.length).toBeLessThanOrEqual(120);
      const last = scene.steps[scene.steps.length - 1];
      expect(arrayState(last).values).toEqual([...arrayState(last).values].sort((a, b) => a - b));
      expect(arrayState(last).values).toHaveLength(size);
    }
  });

  it('is deterministic for the same params', () => {
    const a = createScene('quick', { size: 12, pivot: 1 });
    const b = createScene('quick', { size: 12, pivot: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different sizes produce different samples', () => {
    expect(arrayState(createScene('quick', { size: 6 }).steps[0]).values).not.toEqual(
      arrayState(createScene('quick', { size: 10 }).steps[0]).values,
    );
  });

  it('quick sort supports the median-of-three pivot', () => {
    const scene = createScene('quick', { size: 10, pivot: 1 });
    expect(scene.steps.some((step) => step.caption.includes('三数取中'))).toBe(true);
    const last = arrayState(scene.steps[scene.steps.length - 1]);
    expect(last.values).toEqual([...last.values].sort((a, b) => a - b));
  });

  it('clamps out-of-range params instead of crashing', () => {
    const scene = createScene('bubble', { size: 999 });
    expect(arrayState(scene.steps[0]).values).toHaveLength(12);
    const tiny = createScene('quick', { size: 1 });
    expect(arrayState(tiny.steps[0]).values).toHaveLength(4);
  });

  it('exposes comparison and swap counters', () => {
    const scene = createScene('bubble');
    const last = scene.steps[scene.steps.length - 1];
    expect(last.metrics?.map((metric) => metric.label)).toEqual(['比较', '交换', '已就位']);
    expect(Number(last.metrics?.[0].value)).toBeGreaterThan(0);
  });
});

describe('tree scenes and parameters', () => {
  it.each(TREE_IDS)('%s: 4 levels visits 15 nodes', (id) => {
    const scene = createScene(id, { levels: 4 });
    const last = treeState(scene.steps[scene.steps.length - 1]);
    expect(last.nodes).toHaveLength(15);
    expect(last.order).toHaveLength(15);
    expect(last.current).toBeNull();
    expect(last.frontier).toEqual([]);
  });

  it.each(TREE_IDS)('%s: 3 levels visits 7 nodes', (id) => {
    const scene = createScene(id, { levels: 3 });
    const last = treeState(scene.steps[scene.steps.length - 1]);
    expect(last.nodes).toHaveLength(7);
    expect(last.order).toHaveLength(7);
  });

  it('level order follows insertion order on a complete BST', () => {
    const scene = createScene('levelorder', { levels: 4 });
    const order = treeState(scene.steps[scene.steps.length - 1]).order ?? [];
    expect(order.map((id) => Number(id.slice(1)))).toEqual([8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15]);
  });

  it('preorder starts at the root and stays inside the step limit', () => {
    const scene = createScene('preorder', { levels: 4 });
    const order = treeState(scene.steps[scene.steps.length - 1]).order ?? [];
    expect(order[0]).toBe('n8');
    expect(scene.steps.length).toBeLessThanOrEqual(120);
  });

  it('inorder on a BST is ascending for both levels', () => {
    for (const levels of [3, 4]) {
      const scene = createScene('inorder', { levels });
      const labels = (treeState(scene.steps[scene.steps.length - 1]).order ?? []).map((id) => Number(id.slice(1)));
      expect(labels).toEqual([...labels].sort((a, b) => a - b));
    }
  });

  it('exposes visited and frontier counters', () => {
    const scene = createScene('levelorder');
    const last = scene.steps[scene.steps.length - 1];
    expect(last.metrics?.map((metric) => metric.label)).toEqual(['已访问', '队列']);
    expect(last.metrics?.[0].value).toBe('15/15');
  });
});

describe('scene validator', () => {
  it('rejects an array index outside the range', () => {
    const scene = clone<Scene>(createScene('quick'));
    const state = scene.steps[1].state;
    if (state.kind !== 'array') throw new Error('expected array');
    state.compare = 99;
    expect(issueMessages(scene).join('\n')).toContain('下标 99 超出');
  });

  it('rejects a dangling tree parent', () => {
    const scene = clone<Scene>(createScene('inorder'));
    const state = treeState(scene.steps[0]);
    state.nodes[1].parent = 'n999';
    expect(issueMessages(scene).join('\n')).toContain('父节点 n999 不存在');
  });

  it('rejects a duplicate root', () => {
    const scene = clone<Scene>(createScene('inorder'));
    const state = treeState(scene.steps[0]);
    const node = state.nodes.find((candidate) => candidate.id === 'n4');
    if (!node) throw new Error('missing node');
    node.parent = null;
    expect(issueMessages(scene).join('\n')).toContain('根节点必须唯一');
  });

  it('rejects a cycle in the parent chain', () => {
    const scene = clone<Scene>(createScene('inorder'));
    const state = treeState(scene.steps[0]);
    const root = state.nodes.find((candidate) => candidate.id === 'n8');
    if (!root) throw new Error('missing root');
    root.parent = 'n1';
    expect(issueMessages(scene).join('\n')).toContain('检测到环');
  });

  it('rejects two children occupying the same side', () => {
    const scene = clone<Scene>(createScene('preorder'));
    const state = treeState(scene.steps[0]);
    const node = state.nodes.find((candidate) => candidate.id === 'n7');
    if (!node) throw new Error('missing node');
    node.side = 'L';
    expect(issueMessages(scene).join('\n')).toContain('子位重复占用');
  });

  it('rejects a step whose figure kind does not match the layout', () => {
    const scene = clone<Scene>(createScene('inorder'));
    scene.layout = 'array';
    expect(issueMessages(scene).join('\n')).toContain('场景 layout 是 array');
  });

  it('rejects a default outside the param range', () => {
    const scene = clone<Scene>(createScene('bubble'));
    scene.params[0].default = 99;
    expect(issueMessages(scene).join('\n')).toContain('不在 [4, 12]');
  });

  it('rejects an enum default missing from options', () => {
    const scene = clone<Scene>(createScene('quick'));
    const pivot = scene.params.find((param) => param.key === 'pivot');
    if (!pivot) throw new Error('missing pivot param');
    pivot.default = 9;
    expect(issueMessages(scene).join('\n')).toContain('不在 options 里');
  });

  it('rejects an outline step outside the scene', () => {
    const scene = clone<Scene>(createScene('quick'));
    scene.outline[0].step = 999;
    expect(issueMessages(scene).join('\n')).toContain('超出');
  });

  it('rejects a sequence message pointing at a missing lane', () => {
    const scene: Scene = {
      id: 'seq',
      title: '握手',
      chapter: 'CH.05 / NETWORK',
      section: '第五讲 · 协议',
      kicker: 'TCP',
      figNo: '5.1',
      pages: [22, 23],
      layout: 'sequence',
      category: 'network',
      summary: '三次握手',
      body: ['客户端与服务端交换三个报文。'],
      formula: 'SYN → SYN-ACK → ACK',
      complexity: { time: 'O(1)', space: 'O(1)' },
      code: ['send(SYN)'],
      note: '为什么要三次？确认双方的收发能力。',
      question: '追问一句：为什么不是两次握手？',
      figure: 'HANDSHAKE',
      facts: [
        { label: '报文数', value: '3' },
        { label: '状态', value: 'ESTABLISHED' },
        { label: '可靠', value: '是' },
      ],
      outline: [
        { label: 'SYN', value: 'c→s', step: 0 },
        { label: 'SYN-ACK', value: 's→c', step: 0 },
        { label: 'ACK', value: 'c→s', step: 0 },
        { label: '连接', value: 'open', step: 0 },
      ],
      params: [],
      source: 'builtin',
      steps: [
        {
          caption: '客户端发起 SYN。',
          codeLine: 1,
          state: {
            kind: 'sequence',
            lanes: [
              { id: 'client', label: 'Client' },
              { id: 'server', label: 'Server' },
            ],
            messages: [{ id: 'm1', from: 'client', to: 'ghost', label: 'SYN' }],
          },
        },
      ],
    };
    expect(sceneSchema.safeParse(scene).success).toBe(true);
    expect(issueMessages(scene).join('\n')).toContain('消息终点 ghost 不在泳道里');
  });
});

describe('rule router', () => {
  it('routes sorting keywords', () => {
    expect(routeScene('用冒泡排序演示')).toBe('bubble');
    expect(routeScene('归并排序怎么合并')).toBe('merge');
    expect(routeScene('快速排序的分区')).toBe('quick');
  });

  it('routes tree traversal keywords', () => {
    expect(routeScene('二叉树的层序遍历')).toBe('levelorder');
    expect(routeScene('前序遍历怎么走')).toBe('preorder');
    expect(routeScene('中序输出为什么是升序')).toBe('inorder');
    expect(routeScene('二叉树遍历')).toBe('levelorder');
  });

  it('leaves long-tail topics to the LLM', () => {
    expect(routeScene('TCP 三次握手')).toBeNull();
    expect(routeScene('Dijkstra 最短路')).toBeNull();
  });
});

describe('scene defaults', () => {
  it('returns a fresh copy per scene', () => {
    const defaults = sceneDefaults('quick');
    expect(defaults).toEqual({ size: 10, pivot: 0 });
    defaults.size = 4;
    expect(sceneDefaults('quick').size).toBe(10);
  });

  it('covers every scene id', () => {
    for (const id of SCENE_ORDER) {
      expect(sceneDefaults(id as SceneId)).toMatchObject({});
    }
  });
});
