import type { Scene } from '../dsl';
import { bubbleScene } from './bubble';
import type { Params } from './common';
import { bfsScene, dijkstraScene } from './graph';
import { mergeScene } from './merge';
import { handshakeScene, waveScene } from './network';
import { quickScene } from './quick';
import { inOrderScene, levelOrderScene, preOrderScene } from './tree';

export type SceneId =
  | 'quick'
  | 'bubble'
  | 'merge'
  | 'levelorder'
  | 'preorder'
  | 'inorder'
  | 'bfs'
  | 'dijkstra'
  | 'handshake'
  | 'wave';
export type SceneGroupId = 'sort' | 'tree' | 'graph' | 'network';

interface SceneModule {
  label: string;
  group: SceneGroupId;
  defaults: Params;
  build: (params: Params) => Scene;
}

const MODULES: Record<SceneId, SceneModule> = {
  quick: { label: '快排', group: 'sort', defaults: { size: 10, pivot: 0 }, build: quickScene },
  bubble: { label: '冒泡', group: 'sort', defaults: { size: 10 }, build: bubbleScene },
  merge: { label: '归并', group: 'sort', defaults: { size: 10 }, build: mergeScene },
  levelorder: { label: '层序', group: 'tree', defaults: { levels: 4 }, build: levelOrderScene },
  preorder: { label: '前序', group: 'tree', defaults: { levels: 4 }, build: preOrderScene },
  inorder: { label: '中序', group: 'tree', defaults: { levels: 4 }, build: inOrderScene },
  bfs: { label: 'BFS', group: 'graph', defaults: { start: 0 }, build: bfsScene },
  dijkstra: { label: 'Dijkstra', group: 'graph', defaults: { start: 0 }, build: dijkstraScene },
  handshake: { label: '握手', group: 'network', defaults: { loss: 0 }, build: handshakeScene },
  wave: { label: '挥手', group: 'network', defaults: { loss: 0 }, build: waveScene },
};

export const SCENE_ORDER: SceneId[] = [
  'quick',
  'bubble',
  'merge',
  'levelorder',
  'preorder',
  'inorder',
  'bfs',
  'dijkstra',
  'handshake',
  'wave',
];

export const SCENE_GROUPS: { id: SceneGroupId; label: string; scenes: SceneId[] }[] = [
  { id: 'sort', label: '排序', scenes: ['quick', 'bubble', 'merge'] },
  { id: 'tree', label: '树', scenes: ['levelorder', 'preorder', 'inorder'] },
  { id: 'graph', label: '图', scenes: ['bfs', 'dijkstra'] },
  { id: 'network', label: '协议', scenes: ['handshake', 'wave'] },
];

export const SCENE_LABEL = Object.fromEntries(
  (Object.keys(MODULES) as SceneId[]).map((id) => [id, MODULES[id].label]),
) as Record<SceneId, string>;

export const SCENE_DEFAULTS = Object.fromEntries(
  (Object.keys(MODULES) as SceneId[]).map((id) => [id, MODULES[id].defaults]),
) as Record<SceneId, Params>;

export function isSceneId(value: string | null): value is SceneId {
  return value !== null && value in MODULES;
}

/** 参数缺省时用场景默认值；引擎内部再做一次范围钳制。 */
export function createScene(id: SceneId, params: Params = {}): Scene {
  return MODULES[id].build({ ...MODULES[id].defaults, ...params });
}

/** 当前场景的默认参数对象（切换场景时重置用）。 */
export function sceneDefaults(id: SceneId): Params {
  return { ...MODULES[id].defaults };
}

/** 本地规则路由：命中关键词直接返回内置场景，0 延迟；未命中返回 null，交给 AI。 */
export function routeScene(prompt: string): SceneId | null {
  if (/握手|SYN|三次/i.test(prompt)) return 'handshake';
  if (/挥手|四次|FIN|TIME-WAIT|TIME_WAIT/i.test(prompt)) return 'wave';
  if (/dijkstra|最短路|单源|松弛/i.test(prompt)) return 'dijkstra';
  if (/广度优先/.test(prompt) && !/二叉树|树|层序/.test(prompt)) return 'bfs';
  if (/图|顶点|邻接|无向|有向/.test(prompt) && /BFS|广度/i.test(prompt)) return 'bfs';
  if (/层序|层次遍历|BFS/i.test(prompt)) return 'levelorder';
  if (/前序|先序/.test(prompt)) return 'preorder';
  if (/中序/.test(prompt)) return 'inorder';
  if (/遍历|二叉树/.test(prompt)) return 'levelorder';
  if (/冒泡/.test(prompt)) return 'bubble';
  if (/归并|合并排序/.test(prompt)) return 'merge';
  if (/快排|快速排序|分区/.test(prompt)) return 'quick';
  return null;
}
