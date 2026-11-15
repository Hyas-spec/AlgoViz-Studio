import { z } from 'zod';
import type { Scene } from '../dsl';
import { streamChat, type ChatMessage, type StreamHooks } from './client';
import { extractJson, type AiPhase } from './generate';

export const answerSchema = z.object({
  title: z.string().min(1).max(60),
  summary: z.string().min(1).max(220),
  points: z.array(z.string().min(1).max(180)).min(3).max(5),
  formula: z.string().max(120).optional(),
  code: z.array(z.string().max(120)).max(8).optional(),
  followups: z.array(z.string().min(1).max(80)).min(2).max(4),
});

export type AnswerPayload = z.infer<typeof answerSchema>;

export interface AnswerResult {
  answer: AnswerPayload;
  repaired: boolean;
  attempts: number;
}

export interface AnswerHooks {
  onStatus?: (phase: AiPhase, round?: number) => void;
  onDelta?: (delta: string) => void;
  signal?: AbortSignal;
  complete?: (messages: ChatMessage[], hooks: StreamHooks) => Promise<string>;
}

export class AnswerGenerationError extends Error {
  readonly issues: { path: string; message: string }[];
  readonly raw: string;

  constructor(issues: { path: string; message: string }[], raw: string) {
    super(issues[0] ? `${issues[0].path || '$'}: ${issues[0].message}` : 'AI 讲解失败');
    this.name = 'AnswerGenerationError';
    this.issues = issues;
    this.raw = raw;
  }
}

export const ANSWER_SYSTEM_PROMPT = `你是 AlgoViz（算法视界）的算法助教。用中文回答计算机/算法概念问题，只输出一个 JSON 对象，不要 Markdown 代码围栏或解释。

输出字段：
{
  "title": "问题式标题，≤60 字",
  "summary": "一句话结论，≤220 字",
  "points": ["3–5 条要点，每条 ≤180 字；讲清因果，不堆术语"],
  "formula": "可选 LaTeX，≤120 字；没有就省略",
  "code": ["可选 1–8 行伪代码/代码；没有就省略"],
  "followups": ["2–4 个下一步追问，每个 ≤80 字"]
}

要求：
- 只回答算法/计算机课程相关问题；不闲聊、不写通用百科。
- 先给结论，再给 3–5 条要点；要点之间要有逻辑，不要同义反复。
- 公式用 LaTeX；代码只保留关键行。
- 不要输出 HTML、脚本或 Markdown 表格。
- 输出完整 JSON，不要用“省略”。`;

const MAX_REPAIRS = 2;

function buildMessages(prompt: string): ChatMessage[] {
  return [
    { role: 'system', content: ANSWER_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
}

function buildRepairMessages(prompt: string, raw: string, issues: { path: string; message: string }[]): ChatMessage[] {
  const issueText = issues.map((issue) => `- ${issue.path || '$'}: ${issue.message}`).join('\n');
  return [
    { role: 'system', content: ANSWER_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
    { role: 'assistant', content: raw || '（上一次输出为空）' },
    {
      role: 'user',
      content: `上一次输出没有通过校验。只返回修正后的完整 JSON，不要解释。\n问题：\n${issueText}\n要求：title/summary 非空；points 恰好 3–5 条；followups 2–4 条；不要 Markdown。`,
    },
  ];
}

function toIssues(error: unknown): { path: string; message: string }[] {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => ({
      path: issue.path.map(String).join('.') || '$',
      message: issue.message,
    }));
  }
  return [{ path: '$', message: error instanceof Error ? error.message : String(error) }];
}

export async function generateAnswer(prompt: string, hooks: AnswerHooks = {}): Promise<AnswerResult> {
  let messages = buildMessages(prompt);
  let raw = '';
  const complete = hooks.complete ?? streamChat;

  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt += 1) {
    hooks.onStatus?.(attempt === 0 ? 'streaming' : 'repairing', attempt);
    raw = await complete(messages, { onDelta: hooks.onDelta, signal: hooks.signal });
    hooks.onStatus?.('validating', attempt);
    try {
      const answer = answerSchema.parse(extractJson(raw));
      return { answer, repaired: attempt > 0, attempts: attempt + 1 };
    } catch (error) {
      const issues = toIssues(error);
      if (attempt === MAX_REPAIRS) throw new AnswerGenerationError(issues, raw);
      messages = buildRepairMessages(prompt, raw, issues);
    }
  }

  throw new AnswerGenerationError([{ path: '$', message: '讲解修复轮用尽' }], raw);
}

/** 把 answer 转成左页可复用的 Scene-like 数据；右页由 AnswerCard 接管。 */
export function answerToScene(answer: AnswerPayload, prompt: string): Scene {
  const points = answer.points.slice(0, 4);
  const outline = Array.from({ length: 4 }, (_, index) => {
    const point = points[index];
    return {
      label: point ? `要点 ${index + 1}` : '延伸',
      value: (point ?? '继续追问').slice(0, 24),
      step: 0,
    };
  });
  return {
    id: 'ai-answer',
    title: answer.title,
    chapter: 'CH.AI / ANSWER',
    section: 'AI 助教 · 概念讲解',
    kicker: 'CONCEPT NOTE',
    figNo: 'AI.A1',
    pages: [40, 41],
    layout: 'sequence',
    category: 'other',
    summary: answer.summary.slice(0, 160),
    body: points,
    formula: answer.formula || '\\text{概念讲解}',
    complexity: { time: '—', space: '—' },
    code: answer.code && answer.code.length > 0 ? answer.code : ['// 纯概念讲解：没有伪代码'],
    note: answer.followups.join('  ·  '),
    question: answer.followups[0] ? `${answer.followups[0]}？` : '继续追问一个相关概念？',
    figure: 'CONCEPT NOTE',
    facts: [
      { label: '形式', value: '纯讲解' },
      { label: '要点', value: `${answer.points.length} 条` },
      { label: '来源', value: 'AI 助教' },
    ],
    outline,
    steps: [
      {
        caption: answer.summary.slice(0, 160),
        codeLine: 1,
        state: {
          kind: 'sequence',
          lanes: [
            { id: 'q', label: '问题' },
            { id: 'a', label: '回答' },
          ],
          messages: [
            {
              id: 'm1',
              from: 'q',
              to: 'a',
              label: '概念讲解',
              tone: 'data',
              lost: false,
            },
          ],
          active: null,
          notes: [{ lane: 'q', text: prompt.slice(0, 40) }],
        },
      },
    ],
    params: [],
    source: 'ai',
  };
}
