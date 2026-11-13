import { validateScene, type Scene, type Step, type TreeNode } from '../dsl';

type Traversal = 'levelorder' | 'preorder' | 'inorder';

/** 固定满二叉树：4 层 15 个节点，层序 / 前序 / 中序共用同一棵树。 */
const BST_VALUES = [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15];

function buildBst(values: number[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  const children = new Map<string, TreeNode[]>();

  values.forEach((value) => {
    const node: TreeNode = { id: `n${value}`, label: String(value), parent: null };
    if (nodes.length === 0) {
      nodes.push(node);
      return;
    }
    let cursor = nodes[0];
    for (;;) {
      const side = value < Number(cursor.label) ? 'L' : 'R';
      const kids = children.get(cursor.id) ?? [];
      const existing = kids.find((kid) => kid.side === side);
      if (!existing) {
        node.parent = cursor.id;
        node.side = side;
        kids.push(node);
        children.set(cursor.id, kids);
        nodes.push(node);
        return;
      }
      cursor = existing;
    }
  });

  return nodes;
}

function childIds(nodes: TreeNode[], id: string): string[] {
  return nodes
    .filter((node) => node.parent === id)
    .sort((a, b) => (a.side === 'L' ? 0 : 1) - (b.side === 'L' ? 0 : 1))
    .map((node) => node.id);
}

function stepsFor(traversal: Traversal, nodes: TreeNode[], rootId: string): Step[] {
  const steps: Step[] = [];
  const visited: string[] = [];
  const labelOf = new Map(nodes.map((node) => [node.id, node.label]));

  const push = (
    current: string | null,
    frontier: string[],
    caption: string,
    codeLine: number,
    doneAll = false,
  ) => {
    steps.push({
      caption,
      codeLine,
      doneAll: doneAll ? true : undefined,
      state: {
        kind: 'tree',
        nodes: nodes.map((node) => ({ ...node })),
        order: [...visited],
        current,
        frontier: [...frontier],
        frontierLabel: traversal === 'levelorder' ? '队列' : '栈',
      },
    });
  };

  if (traversal === 'levelorder') {
    const queue = [rootId];
    push(null, queue, '把根节点放入队列；队列里是「已发现、还没访问」的节点。', 2);
    while (queue.length > 0) {
      const id = queue.shift() as string;
      visited.push(id);
      push(id, queue, `队首出队 ${labelOf.get(id)}，访问第 ${visited.length} 个节点。`, 4);
      const kids = childIds(nodes, id);
      if (kids.length > 0) {
        queue.push(...kids);
        push(id, queue, `把 ${labelOf.get(id)} 的左、右孩子依次入队。`, 6);
      }
    }
    push(null, [], `遍历完成，访问顺序：${visited.map((id) => labelOf.get(id)).join(' → ')}。`, 6, true);
    return steps;
  }

  if (traversal === 'preorder') {
    const stack = [rootId];
    push(null, stack, '把根节点压入栈；栈顶就是下一个要访问的节点。', 2);
    while (stack.length > 0) {
      const id = stack.pop() as string;
      visited.push(id);
      push(id, stack, `弹出 ${labelOf.get(id)}，访问第 ${visited.length} 个节点。`, 4);
      const kids = childIds(nodes, id);
      if (kids.length > 0) {
        stack.push(...[...kids].reverse());
        push(id, stack, `先压右孩子、再压左孩子，保证左子树先出栈。`, 5);
      }
    }
    push(null, [], `遍历完成，访问顺序：${visited.map((id) => labelOf.get(id)).join(' → ')}。`, 5, true);
    return steps;
  }

  const stack: string[] = [];
  let cursor: string | null = rootId;
  push(null, stack, '从根出发一路向左，把沿途节点压栈。', 3);
  while (cursor !== null || stack.length > 0) {
    while (cursor !== null) {
      stack.push(cursor);
      push(null, stack, `压栈 ${labelOf.get(cursor)}，继续向左。`, 4);
      cursor = childIds(nodes, cursor).find((id) => nodes.find((n) => n.id === id)?.side === 'L') ?? null;
    }
    const id = stack.pop() as string;
    visited.push(id);
    push(id, stack, `栈顶弹出 ${labelOf.get(id)}，访问第 ${visited.length} 个节点。`, 5);
    const right = childIds(nodes, id).find((childId) => nodes.find((n) => n.id === childId)?.side === 'R') ?? null;
    if (right) {
      push(id, stack, `转向 ${labelOf.get(id)} 的右子树。`, 6);
    }
    cursor = right;
  }
  push(null, [], `遍历完成，访问顺序：${visited.map((id) => labelOf.get(id)).join(' → ')}。`, 6, true);
  return steps;
}

interface Spec {
  title: string;
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

const SPECS: Record<Traversal, Spec> = {
  levelorder: {
    title: '层序',
    kicker: 'LEVEL ORDER',
    figNo: '4.1',
    pages: [16, 17],
    summary: '从根开始一层一层往下，每层从左到右；队列保证先发现的节点先被访问。',
    body: [
      '层序遍历不看深度优先的顺序，它像水波一样一圈圈扩散：先把根放进队列，然后不断取出队首、访问它，再把它的孩子放到队尾。',
      '队列的先进先出，正好对应「先看到先处理」：同一层的节点一定比下一层先进队，所以整棵树是按层展开的。',
    ],
    formula: 'T(n) = O(n), S(n) = O(w)',
    complexity: { time: 'O(n)', space: 'O(w)' },
    code: [
      'function levelOrder(root):',
      '  q = [root]',
      '  while q not empty:',
      '    x = q.shift()        // 出队',
      '    visit(x)',
      '    q.push(x.left, x.right)',
    ],
    note: '为什么用队列？先进先出，保证同一层从左到右、上一层全部先于下一层被访问。',
    question: '追问一句：层序遍历为什么用队列，而不用栈？',
    figure: 'LEVEL ORDER',
    facts: [
      { label: '时间', value: 'O(n)' },
      { label: '额外空间', value: 'O(宽度)' },
      { label: '用的结构', value: '队列' },
    ],
    outline: [
      { label: '根入队', value: 'enqueue' },
      { label: '取队首', value: 'shift' },
      { label: '访问', value: 'visit' },
      { label: '孩子入队', value: 'expand' },
    ],
  },
  preorder: {
    title: '前序',
    kicker: 'PREORDER',
    figNo: '4.2',
    pages: [18, 19],
    summary: '先访问根，再递归左子树，最后右子树；用栈模拟递归，右孩子先压、左孩子后压。',
    body: [
      '前序的顺序是「根 → 左 → 右」：手里拿到一个节点，先记下它，再往左走，左边走完了才轮到右边。',
      '用栈模拟时顺序要反过来：想让左孩子先出栈，就得让右孩子先进栈。栈的后进先出，把递归的「回来再走右边」变成了显式的待办列表。',
    ],
    formula: 'T(n) = O(n), S(n) = O(h)',
    complexity: { time: 'O(n)', space: 'O(h)' },
    code: [
      'function preorder(root):',
      '  st = [root]',
      '  while st not empty:',
      '    x = st.pop(); visit(x)',
      '    st.push(x.right); st.push(x.left)',
    ],
    note: '为什么先压右孩子？栈是后进先出，左孩子后进栈才能先被弹出，访问顺序才是根左右。',
    question: '追问一句：前序为什么先压右孩子，再压左孩子？',
    figure: 'PREORDER',
    facts: [
      { label: '时间', value: 'O(n)' },
      { label: '额外空间', value: 'O(树高)' },
      { label: '用的结构', value: '栈' },
    ],
    outline: [
      { label: '根入栈', value: 'push' },
      { label: '弹栈访问', value: 'pop' },
      { label: '右孩子入栈', value: 'right' },
      { label: '左孩子入栈', value: 'left' },
    ],
  },
  inorder: {
    title: '中序',
    kicker: 'INORDER',
    figNo: '4.3',
    pages: [20, 21],
    summary: '一路向左压栈，左边走不动了就弹栈访问，再转向右子树；二叉搜索树的中序输出是升序。',
    body: [
      '中序的顺序是「左 → 根 → 右」。所以先不访问根，而是一路向左把节点压进栈，直到没有左孩子为止。',
      '这时栈顶就是最左的节点，弹出访问；再转向它的右子树，重复同样的过程。对二叉搜索树来说，这个顺序恰好是从小到大。',
    ],
    formula: 'T(n) = O(n), S(n) = O(h)',
    complexity: { time: 'O(n)', space: 'O(h)' },
    code: [
      'function inorder(root):',
      '  st = []; x = root',
      '  while x or st:',
      '    while x: st.push(x); x = x.left',
      '    x = st.pop(); visit(x)',
      '    x = x.right',
    ],
    note: '为什么中序是升序？左子树的键都更小，先走完左子树，再访问根，最后走更大的右子树。',
    question: '追问一句：二叉搜索树的中序遍历为什么是升序？',
    figure: 'INORDER',
    facts: [
      { label: '时间', value: 'O(n)' },
      { label: 'BST 输出', value: '升序' },
      { label: '额外空间', value: 'O(树高)' },
    ],
    outline: [
      { label: '一路向左', value: 'push' },
      { label: '弹栈访问', value: 'pop' },
      { label: '转向右子树', value: 'right' },
      { label: 'BST 有序', value: 'sorted' },
    ],
  },
};

function sceneFor(traversal: Traversal): Scene {
  const spec = SPECS[traversal];
  const nodes = buildBst(BST_VALUES);
  return validateScene({
    id: traversal,
    title: spec.title,
    chapter: `CH.04 / TREES — ${spec.kicker}`,
    section: '第四讲 · 树与遍历',
    kicker: spec.kicker,
    figNo: spec.figNo,
    pages: spec.pages,
    layout: 'tree',
    category: 'tree',
    summary: spec.summary,
    body: spec.body,
    formula: spec.formula,
    complexity: spec.complexity,
    code: spec.code,
    note: spec.note,
    question: spec.question,
    figure: spec.figure,
    facts: spec.facts,
    outline: spec.outline,
    source: 'builtin',
    steps: stepsFor(traversal, nodes, nodes[0].id),
  });
}

export const levelOrderScene = () => sceneFor('levelorder');
export const preOrderScene = () => sceneFor('preorder');
export const inOrderScene = () => sceneFor('inorder');

/** 供单测核对遍历顺序。 */
export const TRAVERSAL_EXPECTED: Record<Traversal, number[]> = {
  levelorder: [8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15],
  preorder: [8, 4, 2, 1, 3, 6, 5, 7, 12, 10, 9, 11, 14, 13, 15],
  inorder: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
};
