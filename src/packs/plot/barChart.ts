// 柱状图：也是“怎么写一个带坐标轴的新图表”的最小参考实现（手册见 docs/guides/02-add-chart-component.md）。
// state = { shown: 已出现的柱子数, focus: 聚焦的柱子下标或 null }。
//
//   barSlide({
//     name: '柱状图', items: [{ label: 'A', value: 3 }, { label: 'B', value: 7 }],
//     note: '示意数据',
//     steps: [{ caption: '先出现 A', state: { shown: 1 } }, { caption: '聚焦 B', state: { shown: 2, focus: 1 } }],
//   })
//
// 复制这个文件来做新图表：改数据类型、改 constructor 里的绘制、改 apply 里“state → 画面”的映射。
import { ChartFrame, svgEl } from '@/packs/plot/chartFrame'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import type { Ctx, SlideDef } from '@/runtime/types'

export interface BarItem { label: string; value: number }
/** state 必须是“完整状态”：apply 只能依赖它，不能依赖上一次调用 */
export interface BarState { shown: number; focus: number | null }

export class BarChart implements ChartInstance<BarState> {
  private frame: ChartFrame
  private bars: SVGRectElement[] = []

  constructor(host: HTMLElement, items: BarItem[], ctx: Ctx) {
    const max = Math.max(...items.map((i) => i.value))
    this.frame = new ChartFrame(host, {
      esc: ctx.esc,
      x: { domain: [0, items.length], ticks: [] }, // ticks: [] = 不画 x 刻度
      y: { domain: [0, max * 1.15], label: '数值' },
    })
    const f = this.frame
    const w = (f.plotW / items.length) * 0.6
    items.forEach((it, i) => {
      const x = f.x(i + 0.5) - w / 2
      const y = f.y(it.value)
      // 元素加 class "tr"：之后改 opacity 等属性会自动做 CSS 过渡；初始 opacity 0 = 还没出现
      const rect = svgEl('rect', { x, y, width: w, height: f.plotH - y, rx: 8, fill: ctx.palette.accent, class: 'tr', opacity: 0 }, f.layers.data)
      this.bars.push(rect)
      // 柱子下方的标签：htmlLabel 支持 $…$ 公式
      f.htmlLabel(f.layers.labels, it.label, f.x(i + 0.5), f.plotH + 40, { anchor: 'middle', baseline: 'top', w: w + 60 })
    })
  }

  apply(s: BarState) {
    this.bars.forEach((r, i) => {
      const visible = i < s.shown
      const dim = s.focus !== null && s.focus !== i // 聚焦时压暗其余
      r.setAttribute('opacity', String(visible ? (dim ? 0.25 : 1) : 0))
    })
  }

  destroy() {
    this.frame.destroy()
  }
}

export interface BarSlideOpts {
  name: string
  items: BarItem[]
  steps: ChartStep<BarState>[]
  note?: string
  notes?: string
}

export function barSlide(o: BarSlideOpts): SlideDef {
  return chartSlide<BarState>({
    name: o.name,
    notes: o.notes,
    note: o.note, // 右下角小注，如“示意数据”
    initial: { shown: 0, focus: null },
    steps: o.steps,
    create: (host, ctx) => new BarChart(host, o.items, ctx),
  })
}
