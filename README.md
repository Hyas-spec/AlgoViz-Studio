# AlgoViz · 算法视界

> 说一句原理，生成一段可单步、可调参、可导出的算法动画。

面向计算机 / 理工科学生的「讲义双页」式算法可视化工作台：左页讲解（正文、公式、伪代码），右页图版（可播放的算法动画 + 标尺时间轴）。自然语言生成 → 结构化 Scene DSL → 可复现的动画。

![AlgoViz · 讲义双页](mockups/app-spread.png)

## 状态

- ✅ 视觉定稿：讲义双页（The Spread）
- ✅ 双页版式 + 数组图版 + 三种排序（快排 / 冒泡 / 归并）
- ✅ 树图版 + 三种遍历（层序 / 前序 / 中序）
- ✅ 图图版 + BFS / Dijkstra（环形布局、边权、松弛与最短路高亮）
- ✅ 时序图版 + TCP 三次握手 / 四次挥手（参数可开丢包重传）
- ✅ Scene DSL v2：四态联合（array / tree / graph / sequence）+ Zod + 业务校验 + 规则路由
- ✅ LLM 代理 `/api/llm`：Key 只在 Node 侧，dev / preview 通用；已验通 DeepSeek 非流式与 SSE
- ✅ 参数注记：排序规模 4–16（冒泡/归并 4–12）、快排基准策略、树高 3–4 层、图起点、TCP 丢包开关，改参数即时重算
- ✅ 过程量：每帧显示比较 / 交换 / 已就位；树版显示已访问与队列长度；图版显示已访问 / 队列、已确定 / 待确定
- ✅ 教学交互：点伪代码跳帧、点大纲跳关键步、展开全部步骤、`F` 板书模式、往期讲义
- ✅ KaTeX 公式与「Scene DSL · 只读 JSON」抽屉
- ⬜ 待接入：AI 生成场景（11/15）、导出、历史分享

## 场景

| 场景 | 图版 | 默认步数 | 参数 | 特点 |
|---|---|---|---|---|
| 快排 | 数组 | 51 | n 4–16、基准 末元素/三数取中 | Lomuto 分区 |
| 冒泡 | 数组 | 72 | n 4–12 | 相邻比较、稳定 |
| 归并 | 数组 | 78 | n 4–12 | 双指针合并、O(n) 辅助空间 |
| 层序 | 树 | 24 | 树高 3–4 层 | 队列、逐层展开 |
| 前序 | 树 | 31 | 树高 3–4 层 | 栈、右孩子先压 |
| 中序 | 树 | 39 | 树高 3–4 层 | 一路向左、BST 升序 |
| BFS | 图（环形） | 15 | 起点 A / D | 队列、逐层扩散 |
| Dijkstra | 图（环形） | 17 | 起点 S / A | 暂定距离、松弛、最短路高亮 |
| 握手 | 时序 | 5（丢包 6） | 正常 / 丢包 | SYN、SYN+ACK、ACK；丢包重传 |
| 挥手 | 时序 | 6（丢包 7） | 正常 / 丢包 | 半关闭、TIME-WAIT、2MSL |

在页眉下方按「排序 / 树 / 图 / 协议」四组切换，或访问 `/?scene=quick|bubble|merge|levelorder|preorder|inorder|bfs|dijkstra|handshake|wave`。
参数也能写进地址：`/?scene=quick&size=8&pivot=1`、`/?scene=levelorder&levels=3`、`/?scene=handshake&loss=1`；`&step=12` 跳到第 13 帧。

| 图：Dijkstra 最短路 | 时序：TCP 三次握手 |
|---|---|
| ![Dijkstra](mockups/v5-dijkstra.png) | ![TCP 三次握手](mockups/v5-handshake.png) |

> 规模上限来自 DSL 的 120 步约束：n = 16 的快排已经 115 步，n = 12 的冒泡 104 步。再大就只能压缩讲解粒度，不如把上限标在参数表里。

## 教学操作

- **点伪代码**：跳到该行下一次出现的步骤，不用拖标尺找「基准归位」。
- **点大纲 / 全部步骤**：四个关键阶段与全部单步都能直接跳。
- **`F` 板书模式**：隐藏左页、图版铺满，`Esc` 退出；页眉「演示」按钮同效。
- **往期讲义**：页脚「往期」记录最近 6 个场景与参数，刷新后自动回到上次的一页。
- **过程量**：图注下的「比较 / 交换 / 已就位」随帧变化，讲复杂度时可以直接指着说；图版换成「已确定 / 待确定」。
- **只读 JSON**：左页底部展开「Scene DSL」，能看到当前这一页的完整结构，可一键复制。

![参数与板书模式](mockups/v4-quick.png)

## AI 代理（可选）

内置场景不需要 Key；要试模型连通性，把 `.env.local.example` 复制成 `.env.local` 并填 `LLM_API_KEY`，然后：

```bash
npm run dev
curl http://127.0.0.1:5173/api/llm/health
# {"ok":true,"keyConfigured":true,"model":"deepseek-chat","upstream":"https://api.deepseek.com/v1"}
```

`POST /api/llm` 接受 OpenAI 兼容的 `{ messages, model?, temperature?, max_tokens?, stream? }`，支持 SSE 透传；Key 不会出现在前端代码或响应里。`npm run preview` 同样生效。

## 10 分钟复现

环境：Node 20.19+（本机 26.13）、npm 11+。

```bash
# 1. 安装依赖（国内网络可加 --registry=https://registry.npmmirror.com）
npm install

# 2. 环境变量（可选；当前只跑内置引擎，不需要 Key）
#    Windows: copy .env.local.example .env.local
cp .env.local.example .env.local

# 3. 启动
npm run dev

# 4. 打开
#    http://127.0.0.1:5173
```

验收：双页可见；播放/单步/标尺可用；十种场景都能播放；`<780px` 自动单列且图版在前。
`npm test` 应全绿（75 个用例，覆盖三种排序、三种遍历、BFS/Dijkstra、TCP 握手/挥手与丢包、参数与步数上限、四态校验器与规则路由）。

常见问题：

- 端口占用：改 `vite.config.ts` 的 `server.port`。
- 字体缺失：Noto Serif SC 缺失时回退宋体，不影响布局。
- 高缩放：Edge 200% 下为 954×440 的紧凑双页，左页可独立滚动。
- npm 源慢：加 `--registry=https://registry.npmmirror.com`。

## 命令

```bash
npm run dev        # http://127.0.0.1:5173
npm run build      # tsc --noEmit && vite build
npm run typecheck
npm test           # vitest run
```

## 目录

```
docs/             设计书、操作流程、Prompt 记录
  prompts/        文字版 Prompt 链（00 界面选型、01 脚手架与双页、02 引擎与三种排序）
mockups/          视觉基线、场景截图与兼容性截图
src/
  components/     双页界面、图版渲染器（figure/*）、Formula（KaTeX）、JsonDrawer（只读 DSL）
  lib/dsl.ts      Scene DSL 与业务校验
  lib/engines/    快排 / 冒泡 / 归并 / 树遍历 / BFS / Dijkstra / TCP 握手与挥手
  lib/describe.ts 图版状态的自然语言描述（读屏与 aria-label）
```

## 设计文档

- [项目设计书](docs/01-项目设计书.md)（v0.5，视觉定稿 + 实现对照见 §9.4）
- [操作流程](docs/00-操作流程.md)
- [Prompt 00 · 界面选型](docs/prompts/00-界面选型.md)
- [Prompt 01 · 脚手架与双页](docs/prompts/01-脚手架与双页.md)
- [Prompt 02 · 引擎与场景](docs/prompts/02-引擎与三种排序.md)
- 视觉基线：[concept-spread.png](mockups/concept-spread.png)
