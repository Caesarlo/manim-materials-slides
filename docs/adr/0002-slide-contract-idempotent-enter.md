# ADR 0002: 幻灯片契约——enter(step, animate) 幂等，跳转必须等于点过来

topic: slide-contract
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

演示时会回退、跳页、刷新、连点（FR-1、FR-2）。如果每一步只写“相对上一步的变化”，回退和跳转就会出现残影、状态错乱，而这类问题在现场最难补救。

## Decision

**每页暴露 `enter(step, animate)`：写“第 1..step 步累积后的完整状态”，不写增量；`animate=true` 才播放动画，`animate=false`（回退/跳转/刷新）必须立刻给出与“逐步点过来”完全一致的画面。** 并用无头浏览器自动验证这一点（`npm run check`：每步比较“点过来”和“直接跳”两种路径的截图，差异 ≤ 0.1%）。

## Considered Options

### Option A: 增量动画（每步只做变化）
- Pros: 写起来最直观。
- Cons: 回退/跳转要么不支持，要么需要为每步写逆操作。

### Option B: 幂等状态 + 步骤合并（选中）
- Pros: 回退、跳转、刷新天然正确；可以自动测试；3D 与 CSS 过渡共用同一思路（目标状态 → 阻尼/过渡逼近）。
- Cons: 作者要想清楚“某一步的完整状态”；动画不能依赖时间序列。

## Consequences

- manim 舞台：向前一步播放该步动画，其余情况**重建对象并瞬间应用 1..k 步**（所以 `build` 必须每次创建全新对象，不要放进模块变量）。
- 声明式页面（`crystalSlide`、`chartSlide`）用“后一步继承前一步”的浅合并实现，作者只写变化的字段。
- **不要用 requestAnimationFrame / setTimeout 驱动动画状态**；位移用 CSS transform 过渡，3D 用目标值阻尼。
- `check-deck` 在页面整页淡入完成后才开始计时，避免机器忙时截到半透明画面。
