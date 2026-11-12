# AlgoViz · 算法视界

> 说一句原理，生成一段可单步、可调参、可导出的算法动画。

面向计算机 / 理工科学生的「讲义双页」式算法可视化工作台：左页讲解（正文、公式、伪代码），右页图版（可播放的算法动画 + 标尺时间轴）。自然语言生成 → 结构化 Scene DSL → 可复现的动画。

![AlgoViz · 讲义双页](mockups/app-spread.png)

## 状态

- ✅ 视觉定稿：讲义双页（The Spread）
- ✅ 双页版式 + 数组图版 + 三种排序（快排 / 冒泡 / 归并）
- ✅ Scene DSL + Zod 校验 + 本地规则路由
- 🚧 进行中：树 / 图 / 时序图版
- ⬜ 待接入：LLM 生成、导出、Monaco/KaTeX

## 场景

| 场景 | 步数 | 特点 |
|---|---|---|
| 快排 | 46 | Lomuto 分区、末元素基准 |
| 冒泡 | 72 | 相邻比较、稳定 |
| 归并 | 78 | 双指针合并、O(n) 辅助空间 |

在页眉下方可切换，或访问 `/?scene=quick|bubble|merge`。

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

验收：双页可见；播放/单步/标尺可用；`<780px` 自动单列且图版在前。

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
```

## 目录

```
docs/             设计书、操作流程、Prompt 记录
  prompts/        文字版 Prompt 链（00 界面选型、01 脚手架与双页）
mockups/          视觉基线与兼容性截图
src/              应用源码
```

## 设计文档

- [项目设计书](docs/01-项目设计书.md)（v0.2，视觉定稿）
- [操作流程](docs/00-操作流程.md)
- [Prompt 00 · 界面选型](docs/prompts/00-界面选型.md)
- [Prompt 01 · 脚手架与双页](docs/prompts/01-脚手架与双页.md)
- 视觉基线：[concept-spread.png](mockups/concept-spread.png)
