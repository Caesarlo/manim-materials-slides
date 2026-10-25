# ADR 0001: 动画引擎用 manim-web，运行时自己写

topic: engine
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

目标是 3b1b 式画面 + 点击逐步推进 + 可回退 + 3D 晶体可交互（FR-1、FR-2、FR-4）。需要在“真 Manim 效果”和“现场可交互”之间取舍。

## Decision

**动画引擎用 manim-web（MIT，Manim 的 TypeScript 浏览器移植版）；幻灯片运行时（导航、步进、回退、总览、备注）自己写**，不复制任何第三方模板的代码。

## Considered Options

### Option A: manim-slides（Python Manim 渲染视频，放映时按段播放）
- Pros: 画面最接近 3b1b；公式变形最成熟。
- Cons: 产物是视频，不能交互旋转晶体；回退只能回到片段开头；每次改动要重新渲染；3D 晶体质感粗糙。

### Option B: React + Motion + react-three-fiber（本项目早期原型，已归档）
- Pros: 技术栈熟悉，可控。
- Cons: 没有 Manim 的对象形变与公式匹配变换，要自己造；“3b1b 感”弱。

### Option C: manim-web + 自写运行时（选中）
- Pros: Manim 风格 API 在浏览器实时跑，`TransformMatchingTex`、`Axes`、`Graph` 等现成；可与 three.js 并存做 3D；改完刷新即见。
- Cons: manim-web 较年轻；公式变形有坑（见后）。

### Option D: 直接 fork protein-design-interactive-slides
- Pros: 现成的点击步进模板。
- Cons: **仓库没有 LICENSE 文件**，默认保留所有权利，不能复制代码；偏蛋白质领域。

## Consequences

- 参考仓库只借鉴设计思路（每页一个模块、`enter(step, animate)` 幂等且可跳转、回退靠重建、数据由脚本预处理、无头检查），代码全部自己实现。
- manim-web 的 `TransformMatchingTex` 会就地改写源公式、不会把目标放进场景，所以统一封装为 `morphTex`（`runtime/manimStage.ts`）；`MathTex` 字形异步渲染，上色必须放在 `prepare` 钩子里。
- manim-web 带有几个未安装的可选动态导入（pptxgenjs、typst），`vite.config.ts` 用空模块顶替，不要删。
- manim-web 约 5 MB，后续可按页懒加载。
