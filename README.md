# AlgoViz · 算法视界

> 说一句原理，生成一段可单步、可调参、可导出的算法动画。

面向计算机 / 理工科学生的「讲义双页」式算法可视化工作台：左页讲解（正文、公式、伪代码），右页图版（可播放的算法动画 + 标尺时间轴）。自然语言生成 → 结构化 Scene DSL → 可复现的动画。

![AlgoViz · 讲义双页](mockups/app-spread.png)

## 状态

- ✅ 视觉定稿：讲义双页（The Spread）
- 🚧 开发中：双页版式 + 数组图版 + 快速排序引擎
- ⬜ 待接入：LLM 生成、四类图版、导出

## 开发

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run typecheck
```

## 目录

```
docs/       设计书、操作流程、Prompt 记录
mockups/    视觉基线（concept-spread.png）
src/        应用源码
```

## 设计文档

- [项目设计书](docs/01-项目设计书.md)（v0.2，视觉定稿）
- [操作流程](docs/00-操作流程.md)
- 视觉基线：[concept-spread.png](mockups/concept-spread.png)
