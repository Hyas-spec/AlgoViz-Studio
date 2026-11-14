import { useEffect, useRef } from 'react';
import { describeState } from '../lib/describe';
import type { Step, StepState } from '../lib/dsl';
import { drawArray } from './figure/array';
import { drawGraph } from './figure/graph';
import { drawPlate, easeOutCubic } from './figure/plate';
import { drawSequence } from './figure/sequence';
import { drawTree } from './figure/tree';

/** 单帧过渡时长；`prefers-reduced-motion` 时缩短到 120ms。 */
function transitionMs(): number {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : 260;
}

export function Figure({ step, typeScale = 1 }: { step: Step; typeScale?: number }) {
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
      const prevAux = prev.kind === 'array' && prev.aux ? 1 : 0;
      const nextAux = state.aux ? 1 : 0;
      const auxMix = prevAux + (nextAux - prevAux) * eased;
      drawArray(ctx, W, H, state, values, auxMix, typeScale, prev.kind === 'array' ? prev.aux : undefined);
      return;
    }

    if (state.kind === 'tree') {
      drawTree(ctx, W, H, state, prev.kind === 'tree' ? prev : state, eased, typeScale);
      return;
    }

    if (state.kind === 'graph') {
      drawGraph(ctx, W, H, state, prev.kind === 'graph' ? prev : state, eased, typeScale);
      return;
    }

    drawSequence(ctx, W, H, state, prev.kind === 'sequence' ? prev : state, eased, typeScale);
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
  }, [step, typeScale]);

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
