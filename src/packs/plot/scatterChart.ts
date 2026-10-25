// 散点图（性能–性能图 / Ashby 式）：看候选在整体中的位置。
//
//   scatterSlide({
//     name: 'σ–κ', points, groups: [{ name: 'A 类' }, …],
//     x: { domain: [0.1, 1000], type: 'log', label: '$\\kappa$' }, y: { … },
//     steps: [
//       { caption: '…', state: { groupsShown: 1 } },                 // 前 n 组依次淡入
//       { caption: '…', state: { region: { x0, x1, y0, y1 } } },     // 目标区域（数据坐标，对数轴也是）
//       { caption: '…', state: { highlight: pointsInRegion(points, region), labels: true } },
//     ],
//   })
//
// state：groupsShown 前 n 组已显示；highlight 点下标（其余压暗到 0.2，null = 不压暗）；
//        region 目标区域（半透明矩形 + 虚线边框，null = 不显示）；labels 为真时标出带 label 的点。
// 组名直接标在该组上方（不用图例），颜色与点同色。groups[i].dx/dy 可微调组名位置（viewBox 单位）。
import { palette } from '@/runtime/palette'
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import { ChartFrame, svgEl, type AxisSpec } from './chartFrame'
import { centroid, type Region } from './scatterMath'

export { centroid, inRegion, pointsInRegion, type Region } from './scatterMath'

export interface ScatterPoint { x: number; y: number; group: number; label?: string }
export interface ScatterGroup { name: string; color?: string; dx?: number; dy?: number }

export interface ScatterState {
  groupsShown: number
  highlight: number[] | null
  region?: Region | null
  labels: boolean
}

const R = 9
const DIM = 0.2

/** 估算一段文字（含 $…$）在 32 单位字号下的宽度，用于标签避让 */
const textW = (s: string) => s.replace(/[$\\{}_^]/g, '').length * 19 + 10

interface Box { x0: number; x1: number; y0: number; y1: number }
const hit = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0

export class ScatterChart implements ChartInstance<ScatterState> {
  private frame: ChartFrame
  private pts: { g: SVGGElement; dot: SVGCircleElement; label: SVGGElement | null; group: number }[] = []
  private groupLabels: SVGGElement[] = []
  private regionRect: SVGRectElement

  constructor(host: HTMLElement, ctx: Ctx, o: { points: ScatterPoint[]; groups: ScatterGroup[]; x: AxisSpec; y: AxisSpec }) {
    const f = (this.frame = new ChartFrame(host, { x: o.x, y: o.y, esc: ctx.esc }))
    const colorOf = (g: number) => o.groups[g]?.color ?? palette.series[g % palette.series.length]
    const px = o.points.map((p) => f.x(p.x)), py = o.points.map((p) => f.y(p.y))

    // 目标区域在数据层最底下
    this.regionRect = svgEl('rect', { class: 'tr', fill: palette.accent, 'fill-opacity': 0.12, stroke: palette.accent, 'stroke-width': 4, 'stroke-dasharray': '16 12', opacity: 0 }, f.layers.data)

    const obstacles: Box[] = px.map((x, i) => ({ x0: x - R - 2, x1: x + R + 2, y0: py[i] - R - 2, y1: py[i] + R + 2 }))

    // 组名：放在该组最高点的上方，水平居中于质心
    o.groups.forEach((grp, g) => {
      const mine = o.points.map((p, i) => ({ p, i })).filter(({ p }) => p.group === g)
      if (!mine.length) { this.groupLabels.push(svgEl('g', {}, f.layers.labels)); return }
      const c = centroid(mine.map(({ i }) => ({ x: px[i], y: py[i] })))
      const top = Math.min(...mine.map(({ i }) => py[i]))
      const w = textW(grp.name) + 20
      const x = Math.min(Math.max(c.x + (grp.dx ?? 0), w / 2), f.plotW - w / 2)
      const y = Math.max(top - 26 + (grp.dy ?? 0), 44)
      const el = f.htmlLabel(f.layers.labels, grp.name, x, y, { anchor: 'middle', baseline: 'bottom', color: colorOf(g), w, h: 48 })
      el.querySelector<HTMLElement>('.fo-text')!.style.fontWeight = '600'
      this.groupLabels.push(el)
      obstacles.push({ x0: x - w / 2, x1: x + w / 2, y0: y - 48, y1: y })
    })

    // 点
    o.points.forEach((p, i) => {
      const g = svgEl('g', { class: 'tr', transform: `translate(${px[i]},${py[i]})`, opacity: 0 }, f.layers.data)
      const dot = svgEl('circle', { r: R, fill: colorOf(p.group), stroke: palette.bg, 'stroke-width': 3, class: 'tr' }, g)
      dot.style.transformBox = 'fill-box'
      dot.style.transformOrigin = 'center'
      this.pts.push({ g, dot, label: null, group: p.group })
    })

    // 点标签（简单避让：右 → 左 → 上 → 下，选第一个不压住点/已有标签且在绘图区内的位置）
    o.points.forEach((p, i) => {
      if (!p.label) return
      const w = textW(p.label), h = 44, gap = 10
      const cand = [
        { a: 'start' as const, b: 'middle' as const, x: px[i] + R + gap, y: py[i], box: { x0: px[i] + R + gap, x1: px[i] + R + gap + w, y0: py[i] - h / 2, y1: py[i] + h / 2 } },
        { a: 'end' as const, b: 'middle' as const, x: px[i] - R - gap, y: py[i], box: { x0: px[i] - R - gap - w, x1: px[i] - R - gap, y0: py[i] - h / 2, y1: py[i] + h / 2 } },
        { a: 'middle' as const, b: 'bottom' as const, x: px[i], y: py[i] - R - gap, box: { x0: px[i] - w / 2, x1: px[i] + w / 2, y0: py[i] - R - gap - h, y1: py[i] - R - gap } },
        { a: 'middle' as const, b: 'top' as const, x: px[i], y: py[i] + R + gap, box: { x0: px[i] - w / 2, x1: px[i] + w / 2, y0: py[i] + R + gap, y1: py[i] + R + gap + h } },
      ]
      const ok = (c: (typeof cand)[number]) =>
        c.box.x0 >= 0 && c.box.x1 <= f.plotW && c.box.y0 >= 0 && c.box.y1 <= f.plotH &&
        !obstacles.some((ob, k) => k !== i && hit(c.box, ob))
      const pick = cand.find(ok) ?? cand[0]
      obstacles.push(pick.box)
      const el = f.htmlLabel(f.layers.labels, p.label, pick.x, pick.y, { anchor: pick.a, baseline: pick.b, w: w + 20, h })
      el.setAttribute('opacity', '0')
      this.pts[i].label = el
    })
  }

  apply(s: ScatterState, animate: boolean): void {
    const f = this.frame
    const hl = s.highlight ? new Set(s.highlight) : null
    this.pts.forEach((p, i) => {
      const vis = p.group < s.groupsShown
      const dim = hl && !hl.has(i)
      const op = vis ? (dim ? DIM : 1) : 0
      // 同组内错开淡入；回退/跳转时 chartSlide 关闭过渡，延迟不会生效
      p.g.style.transitionDelay = animate ? `${(i % 12) * 0.03}s` : '0s'
      p.g.setAttribute('opacity', String(op))
      p.dot.style.transform = hl && hl.has(i) ? 'scale(1.35)' : 'scale(1)'
      p.label?.setAttribute('opacity', String(s.labels && vis ? op : 0))
    })
    this.groupLabels.forEach((el, g) => el.setAttribute('opacity', String(g < s.groupsShown ? (hl ? 0.35 : 1) : 0)))

    const r = s.region
    if (r) {
      const x0 = f.x(Math.min(r.x0, r.x1)), x1 = f.x(Math.max(r.x0, r.x1))
      const y0 = f.y(Math.max(r.y0, r.y1)), y1 = f.y(Math.min(r.y0, r.y1))
      this.regionRect.setAttribute('x', String(x0))
      this.regionRect.setAttribute('y', String(y0))
      this.regionRect.setAttribute('width', String(x1 - x0))
      this.regionRect.setAttribute('height', String(y1 - y0))
    }
    this.regionRect.setAttribute('opacity', r ? '1' : '0')
  }

  destroy(): void {
    this.frame.destroy()
  }
}

export interface ScatterSlideOpts {
  name: string
  points: ScatterPoint[]
  groups: ScatterGroup[]
  x: AxisSpec
  y: AxisSpec
  steps: ChartStep<ScatterState>[]
  notes?: string
  /** 图右下角的小注（如“示意数据”） */
  note?: string
}

/** 在 host 右下角放一句小注（图表区下方，旁白右侧），返回清理函数 */
export function addNote(host: HTMLElement, note: string | undefined, esc: (s: string) => string): () => void {
  if (!note) return () => {}
  const p = document.createElement('p')
  p.className = 'deck-detail'
  p.style.cssText = 'position:absolute;right:0;bottom:-15%;margin:0'
  p.innerHTML = esc(note)
  host.append(p)
  return () => p.remove()
}

export function scatterSlide(o: ScatterSlideOpts): SlideDef {
  return chartSlide<ScatterState>({
    name: o.name,
    notes: o.notes,
    initial: { groupsShown: 0, highlight: null, region: null, labels: false },
    steps: o.steps,
    create(host, ctx) {
      const chart = new ScatterChart(host, ctx, o)
      const rm = addNote(host, o.note, ctx.esc)
      return { apply: (s, a) => chart.apply(s, a), destroy: () => { rm(); chart.destroy() } }
    },
  })
}
