# ADR 0007: 轻量采用 sdlc-harness

topic: process
date: 2026-10-25
status: accepted
supersedes:
superseded-by:

## Context

这个模板是长期工具：以后每次汇报前都可能要改，由使用者与编码助手跨多次会话开发。需要一种方式让“做到哪了、为什么这样设计、怎样才算完成”留在仓库里而不是聊天记录里。使用者的 `thermal-web-user`、`thermal-web-admin` 已在用同一个工具（`@caesarlo/sdlc-harness`），但它们是有后端、部署和多人协作的产品，而本项目是单人使用的模板工具。

## Decision

**采用 sdlc-harness，但只用其中管“状态与证据”的核心，跳过产品化流程**：

- `feature_list.json` 只记录**前瞻性的待办**（一个 feature 一次会话能做完，必须有声明的验证命令）；已经完成的历史工作不补录，历史以 git 与这些 ADR 为准。
- `progress.md` 每次会话收尾追加检查点（`sdlc-harness session close` 的报告 + 做了什么 + 下一步）。
- `harness.config.json`：`collaborationMode: solo`、`deploymentMode: none`、`observabilityMode: none`（没有线上部署目标，也没有运行时受众）；`verify` = `npm run verify`。
- 需求写成 `docs/product/requirements.md`（FR/NFR 带编号，供 feature 的 `source_refs` 引用）；用户故事（阶段 3）跳过。
- 重大技术决策写 ADR（本目录），已接受的 ADR 只追加不修改。
- 删除 `adopt` 生成的 `deploy.yml`（没有部署目标）；`ci.yml` 改成真实的 `npm run verify`，并让 main 上的推送也触发（单人直接提交 main）。

## Considered Options

### Option A: 不用 harness，只靠 README / AGENTS.md
- Pros: 零负担。
- Cons: 跨会话的待办、验证证据、决策原因容易丢；与使用者其他项目的做法不一致。

### Option B: 完整采用（含部署、可观测、用户故事、追溯矩阵）
- Pros: 流程最完整。
- Cons: 对一个单人模板工具是过度仪式化，会拖慢开发。

### Option C: 轻量采用（选中）
- Pros: 保留“证据才算完成”“会话可交接”“决策可追溯”，去掉不适用的阶段；与使用者其他项目同一套命令与 hook。
- Cons: 仍要维护 `feature_list.json` 和 `progress.md`。

## Consequences

- 每次会话开始：`npx @caesarlo/sdlc-harness validate` 与 `status`；结束：`session close` 并追加 `progress.md`。
- 一个 feature 变成 `passing` 需要：声明的验证命令跑过并记录证据 + 一条 review 证据（用 `sdlc-harness verify / review record / feature complete`，不要手改状态）。
- **人类批准类证据（`evidence approval`）必须由使用者确认后才能记录，助手不得代记。** 目前需求与 ADR 尚未有批准证据。
- `.claude/skills/*`（9 个阶段技能）、`docs/workflow/*` 是 harness 自带的流程文档，保留不改。
- pre-commit 钩子只在 `feature_list.json` 变化时才跑 `validate`，对日常提交几乎无负担（首次需 `git config core.hooksPath .githooks`）。
