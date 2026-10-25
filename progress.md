# manim-materials-slides Progress

## Progress Protocol

- `feature_list.json` is the single source of truth for feature scope and state.
- Read this file and `feature_list.json` before implementation work begins.
- Only one feature may be `in_progress` at a time.
- Append a checkpoint immediately after every meaningful implementation step.
- A feature may become `passing` only after its declared verification has run
  successfully and evidence — including a review entry — has been recorded.
- Do not rewrite or delete historical session checkpoints.

## Current Verified State

- Last updated: 2026-10-25
- Active feature: None.
- Standard verification: `npx @caesarlo/sdlc-harness validate`；项目自身的验证命令是 `npm run verify`（tsc + vitest + vite build，已配置为 `harness.config.json` 的 `verify`）；视觉与交互回归用 `npm run check -- --talk <演讲>`（无头 Chrome，合并前本地运行，见 ADR 0004）。
- Current blocker: None.

## Session Log

(Append checkpoints below, oldest first.)

### 2026-10-25 采用 sdlc-harness（轻量），补需求/ADR/开发手册，登记待办
- 做了：`sdlc-harness adopt` 补齐 harness 文件（未覆盖已有的 AGENTS.md/.gitignore）；`harness.config.json` 设为 solo / 无部署 / 无可观测，`verify` = `npm run verify`；删除 `adopt` 生成的占位 `deploy.yml`（没有部署目标），`ci.yml` 改为真实的 `npm run verify` 并让 main 推送也触发；写了 `docs/product/requirements.md`（FR-1..14、NFR-1..6）、`docs/architecture/overview.md`、ADR 0001–0007；写了 `docs/guides/` 六份开发手册（给能力较弱的模型照着做）；登记 11 个待办（M1 可靠交付、M2 材料包、M3 大模型包，任务书写在各 feature 的 `notes`）和 6 个基线 feature（M0，已完成的工作补证据）。
- 验证：`validate` 通过；`npm run verify`、三个演讲的无头检查（共 116 步 + 画廊第 14 页柱状图）均通过。
- 证据：基线 feature 通过 `sdlc-harness verify / evidence manual / review record / feature complete` 记录（见 feature_list.json）。需求与 ADR 尚无使用者批准证据（`evidence approval` 必须由使用者确认后记录）。
- 下一步：按 `status` 的建议做下一个待办；建议先做 `M1-LICENSE-001`（需要使用者决定许可证）与 `M1-OFFLINE-001`（离线单文件，实用价值最大）。
- 遗留/风险：CI 目前只跑 `verify`（未验证 GitHub Actions 能否稳定跑无头检查，见 M1-CICHECK-001）；仓库还没有 LICENSE；Agent 适配器尚未用真实线程验证（M3-THREAD-001）。

### 2026-10-25 M1-LICENSE-001 完成：MIT 许可证
- 做了：使用者选定 MIT、版权人 Caesarlo；新增 `LICENSE`，`package.json` 加 `license`，README 加“许可证”一节，requirements 里的 Open Question 标为 Resolved。
- 验证：`npm run verify` 通过（195 项测试、构建）；`sdlc-harness verify` 通过；手动证据记录了使用者的明确选择。
- 证据：M1-LICENSE-001 passing（7 passing / 10 not_started）。
- 经验：harness 的证据绑定提交——先提交，再 verify → evidence manual → review record → feature complete；否则 `feature complete` 报 `missing passing evidence for current commit`。已写进 docs/guides/05、06。
- 下一步：`M1-OFFLINE-001`（离线单文件放映）。
