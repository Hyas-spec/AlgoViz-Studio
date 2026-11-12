import { useEffect, useRef } from 'react';
import type { Step } from '../lib/dsl';

const PAPER = '#FBF8F1';
const INK = '#151515';
const BLUE = '#1B4DFF';
const ORANGE = '#E4572E';
const MUTED = '#6D6658';
const FAINT = '#9B9382';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function Figure({ step }: { step: Step }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayRef = useRef<number[]>(step.values);
  const stepRef = useRef(step);
  const rafRef = useRef(0);

  stepRef.current = step;

  const drawRef = useRef<(values: number[]) => void>(() => {});
  drawRef.current = (values: number[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = rect.width;
    const H = rect.height;
    const s = stepRef.current;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(27,77,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 28) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
    }
    for (let y = 0; y <= H; y += 28) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
    }
    ctx.stroke();

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

    if (s.range) {
      const [l, r] = s.range;
      const x1 = padX + l * (barW + gap) + barW / 2;
      const x2 = padX + r * (barW + gap) + barW / 2;
      const y = 18;
      ctx.strokeStyle = 'rgba(27,77,255,.35)';
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.fillStyle = BLUE;
      ctx.font = '9px "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`[${l}..${r}]`, x1, y - 5);
    }

    values.forEach((v, i) => {
      const barH = Math.max(6, v * scale);
      const x = padX + i * (barW + gap);
      const y = baseY - barH;
      const isPivot = s.pivot === i;
      const isCompare = s.compare === i;
      const isLocked = s.locked.includes(i);

      if (isCompare) {
        ctx.fillStyle = PAPER;
        ctx.fillRect(x, y, barW, barH);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, barW, barH);
        ctx.clip();
        ctx.strokeStyle = 'rgba(27,77,255,.9)';
        ctx.lineWidth = 2;
        for (let d = -barH; d < barW; d += 7) {
          ctx.beginPath();
          ctx.moveTo(x + d, y + barH);
          ctx.lineTo(x + d + barH, y);
          ctx.stroke();
        }
        ctx.restore();
      } else {
        ctx.fillStyle = isPivot ? ORANGE : isLocked ? BLUE : INK;
        ctx.fillRect(x, y, barW, barH);
      }

      ctx.fillStyle = isPivot ? ORANGE : isCompare ? BLUE : MUTED;
      ctx.font = '10px "Cascadia Mono", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(s.values[i] ?? v), x + barW / 2, y - 8);

      ctx.fillStyle = FAINT;
      ctx.font = '8px "Cascadia Mono", Consolas, monospace';
      ctx.fillText(String(i), x + barW / 2, baseY + 16);
    });

    ctx.strokeStyle = 'rgba(21,21,21,.35)';
    ctx.beginPath();
    ctx.moveTo(padX - 6, baseY + 0.5);
    ctx.lineTo(W - padX + 6, baseY + 0.5);
    ctx.stroke();
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => drawRef.current(displayRef.current));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const from = displayRef.current.slice();
    const to = step.values;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now: number) => {
      const k = easeOutCubic(Math.min(1, (now - start) / 260));
      const current = to.map((value, i) => {
        const f = from[i] ?? value;
        return f + (value - f) * k;
      });
      drawRef.current(current);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to.slice();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  return (
    <div ref={wrapRef} className="figure-canvas-wrap">
      <canvas ref={canvasRef} className="figure-canvas" />
    </div>
  );
}
