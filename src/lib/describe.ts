import type { StepState } from './dsl';

/**
 * 把一帧的图版状态说成一句话，供 canvas 的 aria-label 与读屏 live region 使用。
 * 只说当前帧的事实，不重复讲解文案。
 */
export function describeState(state: StepState): string {
  if (state.kind === 'array') {
    const parts = [`数组共 ${state.values.length} 个元素，当前为 ${state.values.join('、')}`];
    if (state.pivot !== null) {
      parts.push(`基准在下标 ${state.pivot}，值是 ${state.values[state.pivot]}`);
    }
    if (state.compare !== null) {
      parts.push(`正在比较下标 ${state.compare}，值是 ${state.values[state.compare]}`);
    }
    if (state.locked.length > 0) {
      parts.push(`已就位 ${state.locked.length} 个元素`);
    }
    return `${parts.join('；')}。`;
  }

  if (state.kind === 'tree') {
    const labelOf = new Map(state.nodes.map((node) => [node.id, node.label]));
    const visited = (state.order ?? []).map((id) => labelOf.get(id) ?? id);
    const frontier = (state.frontier ?? []).map((id) => labelOf.get(id) ?? id);
    const current = state.current ? (labelOf.get(state.current) ?? state.current) : null;
    const parts = [`共 ${state.nodes.length} 个节点`];
    if (current) parts.push(`当前访问 ${current}`);
    parts.push(`已访问 ${visited.length} 个`);
    parts.push(`${state.frontierLabel ?? '队列'}：${frontier.length > 0 ? frontier.join('、') : '空'}`);
    return `${parts.join('；')}。`;
  }

  if (state.kind === 'graph') {
    const labelOf = new Map(state.nodes.map((node) => [node.id, node.label]));
    const visited = (state.visited ?? []).map((id) => labelOf.get(id) ?? id);
    const frontier = (state.frontier ?? []).map((id) => labelOf.get(id) ?? id);
    const parts = [`图共 ${state.nodes.length} 个节点、${state.edges.length} 条边`];
    if (visited.length > 0) parts.push(`已访问：${visited.join('、')}`);
    if (frontier.length > 0) parts.push(`待访问：${frontier.join('、')}`);
    return `${parts.join('；')}。`;
  }

  const active = state.active ? state.messages.find((message) => message.id === state.active) : null;
  const parts = [`${state.lanes.length} 条泳道，共 ${state.messages.length} 条消息`];
  if (active) parts.push(`当前消息：${active.label}`);
  return `${parts.join('；')}。`;
}
