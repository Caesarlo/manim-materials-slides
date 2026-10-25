# Requirements: manim-materials-slides

## Problem Statement

做“大模型 × 材料”方向的汇报时，现成的工具要么是静态 PPT（画不出公式变形、3D 晶体、Agent 回放），要么是 Manim 渲染出的视频（不能临场点击、不能回退、不能交互旋转晶体）。需要一个**可反复使用的演示模板**：画面是 3b1b 式的（公式逐项变形、对象渐变、颜色呼应），但由**点击逐步推进**，可回退，3D 晶体可拖动，数据来自真实文件（CIF、CSV、Agent 线程）。以后每次汇报复制一个演讲目录、换内容即可，不必每次从头造轮子。

## Stakeholders

- 使用者与验收人：项目所有者（材料 / 热电 / 大模型 Agent 方向的研究者，自己做汇报）。
- 开发者：项目所有者与编码助手（Claude Code 等）；助手需要靠仓库内的文档和检查脚本在多次会话间保持一致。

## Success Metrics

- 新建一场演讲（复制 `talks/example/`、替换内容）并能放映，不需要改动 `runtime/` 与 `packs/`。
- 每个组件有一页示范，`npm run check -- --talk gallery` / `gallery-llm` 逐页逐步全部通过（“点过来”与“直接跳”画面差异 ≤ 0.1%，无控制台错误）。
- `npm run verify`（类型检查 + 单元测试 + 构建）通过。
- 一页幻灯片里出现的所有数值，要么来自真实数据文件，要么在页面上明确标注“示意数据”。

## Functional Requirements

- **FR-1**: WHEN 用户点击、按 →/空格/翻页笔，the system SHALL 前进一步（步数用完进入下一页）；WHEN 用户按 ←/右键，the system SHALL 回退一步。
- **FR-2**: WHEN 用户跳转到任意“页/步”（刷新、回退、URL 哈希 `#/页/步`），the system SHALL 显示与“从该页第 1 步逐步点到该步”完全一致的画面。
- **FR-3**: The system SHALL 支持公式逐项变形：相同的 LaTeX 部分移动到新位置，不同的部分淡入淡出，且结束后场景中只剩目标公式。
- **FR-4**: The system SHALL 从 CIF 文件生成晶体数据，并显示可拖动旋转的 3D 球棍模型，含晶胞、配位多面体、元素标签与图例、晶格矢量、高亮、按层聚焦、超胞。
- **FR-5**: The system SHALL 提供热电/材料常用图表：折线（含对数轴）、能带 + 态密度、散点、形成能凸包、筛选漏斗、XRD 谱，每个图表的“步骤”能逐步显现、聚焦、压暗其余。
- **FR-6**: The system SHALL 提供大模型常用图表：词元条、注意力热图（由缩放点积真实计算）、自回归下一词元概率与温度采样、模型架构块图（含残差与 ×N）。
- **FR-7**: The system SHALL 把 LangChain 风格的消息数组（harness 线程格式）转换成通用 Agent trace 并逐事件回放，包括并行子任务、失败、超时与重试；不依赖任何特定项目的日志格式。
- **FR-8**: The system SHALL 把晶体显示为图并演示 GNN 消息传递的感受野逐轮扩大。
- **FR-9**: WHEN 示例数据不是真实测量/计算结果，the system SHALL 在该页显示“示意数据”类小注。
- **FR-10**: WHERE 一场演讲位于 `src/talks/<名称>/`，the system SHALL 通过 `?talk=<名称>` 加载它，新增演讲不需要登记。
- **FR-11**: The system SHALL 提供演讲者备注（S）、页面总览（O）、全屏（F）。
- **FR-12**: WHEN 汇报要在没有开发环境的电脑上放映，the system SHALL 提供一个自包含的离线构建，双击 `index.html`（`file://`）即可放映，不需要静态服务器。
- **FR-13**: IF 现场放映设备出问题，THEN the system SHALL 能把任一演讲导出为逐步截图和 PDF 作为兜底。
- **FR-14**: WHERE 有第二块屏幕，the system SHALL 提供演讲者视图（第二个窗口：当前页、下一页信息、备注、计时），与主窗口通过 BroadcastChannel 同步翻页。

## Non-Functional Requirements

- **NFR-1**: 画面为白底、低饱和配色，文字在 1080p 下不小于约 28 px，一页一个观点，说明用底部一句旁白，不堆段落。
- **NFR-2**: 颜色只来自 `runtime/palette.ts`，不在幻灯片里写死十六进制。
- **NFR-3**: 同一时刻只挂载当前一页，切走时释放 WebGL 与监听器（浏览器 WebGL 上下文有限）。
- **NFR-4**: 纯逻辑（比例尺、凸包、能隙、注意力、采样、Agent 适配器……）有单元测试，断言使用手算得出的值。
- **NFR-5**: 演讲在断网的机器上也能放映（不依赖 CDN）。
- **NFR-6**: The repository SHALL 带有由所有者选定的 LICENSE 文件，且与依赖的许可证（manim-web、three.js、katex、vite 均为 MIT）兼容。

## Explicit Non-Goals

- 不做所见即所得的幻灯片编辑器；内容用 TypeScript 声明。
- 不做云端协作与多人同步放映。
- 不复制没有许可证的第三方仓库代码（参考仓库 protein-design-interactive-slides 没有 LICENSE，只借鉴思路，见 ADR 0001）。
- 不追求通用 PPT 的全部能力（模板、母版、动画库）。

## Assumptions & Open Questions

- [Resolved] 仓库许可证：使用者于 2026-10-25 选定 MIT，版权人 Caesarlo（NFR-6，feature M1-LICENSE-001）。
- [Open] 离线放映（FR-12）、导出兜底（FR-13）、演讲者视图（FR-14）尚未实现，见 feature M1-*。
- [Open] 用真实线程 JSON 验证 Agent 适配器（目前只用手写的、字段名与 harness 一致的消息数组）。
- [Assumption] 放映用 Chrome / Edge；无头检查用本机 Chrome（找不到则用 Edge）。
