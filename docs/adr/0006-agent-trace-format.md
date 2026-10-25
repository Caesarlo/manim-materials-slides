# ADR 0006: Agent 回放用通用 trace 格式，LangChain 消息经适配器转入

topic: agent-trace
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

汇报里要回放“Agent 如何拆任务、并行、失败、重试”（FR-7）。使用者明确：这个回放**不绑定任何具体项目（如某个 Campaign）**，随便一个会话即可；但希望能对接 `oh` 工作站上 harness 后端的真实线程格式。

## Decision

- 定义与项目无关的 `AgentTrace { actors, events }`，事件为 `ask | delegate | result | retry | answer`。
- 提供适配器 `fromMessages(messages)`，吃 LangChain 风格的消息数组（`human/ai/tool`、`tool_calls`、`tool_call_id`、`additional_kwargs.subagent_status`）。字段名依据对 harness 后端源码的**只读**核对（DeerFlow fork：`task` 工具委派子 agent，状态 `completed/failed/cancelled/timed_out/polling_timed_out`）。
- 规则：同一条 ai 消息里的并行调用合成一个 `delegate`；之前失败/取消/超时的同名同任务调用再次出现，识别为 `retry`；`reasoning_content` 不展示。

## Considered Options

### Option A: 直接绑定 harness 的 Campaign 事件
- Pros: 对本项目最贴合。
- Cons: 换项目就不能用；使用者明确不要绑定。

### Option B: 通用 trace + 适配器（选中）
- Pros: 其他 Agent 框架只需再写一个适配器；回放组件不变。
- Cons: 多一层转换。

## Consequences

- 示例数据 `talks/gallery-llm/data/session.ts` 是**手写**的、字段名与真实格式一致的消息数组，页面上标“示意会话”。
- 待办：用一份真实导出的线程 JSON 验证适配器（见 requirements 的 Open Questions）。
- 适配器的判定规则（普通工具何时算失败等）写在 `agentTrace.ts` 文件头，并有 20 项单测。
