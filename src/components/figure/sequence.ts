import type { SequenceState } from '../../lib/dsl';
import { BLUE, FAINT, FONT_MONO, INK, MUTED, ORANGE, PAPER } from './plate';

const TOP = 16;
const HEADER_H = 24;
const BOTTOM = 46;

/** 泳道顶部标签的宽度：按文字量算，但不许吃掉整条泳道间距。 */
function headerWidth(text: string, ctx: CanvasRenderingContext2D, spacing: number): number {
  return Math.min(Math.max(64, ctx.measureText(text).width + 22), Math.max(64, spacing - 16));
}

function arrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, direction: number, size = 5): void {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - direction * size, y - size * 0.62);
  ctx.moveTo(x, y);
  ctx.lineTo(x - direction * size, y + size * 0.62);
  ctx.stroke();
}

function cross(ctx: CanvasRenderingContext2D, x: number, y: number, size = 4): void {
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();
}

/** 时序图版：泳道、消息箭头、丢包虚线、当前消息高亮、底部状态注记。 */
export function drawSequence(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: SequenceState,
  prev: SequenceState,
  k: number,
): void {
  const lanes = state.lanes;
  const count = Math.max(1, lanes.length);
  const margin = Math.max(46, Math.min(W * 0.14, W / 2 - 70));
  const spacing = count > 1 ? (W - margin * 2) / (count - 1) : 0;
  const xOf = new Map(lanes.map((lane, i) => [lane.id, margin + i * spacing]));
  const headerY = TOP + HEADER_H / 2;
  const lineTop = TOP + HEADER_H + 18;
  const lineBottom = H - BOTTOM;
  const previousIds = new Set((prev.messages ?? []).map((message) => message.id));

  ctx.save();
  ctx.textBaseline = 'middle';

  // 泳道与生命线
  lanes.forEach((lane) => {
    const x = xOf.get(lane.id) ?? 0;
    ctx.strokeStyle = 'rgba(21,21,21,.34)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, lineTop);
    ctx.lineTo(x, lineBottom);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // 泳道标题
  lanes.forEach((lane) => {
    const x = xOf.get(lane.id) ?? 0;
    ctx.font = `600 10.5px ${FONT_MONO}`;
    const width = headerWidth(lane.label, ctx, spacing);
    ctx.fillStyle = PAPER;
    ctx.fillRect(x - width / 2, headerY - HEADER_H / 2, width, HEADER_H);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2 + 0.5, headerY - HEADER_H / 2 + 0.5, width - 1, HEADER_H - 1);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(lane.label, x, headerY + 0.5);
  });

  const messages = state.messages ?? [];
  const area = Math.max(40, lineBottom - lineTop - 14);
  const rowH = Math.min(72, Math.max(32, area / Math.max(messages.length + 1, 4)));
  const yOf = (i: number) => lineTop + 24 + i * rowH;

  if (messages.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.font = `10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText('还没有报文，等待发起方', W / 2, (lineTop + lineBottom) / 2);
  }

  messages.forEach((message, i) => {
    const x1 = xOf.get(message.from);
    const x2 = xOf.get(message.to);
    if (x1 === undefined || x2 === undefined) return;

    const y = yOf(i);
    const direction = x2 >= x1 ? 1 : -1;
    const active = state.active === message.id;
    const lost = message.lost === true || message.tone === 'lost';
    const isNew = !previousIds.has(message.id);
    const alpha = isNew ? 0.25 + 0.75 * k : 1;
    const tone = message.tone ?? 'ack';
    const color = lost || tone === 'fin' ? ORANGE : tone === 'ack' ? INK : BLUE;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (active) {
      ctx.fillStyle = 'rgba(228,87,46,.06)';
      ctx.fillRect(Math.min(x1, x2) - 6, y - 13, Math.abs(x2 - x1) + 12, 26);
    }

    // 同一泳道内的自发消息：画一个小回环。
    if (x1 === x2) {
      ctx.strokeStyle = color;
      ctx.lineWidth = active ? 1.8 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x1, y - 3);
      ctx.bezierCurveTo(x1 + 30, y - 16, x1 + 34, y + 12, x1 + 6, y + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x1 + 8, y);
      ctx.stroke();
      ctx.fillStyle = active ? ORANGE : INK;
      ctx.font = `9.5px ${FONT_MONO}`;
      ctx.textAlign = 'left';
      ctx.fillText(message.label, x1 + 40, y);
      ctx.restore();
      return;
    }

    const start = x1 + direction * 8;
    const tip = x2 - direction * 8;
    const end = lost ? start + (tip - start) * 0.6 : tip;

    ctx.strokeStyle = color;
    ctx.lineWidth = active ? 2 : 1.2;
    ctx.setLineDash(lost ? [4, 3] : []);
    ctx.beginPath();
    ctx.moveTo(start, y);
    ctx.lineTo(end, y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (lost) {
      ctx.lineWidth = 1.6;
      cross(ctx, end, y, 4);
    } else {
      arrowHead(ctx, tip, y, direction, active ? 6 : 5);
    }

    // 消息两端的汇合点
    ctx.fillStyle = color;
    for (const x of [x1, x2]) {
      ctx.beginPath();
      ctx.arc(x, y, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = active || lost ? ORANGE : INK;
    ctx.font = `${active ? 600 : 400} 10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(message.label, (start + end) / 2, y - 9);

    if (lost) {
      ctx.fillStyle = ORANGE;
      ctx.font = `8px ${FONT_MONO}`;
      ctx.fillText('丢失', end, y + 12);
    }
    ctx.restore();
  });

  // 底部状态注记
  (state.notes ?? []).forEach((note) => {
    const x = xOf.get(note.lane);
    if (x === undefined) return;
    ctx.strokeStyle = 'rgba(21,21,21,.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 3, H - 43);
    ctx.lineTo(x + 3, H - 43);
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.fillRect(x - 45, H - 36, 90, 16);
    ctx.fillStyle = MUTED;
    ctx.font = `9px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(note.text, x, H - 24);
  });

  ctx.restore();
}
