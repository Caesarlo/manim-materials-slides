# 06 排错：已经踩过的坑

按“现象 → 原因 → 解法”列出。遇到新坑，把它加到这里。

## 页面与交互

| 现象 | 原因 | 解法 |
|---|---|---|
| 整个页面发白、文字发灰 | 总览层 `.deck-overview` 带 `display:grid`，盖过了 `hidden` 属性 | `deck.css` 里已有 `[hidden]{display:none!important}`；自己加带 `display` 的浮层时同样要保证 `hidden` 生效 |
| 公式变形后留下半透明的旧公式叠影 | 直接用了 `TransformMatchingTex`：它就地改源公式、不把目标放进场景 | 用 `morphTex(from, to)`（`runtime/manimStage.ts`） |
| 报 `Part index 0 out of range` | `MathTex` 字形是异步渲染的，在 `build` 里调用 `getPart` 太早 | 上色等放进 stage 的 `prepare` 钩子 |
| LaTeX 里的 `\top`、`\frac` 变成乱码/制表符 | TS 字符串里 `\t`、`\f` 被当成转义；shell heredoc 还会吞反斜杠 | TS 里用 `String.raw\`...\``；写文件用编辑器工具，别用 shell heredoc |
| 旁白里的 `√d`、下标看起来不是公式 | 直接打了 Unicode 字符，用的是备用字体 | 用行内公式 `$\sqrt{d_k}$`（旁白/标题/标签都支持） |
| 坐标轴 0 刻度显示 `-6×10⁻¹⁷` 或 0.25 显示成 0.3 | 旧版 `niceTicks` / `formatTick` 的浮点与小数位问题（已修） | 已在 `scale.ts` 修复并有测试；自己传 `ticks` 时也可绕过 |
| 3D 层状晶体又窄又小 | 晶胞很高（c = 30 Å）而画面是横向的 | `crystalSlide({ orientation: [0, Math.PI/2, 0] })` 并配合 `zoom` |
| 3D 俯视图一片空白 | 视线方向恰好平行于相机 up 向量（退化） | 俯视用 `dir: [0.001, 0.001, 1]` |

## 检查脚本（`npm run check`）

| 现象 | 原因 | 解法 |
|---|---|---|
| “点过来 vs 直接跳”差异 1~5% | 机器忙（别的 Chrome 在跑）时，截图抓在整页淡入或 3D 收敛的中途 | **只重跑那一页**：`npm run check -- --talk X --slide N`；稳定复现才是代码问题。别同时开多个检查 |
| 差异稳定 > 0.1% 且差异图里是你的元素 | `apply`/`enter` 依赖了上一次调用，或用了随机数/时间 | 让 `apply` 只依赖传入的 state；随机用固定种子；去掉 rAF/setTimeout 状态 |
| 控制台报错但页面看着正常 | 例如缺 favicon、未捕获的 Promise | 看 `check` 输出里的 `[页/步] console.error: ...`，逐条修 |
| 找不到 Chrome | 检查脚本用本机 Chrome，找不到再用 Edge | 安装其中一个；或在 `tools/check-deck.mjs` 里加 `executablePath` |

## 测试与构建

| 现象 | 原因 | 解法 |
|---|---|---|
| vitest 报 CSS/DOM 相关错误 | 纯逻辑文件 import 了带 CSS 的模块（如 `@/runtime/tex`） | 把纯函数放进独立的 `*Math.ts`，不 import 任何 CSS/DOM 模块 |
| 开发服务器启动报 `Failed to resolve import "pptxgenjs"` | manim-web 的可选动态导入没装 | `vite.config.ts` 里已用空模块顶替，不要删 |
| `tsc` 报 `baseUrl` 已弃用 | TypeScript 6 | `tsconfig.json` 里已去掉 `baseUrl`，只用 `paths` |

## Windows 环境

| 现象 | 原因 | 解法 |
|---|---|---|
| 文件夹无法重命名/移动，提示被占用 | 有后台 `node`/`bash`/`chrome` 进程把它当工作目录 | 先结束这些进程（命令行含项目路径的），或把会话工作目录切到上一级再操作 |
| `git` 警告 `CRLF will be replaced by LF` | 工作区是 CRLF，仓库用 LF | `.gitattributes` 已设 `* text=auto eol=lf`，可忽略 |
| 中文在终端里乱码 | 控制台编码 | Python 脚本已强制 UTF-8 输出；自己写脚本时同样处理 |

## sdlc-harness

| 现象 | 解法 |
|---|---|
| `validate` 报 `agents-onboarding` | `AGENTS.md` 开头要有指向 `AGENTS.sdlc-harness.md` 的链接（已有，别删） |
| `validate` 报 `traceability` | 每条 FR/NFR 要被某个 feature 覆盖；feature 的 `source_refs` 要写成 `docs/product/requirements.md#FR-5` 这种带**大写编号**的锚点 |
| `feature complete` 失败，提示 `missing passing evidence for current commit` | 证据绑定提交：你在 verify 之后又提交了。在**当前提交**上重新跑 `verify`、`evidence manual`、`review record` 再 `feature complete` |
| `feature complete` 失败（其他） | 缺 `verify` 证据或缺 `review record`；按 05-C 的顺序补齐 |
| 想改 feature 状态 | 不要手改 JSON；用 `feature start/block/reopen/complete` |
