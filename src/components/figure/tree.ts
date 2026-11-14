import type { TreeNode, TreeState } from '../../lib/dsl';
import { BLUE, FONT_MONO, INK, MUTED, ORANGE, PAPER } from './plate';
import { drawStrip } from './strip';

export interface PlacedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
}

export interface TreeLayout {
  placed: PlacedNode[];
  byId: Map<string, PlacedNode>;
  radius: number;
}

const PAD_X = 40;
const PAD_TOP = 26;
/** 底部留给「队列 / 栈」的游标条。 */
const PAD_BOTTOM = 58;

/**
 * 层序布局：按中序给横向槽位（左子树 → 节点 → 右子树），按深度给纵向层高。
 * 坐标完全由渲染器算，模型只给「谁是谁的孩子、先访问谁」。
 */
export function layoutTree(nodes: TreeNode[], W: number, H: number): TreeLayout {
  const root = nodes.find((node) => node.parent === null) ?? nodes[0];
  const children = new Map<string, TreeNode[]>();
  nodes.forEach((node) => {
    if (!node.parent) return;
    const list = children.get(node.parent) ?? [];
    list.push(node);
    children.set(node.parent, list);
  });
  const bySide = (a: TreeNode, b: TreeNode) => (a.side === 'L' ? 0 : 1) - (b.side === 'L' ? 0 : 1);
  children.forEach((list) => list.sort(bySide));

  const slot = new Map<string, number>();
  const depth = new Map<string, number>();
  let cursor = 0;
  const walk = (node: TreeNode, d: number) => {
    depth.set(node.id, d);
    const kids = children.get(node.id) ?? [];
    kids.filter((kid) => kid.side === 'L').forEach((kid) => walk(kid, d + 1));
    slot.set(node.id, cursor++);
    kids.filter((kid) => kid.side === 'R').forEach((kid) => walk(kid, d + 1));
  };
  if (root) walk(root, 0);

  const slots = Math.max(1, cursor);
  const levels = Math.max(1, ...[...depth.values()].map((d) => d + 1));
  const innerW = Math.max(60, W - PAD_X * 2);
  const innerH = Math.max(60, H - PAD_TOP - PAD_BOTTOM);
  const stepX = slots > 1 ? Math.min(90, innerW / (slots - 1)) : 0;
  const stepY = levels > 1 ? Math.min(112, innerH / (levels - 1)) : 0;
  const originX = (W - stepX * (slots - 1)) / 2;
  const originY = PAD_TOP + (innerH - stepY * (levels - 1)) / 2;
  const radius = Math.max(9, Math.min(17, stepX ? stepX * 0.3 : 15, stepY ? stepY * 0.28 : 15));

  const placed: PlacedNode[] = nodes.map((node) => {
    const s = slot.get(node.id) ?? 0;
    const d = depth.get(node.id) ?? 0;
    return { id: node.id, label: node.label, x: originX + s * stepX, y: originY + d * stepY, depth: d };
  });

  return { placed, byId: new Map(placed.map((node) => [node.id, node])), radius };
}

/** 树图版：细线连边、已访问填墨、当前朱砂圈、待访问蓝色虚线、底部队列/栈。 */
export function drawTree(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: TreeState,
  prev: TreeState,
  k: number,
): void {
  const layout = layoutTree(state.nodes, W, H);
  const visited = new Set(state.order ?? []);
  const previous = new Set(prev.order ?? []);
  const frontier = new Set(state.frontier ?? []);

  state.nodes.forEach((node) => {
    if (!node.parent) return;
    const from = layout.byId.get(node.parent);
    const to = layout.byId.get(node.id);
    if (!from || !to) return;
    const lit = visited.has(node.parent) && visited.has(node.id);
    ctx.strokeStyle = lit ? 'rgba(21,21,21,.5)' : 'rgba(21,21,21,.22)';
    ctx.lineWidth = lit ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  state.nodes.forEach((node) => {
    const placed = layout.byId.get(node.id);
    if (!placed) return;
    const isVisited = visited.has(node.id);
    const isNew = isVisited && !previous.has(node.id);
    const alpha = isNew ? 0.45 + 0.55 * k : 1;
    const isCurrent = state.current === node.id;
    const isFrontier = frontier.has(node.id) && !isVisited;

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.arc(placed.x, placed.y, layout.radius, 0, Math.PI * 2);
    ctx.fillStyle = isVisited ? INK : PAPER;
    ctx.fill();

    if (isFrontier) {
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = isVisited ? INK : MUTED;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    if (isCurrent) {
      ctx.globalAlpha = alpha * (0.45 + 0.55 * k);
      ctx.beginPath();
      ctx.arc(placed.x, placed.y, layout.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = alpha;
    }

    ctx.fillStyle = isVisited ? PAPER : INK;
    ctx.font = `600 ${Math.round(layout.radius * 1.02)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, placed.x, placed.y + 0.5);
    ctx.restore();
  });

  const label = state.frontierLabel ?? '队列';
  const items = (state.frontier ?? []).map(
    (id) => state.nodes.find((candidate) => candidate.id === id)?.label ?? id,
  );
  drawStrip(ctx, W, H, items, label, label === '队列' ? 0 : items.length - 1);
}
