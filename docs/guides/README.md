# 开发手册（给执行任务的人或模型）

这些手册写给**照着做就能完成任务**的执行者（包括能力较弱的模型）。每一份都是“文件路径 + 命令 + 代码骨架 + 验收标准 + 常见坑”，不需要理解整个项目的历史。

**读的顺序**：先读 `01`，再按任务读对应的一份，最后用 `05` 收尾。

| 文件 | 什么时候读 |
|---|---|
| [01-start-here.md](01-start-here.md) | 每次开工前：项目地图、每次会话的命令、**绝对不要做的事** |
| [02-add-chart-component.md](02-add-chart-component.md) | 新增一个图表（折线、柱状、时间线、散点…）：完整骨架 + 单测 + 画廊 + 截图 |
| [03-add-crystal-step-field.md](03-add-crystal-step-field.md) | 给 3D 晶体视图新增“步骤里可声明的效果”（如标签、高亮、GNN） |
| [04-add-a-talk.md](04-add-a-talk.md) | 为一场新汇报建一个演讲目录，接入 CIF / CSV / Agent 线程数据 |
| [05-definition-of-done.md](05-definition-of-done.md) | 收尾：检查清单 + 用 sdlc-harness 记录证据、把 feature 标成完成 |
| [06-troubleshooting.md](06-troubleshooting.md) | 出错时：已经踩过的坑和解法 |

相关文档：[AGENTS.md](../../AGENTS.md)（约定总览）、[requirements.md](../product/requirements.md)（需求）、[docs/adr/](../adr/README.md)（为什么这样设计）、[feature_list.json](../../feature_list.json)（待办与状态）。
