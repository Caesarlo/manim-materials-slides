# ADR Index

One row per ADR in this directory. Append a row when a new ADR is created; update the
`Status` column when an ADR is accepted or superseded. Never delete a row — an ADR that
is superseded stays listed, with a link to what replaced it.

| ID   | Title | Topic | Status | Supersedes | Superseded By |
| ---- | ----- | ----- | ------ | ---------- | ------------- |
| 0001 | 动画引擎用 manim-web，运行时自己写 | engine | accepted | — | — |
| 0002 | 幻灯片契约：enter(step, animate) 幂等，跳转必须等于点过来 | slide-contract | accepted | — | — |
| 0003 | 设计语言（白底、少小字、3b1b 版面）与数据诚实 | design-language | accepted | — | — |
| 0004 | 验证策略：纯逻辑单测 + 无头逐步检查，CI 只跑快的部分 | verification | accepted | — | — |
| 0005 | 演讲按目录组织，画廊兼作文档与回归检查 | talks-layout | accepted | — | — |
| 0006 | Agent 回放用通用 trace 格式，LangChain 消息经适配器转入 | agent-trace | accepted | — | — |
| 0007 | 轻量采用 sdlc-harness | process | accepted | — | — |

Status values: `proposed`, `accepted`, `superseded`. See `template.md` for the ADR shape
and the append-only rule that governs edits to accepted ADRs.
