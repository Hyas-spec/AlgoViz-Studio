import { BLUE, FAINT, FONT_MONO, INK, MUTED } from './plate';

/**
 * 图版底部的「游标条」：队列 / 栈 / 已确定。
 * 树与图共用；超出宽度时截断并显示 +N。
 */
export function drawStrip(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  items: string[],
  caption: string,
  liveIndex: number,
  fontScale = 1,
): void {
  const y = H - 34;
  const fs = Math.min(fontScale, 1.35);
  const boxH = 20 * Math.min(1.25, fs);

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `${9 * fs}px ${FONT_MONO}`;
  ctx.fillText(caption, 20, y);

  let x = 20 + ctx.measureText(caption).width + 10;
  const shown = items.slice(0, 9);
  shown.forEach((text, i) => {
    const boxW = Math.max(18, ctx.measureText(text).width + 12);
    if (x + boxW > W - 20) return;
    ctx.strokeStyle = i === liveIndex ? BLUE : 'rgba(21,21,21,.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y - boxH / 2 + 0.5, boxW, boxH);
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.fillText(text, x + boxW / 2, y + 0.5);
    ctx.textAlign = 'left';
    x += boxW + 6;
  });

  if (items.length > shown.length && x < W - 46) {
    ctx.fillStyle = FAINT;
    ctx.font = `${9 * fs}px ${FONT_MONO}`;
    ctx.fillText(`+${items.length - shown.length}`, x, y);
  }
  if (items.length === 0) {
    ctx.fillStyle = FAINT;
    ctx.font = `${9 * fs}px ${FONT_MONO}`;
    ctx.fillText('空', x, y);
  }
  ctx.restore();
}
