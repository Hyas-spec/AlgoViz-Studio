import type { Scene } from '../dsl';
import { quickScene } from './quick';
import { bubbleScene } from './bubble';
import { mergeScene } from './merge';

export const SCENES = {
  quick: quickScene(),
  bubble: bubbleScene(),
  merge: mergeScene(),
} as const satisfies Record<string, Scene>;

export type SceneId = keyof typeof SCENES;

export const SCENE_ORDER: SceneId[] = ['quick', 'bubble', 'merge'];

export const SCENE_LABEL: Record<SceneId, string> = {
  quick: '快排',
  bubble: '冒泡',
  merge: '归并',
};

/** 本地规则路由：命中关键词直接返回内置场景，0 延迟；未命中返回 null，交给 AI。 */
export function routeScene(prompt: string): SceneId | null {
  if (/冒泡/.test(prompt)) return 'bubble';
  if (/归并|合并排序/.test(prompt)) return 'merge';
  if (/快排|快速排序|分区/.test(prompt)) return 'quick';
  return null;
}
