import { describe, expect, it } from 'vitest';
import { routeScene, SCENES } from './engines';
import { TRAVERSAL_EXPECTED } from './engines/tree';
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

describe('sorting scenes', () => {
  it.each(SORT_IDS)('%s: schema valid and ends sorted', (id) => {
    const scene = validateScene(SCENES[id]);
    const last = scene.steps[scene.steps.length - 1];
    const state = arrayState(last);
    expect(last.doneAll).toBe(true);
    expect(state.values).toEqual([...state.values].sort((a, b) => a - b));
    expect(state.values).toHaveLength(10);
  });

  it.each(SORT_IDS)('%s: every step keeps the array length', (id) => {
    for (const step of SCENES[id].steps) {
      expect(arrayState(step).values).toHaveLength(10);
    }
  });
});

describe('tree scenes', () => {
  it.each(TREE_IDS)('%s: schema valid and visits every node in order', (id) => {
    const scene = validateScene(SCENES[id]);
    const last = treeState(scene.steps[scene.steps.length - 1]);
    const visited = (last.order ?? []).map((nodeId) => Number(nodeId.slice(1)));
    expect(visited).toEqual(TRAVERSAL_EXPECTED[id]);
    expect(last.nodes).toHaveLength(15);
    expect(last.current).toBeNull();
    expect(last.frontier).toEqual([]);
  });

  it.each(TREE_IDS)('%s: step count stays inside the DSL limit', (id) => {
    const scene = SCENES[id];
    expect(scene.steps.length).toBeGreaterThan(15);
    expect(scene.steps.length).toBeLessThanOrEqual(120);
    expect(scene.layout).toBe('tree');
  });

  it('preorder follows 根 → 左 → 右', () => {
    const scene = SCENES.preorder;
    const order = treeState(scene.steps[scene.steps.length - 1]).order ?? [];
    expect(order.slice(0, 7)).toEqual(['n8', 'n4', 'n2', 'n1', 'n3', 'n6', 'n5']);
  });

  it('inorder on a BST is ascending', () => {
    const scene = SCENES.inorder;
    const labels = (treeState(scene.steps[scene.steps.length - 1]).order ?? []).map((id) => Number(id.slice(1)));
    expect(labels).toEqual([...labels].sort((a, b) => a - b));
  });
});

describe('scene validator', () => {
  it('accepts all built-in scenes', () => {
    for (const scene of Object.values(SCENES)) {
      expect(() => validateScene(scene)).not.toThrow();
    }
  });

  it('rejects an array index outside the range', () => {
    const scene = clone<Scene>(SCENES.quick);
    const state = scene.steps[1].state;
    if (state.kind !== 'array') throw new Error('expected array');
    state.compare = 99;
    expect(issueMessages(scene).join('\n')).toContain('下标 99 超出');
  });

  it('rejects a dangling tree parent', () => {
    const scene = clone<Scene>(SCENES.inorder);
    const state = treeState(scene.steps[0]);
    state.nodes[1].parent = 'n999';
    expect(issueMessages(scene).join('\n')).toContain('父节点 n999 不存在');
  });

  it('rejects a duplicate root', () => {
    const scene = clone<Scene>(SCENES.inorder);
    const state = treeState(scene.steps[0]);
    const node = state.nodes.find((candidate) => candidate.id === 'n4');
    if (!node) throw new Error('missing node');
    node.parent = null;
    expect(issueMessages(scene).join('\n')).toContain('根节点必须唯一');
  });

  it('rejects a cycle in the parent chain', () => {
    const scene = clone<Scene>(SCENES.inorder);
    const state = treeState(scene.steps[0]);
    const root = state.nodes.find((candidate) => candidate.id === 'n8');
    if (!root) throw new Error('missing root');
    root.parent = 'n1';
    expect(issueMessages(scene).join('\n')).toContain('检测到环');
  });

  it('rejects two children occupying the same side', () => {
    const scene = clone<Scene>(SCENES.preorder);
    const state = treeState(scene.steps[0]);
    const node = state.nodes.find((candidate) => candidate.id === 'n7');
    if (!node) throw new Error('missing node');
    node.side = 'L';
    expect(issueMessages(scene).join('\n')).toContain('子位重复占用');
  });

  it('rejects a step whose figure kind does not match the layout', () => {
    const scene = clone<Scene>(SCENES.inorder);
    scene.layout = 'array';
    expect(issueMessages(scene).join('\n')).toContain('场景 layout 是 array');
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
        { label: 'SYN', value: 'c→s' },
        { label: 'SYN-ACK', value: 's→c' },
        { label: 'ACK', value: 'c→s' },
        { label: '连接', value: 'open' },
      ],
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
