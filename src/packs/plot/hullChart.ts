// 凸包图：二元体系 A–B 的形成能 vs 成分，看哪些化合物稳定（在凸包上）、不稳定的离凸包多远。
//
//   hullSlide({
//     name: '凸包', points: [{ x: 0.5, e: -0.4, label: 'AB' }, { x: 0.25, e: -0.1, label: 'A$_3$B' }, …],
//     steps: [
//       { caption: '…', state: { shown: 3 } },        // 前 n 个点已显示（元素端点 (0,0)、(1,0) 自动加入且始终显示）
//       { caption: '…', state: { hull: true } },      // 依次连接稳定点的折线“画出来”
//       { caption: '…', state: { drops: true } },     // 不稳定点向下的竖直虚线连到凸包，标 E_hull
//       { caption: '…', state: { focus: 1 } },        // 聚焦一个点（下标指 points 里的顺序），其余压暗到 0.25
//     ],
//   })
//
// 稳定点（E_hull = 0）实心 + 标 label；不稳定点空心。E_hull 的数值由 hullMath 计算（2 位小数）。
// 注意：稳定与否、凸包线都是按“全部点”算的，所以通常应当在 shown 到达全部点之后再打开 hull。
import { palette } from '@/runtime/palette'
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import { ChartFrame, pathD, prepareDraw, setDrawn, svgEl } from './chartFrame'
import { energyAboveHull, hullEnergyAt, lowerHull, type HullPoint } from './hullMath'
import { formatTick, niceDomain, niceTicks } from './scale'
import { addNote } from './scatterChart'

export type { HullPoint } from './hullMath'

export interface HullState {
  /** 前 n 个点已显示 */
  shown: number
  hull: boolean
  drops: boolean
  /** 聚焦的点（points 下标），null = 不聚焦 */
  focus: number | null
}

const R = 11
const DIM = 0.25

interface Item extends HullPoint { idx: number; ehull: number; stable: boolean }

export class HullChart implements ChartInstance<HullState> {
  private frame: ChartFrame
  private items: Item[]
  private els: { g: SVGGElement; label: SVGGElement | null; drop: SVGLineElement | null; dropLabel: SVGGElement | null }[] = []
  private hullPath: SVGPathElement

  constructor(host: HTMLElement, ctx: Ctx, o: { points: HullPoint[] }) {
    // 元素端点自动加入（idx = -1，始终显示）
    const extra: HullPoint[] = []
    if (!o.points.some((p) => p.x === 0)) extra.push({ x: 0, e: 0, label: 'A' })
    if (!o.points.some((p) => p.x === 1)) extra.push({ x: 1, e: 0, label: 'B' })
    const all: HullPoint[] = [...extra, ...o.points]
    const eh = energyAboveHull(all)
    this.items = all.map((p, k) => ({ ...p, idx: k - extra.length, ehull: eh[k], stable: eh[k] === 0 }))

    // y 轴范围：下方留出标签的位置，上方留出端点标签
    const es = all.map((p) => p.e)
    const lo = Math.min(...es, 0), hi = Math.max(...es, 0), span = Math.max(hi - lo, 0.1)
    const [y0, y1] = niceDomain(lo - 0.3 * span, hi + 0.2 * span, 5)

    // 刻度自己生成：把浮点残差（如 -6e-17）清成 0
    const yt = niceTicks(y0, y1, 5).map((v) => (Math.abs(v) < 1e-9 ? 0 : v))
    const ystep = yt.length > 1 ? yt[1] - yt[0] : undefined
    const f = (this.frame = new ChartFrame(host, {
      esc: ctx.esc,
      x: { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], tickFormat: (v) => String(v), label: String.raw`$x$ in A$_{1-x}$B$_x$` },
      y: { domain: [y0, y1], ticks: yt, tickFormat: (v) => formatTick(v, ystep), label: String.raw`$E_f$ (eV/atom)` },
    }))

    // e = 0 的参考线（元素的形成能）
    svgEl('line', { x1: 0, x2: f.plotW, y1: f.y(0), y2: f.y(0), stroke: palette.line, 'stroke-width': 3 }, f.layers.grid)

    // 凸包折线（先画，在点的下面）
    const hull = lowerHull(this.items)
    this.hullPath = svgEl('path', { d: pathD(hull.map((p) => [f.x(p.x), f.y(p.e)])), fill: 'none', stroke: palette.accent, 'stroke-width': 5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, f.layers.data)
    prepareDraw(this.hullPath)

    for (const it of this.items) {
      const px = f.x(it.x), py = f.y(it.e)
      const dropTo = f.y(hullEnergyAt(hull, it.x))
      let drop: SVGLineElement | null = null, dropLabel: SVGGElement | null = null
      if (!it.stable) {
        drop = svgEl('line', { x1: px, x2: px, y1: py, y2: dropTo, stroke: palette.amber, 'stroke-width': 4, 'stroke-dasharray': '10 8', class: 'tr', opacity: 0 }, f.layers.data)
        dropLabel = f.htmlLabel(f.layers.labels, `$E_{\\mathrm{hull}}$ = ${it.ehull.toFixed(2)} eV`, px + 22, py, { anchor: 'start', baseline: 'middle', w: 420 })
        dropLabel.setAttribute('opacity', '0')
      }
      const g = svgEl('g', { class: 'tr', transform: `translate(${px},${py})` }, f.layers.data)
      if (it.stable) svgEl('circle', { r: R, fill: palette.accent, stroke: palette.bg, 'stroke-width': 3 }, g)
      else svgEl('circle', { r: R, fill: palette.bg, stroke: palette.amber, 'stroke-width': 4.5 }, g)

      let label: SVGGElement | null = null
      if (it.stable && it.label) {
        // 左端点标在右上、右端点标在左上，其余标在点正下方
        const end = it.x <= 0 ? 'l' : it.x >= 1 ? 'r' : 'm'
        label = end === 'l' ? f.htmlLabel(f.layers.labels, it.label, px + 16, py - 18, { anchor: 'start', baseline: 'bottom', w: 200 })
          : end === 'r' ? f.htmlLabel(f.layers.labels, it.label, px - 16, py - 18, { anchor: 'end', baseline: 'bottom', w: 200 })
          : f.htmlLabel(f.layers.labels, it.label, px, py + R + 12, { anchor: 'middle', baseline: 'top', w: 240 })
      }
      this.els.push({ g, label, drop, dropLabel })
    }
  }

  apply(s: HullState, _animate: boolean): void {
    setDrawn(this.hullPath, s.hull)
    this.hullPath.setAttribute('opacity', String(s.focus === null ? 1 : DIM))
    this.items.forEach((it, k) => {
      const e = this.els[k]
      const vis = it.idx < 0 || it.idx < s.shown
      const dim = s.focus !== null && it.idx !== s.focus
      const op = vis ? (dim ? DIM : 1) : 0
      e.g.setAttribute('opacity', String(op))
      e.label?.setAttribute('opacity', String(op))
      const dop = s.drops ? op : 0
      e.drop?.setAttribute('opacity', String(dop))
      e.dropLabel?.setAttribute('opacity', String(dop))
    })
  }

  destroy(): void {
    this.frame.destroy()
  }
}

export interface HullSlideOpts {
  name: string
  points: HullPoint[]
  steps: ChartStep<HullState>[]
  notes?: string
  /** 图右下角的小注（如“示意数据”） */
  note?: string
}

export function hullSlide(o: HullSlideOpts): SlideDef {
  return chartSlide<HullState>({
    name: o.name,
    notes: o.notes,
    initial: { shown: 0, hull: false, drops: false, focus: null },
    steps: o.steps,
    create(host, ctx) {
      const chart = new HullChart(host, ctx, o)
      const rm = addNote(host, o.note, ctx.esc)
      return { apply: (s, a) => chart.apply(s, a), destroy: () => { rm(); chart.destroy() } }
    },
  })
}
