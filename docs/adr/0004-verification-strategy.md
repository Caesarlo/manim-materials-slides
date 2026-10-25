# ADR 0004: 验证策略——纯逻辑单测 + 无头逐步检查，CI 只跑快的部分

topic: verification
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

视觉项目的“对不对”很难靠类型和单测覆盖：文字压图、颜色看不清、标签重叠都不是编译或控制台错误（NFR-4）。同时无头浏览器检查慢（画廊 50 余步约 8 分钟）且依赖本机 Chrome 的软件渲染。

## Decision

分三层验证：
1. **`npm run verify`**（快，约 15 秒）：`tsc --noEmit` + `vitest run` + `vite build`。是 `harness.config.json` 的 `verify` 命令，也是 CI 跑的内容。
2. **纯逻辑单测**：计算与排版逻辑放进不依赖 DOM/CSS 的 `*Math.ts` / `structure.ts` / `graph.ts` 等，断言使用**手算得出的值**（不只测“不抛错”）。
3. **`npm run check`**（慢）：无头 Chrome 逐页逐步跳转，抓控制台错误，并对比“点过来 vs 直接跳”的截图；**合并前在本地运行**，不放进 CI。改了某类组件就跑对应画廊（`--talk gallery` / `gallery-llm` / `example`）。
4. **人眼看截图**是必须步骤（`check/<演讲名>/`），自动检查只能保证一致性，不能保证好看。

## Considered Options

### Option A: 只靠 CI 的 tsc + 单测
- Pros: 快。
- Cons: 抓不到视觉与交互回归。

### Option B: CI 里也跑无头浏览器检查
- Pros: 全自动。
- Cons: 慢；GitHub runner 上的软件 WebGL 未验证；误报风险（机器忙时动画未收敛）。

### Option C: CI 跑快的，慢的本地合并前跑（选中）
- Pros: 反馈快，视觉回归仍有保障。
- Cons: 依赖开发者自觉；以后可再评估把 `check` 加入 CI。

## Consequences

- 每个新组件必须带：纯逻辑单测 + 画廊里的一页示范 + 通过 `check`。
- `check-deck` 每个演讲输出到 `check/<演讲名>/`，互不覆盖；它在整页淡入完成后才计时。
- 测试文件如果 import 带 CSS 的模块，vitest 的 node 环境会加载失败，所以纯逻辑文件不要 import CSS。
