import type { ArrayState } from '../../lib/dsl';
import { BLUE, FAINT, FONT_MONO, INK, MUTED, ORANGE, PAPER, RULE } from './plate';

/** 数组图版：墨色柱 + 下标 + 朱砂基准 + 蓝色斜纹比较 + 区间线。 */
export function drawArray(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  state: ArrayState,
  values: number[],
  auxMix = state.aux ? 1 : 0,
  fontScale = 1,
  prevAux?: ArrayState['aux'],
): void {
  const n = values.length;
  const padX = 26;
  const padTop = 48;
  const auxiliary = state.aux ?? prevAux ?? null;
  // 大数组在窄屏上不能继续放大太多，否则值标签会互相压住。
  const fs = n > 12 ? Math.min(fontScale, 1.18) : fontScale;
  // auxMix 在 0..1 之间过渡：进入归并时辅助区展开，最后一帧收起，柱高不跳变。
  const padBottom = 44 + 38 * Math.min(1, Math.max(0, auxMix));
  // 大数组在窄屏上不能继续用 10px 柱 + 16px 间距，否则右侧会被裁掉。
  const gap = n > 12 ? Math.max(4, Math.min(16, (W - padX * 2) / (n * 4))) : 16;
  const barW = Math.max(4, (W - padX * 2 - gap * (n - 1)) / n);
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
  ctx.font = `${9 * fs}px ${FONT_MONO}`;
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
    ctx.font = `${10 * fs}px ${FONT_MONO}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(state.values[i] ?? v), x + barW / 2, top - 8);

    ctx.fillStyle = FAINT;
    ctx.font = `${8 * fs}px ${FONT_MONO}`;
    ctx.fillText(String(i), x + barW / 2, baseY + 16);
  });

  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.moveTo(padX - 6, baseY + 0.5);
  ctx.lineTo(W - padX + 6, baseY + 0.5);
  ctx.stroke();

  if (auxiliary) {
    const { left, right, i, j, target } = auxiliary;
    const cell = Math.max(14, Math.min(26, (W - 54) / Math.max(left.length, right.length, 1)));
    const drawRow = (label: string, items: number[], pointer: number, y: number) => {
      ctx.font = `${8 * fs}px ${FONT_MONO}`;
      ctx.fillStyle = MUTED;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 8, y);

      if (items.length === 0) {
        ctx.fillStyle = FAINT;
        ctx.fillText('空', 42, y);
        return;
      }

      items.forEach((value, index) => {
        const x = 42 + index * cell;
        const current = index === pointer;
        ctx.fillStyle = current ? 'rgba(228,87,46,.14)' : PAPER;
        ctx.fillRect(x, y - 7, cell - 2, 14);
        ctx.strokeStyle = current ? ORANGE : 'rgba(21,21,21,.28)';
        ctx.lineWidth = current ? 1.4 : 1;
        ctx.strokeRect(x + 0.5, y - 6.5, cell - 3, 13);
        ctx.fillStyle = current ? ORANGE : INK;
        ctx.textAlign = 'center';
        ctx.fillText(String(value), x + (cell - 2) / 2, y + 0.5);
        ctx.textAlign = 'left';
      });
    };

    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, auxMix));
    drawRow('左段', left, i, H - 50);
    drawRow('右段', right, j, H - 31);

    // 目标格：主数组下方的一道朱砂短线，表示下一次写入的位置
    if (target >= 0 && target < n) {
      const targetX = padX + target * (barW + gap);
      ctx.fillStyle = ORANGE;
      ctx.fillRect(targetX, baseY + 2, barW, 2);
    }
    ctx.restore();
  }
}
