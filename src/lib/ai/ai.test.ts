import { describe, expect, it } from 'vitest';
import { validateScene } from '../dsl';
import { buildInitialMessages, buildRepairMessages, EXAMPLE_SCENE } from './prompt';
import { AiGenerationError, extractJson, generateScene } from './generate';

describe('AI scene generation helpers', () => {
  it('ships a valid few-shot scene', () => {
    expect(() => validateScene(EXAMPLE_SCENE)).not.toThrow();
    const scene = validateScene(EXAMPLE_SCENE);
    expect(scene.steps).toHaveLength(8);
    expect(scene.steps[scene.steps.length - 1].doneAll).toBe(true);
  });

  it('extracts JSON from fences and surrounding prose', () => {
    expect(extractJson('```json\n{"title":"x"}\n```')).toEqual({ title: 'x' });
    expect(extractJson('下面是结果：\n{"a":1}\n希望有帮助')).toEqual({ a: 1 });
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('puts the original output and structured issues into the repair turn', () => {
    const messages = buildRepairMessages('二分查找', '{"bad":true}', [
      { path: 'steps[0].state.kind', message: '场景 layout 是 array，这一步却是 tree' },
    ]);
    expect(messages.some((message) => message.role === 'assistant' && message.content === '{"bad":true}')).toBe(true);
    expect(messages[messages.length - 1].content).toContain('steps[0].state.kind');
    expect(messages[messages.length - 1].content).toContain('layout');
  });

  it('keeps the original prompt in the first messages', () => {
    const messages = buildInitialMessages('演示 Dijkstra');
    expect(messages[0].role).toBe('system');
    expect(messages[1]).toEqual({ role: 'user', content: '演示 Dijkstra' });
  });

  it('repairs an invalid first output and marks the result as repaired', async () => {
    const phases: string[] = [];
    let calls = 0;
    const accepted = { ...EXAMPLE_SCENE, category: 'other' };
    const replies = [JSON.stringify({ bad: true }), JSON.stringify(accepted)];
    const result = await generateScene('插入排序', {
      complete: async () => {
        const reply = replies[calls];
        calls += 1;
        if (!reply) throw new Error('unexpected extra call');
        return reply;
      },
      onStatus: (phase) => phases.push(phase),
    });

    expect(calls).toBe(2);
    expect(result.repaired).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.scene.title).toBe('选择排序');
    expect(phases).toContain('repairing');
  });

  it('throws a structured error after three repair rounds', async () => {
    let calls = 0;
    await expect(
      generateScene('坏输出', {
        complete: async () => {
          calls += 1;
          return '{"steps":[]}';
        },
      }),
    ).rejects.toBeInstanceOf(AiGenerationError);
    expect(calls).toBe(4);
  });

  it('repairs a structurally valid but too-short scene', async () => {
    const shortScene = JSON.parse(JSON.stringify(EXAMPLE_SCENE)) as typeof EXAMPLE_SCENE;
    shortScene.steps = shortScene.steps.slice(0, 4);
    shortScene.outline = shortScene.outline.map((item, index) => ({ ...item, step: Math.min(index, 3) }));
    const accepted = { ...EXAMPLE_SCENE, category: 'other' };
    let calls = 0;
    const replies = [JSON.stringify(shortScene), JSON.stringify(accepted)];
    const result = await generateScene('太短的场景', {
      complete: async () => {
        const reply = replies[calls];
        calls += 1;
        if (!reply) throw new Error('unexpected extra call');
        return reply;
      },
    });
    expect(calls).toBe(2);
    expect(result.repaired).toBe(true);
    expect(result.scene.steps).toHaveLength(8);
  });
});
