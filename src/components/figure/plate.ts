export const PAPER = '#FBF8F1';
export const INK = '#151515';
export const BLUE = '#1B4DFF';
export const ORANGE = '#E4572E';
export const MUTED = '#6D6658';
export const FAINT = '#9B9382';
export const RULE = 'rgba(21,21,21,.35)';
export const FONT_MONO = '"Cascadia Mono", Consolas, monospace';

export const GRID = 28;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** 纸面 + 28px 网格：四种图版共用的底。 */
export function drawPlate(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(27,77,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= W; x += GRID) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y <= H; y += GRID) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
}
