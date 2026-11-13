import type { Scene } from '../dsl';
import { bubbleScene } from './bubble';
import { mergeScene } from './merge';
import { quickScene } from './quick';
import { inOrderScene, levelOrderScene, preOrderScene } from './tree';

export const SCENES = {
  quick: quickScene(),
  bubble: bubbleScene(),
  merge: mergeScene(),
  levelorder: levelOrderScene(),
  preorder: preOrderScene(),
  inorder: inOrderScene(),
} as const satisfies Record<string, Scene>;

export type SceneId = keyof typeof SCENES;

export const SCENE_ORDER: SceneId[] = ['quick', 'bubble', 'merge', 'levelorder', 'preorder', 'inorder'];

export const SCENE_LABEL: Record<SceneId, string> = {
  quick: '快排',
  bubble: '冒泡',
  merge: '归并',
  levelorder: '层序',
  preorder: '前序',
  inorder: '中序',
};

/** 本地规则路由：命中关键词直接返回内置场景，0 延迟；未命中返回 null，交给 AI。 */
export function routeScene(prompt: string): SceneId | null {
  if (/层序|层次遍历|BFS/i.test(prompt)) return 'levelorder';
  if (/前序|先序/.test(prompt)) return 'preorder';
  if (/中序/.test(prompt)) return 'inorder';
  if (/遍历|二叉树/.test(prompt)) return 'levelorder';
  if (/冒泡/.test(prompt)) return 'bubble';
  if (/归并|合并排序/.test(prompt)) return 'merge';
  if (/快排|快速排序|分区/.test(prompt)) return 'quick';
  return null;
}
