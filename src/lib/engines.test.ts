import { describe, expect, it } from 'vitest';
import { SCENES } from './engines';
import { sceneSchema } from './dsl';

const ids = ['quick', 'bubble', 'merge'] as const;

describe('sorting scenes', () => {
  it.each(ids)('%s: schema valid and ends sorted', (id) => {
    const scene = SCENES[id];
    expect(() => sceneSchema.parse(scene)).not.toThrow();

    const last = scene.steps[scene.steps.length - 1];
    expect(last.doneAll).toBe(true);
    expect(last.values).toEqual([...last.values].sort((a, b) => a - b));
    expect(last.values).toHaveLength(10);
  });

  it.each(ids)('%s: every step keeps the original length', (id) => {
    for (const step of SCENES[id].steps) {
      expect(step.values).toHaveLength(10);
    }
  });

  it('routeScene matches Chinese keywords', async () => {
    const { routeScene } = await import('./engines');
    expect(routeScene('用冒泡排序演示')).toBe('bubble');
    expect(routeScene('归并排序怎么合并')).toBe('merge');
    expect(routeScene('快速排序的分区')).toBe('quick');
    expect(routeScene('TCP 三次握手')).toBeNull();
  });
});
