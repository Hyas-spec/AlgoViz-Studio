import { z } from 'zod';
import { SceneIssueError, validateScene, type Scene, type SceneIssue } from '../dsl';
import { streamChat, type ChatMessage, type StreamHooks } from './client';
import { buildInitialMessages, buildRepairMessages } from './prompt';

export type AiPhase = 'streaming' | 'validating' | 'repairing';

export interface GenerateHooks {
  onStatus?: (phase: AiPhase, round?: number) => void;
  onDelta?: (delta: string) => void;
  signal?: AbortSignal;
  /** 测试注入点：默认走真实 /api/llm。 */
  complete?: (messages: ChatMessage[], hooks: StreamHooks) => Promise<string>;
}

export interface GenerateResult {
  scene: Scene;
  repaired: boolean;
  attempts: number;
}

export class AiGenerationError extends Error {
  readonly issues: SceneIssue[];
  readonly raw: string;
  readonly attempts: number;

  constructor(issues: SceneIssue[], raw: string, attempts: number) {
    super(issues[0] ? `${issues[0].path || '$'}: ${issues[0].message}` : 'AI 生成失败');
    this.name = 'AiGenerationError';
    this.issues = issues;
    this.raw = raw;
    this.attempts = attempts;
  }
}

const MAX_REPAIRS = 3;

export const AI_MAX_REPAIRS = MAX_REPAIRS;

/** 各题材的最低帧数：排序要像内置场景一样把每次比较/移动讲开。 */
function minSteps(scene: Scene): number {
  if (scene.category === 'sort') return 24;
  if (scene.category === 'search') return 8;
  if (scene.layout === 'tree' || scene.layout === 'graph') return 12;
  if (scene.layout === 'sequence') return 5;
  return 8;
}

/** 剥掉模型偶尔带的 ```json 围栏和解释文字，再 JSON.parse。 */
export function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);
  return JSON.parse(text);
}

function toIssues(error: unknown): SceneIssue[] {
  if (error instanceof SceneIssueError) return error.issues;
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '$',
      message: issue.message,
    }));
  }
  return [{ path: '$', message: error instanceof Error ? error.message : String(error) }];
}

/** Schema 管不住“太短/没收尾”，这里给 AI 场景加最低质量线。 */
function qualityIssues(scene: Scene): SceneIssue[] {
  const issues: SceneIssue[] = [];
  const min = minSteps(scene);
  if (scene.steps.length < min) {
    issues.push({
      path: 'steps',
      message: `${scene.category} / ${scene.layout} 场景至少 ${min} 帧，当前只有 ${scene.steps.length} 帧`,
    });
  }
  scene.steps.forEach((step, index) => {
    if (step.codeLine < 1 || step.codeLine > scene.code.length) {
      issues.push({
        path: `steps[${index}].codeLine`,
        message: `codeLine ${step.codeLine} 超出 1..${scene.code.length}`,
      });
    }
  });
  const last = scene.steps[scene.steps.length - 1];
  if (last && !last.doneAll) {
    issues.push({ path: `steps[${scene.steps.length - 1}].doneAll`, message: '最后一帧必须标记 doneAll: true' });
  }
  const firstState = scene.steps[0]?.state;
  if (scene.category === 'sort' && firstState?.kind === 'array' && firstState.values.length < 8) {
    issues.push({
      path: 'steps[0].state.values',
      message: `排序场景至少要有 8 个元素，当前只有 ${firstState.values.length} 个，内容会太单薄`,
    });
  }
  return issues;
}

/**
 * 生成 → 校验 → 失败修复（最多 2 轮）。每轮都流式回调，UI 可实时显示。
 * 修复轮会把上一次的原始 JSON 与结构化 issues 一起回喂模型。
 */
export async function generateScene(prompt: string, hooks: GenerateHooks = {}): Promise<GenerateResult> {
  let messages: ChatMessage[] = buildInitialMessages(prompt);
  let raw = '';
  const complete = hooks.complete ?? streamChat;

  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt += 1) {
    hooks.onStatus?.(attempt === 0 ? 'streaming' : 'repairing', attempt);
    raw = await complete(messages, { onDelta: hooks.onDelta, signal: hooks.signal });
    hooks.onStatus?.('validating', attempt);

    try {
      const scene = validateScene(extractJson(raw));
      scene.source = 'ai';
      const quality = qualityIssues(scene);
      if (quality.length > 0) throw new SceneIssueError(quality);
      return { scene, repaired: attempt > 0, attempts: attempt + 1 };
    } catch (error) {
      const issues = toIssues(error);
      if (attempt === MAX_REPAIRS) {
        throw new AiGenerationError(issues, raw, attempt + 1);
      }
      messages = buildRepairMessages(prompt, raw, issues);
    }
  }

  throw new AiGenerationError([{ path: '$', message: '修复轮用尽' }], raw, MAX_REPAIRS + 1);
}
