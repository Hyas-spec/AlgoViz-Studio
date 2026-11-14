import type { GraphState } from '../../lib/dsl';
import { BLUE, FAINT, FONT_MONO, INK, MUTED, ORANGE, PAPER } from './plate';
import { drawStrip } from './strip';

interface Placed {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface GraphLayout {
  placed: Placed[];
  byId: Map<string, Placed>;
  radius: number;
  cx: number;
  cy: number;
}

const PAD_TOP = 24;
/** 底部留给游标条。 */
const PAD_BOTTOM = 58;
const PAD_X = 34;

/** 环形布局：节点按输入顺序均分在圆周上，坐标全由渲染器算。 */
export function layoutGraph(nodes: GraphState['nodes'], W: number, H: number): GraphLayout {
  const count = Math.max(1, nodes.length);
  const innerW = Math.max(80, W - PAD_X * 2);
  const innerH = Math.max(80, H - PAD_TOP - PAD_BOTTOM);
  const ring = Math.max(36, Math.min(innerW, innerH) / 2 - 26);
  const cx = W / 2;
  const cy = PAD_TOP + innerH / 2;

  const placed: Placed[] = nodes.map((node, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / count;
    return {
      id: node.id,
      label: node.label,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
    };
  });

  const radius = Math.max(11, Math.min(18, ring * 0.16));
  return { placed, byId: new Map(placed.map((node) => [node.id, node])), radius, cx, cy };
}

interface Point {
  x: number;
  y: number;
}

/** 边稍微向圆心内凹，避免多条弦在圆心处完全重叠。 */
function controlPoint(a: Point, b: Point, cx: number, cy: number): Point {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return { x: mx + (cx - mx) * 0.16, y: my + (cy - my) * 0.16 };
}

function quadAt(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, size = 5): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle - 0.45) * size, y - Math.sin(angle - 0.45) * size);
  ctx.moveTo(x, y);
  ctx.lineTo(x - Math.cos(angle + 0.45) * size, y - Math.sin(angle + 0.45) * size);
  ctx.stroke();
}

function edgeCurve(ctx: CanvasRenderingContext2D, a: Point, c: Point, b: Point): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
  ctx.stroke();
}

/** 图图版：环形节点、二次曲线边、边权标注、最短路高亮、底部游标条。 */
export function drawGraph(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: GraphState,
  prev: GraphState,
  k: number,
  fontScale = 1,
): void {
  const layout = layoutGraph(state.nodes, W, H);
  const fs = Math.min(fontScale, W < 520 ? 1.18 : 1.35);
  const visited = new Set(state.visited ?? []);
  const previous = new Set(prev.visited ?? []);
  const frontier = new Set(state.frontier ?? []);
  const path = state.path ?? [];
  const pathSet = new Set(path);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 边：两端都访问过才加深；有向边在终点画箭头。
  state.edges.forEach((edge) => {
    const from = layout.byId.get(edge.from);
    const to = layout.byId.get(edge.to);
    if (!from || !to) return;
    const lit = visited.has(edge.from) && visited.has(edge.to);
    ctx.strokeStyle = lit ? 'rgba(21,21,21,.55)' : 'rgba(21,21,21,.3)';
    ctx.lineWidth = lit ? 1.4 : 1;
    edgeCurve(ctx, from, controlPoint(from, to, layout.cx, layout.cy), to);
    if (edge.directed) {
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      ctx.strokeStyle = lit ? INK : MUTED;
      arrowHead(ctx, to.x - Math.cos(angle) * (layout.radius + 2), to.y - Math.sin(angle) * (layout.radius + 2), angle);
    }
  });

  // 最短路：蓝色粗线覆盖在普通边上，带方向。
  path.forEach((id, i) => {
    if (i === 0) return;
    const from = layout.byId.get(path[i - 1]);
    const to = layout.byId.get(id);
    if (!from || !to) return;
    const c = controlPoint(from, to, layout.cx, layout.cy);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const start = { x: from.x + Math.cos(angle) * (layout.radius + 2), y: from.y + Math.sin(angle) * (layout.radius + 2) };
    const end = { x: to.x - Math.cos(angle) * (layout.radius + 2), y: to.y - Math.sin(angle) * (layout.radius + 2) };
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2.6;
    edgeCurve(ctx, start, c, end);
    arrowHead(ctx, end.x, end.y, angle, 6);
  });

  // 边权标注：放在靠起点的 33% 处，避开圆心。
  state.edges.forEach((edge) => {
    if (edge.weight === undefined) return;
    const from = layout.byId.get(edge.from);
    const to = layout.byId.get(edge.to);
    if (!from || !to) return;
    const c = controlPoint(from, to, layout.cx, layout.cy);
    const at = quadAt(from, c, to, 0.33);
    const text = String(edge.weight);
    ctx.font = `600 ${9.5 * fs}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const width = ctx.measureText(text).width;
    ctx.fillStyle = PAPER;
    const labelH = 14 * fs;
    ctx.fillRect(at.x - width / 2 - 3, at.y - labelH / 2, width + 6, labelH);
    ctx.fillStyle = 'rgba(21,21,21,.72)';
    ctx.fillText(text, at.x, at.y + 0.5);
  });

  // 节点
  const distOf = new Map((state.dist ?? []).map((entry) => [entry.id, entry.value]));
  state.nodes.forEach((node) => {
    const placed = layout.byId.get(node.id);
    if (!placed) return;
    const isVisited = visited.has(node.id);
    const isNew = isVisited && !previous.has(node.id);
    const alpha = isNew ? 0.35 + 0.65 * k : 1;
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

    if (pathSet.has(node.id) && !isCurrent) {
      ctx.beginPath();
      ctx.arc(placed.x, placed.y, layout.radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = BLUE;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    if (isCurrent) {
      ctx.beginPath();
      ctx.arc(placed.x, placed.y, layout.radius + 6, 0, Math.PI * 2);
      ctx.strokeStyle = ORANGE;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.fillStyle = isVisited ? PAPER : INK;
    const labelPx = Math.min(layout.radius * 1.35, layout.radius * 1.02 * fs);
    ctx.font = `600 ${Math.round(labelPx)}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.label, placed.x, placed.y + 0.5);

    const dist = distOf.get(node.id);
    if (dist !== undefined) {
      ctx.font = `${9 * fs}px ${FONT_MONO}`;
      const width = ctx.measureText(dist).width;
      ctx.fillStyle = PAPER;
      ctx.fillRect(placed.x - width / 2 - 3, placed.y + layout.radius + 2, width + 6, 12 * fs);
      ctx.fillStyle = isVisited ? INK : isFrontier ? BLUE : FAINT;
      ctx.fillText(dist, placed.x, placed.y + layout.radius + 8.5);
    }
    ctx.restore();
  });

  ctx.restore();

  const items = (state.frontier ?? []).map(
    (id) => state.nodes.find((node) => node.id === id)?.label ?? id,
  );
  drawStrip(ctx, W, H, items, state.frontierLabel ?? '队列', 0, fs);
}
