import type { ChatMessage } from './client';

/**
 * 一个完整、能通过 validateScene 的示例。把它放进 system prompt，
 * 比只写字段说明更能约束模型的输出形状。
 */
export const EXAMPLE_SCENE = {
  id: 'ai-selection',
  title: '选择排序',
  chapter: 'CH.AI / SORTING',
  section: 'AI 生成 · 排序',
  kicker: 'SELECTION SORT',
  figNo: 'AI.1',
  pages: [40, 41],
  layout: 'array',
  category: 'sort',
  summary: '每轮从未排序区间里选出最小值，放到区间最前面。',
  body: [
    '选择排序把数组分成已排序和未排序两段。每轮扫描未排序区间，找到最小值，与区间第一个元素交换。',
    '选择排序的比较次数固定是 n(n-1)/2，交换最多 n-1 次；它不稳定，因为交换会跨过相等元素。',
  ],
  formula: 'T(n) = O(n^2)',
  complexity: { time: 'O(n^2)', space: 'O(1)' },
  code: [
    'function selectionSort(a):',
    '  for i in 0..n-1:',
    '    j = argmin(a[i..])',
    '    swap(a[i], a[j])',
  ],
  note: '为什么选择排序不稳定？交换最小值时可能把前面的相等元素跨过去。',
  question: '追问一句：选择排序为什么不稳定？',
  figure: 'SELECTION SORT',
  facts: [
    { label: '时间', value: 'O(n²)' },
    { label: '空间', value: 'O(1)' },
    { label: '稳定', value: '否' },
  ],
  outline: [
    { label: '扫描', value: 'argmin', step: 0 },
    { label: '交换', value: 'swap', step: 3 },
    { label: '收缩区间', value: 'i+1', step: 4 },
    { label: '完成', value: 'done', step: 7 },
  ],
  steps: [
    {
      caption: '初始数组 [3,1,2]，从下标 0 开始扫描。',
      codeLine: 2,
      metrics: [
        { label: '比较', value: '0' },
        { label: '交换', value: '0' },
      ],
      state: {
        kind: 'array',
        values: [3, 1, 2],
        pivot: null,
        compare: null,
        swap: null,
        locked: [],
        range: [0, 2],
      },
    },
    {
      caption: '比较 a[0]=3 与 a[1]=1，记录当前最小值 1。',
      codeLine: 3,
      metrics: [
        { label: '比较', value: '1' },
        { label: '交换', value: '0' },
      ],
      state: {
        kind: 'array',
        values: [3, 1, 2],
        pivot: null,
        compare: 1,
        swap: null,
        locked: [],
        range: [0, 2],
      },
    },
    {
      caption: '比较 a[0]=3 与 a[2]=2，最小值仍是 1。',
      codeLine: 3,
      metrics: [
        { label: '比较', value: '2' },
        { label: '交换', value: '0' },
      ],
      state: {
        kind: 'array',
        values: [3, 1, 2],
        pivot: null,
        compare: 2,
        swap: null,
        locked: [],
        range: [0, 2],
      },
    },
    {
      caption: '把最小值 1 与 a[0] 交换。',
      codeLine: 4,
      metrics: [
        { label: '比较', value: '2' },
        { label: '交换', value: '1' },
      ],
      state: {
        kind: 'array',
        values: [1, 3, 2],
        pivot: null,
        compare: null,
        swap: [0, 1],
        locked: [0],
        range: [0, 2],
      },
    },
    {
      caption: '未排序区间缩到 [1..2]，当前最小值是 3。',
      codeLine: 2,
      metrics: [
        { label: '比较', value: '2' },
        { label: '交换', value: '1' },
      ],
      state: {
        kind: 'array',
        values: [1, 3, 2],
        pivot: null,
        compare: 1,
        swap: null,
        locked: [0],
        range: [1, 2],
      },
    },
    {
      caption: '比较 a[1]=3 与 a[2]=2，最小值是 2。',
      codeLine: 3,
      metrics: [
        { label: '比较', value: '3' },
        { label: '交换', value: '1' },
      ],
      state: {
        kind: 'array',
        values: [1, 3, 2],
        pivot: null,
        compare: 2,
        swap: null,
        locked: [0],
        range: [1, 2],
      },
    },
    {
      caption: '把最小值 2 与 a[1] 交换。',
      codeLine: 4,
      metrics: [
        { label: '比较', value: '3' },
        { label: '交换', value: '2' },
      ],
      state: {
        kind: 'array',
        values: [1, 2, 3],
        pivot: null,
        compare: null,
        swap: [1, 2],
        locked: [0, 1],
        range: [1, 2],
      },
    },
    {
      caption: '数组有序，排序完成。',
      codeLine: 4,
      metrics: [
        { label: '比较', value: '3' },
        { label: '交换', value: '2' },
      ],
      state: {
        kind: 'array',
        values: [1, 2, 3],
        pivot: null,
        compare: null,
        swap: null,
        locked: [0, 1, 2],
        range: [0, 2],
      },
      doneAll: true,
    },
  ],
  params: [],
  source: 'ai',
};

const EXAMPLE_JSON = JSON.stringify(EXAMPLE_SCENE, null, 2);

export const SYSTEM_PROMPT = `你是 AlgoViz（算法视界）的 Scene DSL 生成器。你只输出一个合法 JSON 对象，不输出 Markdown 代码围栏、解释或前后缀。

用户会给你一个算法或协议主题。你的任务是生成一节可单步播放的算法讲义场景，必须通过 AlgoViz 的 Zod 结构校验与业务校验。

【总规则】
1. 只输出 JSON 对象，第一个字符是 {，最后一个字符是 }；不要写 \`\`\`json。
2. 字段名、枚举值必须与下面完全一致；不要增加未声明字段。
3. 文本用中文（代码和公式除外）；不要 HTML、不要脚本、不要控制字符。
4. 帧数下限：排序至少 24 帧（建议 30–50，每次比较/交换/写入都单独成帧），树/图至少 12 帧，查找至少 8 帧，时序至少 5 帧；上限 120。示例只有 8 帧，只展示字段形状，不要照抄长度。每帧必须有 caption / codeLine / state。
5. 所有步骤的 state.kind 必须等于 scene.layout；同一场里数组 length、图节点/边、时序泳道必须保持不变。树允许插入新节点、允许旋转改变 parent/side，但旧节点不能消失，且每帧必须根唯一、无环。规模建议：排序数组必须 8–10 个元素（少于 8 个视为不合格），查找 7–10 个，树 7–12 个节点，图 5–8 个节点。
6. 最后一帧必须 doneAll: true；数组终态升序，树/图遍历完成，时序 active 为 null。
7. outline 恰好 4 项，step 指向 0..steps.length-1；codeLine 指向 1..code.length。
8. facts 恰好 3 项；params 固定为 []；source 固定为 "ai"。
9. 不要写“省略”“同上”等占位；必须输出完整、可 JSON.parse 的内容。
10. 页面字段：pages 用 [40, 41]；figNo 用 "AI.1"；chapter 用 "CH.AI / ..."；section 用 "AI 生成 · ..."。

【Scene 字段】
{
  "id": "字符串，≤40",
  "title": "字符串，≤40",
  "chapter": "字符串，≤60",
  "section": "字符串，≤60",
  "kicker": "字符串，≤40",
  "figNo": "字符串，≤10",
  "pages": [40, 41],
  "layout": "array | tree | graph | sequence",
  "category": "sort | search | tree | graph | network | other",
  "summary": "一句话，≤160",
  "body": ["1–4 段正文，每段 ≤400 字"],
  "formula": "LaTeX 公式，≤120",
  "complexity": { "time": "≤24 字", "space": "≤24 字" },
  "code": ["1–12 行伪代码，每行 ≤120 字"],
  "note": "边注，≤400 字",
  "question": "一句追问，≤160 字",
  "figure": "图题，≤40 字",
  "facts": [{ "label": "≤16", "value": "≤24" }, ... 恰好 3 项],
  "glossary": [{ "term": "≤16", "text": "≤60" }, ... 可选，最多 10 项；协议场景建议给],
  "outline": [{ "label": "≤16", "value": "≤24", "step": 0 }, ... 恰好 4 项],
  "steps": [Step, ...],
  "params": [],
  "source": "ai"
}

【Step 字段】
{
  "caption": "这一帧的讲解，≤160 字",
  "codeLine": 1,
  "metrics": [{ "label": "≤8", "value": "≤12" }, ... 可选，最多 3 项],
  "doneAll": true,
  "state": ArrayState | TreeState | GraphState | SequenceState
}

【ArrayState】layout = "array"
{
  "kind": "array",
  "values": [数字, ... 长度 2–64，整场不变],
  "pivot": null | 下标,
  "compare": null | 下标,
  "swap": null | [下标, 下标],
  "locked": [下标, ...],
  "range": [左下标, 右下标],
  "aux": 仅归并排序可选：{
    "left": [数字...], "right": [数字...],
    "i": 左段指针, "j": 右段指针, "target": 目标写入下标
  }
}
数组终态 values 必须升序，locked 包含全部下标。

【TreeState】layout = "tree"
{
  "kind": "tree",
  "nodes": [{ "id": "n1", "label": "≤12", "parent": null | "nX", "side": "L" | "R" }],
  "order": ["已访问 id", ...],
  "current": null | "id",
  "frontier": ["待访问 id", ...],
  "frontierLabel": "队列" | "栈"
}
根节点必须恰好一个且 parent 为 null；非根节点必须有 side；禁止环；id 不得重复。

【GraphState】layout = "graph"
{
  "kind": "graph",
  "nodes": [{ "id": "s", "label": "≤12" }],
  "edges": [{ "from": "s", "to": "t", "weight": 正数, "directed": false }],
  "visited": ["id", ...],
  "frontier": ["id", ...],
  "path": ["id", ...],
  "current": null | "id",
  "dist": [{ "id": "s", "value": "0" }, ...],
  "frontierLabel": "队列" | "待确定"
}
边端点必须存在；禁止自环；dist 的 id 不得重复。

【SequenceState】layout = "sequence"
{
  "kind": "sequence",
  "lanes": [{ "id": "client", "label": "客户端" }, { "id": "server", "label": "服务器" }],
  "messages": [{
    "id": "m1", "from": "client", "to": "server", "label": "≤24",
    "tone": "syn" | "ack" | "data" | "fin" | "lost",
    "lost": false
  }],
  "active": null | "m1",
  "notes": [{ "lane": "client", "text": "≤40" }]
}
lanes 至少 2 条；消息端点必须在 lanes 中；消息 id 不得重复；active 必须指向存在的消息。

【质量要求】
- 先判断主题属于哪类：排序/查找优先 array，树的遍历优先 tree，图算法优先 graph，TCP/协议优先 sequence；不要一律生成数组。
- 第一帧交代场景，最后一帧交代终态；中间帧每步只做一件可观察的事。
- 数组版：比较/交换/写入用 compare/swap/locked 等字段表达，不要只改 values 不解释。
- 树版：frontier 表示队列/栈；order 是已访问顺序；frontierLabel 固定用“队列”或“栈”。
- 图版：BFS 用 visited/frontier；Dijkstra 用 dist/path/frontierLabel=“待确定”，dist 值用字符串，未确定可写 "∞"。
- 时序版：每条消息单独一帧推进；active 指向当前消息；丢包用 lost:true，重传另起一条消息。
- 公式用 LaTeX；代码行必须能对应到 codeLine。

【完整示例（必须保持同样的字段形状）】
注意：这个示例只有 8 帧，是为了展示字段形状；排序场景实际必须至少 24 帧。
${EXAMPLE_JSON}

现在根据用户主题生成新的 JSON。再次强调：只输出 JSON 对象，不要任何解释。`;

const REPAIR_PREFIX = `上一次输出没有通过 AlgoViz 的校验。请只返回修正后的完整 JSON 对象，不要解释、不要代码围栏。

校验问题：
`;

const REPAIR_RULES = `
修复要求：
1. 只修改问题涉及的路径，保持主题、已正确的字段和讲解内容不变。
2. 重新检查：layout 与每帧 state.kind 一致；数组长度/树节点/图节点/泳道在整场一致；所有引用 id 存在。
3. 重新检查：outline 恰好 4 项且 step 在范围内；codeLine 在 1..code.length；facts 恰好 3 项；最后一帧 doneAll=true。
4. 结构细节：树只能有一个根（parent=null），非根必须有 side L/R，禁止环；图边端点必须存在、禁止自环；时序消息端点必须属于 lanes、消息 id 不重复。
5. 排序场景少于 24 帧必须继续展开比较/交换/写入步骤；树/图少于 12 帧也要补足。
6. 输出完整 JSON，不要用“省略”或注释。`;

export function buildInitialMessages(prompt: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];
}

export function buildRepairMessages(prompt: string, raw: string, issues: { path: string; message: string }[]): ChatMessage[] {
  const issueText = issues.map((issue) => `- ${issue.path || '$'}: ${issue.message}`).join('\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
    { role: 'assistant', content: raw || '（上一次输出为空）' },
    { role: 'user', content: `${REPAIR_PREFIX}${issueText}\n${REPAIR_RULES}` },
  ];
}
