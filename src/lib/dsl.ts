import { z } from 'zod';

export const stepSchema = z.object({
  values: z.array(z.number()),
  pivot: z.number().int().nullable(),
  compare: z.number().int().nullable(),
  swap: z.tuple([z.number().int(), z.number().int()]).nullable(),
  locked: z.array(z.number().int()),
  range: z.tuple([z.number().int(), z.number().int()]),
  caption: z.string().min(1),
  codeLine: z.number().int().min(0),
  doneAll: z.boolean().optional(),
});

export type Step = z.infer<typeof stepSchema>;

export const sceneSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chapter: z.string().min(1),
  kicker: z.string().min(1),
  summary: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
  formula: z.string().min(1),
  complexity: z.object({
    time: z.string().min(1),
    space: z.string().min(1),
  }),
  code: z.array(z.string()).min(1),
  note: z.string().min(1),
  question: z.string().min(1),
  figure: z.string().min(1),
  facts: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).length(3),
  outline: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).length(4),
  steps: z.array(stepSchema).min(1),
  source: z.enum(['builtin', 'ai']),
});

export type Scene = z.infer<typeof sceneSchema>;

export function validateScene(input: unknown): Scene {
  return sceneSchema.parse(input);
}
