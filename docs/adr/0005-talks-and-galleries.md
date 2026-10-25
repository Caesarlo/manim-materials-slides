# ADR 0005: 演讲按目录组织，画廊兼作文档与回归检查

topic: talks-layout
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

以后每次汇报是一场新的演讲，不能每次改模板本体（FR-10）。组件也越来越多，需要一个地方展示“每个组件长什么样、怎么用”，并且在改底座时能发现回归。

## Decision

- 一场演讲 = `src/talks/<名称>/talk.ts`（导出 `talkTitle` 和 `register(deck)`）+ `slides/` + `data/`；入口 `src/main.ts` 按 `?talk=名称` 用 `import.meta.glob` 加载，**新增演讲不需要登记**。
- 两个“画廊”演讲：`gallery`（图表 + 晶体 + GNN）和 `gallery-llm`（大模型组件），每个组件一页示范。它们同时是文档（README 截图由 `npm run shots` 从中生成）和回归检查。
- 通用的东西放 `src/runtime`、`src/packs/*`；某一场演讲的内容只放 `src/talks/<名称>/`。

## Considered Options

### Option A: 一个 deck 配置文件列出所有页面
- Pros: 集中。
- Cons: 每次新演讲要改中心文件；演讲之间互相干扰。

### Option B: 目录即演讲 + glob 发现（选中）
- Pros: 复制目录就能开新演讲；检查脚本、截图脚本都能按名字定位。
- Cons: 目录名即 URL 参数，要避免空格和特殊字符。

## Consequences

- 单测里允许引用 `talks/example/data`、`talks/gallery-llm/data` 的数据（它们属于模板自带的示范数据）。
- 新组件必须在对应画廊加一页；`gallery` 页号变动时要同步 `tools/screenshots.mjs` 里的页号。
