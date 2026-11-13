import type { ArrayState } from '../../lib/dsl';
import { BLUE, FAINT, FONT_MONO, INK, MUTED, ORANGE, PAPER, RULE } from './plate';

/** 数组图版：墨色柱 + 下标 + 朱砂基准 + 蓝色斜纹比较 + 区间线。 */
export function drawArray(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: ArrayState,
  values: number[],
): void {
  const n = values.length;
  const padX = 26;
  const padTop = 48;
  const padBottom = 44;
  const gap = 16;
  const barW = Math.max(10, (W - padX * 2 - gap * (n - 1)) / n);
  const baseY = H - padBottom;
  const maxH = baseY - padTop - 34;
  const maxVal = Math.max(...values, 1);
  const scale = maxH / maxVal;

  const [l, r] = state.range;
  const x1 = padX + l * (barW + gap) + barW / 2;
  const x2 = padX + r * (barW + gap) + barW / 2;
  const y = 18;
  ctx.strokeStyle = 'rgba(27,77,255,.35)';
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.fillStyle = BLUE;
  ctx.font = `9px ${FONT_MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(`[${l}..${r}]`, x1, y - 5);

  values.forEach((v, i) => {
    const barH = Math.max(6, v * scale);
    const x = padX + i * (barW + gap);
    const top = baseY - barH;
    const isPivot = state.pivot === i;
    const isCompare = state.compare === i;
    const isLocked = state.locked.includes(i);

    if (isCompare) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(x, top, barW, barH);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top, barW, barH);
      ctx.clip();
      ctx.strokeStyle = 'rgba(27,77,255,.9)';
      ctx.lineWidth = 2;
      for (let d = -barH; d < barW; d += 7) {
        ctx.beginPath();
        ctx.moveTo(x + d, top + barH);
        ctx.lineTo(x + d + barH, top);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.fillStyle = isPivot ? ORANGE : isLocked ? BLUE : INK;
      ctx.fillRect(x, top, barW, barH);
    }

    ctx.fillStyle = isPivot ? ORANGE : isCompare ? BLUE : MUTED;
    ctx.font = `10px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(state.values[i] ?? v), x + barW / 2, top - 8);

    ctx.fillStyle = FAINT;
    ctx.font = `8px ${FONT_MONO}`;
    ctx.fillText(String(i), x + barW / 2, baseY + 16);
  });

  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(padX - 6, baseY + 0.5);
  ctx.lineTo(W - padX + 6, baseY + 0.5);
  ctx.stroke();
}
