// 折线图（热电 zT–T，S/σ/κ 随载流子浓度等）。
//
//   lineChartSlide({
//     name: 'zT–T', series, x: { domain: [300, 800], label: '$T$ (K)' }, y: { domain: [0, 2], label: '$zT$' },
//     note: '示意数据',
//     steps: [
//       { caption: '…', state: { shown: 1 } },        // 前 shown 条已画出
//       { caption: '…', state: { peaks: true } },     // 标出各曲线峰值
//       { caption: '…', state: { focus: 1 } },        // 聚焦第 1 条，其余压暗到 0.25
//     ],
//   })
//
// 直接标注：每条线末端用同色文字标出名字（不用图例），太近时由 spreadLabels 自动错开。
// 对数轴：x: { domain: [1e18, 1e22], type: 'log' }。
// 数据脚本约定：tools/csv_to_ts.py 生成 ColumnTable，用 fromColumnTable 转成 LineSeries[]。
import { palette } from '@/runtime/palette'
import type { Ctx, SlideDef } from '@/runtime/types'
import { ChartFrame, pathD, prepareDraw, setDrawn, svgEl, type AxisSpec } from './chartFrame'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import './lineChart.css'

export interface LineSeries {
  name: string
  points: [number, number][]
  color?: string
  /** 设为 false 则 peaks 状态下不标这条线的峰值（如单调曲线）。默认标 */
  peak?: boolean
}

/** 与数据脚本约定的列式表：一列 x，多列 y（缺测用 null） */
export interface ColumnTable {
  x: number[]
  xName: string
  series: { name: string; y: (number | null)[] }[]
}

/** 列式表 → 折线数据：跳过 null / 非有限值的点；按 palette.series 依次配色（超出则轮转） */
export function fromColumnTable(t: ColumnTable): LineSeries[] {
  return t.series.map((s, i) => {
    const points: [number, number][] = []
    for (let k = 0; k < t.x.length && k < s.y.length; k++) {
      const y = s.y[k]
      if (y !== null && Number.isFinite(y) && Number.isFinite(t.x[k])) points.push([t.x[k], y])
    }
    return { name: s.name, points, color: palette.series[i % palette.series.length] }
  })
}

export interface LineState {
  /** 前 n 条已画出 */
  shown: number
  /** 聚焦某条，其余压暗到 0.25 */
  focus: number | null
  /** 标出各曲线峰值 */
  peaks: boolean
  /** 竖直参考线（数据 x），如工作温度；null 不显示 */
  refX?: number | null
}

/** 峰值点：最大 y 的点；并列取最左（x 最小）。空数组返回 undefined */
export function peakOf(points: ReadonlyArray<readonly [number, number]>): [number, number] | undefined {
  let best: [number, number] | undefined
  for (const [x, y] of points) {
    if (!best || y > best[1] || (y === best[1] && x < best[0])) best = [x, y]
  }
  return best
}

/**
 * 末端标签错开：给定各标签期望的中心 y，返回调整后的 y（与输入同序）。
 * 相邻（按 y 排序）间距 ≥ minGap，整体落在 [min, max] 内，在此前提下总位移的平方和最小；已满足时原样返回。
 * 若 [min, max] 放不下，则把间距压缩到均分。
 */
export function spreadLabels(ys: number[], minGap: number, min: number, max: number): number[] {
  const n = ys.length
  if (n === 0) return []
  const order = ys.map((_, i) => i).sort((a, b) => ys[a] - ys[b] || a - b)
  let ok = ys.every((y) => y >= min && y <= max)
  for (let k = 1; k < n && ok; k++) if (ys[order[k]] - ys[order[k - 1]] < minGap) ok = false
  if (ok) return ys.slice()

  const gap = n > 1 ? Math.min(minGap, (max - min) / (n - 1)) : 0
  // 令 z_k = y_k − k·gap，问题化为“非降 + 区间约束”的保序回归（PAV 后再夹到区间内即为最优）
  const z = order.map((i, k) => ys[i] - k * gap)
  const blocks: { sum: number; cnt: number }[] = []
  for (const v of z) {
    blocks.push({ sum: v, cnt: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1], a = blocks[blocks.length - 2]
      if (a.sum / a.cnt <= b.sum / b.cnt) break
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, cnt: a.cnt + b.cnt })
    }
  }
  const fit: number[] = []
  for (const b of blocks) for (let c = 0; c < b.cnt; c++) fit.push(b.sum / b.cnt)
  const lo = min, hi = max - (n - 1) * gap
  const out = new Array<number>(n)
  order.forEach((i, k) => { out[i] = Math.min(hi, Math.max(lo, fit[k])) + k * gap })
  return out
}

/** 第 i 条线（及其标签、峰值）的不透明度：未画出 0；聚焦时非聚焦项 0.25；否则 1 */
export function seriesOpacity(i: number, s: Pick<LineState, 'shown' | 'focus'>): number {
  if (i >= s.shown) return 0
  return s.focus === null || s.focus === i ? 1 : 0.25
}

/** 峰值文字放在点的上方还是下方：上方空间（像素）不够就放下方 */
export function peakLabelSide(py: number, labelH: number, gap = 20): 'above' | 'below' {
  return py - gap - labelH >= 0 ? 'above' : 'below'
}

function defaultPeakText(p: [number, number]): string {
  return `$${Number(p[1].toPrecision(3))}$`
}

export interface LineChartOpts {
  x: AxisSpec
  y: AxisSpec
  series: LineSeries[]
  /** 峰值文字，默认只写数值。例：(s, p) => String.raw`$zT_{max}$ = ${p[1].toFixed(1)}` */
  peakLabel?: (s: LineSeries, p: [number, number], i: number) => string
}

const LABEL_H = 56
const END_GAP = 44

export class LineChart implements ChartInstance<LineState> {
  private frame: ChartFrame
  private paths: SVGPathElement[] = []
  private ends: SVGGElement[] = []
  private peaks: (SVGGElement | null)[] = []
  private ref: SVGLineElement

  private constructor(host: HTMLElement, ctx: Ctx, private o: LineChartOpts) {
    const f = this.frame = new ChartFrame(host, { x: o.x, y: o.y, esc: ctx.esc, margin: { r: 230 } })
    const colorOf = (s: LineSeries, i: number) => s.color ?? palette.series[i % palette.series.length]

    // 参考线放在网格层，数据线盖在它上面
    this.ref = svgEl('line', { x1: 0, x2: 0, y1: 0, y2: f.plotH, class: 'ref-line tr' }, f.layers.grid)
    this.ref.style.opacity = '0'

    // 末端标签位置：按各线最后一点的 y 错开
    const endPts = o.series.map((s) => s.points[s.points.length - 1])
    const wanted = endPts.map((p) => (p ? f.y(p[1]) : 0))
    const placed = spreadLabels(wanted, END_GAP, END_GAP / 2, f.plotH - END_GAP / 2)

    o.series.forEach((s, i) => {
      const c = colorOf(s, i)
      const px = s.points.map(([x, y]) => [f.x(x), f.y(y)] as [number, number])
      const path = svgEl('path', { d: pathD(px), class: 'line-path', stroke: c, 'stroke-width': 7 }, f.layers.data)
      prepareDraw(path)
      this.paths.push(path)

      const end = endPts[i]
      const g = f.htmlLabel(f.layers.labels, s.name, end ? f.x(end[0]) + 18 : 0, placed[i], { anchor: 'start', baseline: 'middle', cls: 'line-end', color: c, w: 220, h: LABEL_H })
      g.style.opacity = '0'
      this.ends.push(g)

      const pk = s.peak === false ? undefined : peakOf(s.points)
      if (!pk) { this.peaks.push(null); return }
      const pg = svgEl('g', { class: 'tr' }, f.layers.marks)
      pg.style.opacity = '0'
      const cx = f.x(pk[0]), cy = f.y(pk[1])
      svgEl('circle', { cx, cy, r: 13, fill: c, class: 'peak-dot' }, pg)
      const text = (o.peakLabel ?? ((_s, p) => defaultPeakText(p)))(s, pk, i)
      const side = peakLabelSide(cy, LABEL_H)
      const W = 420
      // 水平方向夹在绘图区内：靠近左右边缘时改成贴边对齐
      const anchor = cx < W / 2 ? 'start' : cx > f.plotW - W / 2 ? 'end' : 'middle'
      const ax = anchor === 'start' ? cx - 16 : anchor === 'end' ? cx + 16 : cx
      f.htmlLabel(pg, text, ax, side === 'above' ? cy - 20 : cy + 20, { anchor, baseline: side === 'above' ? 'bottom' : 'top', cls: 'peak-text', color: c, w: W, h: LABEL_H })
      this.peaks.push(pg)
    })
  }

  static create(host: HTMLElement, ctx: Ctx, o: LineChartOpts): LineChart {
    return new LineChart(host, ctx, o)
  }

  apply(state: LineState, animate: boolean): void {
    const refX = state.refX ?? null
    this.o.series.forEach((_, i) => {
      const op = seriesOpacity(i, state)
      const on = i < state.shown
      setDrawn(this.paths[i], on)
      this.paths[i].style.opacity = String(on ? op : 1)
      const lab = this.ends[i]
      // 标签等线画得差不多再淡入（跳转时过渡已关闭，延迟无影响）
      lab.style.transitionDelay = animate && on ? '.7s' : '0s'
      lab.style.opacity = String(op)
      const pk = this.peaks[i]
      if (pk) pk.style.opacity = String(state.peaks ? op : 0)
    })
    if (refX !== null) this.ref.style.transform = `translate(${this.frame.x(refX)}px, 0)`
    this.ref.style.opacity = refX === null ? '0' : '1'
  }

  destroy(): void {
    this.frame.destroy()
  }
}

export interface LineChartSlideDef {
  name: string
  heading?: string
  series: LineSeries[]
  x: AxisSpec
  y: AxisSpec
  steps: ChartStep<LineState>[]
  notes?: string
  /** 右下角小注，如“示意数据” */
  note?: string
  peakLabel?: LineChartOpts['peakLabel']
}

export function lineChartSlide(def: LineChartSlideDef): SlideDef {
  const base = chartSlide<LineState>({
    name: def.name,
    heading: def.heading,
    notes: def.notes,
    initial: { shown: 0, focus: null, peaks: false, refX: null },
    steps: def.steps,
    create: (host, ctx) => LineChart.create(host, ctx, { x: def.x, y: def.y, series: def.series, peakLabel: def.peakLabel }),
  })
  if (!def.note) return base
  return {
    ...base,
    mount(frame, ctx) {
      const inst = base.mount(frame, ctx)
      const p = document.createElement('p')
      p.className = 'deck-detail'
      p.style.cssText = 'position:absolute;right:3%;bottom:2%;margin:0'
      p.textContent = def.note!
      frame.append(p)
      return inst
    },
  }
}
