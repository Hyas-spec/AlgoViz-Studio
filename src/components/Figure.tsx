import { useEffect, useRef } from 'react';
import { describeState } from '../lib/describe';
import type { Step, StepState } from '../lib/dsl';
import { drawArray } from './figure/array';
import { drawPlate, easeOutCubic } from './figure/plate';
import { drawTree } from './figure/tree';

/** 单帧过渡时长；`prefers-reduced-motion` 时缩短到 120ms。 */
function transitionMs(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 260;
}

export function Figure({ step }: { step: Step }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<StepState>(step.state);
  const prevRef = useRef<StepState>(step.state);
  const rafRef = useRef(0);

  const paint = (state: StepState, prev: StepState, k: number) => {
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
    drawPlate(ctx, W, H);

    const eased = easeOutCubic(k);
    if (state.kind === 'array') {
      const from = prev.kind === 'array' ? prev.values : state.values;
      const values = state.values.map((value, i) => {
        const start = from[i] ?? value;
        return start + (value - start) * eased;
      });
      drawArray(ctx, W, H, state, values);
      return;
    }

    if (state.kind === 'tree') {
      drawTree(ctx, W, H, state, prev.kind === 'tree' ? prev : state, eased);
      return;
    }

    ctx.fillStyle = '#6D6658';
    ctx.font = '11px "Cascadia Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('图版绘制中', W / 2, H / 2);
  };

  const paintRef = useRef(paint);
  paintRef.current = paint;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => paintRef.current(stateRef.current, stateRef.current, 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const state = step.state;
    const prev = prevRef.current;
    stateRef.current = state;
    cancelAnimationFrame(rafRef.current);

    const duration = transitionMs();
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / duration);
      paintRef.current(state, prev, k);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        prevRef.current = state;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [step]);

  return (
    <div ref={wrapRef} className="figure-canvas-wrap">
      <canvas
        ref={canvasRef}
        className="figure-canvas"
        role="img"
        aria-label={`图版：${describeState(step.state)}`}
      />
    </div>
  );
}
