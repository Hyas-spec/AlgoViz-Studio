---
title: AlgoViz|Prompt 历史快照
doctype: AI 对话历史导出
kicker: 传智杯 · 省赛 B 组 · 个人 · 作品《AlgoViz · 算法视界》
subtitle: 四条核心迭代的完整 Prompt 链：提问、AI 建议、失败定位、修复指令与最终结果。
author: 何丹丹
school: 新余学院
group: B 组 · 个人
repo: https://github.com/Hyas-spec/AlgoViz-Studio
version: v1.0（提交版）
date: 2026-11-18
toc: false
h1break: true
header: AlgoViz Studio
---

# 说明

本文件是参赛作品的 **Prompt 历史快照**，用于证明作品的 AI 演进过程真实、可复现，而不是一次性生成。

- 开发工具：DeepSeek Harness（DSH），以 AI 编程代理方式参与日常开发；
- 产品内模型：DeepSeek-Chat（OpenAI 兼容接口），经 `/api/llm` 以 SSE 流式调用；
- 记录方式：每轮迭代固定记录「用户 Prompt → AI 输出 / 建议 → 发现的问题 → 修复指令 → 最终结果 → 对应 commit → 截图」；
- 收录范围：00 界面选型、01 脚手架与双页、02 Scene DSL 与三种排序（含 02b 四态扩展、02c 参数与过程量）、03 AI 生成与修复（含 AI 历史与直接讲解）。

## 证据索引

| 编号 | 主题 | 关键提交 | 截图 |
|---|---|---|---|
| 00 | 界面选型：4 个方向 → 讲义双页 | 早期 `docs:` / `chore:` 提交 | `assets/00-01..00-03` |
| 01 | 脚手架与双页首屏（含兼容性修复） | `chore: scaffold` / `fix(...)` | `assets/01-01..01-05` |
| 02 | Scene DSL、三种排序、四态扩展、参数与过程量 | `feat(dsl)` / `feat(figure-*)` / `feat(engine-*)` | `assets/02-*`、`02b-*`、`02c-*` |
| 03 | AI 生成 → 校验失败 → 修复 → 上屏；AI 历史 + 直接讲解 | `cee9af8`、`27a09a7`、`feat(ai)` 历史/讲解 | `assets/03-01..03-05` |

> 截图说明：为控制 PDF 体积与版式，本文件只收录关键截图，并把长对话截图切成连续片段（标注 1/2、2/2…）；完整 17 张原图保存在仓库 `docs/prompts/assets/`，可在 GitHub 上逐张查看。

> 阅读提示：每条链里的「失败」都是真实发生的，不是摆拍；修复指令保留了当时的原始措辞，个别数字（如测试数量 86 / 87 / 91 / 92）是不同时间点的快照，正文中已注明。



<!-- pagebreak -->

# 迭代 00 · 界面选型：4 个方向 → 讲义双页

- 日期：2026-11-12
- 工具/模型：DeepSeek Harness（本会话）
- 目标：摆脱「深色三栏 Dashboard」的模板感，确定视觉方向
- 说明：评审要求提交对话截图；本文件是文字版 Prompt 链，截图已归档在文末（`assets/00-*`）。

## Prompt（用户原话，节选）

> 界面太千篇一律了，你现在以一名 web 页面设计专家的身份，重新设计页面排版和动画效果，可以让界面带一点不影响视觉体验动态效果，依旧先给我看一下图片。

> 你再设计 3-5 种界面供我挑选，不局限于固定排版。

> 我喜欢第二种，按第二种来吧。

## AI 输出

第一轮先否掉「深色三栏 + 卡片」的默认答案，改成**「算法手稿 / 学术图版」**：纸面、栏线、图版编号、页边注、胶片时间轴。

第二轮并行给出四个结构完全不同的方向：

| 编号 | 方向 | 结构 |
|---|---|---|
| 01 | Stage | 全屏画布即背景，控件是 HUD |
| 02 | Spread | 左页讲解 / 右页图版，中缝装订 |
| 03 | Poster | 12 栏海报、色块、超大字号 |
| 04 | Terminal | ALGO/OS 终端，ASCII 柱状图 |

产出：`mockups/concept-*.png`、`concepts-overview.png`。

## 决策

选定 **02 Spread**：

- 算法讲解天然是「左文右图」的阅读关系；
- 双页把讲解和演示放在同一视线里，与常见 Dashboard 一眼区分；
- 仍可承载完整交互（输入、标尺、导出）。

## 对应 commit

- `ebcb15c` docs: design book v0.2 and visual baselines
- 视觉基线：`mockups/concept-spread.png`

## 截图（已归档）

### 00-01 需求：界面太千篇一律

（截图 `assets/00-01-brief.jpg` 见仓库同名文件）

### 00-02 四方向对比

（截图 `assets/00-02-four.jpg` 见仓库同名文件）

### 00-03 选定讲义双页

![用户选择第二种（1/2）](../../.tmp/prompt-slices/00-03-choice-1.png){width=12cm}

![用户选择第二种（2/2）](../../.tmp/prompt-slices/00-03-choice-2.png){width=12cm}

> 截图由用户于 2026-11-12 提供；原始文件见 `assets/`。



<!-- pagebreak -->

# 迭代 01 · 脚手架与双页首屏

- 日期：2026-11-12
- 目标：把 Spread 从静态稿做成可运行页面
- 说明：评审要求提交对话截图；本文件是文字版 Prompt 链，截图已归档在文末（`assets/01-*`）。

## Prompt（节选）

> 我喜欢第二种，按第二种来吧。

> GitHub：https://github.com/Hyas-spec/AlgoViz-Studio
> LLM Key：DeepSeek（我自己填 `.env.local`）
> 报名状态：已缴费，B 组，个人

> 先调试一下页面的画面兼容性，比如 edge 展示出来是如图……

## 实施

1. Vite 8 + React 19 + TS；样式用 CSS 变量（纸/墨/钴蓝/朱砂），不引入 UI 框架。
2. 快排引擎：Lomuto 分区、末元素基准、每步数组快照，共 46 步。
3. 图版：Canvas 2D，28px 网格、墨色柱、朱砂基准、蓝色斜纹比较。
4. 交互：播放/暂停、单步、点击标尺跳帧、倍速、键盘。
5. 布局：双页 + 中缝 + 页码；图版 flex 填充剩余高度。

## 遇到的问题与修复

| 问题 | 原因 | 修复 |
|---|---|---|
| 正文两栏出现孤字 | CSS columns 把段落拆开 | 改成两个显式栏 |
| 图版把图注/标尺顶出首屏 | 固定宽高比、没有高度适配 | 图版 `flex:1` 填满剩余高度 |
| 高缩放时单列、正文全宽 | 断点 1179 太高 | 断点降到 780，字号 `clamp()` |
| 短屏左页内容被截 | 页面按固定间距排 | 左页独立滚动、追问条吸底、≤560 高隐藏代码 |

## 结果

- 可运行：`npm run dev` → <http://127.0.0.1:5173>
- 截图：`mockups/app-spread.png`、`mockups/compat-*.png`
- 验证视口：1908×880、1600×1000、1366×768、1272×587、954×440

## 对应 commit

- `8c7b64f` chore: scaffold vite react ts
- `6628e01` feat(engine): quicksort step generator
- `f573950` feat(figure): canvas array plate
- `6164f3d` feat(spread): two-page workspace with ruler player
- `68be9cd` fix(layout): fit viewport height and improve narrow-screen stacking
- `8cb81bf` fix(layout): fluid type, scrollable notes and 780px breakpoint

## 截图（已归档）

### 01-01 开工：仓库 / Key / 报名 + 首个双页

（截图 `assets/01-01-kickoff.jpg` 见仓库同名文件）

### 01-03 兼容性问题与第一次修复

（截图 `assets/01-03-bug-edge.jpg` 见仓库同名文件）

### 01-04 第二次修复：连续自适应

![改为 clamp 连续自适应、780 断点、左页滚动（1/3）](../../.tmp/prompt-slices/01-04-fluid-fix-1.png){width=12cm}

![改为 clamp 连续自适应、780 断点、左页滚动（2/3）](../../.tmp/prompt-slices/01-04-fluid-fix-2.png){width=12cm}

![改为 clamp 连续自适应、780 断点、左页滚动（3/3）](../../.tmp/prompt-slices/01-04-fluid-fix-3.png){width=12cm}

### 01-05 版式确认

（截图 `assets/01-05-fixed.png` 见仓库同名文件）

> 说明：`01-02` 首屏截图已包含在 `01-01` 中；`01-04-devtools.png`（控制台 371/531/1.6625）未单独提供，不影响修复链完整性。



<!-- pagebreak -->

# 迭代 02 · Scene DSL 与三种排序

- 日期：2026-11-12
- 目标：把“只有快排”的单场景重构成可切换、可校验的 Scene
- 说明：对话截图 `02-01-engine.jpg` 已归档。

## Prompt（节选）

> 有缺漏吗，没有就继续你的任务

（截图 `./assets/02-01-engine.jpg` 见仓库同名文件）

## 实施

1. `src/lib/dsl.ts`：Scene / Step 的 Zod Schema，约束步数、区间、锁定下标、文案非空。
2. `src/lib/engines/`：`quick` / `bubble` / `merge` 三个引擎，统一输出 `Scene`，并由 Schema 校验。
3. `src/lib/engines/index.ts`：规则路由 `routeScene()` —— “冒泡 / 归并 / 快排”关键词直接命中内置场景。
4. `App.tsx`：场景切换、`safeIndex` 防止切场景越界；facts / outline / code / note / question 全部数据驱动。
5. 图版保持不变：Canvas 2D、28px 网格、墨色柱、朱砂基准、蓝色斜纹比较。

## 遇到的问题与修复

| 问题 | 原因 | 修复 |
|---|---|---|
| 切换场景后 facts / outline 仍是快排 | 这两块原来是静态 JSX | 写进 Scene，数据驱动 |
| 切换场景瞬间 index 越界 | 新场景步数更少 | `safeIndex = min(index, last)` |
| 改了 App 但页面还是旧内容 | Vite 模块缓存未失效 | 重启 dev server |
| 归并 note 里出现反引号 | 文案里写了 Markdown 标记 | 去掉反引号 |

## 验证

- `npm run test`：7 passed（三场景终态有序、每步长度、路由关键词）。
- `npm run build`：通过。
- 截图：`mockups/scene-quick.png`、`scene-bubble.png`、`scene-merge.png`。

## 对应 commit

- `feat(engines): scene DSL, bubble/merge and rule router`（本次提交）

---

# 迭代 02b · 四态 DSL 与树图版

- 日期：2026-11-13
- 目标：把「数组专用」的 Step 扩成四种图版共用的联合类型，并接入树图版与三种遍历
- 说明：对话截图 `02b-01-plan.jpg`、`02b-02-dsl.jpg` 已归档。

## Prompt（节选）

> 根据操作流程和项目设计书的文件内容，和昨天项目进度，告诉我今天的任务有哪些
>
> 开始

（截图 `./assets/02b-01-plan.jpg` 见仓库同名文件）

## 判断（AI 提出、我确认）

昨天的 `Step` 是 `{ values, pivot, compare, swap, locked, range }`，数组专用；树的 `nodes/order/frontier` 根本塞不进去。设计书 §9 本来就是四态联合，所以第一步不是画树，而是先把 DSL 改回去——否则后面三种图版全是白写。

## 实施

1. `src/lib/dsl.ts`：`arrayState / treeState / graphState / sequenceState` 四个 Zod 对象 + `stepSchema.state` 判别联合；`Scene` 增加 `layout / category / section / figNo / pages`。
2. 业务校验：`inspectScene()` 独立于 Schema，检查下标越界、根唯一、父节点存在、环、左右子位重复、悬空边、自环、泳道引用、数组长度恒定；失败抛 `SceneIssueError`（`path + message` 列表，后续直接回喂模型）。
3. `src/components/figure/`：拆 `plate.ts`（纸面 + 28px 网格）、`array.ts`、`tree.ts`；`Figure.tsx` 只负责画布、DPR、补间与按 `state.kind` 分发。
4. 树布局：中序给横向槽位、深度给层高，坐标全由渲染器算；底部画「队列 / 栈」游标，队首/栈顶蓝色高亮。
5. `src/lib/engines/tree.ts`：固定 15 节点满二叉树，层序 / 前序 / 中序三个场景；前序显式「先压右、再压左」。
6. `index.ts`：6 个场景 + 标签 + 路由（层序/前序/中序/二叉树/遍历）。
7. `App.tsx`：页眉讲次、图号、页码改为场景数据；`&step=n` 深链到指定帧。

## 遇到的问题与修复

| 问题 | 原因 | 修复 |
|---|---|---|
| 左页页码被追问条盖住 / 在矮屏被切断 | `.left` 是滚动容器，页码 absolute 跟着内容走；grid 行高由内容撑开 | `.spread` 加 `grid-template-rows: minmax(0,1fr)`；左页拆出 `.left-scroll`，页码留在滚动区外 |
| `&step=12` 打开仍停在第 1 帧 | React StrictMode 挂载时 effect 跑两遍，第二遍把 index 归零 | 用 `sceneRef` 比对 sceneId，只在真正切换场景时归零 |
| 6 个 tab 在 1024 宽挤成两行、参差 | 固定 `gap` 不换行 | `flex-wrap: wrap` + `gap: 4px 14px` |
| `Set-Content` 改 CSS 后中文注释变乱码 | PowerShell 默认按 GBK 读 UTF-8 | `git checkout` 该文件，改用编辑工具重做三处改动 |
| `ReplaceFileW EIO (Win32 32)` 频繁失败 | Vite watcher / 索引器占着文件句柄 | 停 dev server 再改；或稍后重试 |
| Edge headless 390 宽截图被裁 | Chromium 最小窗口宽约 500px，`--window-size=390` 不生效 | 用 CDP `Emulation.setDeviceMetricsOverride` 模拟 390，再 `Page.captureScreenshot` |

（截图 `./assets/02b-02-dsl.jpg` 见仓库同名文件）

## 验证

- `npm test`：25 passed（3 排序终态、3 遍历顺序、BST 中序升序、校验器 7 个反例、路由）。
- `npm run typecheck` / `npm run build`：通过。
- 截图：`mockups/scene-levelorder.png`、`scene-inorder.png`（第 13 帧）、`compat-1024-tree.png`、`compat-390-tree.png`。

## 对应 commit

- `refactor(dsl): four-kind step union with business validation`
- `feat(figure-tree): deterministic level layout and queue cursor`
- `feat(engine-tree): level, preorder and inorder traversal scenes`
- `fix(spread): pin page numbers and keep left page scrollable`

---

# 迭代 02c · 参数注记与过程量

- 日期：2026-11-13 晚
- 目标：解决试用时发现的「不能改规模、复杂度是死的、伪代码不能点、后排看不清」
- 说明：对话截图 `02c-00-review.jpg`、`02c-01-ask.jpg` 已归档（试玩评审 → 10 条问题 → 九项交付与 120 步偏差）。

## 背景：先试玩，再列问题

用户让我以「软件工程学生 + 老师」两个角度试用，产出了下面这份评审；其中 5 条「不爽」直接变成下一轮的输入。

（截图 `./assets/02c-00-review.jpg` 见仓库同名文件）

## Prompt（节选）

> 现在你完善一下项目功能，解决如下问题，有拿不准的先问我再执行，不要跑偏
>
> （列出 10 条：参数、伪代码、最近打开、过程量、tab 分组、对比度、板书模式、步骤目录、导出、读屏）

![10 条问题与九项交付（1/4）](../../.tmp/prompt-slices/02c-01-ask-1.png){width=12cm}

![10 条问题与九项交付（2/4）](../../.tmp/prompt-slices/02c-01-ask-2.png){width=12cm}

![10 条问题与九项交付（3/4）](../../.tmp/prompt-slices/02c-01-ask-3.png){width=12cm}

![10 条问题与九项交付（4/4）](../../.tmp/prompt-slices/02c-01-ask-4.png){width=12cm}

## 先问后做

导出要引 gif.js + worker，是最容易翻车的一块；参数范围又与「120 步」上限冲突。所以先确认两件事：今天不含导出、参数做规模 + 基准策略 + 树高。

## 实施

1. `Scene.params`（int / enum）+ `createScene(id, params)` 工厂；固定种子的样本数组保证「同参数同结果」，参数越界由引擎钳制并在界面回写。
2. `Step.metrics`（≤3 项）与 `outline[].step`：每帧的比较 / 交换 / 已就位、树的已访问 / 队列长度，都由引擎产出。
3. 左页参数表：排序规模滑杆、基准策略分段器、树高滑杆；改动即时重算并回到第 1 帧，参数写进 URL。
4. 伪代码行改成按钮，跳到该行下一次出现的步骤；大纲四条与「全部 N 步」都能点。
5. `F` / 页眉「演示」进入板书模式：隐藏左页、图版铺满，`Esc` 退出。
6. 往期讲义：localStorage 记最近 6 个场景 + 参数，刷新自动回到上次一页。
7. `--faint` 从 `#9B9382` 加深到 `#7A7263`（纸色上约 4.5:1），8px 以下字号统一抬到 8px 下限。
8. `describeState()`：把当前帧说成一句话，canvas 的 `aria-label` 与 `aria-live` 共用。

## 遇到的问题与修复

| 问题 | 原因 | 修复 |
|---|---|---|
| 冒泡/归并 n=24 直接爆 120 步 | 每步都有讲解，步数随 n² / n log n 增长 | 按算法标上限：快排 4–16、冒泡/归并 4–12，README 与设计书写明原因 |
| 切到树版后 URL 还带着 `size/pivot` | 只 set 不删旧参数 | 同步时删掉当前场景没有的 key |
| 同一个场景的往期记录点了没反应 | 只在 sceneId 变化时才应用参数 | 同场景直接 `setParams`，跨场景走 pending 参数 |
| 三数取中的第一帧橙色标错位置 | 选基准那一步把末位当成了 pivot | 选基准时标中位下标，交换后再标末位 |
| 参数越界时滑杆显示 99、画面却是 12 | URL/历史里的脏参数没回写 | 用场景 spec 钳制后 `setParams` |
| Vite 原生配置加载器警告 | `import './server/llmProxy'` 没有扩展名 | 改成 `./server/llmProxy.ts` |

## 验证

- `npm test`：49 passed（含每个受支持 n 的终态有序与 ≤120 步、参数确定性、三数取中、树 3/4 层、脏参数钳制、校验器反例）。
- 交互实测（CDP）：三数取中切到 59 步、n=6 变 30 步、点第 4 行跳到第 2 帧、`F` 后左页 `display:none`、`Esc` 退出、往期面板 2 条可恢复、canvas aria 与 live region 内容一致。
- 截图：`mockups/v4-quick.png`、`v4-tree3.png`、`v4-focus.png`、`v4-recent.png`。

## 对应 commit

- `feat(engines): parameterized scenes with metrics and jump marks`
- `feat(spread): parameter panel, live metrics, jumpable code and focus mode`



<!-- pagebreak -->

# 迭代 03 · AI 生成与校验修复（文字 + 对话截图）

- 日期：2026-11-14（生成/修复），2026-11-15（AI 历史 + 直接讲解并入）
- 工具/模型：DeepSeek Harness，`deepseek-chat`，经 `/api/llm` SSE
- 目标：非内置主题 → 流式生成 Scene DSL → 校验 → 自动修复 → 上屏；11/15 扩展 AI 历史与纯讲解
- 状态：**文字、对话截图、应用截图完成**
- 对应提交：`cee9af8`（AI 闭环）、`27a09a7`（旋转与质量线修复）、11/15 的 `feat(ai)`（历史/讲解）

> 这条链是 03 号加分项；评审硬性要求至少 3 条，00/01/02 已完成。
> 对话截图由用户提供，已裁掉无关空白；应用截图只作补充，不能替代对话截图。

## 1. 用户 Prompt

> 红黑树插入

> 插入排序

> 就继续做这一部分的内容，其余先不动：AI system prompt + 前端流式 + 校验/repair

（截图 `assets/03-01-implementation.jpg` 见仓库同名文件）

> 第一轮 AI 闭环：system prompt、SSE、校验/repair 与 5 个实测主题。截图保留当时的快照：当时是 2 轮修复、86 tests，且 AI 场景不写历史；后续已升级为 3 轮、92 tests，并接入 AI 历史/讲解。

## 2. AI 第一次输出与问题

### 红黑树

第一次生成能解析，也能过 Zod，但过不了树业务校验：

```text
AI 生成失败：steps[5].state.nodes 节点 n10 的父节点在第 5 步被改动了；
steps[5].state.nodes 节点 n5 的父节点在第 5 步被改动了
```

原因不是模型“乱写”，而是红黑树插入本来就要旋转，旋转会改变 `parent / side`；旧校验器却要求整场树的父子关系不变。

### 插入排序

第一次生成能上屏，但只有 6 个元素、17 帧；对比内置快排 51 帧，内容明显单薄。

## 3. 修复指令（节选）

```text
树允许插入新节点、允许旋转改变 parent/side，但旧节点不能消失，
且每帧必须根唯一、无环。

排序至少 24 帧，数组至少 8 个元素；
每次比较/交换/写入单独成帧。
```

代码层对应：

- `src/lib/dsl.ts`：去掉“父节点不得变化”，保留“旧节点不可消失、根唯一、无环、side 不重复”。
- `src/lib/ai/generate.ts`：质量线按 category/layout 计算；修复轮从 2 提到 3。
- `src/lib/ai/prompt.ts`：系统提示加树旋转说明、排序 8 元素/24 帧下限、修复结构细节。

## 4. 最终结果

| 主题 | 结果 | 说明 |
|---|---|---|
| 红黑树插入 | 12 帧，AI 修复后 | 修复 1 轮；树可旋转/新增节点 |
| 插入排序 | 41 帧、8 个元素，AI 修复后 | 第一次 6 元素/17 帧被质量线拦下，修复 1 轮后扩展 |

结果截图：

- `mockups/v5-ai-repaired.png`（红黑树，12 帧，AI 修复后）
- `mockups/v5-ai-prim.png`（Prim，13 帧，AI 生成）
- `mockups/v5-ai-insertion.png`（插入排序 41 帧，AI 修复后）

![红黑树失败与修复的完整对话：父节点旋转、修复后 12 帧、插入排序 41 帧、验证与提交（1/2）](../../.tmp/prompt-slices/03-02-failure-fix-1.png){width=12cm}

![红黑树失败与修复的完整对话：父节点旋转、修复后 12 帧、插入排序 41 帧、验证与提交（2/2）](../../.tmp/prompt-slices/03-02-failure-fix-2.png){width=12cm}

> 第二段对话：用户报告“红黑树失败 + 插入排序内容不够多”，AI 定位到父节点旋转，修复后红黑树 12 帧、插入排序 41 帧，并记录验证与 commit。截图中的 87 passed 是当时的数量，后续已增至 92。

## 5. 验证

- `npm test`：92 passed（含 AI 答案/历史 4 例、树旋转/新增节点回归）
- `tsc --noEmit`、`vite build`：通过
- `/api/llm/health`：`keyConfigured: true`

## 6. 截图清单

- [x] 输入「红黑树插入」的对话界面（`assets/03-02-failure-fix.png`）
- [x] 流式生成/校验/修复的对话（`assets/03-01-implementation.jpg`、`03-02-failure-fix.png`）
- [x] 第一次校验报错（父节点被旋转，`03-02-failure-fix.png`）
- [x] 修复后的 12 帧与「AI 修复后」徽标（`03-02-failure-fix.png`）
- [x] 插入排序 41 帧结果（`03-02-failure-fix.png`）
- [x] 纯讲解问答卡（`assets/03-04-answer.png`、`mockups/v5-answer.png`）
- [x] AI 历史面板（`assets/03-05-history.png`、`mockups/v5-ai-history.png`）

> 全部截图已归档；对话截图在 `docs/prompts/assets/03-01..03-03`，应用截图在 `03-04..03-05` 与 `mockups/`。

## 7. 11/15 扩展：AI 历史 + 直接讲解

### 用户 Prompt

> 为什么快速排序最坏是 O(n²)？

![用户反馈 AI 功能太单调、需要历史；AI 给出三种方案并推荐方案 B（1/2）](../../.tmp/prompt-slices/03-03-plan-b-1.png){width=12cm}

![用户反馈 AI 功能太单调、需要历史；AI 给出三种方案并推荐方案 B（2/2）](../../.tmp/prompt-slices/03-03-plan-b-2.png){width=12cm}

> 方案讨论：用户提出“功能太单调、还要能回答别的问题、需要历史记录”，AI 给出 A/B/C 三种方案，推荐 B（AI 历史 + 直接讲解），并把范围压到“算法课程助教”。

### AI 输出

模型返回结构化 `answer`：

- 标题：为什么快速排序最坏时间复杂度是 O(n²)？
- 结论：每次划分极不均衡时递归深度退化为 n，总代价 O(n²)。
- 5 条要点：分区代价、极端基准、逐层累加、随机/三数取中、`introsort` 兜底。
- 公式：`T(n)=T(n-1)+O(n) => T(n)=O(n²)`
- 代码：Lomuto `partition`
- 4 条追问：递推证明、随机基准、三数取中、`introsort`

### 实现

- `src/lib/ai/answer.ts`：`answerSchema`（title/summary/3–5 points/formula/code/followups）+ 最多 2 轮修复 + `answerToScene()`（左页复用 Scene 排版）。
- `src/components/AnswerCard.tsx`：右页纯讲解卡；不再画动画图版，不显示标尺/帧号。
- `src/lib/ai/history.ts`：`algoviz:ai-history:v1`，最多 20 条，保存 prompt/scene/answer/source/mode/title；按 prompt+mode 去重；`#ai=<id>` 恢复。
- `src/App.tsx`：显式「生成图解 / 直接讲解」切换；历史面板支持搜索、恢复、删除、清空；刷新可恢复。

### 验证

- 纯讲解：右页问答卡 5 条要点 + 公式 + 代码 + 4 条追问；左页讲义排版复用。
- 刷新：URL 保持 `#ai=<id>`，页面恢复答案。
- 历史：2 条记录（图解 + 讲解），搜索「快速」只留讲解；点击恢复成功。
- 截图：`mockups/v5-answer.png`、`mockups/v5-ai-history.png`。
- 测试：`npm test` 92 passed。

![直接讲解问答卡：结论、要点、公式、代码与追问（1/1）](../../.tmp/prompt-slices/03-04-answer-1.png){width=12cm}

![AI 历史面板：图解与讲解两条记录，可搜索/恢复/删除（1/1）](../../.tmp/prompt-slices/03-05-history-1.png){width=12cm}

> 应用截图用于展示最终效果；对话截图（03-01..03-03）才是 AI 协同过程的证据。
