# AGENTS.md — 在这个仓库里工作的约定

给编码助手和人看的同一份规则。

## 这是什么

一套**现场绘制**的演示模板，面向“大模型 × 材料”：每一页是一个小模块，在浏览器里自己画自己。
点一下走一步，可回退，白底、3b1b 式版面。动画引擎是 [manim-web](https://github.com/maloyan/manim-web)（MIT），
3D 晶体用 three.js，其余用 HTML/SVG。运行时是自己写的（设计参考了 ramithuh/protein-design-interactive-slides，
但该仓库没有 LICENSE，**没有复制它的任何代码**，只借鉴架构思路）。

## 目录

| 路径 | 作用 |
|---|---|
| `src/runtime/deck.ts` | 运行时：注册幻灯片、点击步进、回退、URL 哈希、备注(S)、总览(O)、全屏(F) |
| `src/runtime/manimStage.ts` | manim-web 舞台：`build` + `steps`，回退/跳转时重建并瞬间应用；含 `morphTex`、`prepare` |
| `src/runtime/reveal.ts` | HTML 元素按步骤淡入 `show()`；每步一句旁白 `captions()` |
| `src/runtime/palette.ts` | **唯一的颜色来源**，同时写入 CSS 变量 |
| `src/styles/deck.css` | 设计语言：以画面宽度 1% 为单位 `--u`，字号阶梯 `--t-*` |
| `src/packs/materials/` | 材料包：`structure.ts`（晶体→原子/键/多面体）、`CrystalView.ts`（three.js）、`crystalSlide.ts`（声明式 3D 页）、`presets.ts`（成键规则） |
| `src/packs/plot/` | 图表套件：`scale.ts`（比例尺/刻度）、`chartFrame.ts`（SVG 坐标轴底座）、`chartSlide.ts`（声明式图表页）；`lineChart`、`bandChart`、`scatterChart`、`hullChart`、`funnel`、`xrdChart`（各自的纯逻辑在 `*Math.ts`，有单测） |
| `src/packs/llm/` | 大模型包（待补：词元条、注意力热图、训练管线…） |
| `src/main.ts` | 入口：按 `?talk=名称` 加载 `src/talks/<名称>/talk.ts`，默认 `example` |
| `src/talks/<名称>/` | 一场演讲：`talk.ts`（`register(deck)` 里按顺序注册页面）、`slides/*.ts`、`data/*.ts`（由脚本生成）。新建演讲 = 复制 `talks/example/` 改名，无需登记 |
| `tools/cif_to_ts.py` | CIF → 晶体数据（`uv run`，自动装 gemmi，按空间群展开对称操作） |
| `tools/csv_to_ts.py` | CSV → 折线图数据（`uv run`，无依赖；空值→`null`，`#` 注释保留；用法见 `tools/README.md`） |
| `src/talks/gallery/` | **组件画廊**：每个图表/晶体组件各一页示范（数据均为示意），也是回归检查（`npm run check -- --talk gallery`）。新增组件时在这里加一页 |

## 幻灯片契约

```ts
export const x: SlideDef = {
  name: '页面名', steps: 3, notes: '备注(S)', interactive: false,
  mount(frame, { esc, palette }) {
    frame.innerHTML = `…`
    return {
      enter(step, animate) {},   // 显示第 1..step 步
      destroy() {},              // 切走时一定会调用：释放 WebGL / 监听器
    }
  },
}
```

- **`enter` 必须幂等且可跳转**：`enter(4, false)` 紧跟在 `mount` 之后，必须和“从第 1 步逐步点到第 4 步”画面完全一致。
  写“每一步的状态”，不要写“相对上一步的增量”。`animate=true` 才播放动画。
- 第 1 步是进入该页时显示的画面。
- 同一时刻只挂载当前页（WebGL 上下文有限），所以 `destroy` 必须写。
- 新增一页：写 `SlideDef`（或用 `crystalSlide` 等工厂），在 `src/talks/<名称>/talk.ts` 的 `register()` 里 `deck.slide(...)`。
- 新增一场演讲：复制 `src/talks/example/` 为 `src/talks/<新名字>/`，改 `talkTitle` 和页面；用 `http://localhost:4100/?talk=<新名字>` 打开，`npm run check -- --talk <新名字>` 检查。

## 设计语言（用它，别重新发明）

- 一切尺寸用 `--u`（画面宽度的 1%）。**不要在幻灯片里写 px 或临时字号**，用 `--t-display/heading/lead/caption/body/small`。
- 版面：图占满并居中；可选居中标题 `.deck-heading`；底部一句旁白 `.deck-caption`（用 `captions([...])`，每步一句）。
  不写段落，不写项目符号。细节放 `notes`。
- 强调靠运动和透明度（出现、压暗其余），不用发光、渐变、毛玻璃。
- 颜色：CSS 用 `var(--accent)` 等；脚本里用 `palette`。**不要写死十六进制**。每页最多 1 主色 + 1 辅色。颜色即对应关系（公式项、曲线、节点同色）。
- 逐步显现：`class="reveal-in" data-from="2"`（可加 `data-until`、`style="--i:n"` 错落），在 `enter` 里调 `show(frame, step, animate)`。

## manim-web 舞台

```ts
const stage = manimStage(host, {
  build: ({ M, P }) => ({ a: new M.Circle({ color: P.accent }) }),   // 每次返回全新对象
  prepare: (o) => {},                                                // 公式渲染完成后（getPart / 上色）
  steps: [ ({ a }, { M }) => [new M.Create(a)], … ],                 // steps[k-1] 从 k-1 步到 k 步
})
// slide: return { enter: (s, a) => stage.go(s, a), destroy: stage.dispose }
```

- `build` 里**不要**把 mobject 放进模块变量；回退会重建。
- 场景透明，16×9 世界单位，原点居中，y 向上。
- `Transform` 只能在点数匹配的形状间变形；不同形状请淡出/淡入。
- 文字用 HTML 或 `M.Text`；公式用 `M.MathTex`（KaTeX，离线可用）。
- **公式逐项变形一律用 `morphTex(from, to)`**，不要直接 `new M.TransformMatchingTex`：后者会就地改写源公式、不会把目标放进场景，
  直接用会留下叠影。
- `MathTex` 的字形是异步渲染的：`getPart()` 必须在 `prepare` 里调用，不能在 `build` 里。
- **文字里出现数学符号（√、下标、上标、希腊字母）一律用行内公式 `$…$`**，不要直接打 Unicode 字符：
  旁白 `captions()`、`inlineTex()` 都支持，如 String.raw`除以 $\sqrt{d_k}$`。纯文本里的 `√d` 用的是备用字体，和公式对不齐，还丢下标。
- LaTeX 反斜杠一律用 `String.raw\`…\``，否则 `\top`、`\frac` 里的 `\t`、`\f` 会被当成转义字符。

## 图表（packs/plot）

每个图表 = 一个类（`create` 返回 `{ apply(state, animate), destroy() }`）+ 页面工厂（基于 `chartSlide`）+ 纯逻辑单测（`*Math.ts` / `*.test.ts`）。

```ts
lineChartSlide({
  name: 'zT–T', series, x: { domain: [300, 800], label: '$T$ (K)' }, y: { domain: [0, 1.6], label: '$zT$' },
  note: '示意数据',                                   // 右下角小注；不是真实数据就必须写
  steps: [ { caption: '先画材料 A', state: { shown: 1 } }, { caption: '标出峰值', state: { peaks: true } } ],
})
```

| 组件 | 页面工厂 | state 字段 |
|---|---|---|
| 折线（zT–T、取舍曲线） | `lineChartSlide` | `shown` `focus` `peaks` `refX` |
| 能带 + 态密度 | `bandSlide` | `bands` `fermi` `gap` `dos` `focusBand` |
| 散点（性能–性能图） | `scatterSlide` | `groupsShown` `highlight` `region` `labels` |
| 形成能凸包 | `hullSlide` | `shown` `hull` `drops` `focus` |
| 筛选漏斗 | `funnelSlide` | `shown` `focusLast` |
| XRD 谱 | `xrdSlide` | `sticks` `curve` `compare` `hkl` |

- **state 是完整状态**：`chartSlide` 把第 1..k 步的 `state` 浅合并（后者覆盖前者）再交给 `apply`。每步只写变化的字段。
- **动画只用 CSS transition**：给元素加 class `tr`，改 opacity / stroke-dashoffset / transform / 颜色。跳转时 `chartSlide` 给 `.chart-host` 加 `no-tr` 关掉所有过渡，图表代码不要区分“点过来”和“跳转”。描边“画出来”用 `prepareDraw/setDrawn`。
- 图上文字 ≥ 28 个 viewBox 单位（刻度 28、标签 32）；轴标签、公式用 `$…$`（走 `htmlLabel` / foreignObject）。
- **数据诚实**：示例数据不是真实测量/计算结果就必须写“示意数据”小注，材料用 A/B/C 之类泛称，不要编造“某论文的实测值”。
- 数据来源：`uv run tools/csv_to_ts.py x.csv out.ts --name xData` 生成 `{ xName, x, series:[{name,y}] }`，折线图用 `fromColumnTable(xData)` 转换（缺失值 `null` 自动跳过）。
- 纯逻辑放 `*Math.ts`（不 import 带 CSS 的模块，否则 vitest 的 node 环境加载不了），并写**手算得出**的断言，不要只测“不抛错”。

## 3D 晶体

- 数据：`uv run tools/cif_to_ts.py x.cif src/talks/example/data/x.ts --export X --name "显示名"`，得到 `Crystal`（晶格矢量 Å + 分数坐标）。
- 规则：`presets.ts` 里写成键/配位规则，如 `{ polyhedra: [{ center: 'Ti', ligand: 'O', max: 2.2 }] }`。
- 页面：`crystalSlide({ name, crystal, options, steps: [{ caption, show, dim, fly }] })`。后面的步骤**继承**前面的设置，
  所以跳转时合并 1..step 即可，天然幂等。
- 相机**z 轴朝上**（c 轴竖直）。很高/很长的晶胞（如 Bi₂Te₃ 的 c = 30 Å）在横向画面里又窄又小：给 `crystalSlide` 传 `orientation: [0, Math.PI / 2, 0]`（弧度，欧拉角 XYZ）让长轴横过画面，再用 `zoom` 推近（Bi₂Te₃ 用 1.75）。此后 `fly.dir` / `fly.target` 都是旋转后的场景坐标。俯视用 `dir: [0.001, 0.001, 1]`（别用恰好 `[0,0,1]`，会退化）。
- `show` 的 `cell/atoms/bonds/polyhedra` 是 0..1 的目标可见度；`dim: ['Sr']` 压暗某元素；`dim: []` 全部恢复。
- 拖动旋转、滚轮缩放；deck 会区分“拖动”和“点击”，拖动不会翻页。
- 步骤里还可以声明（后一步继承前一步，`null` 取消）：`labels`（元素标签，引线连到代表原子）、`labelFor`、`axes`（a/b/c 晶格矢量箭头）、`highlight: { els?, indices? }`（放大 + 描边，其余不变暗）、`layer: { axis, from, to }`（按分数坐标区间聚焦一层，其余压暗到 0.1）；`crystalSlide({ legend: true })` 给元素图例；超胞用 `options: { repeat: [2, 2, 1] }`。

## 已知坑

- manim-web 有几个可选动态导入（`pptxgenjs`、typst）没装，`vite.config.ts` 里用空模块顶替，否则预打包报错。**不要删**。
- `[hidden]` 必须 `display:none !important`（已在 `deck.css`），否则带 `display:grid` 的总览层会一直盖住画面。
- 在浏览器自动化里用 `navigate` 打开带哈希的页面，会多触发一次“点击”，页码会多走一步；用 `location.hash = '#/页/步'` 跳转更可靠。

## 检查

```bash
npm test           # 单元测试（vitest）：晶体结构构建，如配位数、键长
npm run check      # 无头浏览器逐页逐步检查（用本机 Chrome/Edge，不下载浏览器）
npm run check -- --slide 4          # 只查第 4 页
npm run check -- --no-compare       # 只抓控制台错误，更快
npm run build      # tsc 类型检查 + vite 构建
npm run dev        # http://localhost:4100   #/页/步 直达，如 #/4/3
```

`npm run check` 做两件事：
1. 逐页逐步跳转，**任何 `console.error` 或未捕获异常都算失败**。
2. 验证 `enter()` 契约：对每一步，“从第 1 步一路点过来”和“直接跳到该步”的截图必须一致（差异 ≤ 0.1%）。
   不一致说明某页的 `enter` 写成了“增量”而不是“状态”，差异图在 `check/diff-页-步.png`。

截图在 `check/<演讲名>/`（已 git 忽略；每个演讲用自己的子目录，几个检查同时跑也不会互相删）。**改完请肉眼看截图**：文字压图、颜色在白底上看不清、3D 被旁白挡住，都不是控制台错误。
新增页面后必须跑一遍 `npm run check`；改了 `structure.ts` 必须跑 `npm test`。

## 约定

- 通用的东西放 `src/runtime` 或 `src/packs`；某一场演讲的内容只放 `src/talks/<名称>/`。
- 新的可复用组件：放进对应 `packs/`，文件头写用法注释，并在 `src/talks/example/` 里放一个示范。
- 数据用脚本生成，不手敲进幻灯片；在生成文件头和页面备注里写清来源。
- 不引入 CDN；演示需离线可用（`npm run build` 后用任意静态服务器打开 `dist/`）。
