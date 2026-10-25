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
| `src/packs/llm/` | 大模型包（待补：词元条、注意力热图、训练管线…） |
| `src/talk/` | 一场演讲：`main.ts`（页面顺序）、`slides/*.ts`、`data/*.ts`（由脚本生成） |
| `tools/cif_to_ts.py` | CIF → 晶体数据（`uv run`，自动装 gemmi，按空间群展开对称操作） |

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
- 新增一页：写 `SlideDef`（或用 `crystalSlide` 等工厂），在 `src/talk/main.ts` 里 `deck.slide(...)`。

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

## 3D 晶体

- 数据：`uv run tools/cif_to_ts.py x.cif src/talk/data/x.ts --export X --name "显示名"`，得到 `Crystal`（晶格矢量 Å + 分数坐标）。
- 规则：`presets.ts` 里写成键/配位规则，如 `{ polyhedra: [{ center: 'Ti', ligand: 'O', max: 2.2 }] }`。
- 页面：`crystalSlide({ name, crystal, options, steps: [{ caption, show, dim, fly }] })`。后面的步骤**继承**前面的设置，
  所以跳转时合并 1..step 即可，天然幂等。
- 相机**z 轴朝上**（c 轴竖直）。俯视用 `dir: [0.001, 0.001, 1]`（别用恰好 `[0,0,1]`，会退化）。
- `show` 的 `cell/atoms/bonds/polyhedra` 是 0..1 的目标可见度；`dim: ['Sr']` 压暗某元素；`dim: []` 全部恢复。
- 拖动旋转、滚轮缩放；deck 会区分“拖动”和“点击”，拖动不会翻页。

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

截图都在 `check/`（已 git 忽略）。**改完请肉眼看截图**：文字压图、颜色在白底上看不清、3D 被旁白挡住，都不是控制台错误。
新增页面后必须跑一遍 `npm run check`；改了 `structure.ts` 必须跑 `npm test`。

## 约定

- 通用的东西放 `src/runtime` 或 `src/packs`；某一场演讲的内容只放 `src/talk`。
- 新的可复用组件：放进对应 `packs/`，文件头写用法注释，并在 `src/talk` 里放一个示范。
- 数据用脚本生成，不手敲进幻灯片；在生成文件头和页面备注里写清来源。
- 不引入 CDN；演示需离线可用（`npm run build` 后用任意静态服务器打开 `dist/`）。
