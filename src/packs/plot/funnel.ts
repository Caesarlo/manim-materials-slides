// 筛选漏斗：候选逐级缩小。不是坐标轴图，不用 ChartFrame，自己建 SVG（viewBox 1600×780），沿用 .chart-svg / .tr 样式。
//
//   funnelSlide({
//     name: '筛选漏斗',
//     stages: [{ label: '候选库', count: 100000 }, { label: '热力学稳定', count: 8000 }, …],
//     steps: [{ caption: '候选库', state: { shown: 1 } }, …, { caption: '入选', state: { shown: 5, focusLast: true } }],
//     note: '示意数据',
//   })
//
// 条宽与 log10(count) 线性（funnelWidths）；相邻条之间是向下箭头和通过率。
// state：shown = 已出现的级数；focusLast = 前面各级压暗到 0.3、最后一级用 accent 高亮。
import { inlineTex } from '@/runtime/tex'
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import { svgEl } from './chartFrame'
import { formatCount, funnelWidths, passRates } from './funnelMath'

export interface FunnelStage { label: string; count: number; note?: string }
export interface FunnelState { shown: number; focusLast: boolean }

const W = 1600, H = 780, CX = W / 2
const MIN_W = 640, MAX_W = 1500, GAP = 66, MAX_BAR_H = 84

export class FunnelChart implements ChartInstance<FunnelState> {
  readonly svg: SVGSVGElement
  private bars: { g: SVGGElement; rect: SVGRectElement; text: HTMLElement[] }[] = []
  private rates: SVGGElement[] = []

  constructor(host: HTMLElement, private stages: FunnelStage[], ctx: Ctx) {
    const P = ctx.palette
    const n = stages.length
    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' })
    host.append(this.svg)
    const widths = funnelWidths(stages.map((s) => s.count), MIN_W, MAX_W)
    const rates = passRates(stages.map((s) => s.count))
    const barH = Math.min(MAX_BAR_H, (H - 20 - GAP * (n - 1)) / n)
    const y0 = (H - (n * barH + (n - 1) * GAP)) / 2

    const fo = (parent: Element, x: number, y: number, w: number, h: number, html: string, align: string, extra = '') => {
      const f = svgEl('foreignObject', { x, y, width: w, height: h, class: 'fo' }, parent)
      const div = document.createElement('div')
      div.className = 'fo-text'
      div.style.cssText = `height:100%;justify-content:center;text-align:${align};transition:color .5s;${extra}`
      div.innerHTML = `<span>${html}</span>`
      f.append(div)
      return div
    }

    stages.forEach((s, i) => {
      const y = y0 + i * (barH + GAP)
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      const rect = svgEl('rect', { x: CX - widths[i] / 2, y, width: widths[i], height: barH, rx: 20, class: 'tr' }, g)
      rect.style.strokeWidth = '3'
      const label = fo(g, CX - widths[i] / 2 + 28, y, widths[i] * 0.62, barH, inlineTex(s.label, ctx.esc), 'left')
      const count = fo(g, CX + widths[i] / 2 - 28 - 260, y, 260, barH, ctx.esc(formatCount(s.count)), 'right', 'font-weight:700;')
      this.bars.push({ g, rect, text: [label, count] })

      if (i > 0) {
        const ry = y - GAP
        const rg = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
        svgEl('line', { x1: CX, x2: CX, y1: ry + 8, y2: y - 14, stroke: P.muted, 'stroke-width': 3, 'stroke-linecap': 'round' }, rg)
        svgEl('path', { d: `M${CX - 11},${y - 26} L${CX},${y - 12} L${CX + 11},${y - 26}`, fill: 'none', stroke: P.muted, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, rg)
        const t = fo(rg, CX + 28, ry, 420, GAP, inlineTex(String.raw`$\times$ ${rates[i - 1]}%`, ctx.esc), 'left')
        t.style.color = P.muted
        this.rates.push(rg)
      }
    })
    this.P = P
  }
  private P: Ctx['palette']

  apply(state: FunnelState, _animate: boolean) {
    const P = this.P
    const n = this.stages.length
    this.bars.forEach(({ g, rect, text }, i) => {
      const isLast = i === n - 1
      const hot = state.focusLast && isLast
      const dim = state.focusLast && !isLast
      g.setAttribute('opacity', String(i < state.shown ? (dim ? 0.3 : 1) : 0))
      rect.style.fill = hot ? P.accent : P.line
      rect.style.stroke = hot ? P.accent : P.muted
      text.forEach((t) => (t.style.color = hot ? P.bg : P.fg))
    })
    this.rates.forEach((rg, k) => {
      const i = k + 1
      const dim = state.focusLast && i !== n - 1
      rg.setAttribute('opacity', String(i < state.shown ? (dim ? 0.3 : 1) : 0))
    })
  }

  destroy() {
    this.svg.remove()
  }
}

export interface FunnelSlideOpts {
  name: string
  stages: FunnelStage[]
  steps: ChartStep<FunnelState>[]
  notes?: string
  /** 右下角小注（.deck-detail），如“示意数据” */
  note?: string
}

export function funnelSlide(o: FunnelSlideOpts): SlideDef {
  const base = chartSlide<FunnelState>({
    name: o.name,
    notes: o.notes,
    initial: { shown: 0, focusLast: false },
    steps: o.steps,
    create: (host, ctx) => new FunnelChart(host, o.stages, ctx),
  })
  return withNote(base, o.note)
}

/** 给一个 SlideDef 在右下角追加小注（chartSlide 本身不带） */
export function withNote(def: SlideDef, note?: string): SlideDef {
  if (!note) return def
  return {
    ...def,
    mount(frame, ctx) {
      const inst = def.mount(frame, ctx)
      const p = document.createElement('p')
      p.className = 'deck-detail'
      p.style.cssText = 'position:absolute;right:3%;bottom:2%;margin:0'
      p.textContent = note
      frame.append(p)
      return inst
    },
  }
}
