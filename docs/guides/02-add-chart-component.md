# 02 新增一个图表组件

**参考实现**：`src/packs/plot/barChart.ts`（最小的带坐标轴图表，约 70 行）；更复杂的看 `lineChart.ts`（折线、直接标注）、`funnel.ts`（不带坐标轴、自建 SVG）、`bandChart.ts`（多图层）。
**参考的纯逻辑与单测**：`funnelMath.ts` + `funnelMath.test.ts`。

一个图表由 5 样东西组成，按顺序做：

1. 纯逻辑文件 `xxxMath.ts` + 单测 `xxxMath.test.ts`（有计算才需要）
2. 图表类 `xxx.ts`（实现 `ChartInstance<State>`）+ 页面工厂 `xxxSlide(...)`
3. 画廊里加一页示范
4. 截图清单（可选）+ 文档表格
5. 检查并亲眼看截图

---

## 第 1 步：设计 state（最重要）

state 是“某一步画面的**完整描述**”，用几个简单字段表示：
- 计数：`shown: number`（前 n 个元素已出现）
- 聚焦：`focus: number | null`（只有这个高亮，其余压暗到 0.25）
- 开关：`labels: boolean` 之类

规则：
- `apply(state)` **只依赖传入的 state**，不依赖上一次调用。
- 每个步骤只写**变化的字段**（`chartSlide` 会把第 1..k 步浅合并后传给 apply）。
- 初始状态 `initial` 代表“第 0 步之前”（通常什么都没出现）。

## 第 2 步：图表类骨架

```ts
// src/packs/plot/xxxChart.ts
import { ChartFrame, svgEl } from '@/packs/plot/chartFrame'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import type { Ctx, SlideDef } from '@/runtime/types'

export interface XxxItem { label: string; value: number }
export interface XxxState { shown: number; focus: number | null }

export class XxxChart implements ChartInstance<XxxState> {
  private frame: ChartFrame
  private els: SVGElement[] = []

  constructor(host: HTMLElement, items: XxxItem[], ctx: Ctx) {
    // 1) 建坐标轴。domain 是数据范围；label 支持 $…$ 公式；ticks: [] 表示不画刻度
    this.frame = new ChartFrame(host, {
      esc: ctx.esc,
      x: { domain: [0, 10], label: '$T$ (K)' },
      y: { domain: [0, 1], label: '$zT$' },
    })
    const f = this.frame
    // 2) 把所有可能出现的元素一次性建好，初始 opacity=0；class "tr" 表示属性变化时自动做 CSS 过渡
    items.forEach((it) => {
      const el = svgEl('circle', { cx: f.x(5), cy: f.y(it.value), r: 10, fill: ctx.palette.accent, class: 'tr', opacity: 0 }, f.layers.data)
      this.els.push(el)
    })
  }

  // 3) 只负责“state → 画面”。别在这里新建元素、别用定时器
  apply(s: XxxState) {
    this.els.forEach((el, i) => {
      const visible = i < s.shown
      const dim = s.focus !== null && s.focus !== i
      el.setAttribute('opacity', String(visible ? (dim ? 0.25 : 1) : 0))
    })
  }

  destroy() { this.frame.destroy() }
}

export function xxxSlide(o: { name: string; items: XxxItem[]; steps: ChartStep<XxxState>[]; note?: string; notes?: string }): SlideDef {
  return chartSlide<XxxState>({
    name: o.name, notes: o.notes, note: o.note,
    initial: { shown: 0, focus: null },
    steps: o.steps,
    create: (host, ctx) => new XxxChart(host, o.items, ctx),
  })
}
```

要点：
- **坐标转换**：`f.x(v)` / `f.y(v)` 把数据值变成像素（在 `f.plot` 坐标系里）；`f.plotW` / `f.plotH` 是绘图区宽高。对数轴传 `type: 'log'`。
- **图层**：`f.layers.grid < axes < data < marks < labels`；`data` 层会被裁剪在绘图区内，不想被裁的放 `marks`/`labels`。
- **文字**：用 `f.htmlLabel(parent, text, x, y, { anchor, baseline, w, h })`，支持 `$…$` 公式，自动是 ≥ 32 单位；SVG 的 `<text>` 只用来写刻度数字。
- **画线“画出来”**：`prepareDraw(path)` 之后用 `setDrawn(path, true/false)`（见 `lineChart.ts`）。
- **颜色**：`ctx.palette.accent / amber / red / teal / series[i] / muted / line / fg`，不要写十六进制。
- **没有坐标轴的图**（漏斗、块图）：不用 `ChartFrame`，自己 `svgEl('svg', { viewBox: '0 0 1600 780', class: 'chart-svg' })` 放进 `host`，见 `funnel.ts`。
- 需要“沿路径移动”的小球：用 `style.transform = translate(...)` 加 class `tr`，**不要用 rAF**。

## 第 3 步：纯逻辑与单测（凡是有计算就要）

把计算（布局、排序、凸包、归一化…）放进不 import 任何 CSS/DOM 的 `xxxMath.ts`，然后写单测：

```ts
// src/packs/plot/xxxMath.test.ts
import { describe, expect, it } from 'vitest'
import { layoutThing } from './xxxMath'

describe('layoutThing', () => {
  it('手算：3 个元素、宽 300 → 位置 50/150/250', () => {
    expect(layoutThing(3, 300)).toEqual([50, 150, 250])   // 断言要用你手算得出的值
  })
  it('边界：0 个元素返回空数组', () => {
    expect(layoutThing(0, 300)).toEqual([])
  })
})
```
单测规则：断言**具体数值**（手算），覆盖边界（空、单个、并列、极端）；不要只测“不抛错”。运行：`npx vitest run src/packs/plot/xxxMath.test.ts`。

## 第 4 步：画廊里加一页示范

- 在 `src/talks/gallery/slides/xxxDemo.ts` 里调用 `xxxSlide({...})`，示例数据写成**确定的常量或公式**（不要 `Math.random()`；需要伪随机用固定种子，见 `gallery/slides/sigmaKappa.ts`）。
- **必须**：`note: '示意数据'`（或写清数据来源）；每个步骤有一句不超过约 20 个汉字的 `caption`（旁白，支持 `$…$`）。
- 在 `src/talks/gallery/talk.ts` 里 `import` 并 `deck.slide(...)`，**加在末尾**（插在中间会让 `tools/screenshots.mjs` 里的页号错位）。
- 大模型组件则放进 `src/talks/gallery-llm/`。

## 第 5 步：检查（缺一不可）

```bash
npx tsc --noEmit                                   # 类型检查，必须零错误
npx vitest run src/packs/plot/xxxMath.test.ts      # 单测
npm run check -- --talk gallery --slide 15         # 把 15 换成你的页号；必须全部 0.00%、无控制台错误
```
然后**用图片查看工具打开** `check/gallery/live-<页>-<步>.png`（每一步都看）：
- 文字有没有压在图上 / 被底部旁白或右下角小注挡住？
- 被压暗的部分是不是还看得清（透明度不要低于 0.2）？
- 颜色在白底上够不够清楚？标签有没有互相重叠？
- 过渡是不是已经收敛（没有半透明残影）？

发现问题就改代码重跑，直到每一步都好看。

## 第 6 步：文档

- 在 `AGENTS.md` 的“图表（packs/plot）”表格里加一行：组件、页面工厂、state 字段。
- 想放进 README 的截图：在 `tools/screenshots.mjs` 的 `SHOTS` 里加一项（页号、步号、文件名），运行 `npm run shots`，把新图片加进 `README.md` 的表格。

## 常见坑（详见 06）

- 新建元素放在 `apply` 里 → 跳转时会重复创建。所有元素在 constructor 里建好。
- 用 `Math.random()` → 每次画面不同，检查会报“点过来 vs 直接跳”不一致。
- 用 `setTimeout` / `requestAnimationFrame` 改状态 → 同上。
- 在 `*Math.ts` 里 `import` 了带 CSS 的模块 → vitest 报错；纯逻辑文件保持无依赖。
- state 里放对象/数组时，`chartSlide` 的合并是**浅合并**（整体替换，不是深合并）。
