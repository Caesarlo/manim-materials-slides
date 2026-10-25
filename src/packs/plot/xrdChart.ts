// XRD 谱：竖线（峰位 + 强度）→ 高斯展宽的连续谱 → 标 (hkl) → 与第二条谱上下对比。
//
//   xrdSlide({
//     name: 'XRD', patterns: [{ name: '计算谱', peaks }, { name: '实验谱', peaks: peaks2, fwhm: 0.8 }],
//     steps: [{ caption: '峰位与强度', state: { sticks: true } }, { caption: '展宽', state: { curve: true } }, …],
//     note: '示意数据',
//   })
//
// state：sticks 竖线（灰）；curve 展宽曲线（第一条 accent，第二条 amber）；hkl 在最高的 5 个峰上方标 (hkl)；
// compare 把第一条谱压缩到上半区、第二条谱画在下半区（二者共享 x，y 轴无刻度数值）。
// 实现：几何按“整幅绘图区”一次算好，compare 只改每组的 translate+scale（CSS transition），
// 线宽用 vector-effect: non-scaling-stroke 不随缩放变粗。曲线用淡入而不是描边动画（二者与 non-scaling-stroke 冲突）。
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import { ChartFrame, pathD, svgEl } from './chartFrame'
import { withNote } from './funnel'
import { broaden, makeGrid, normalize, type XrdPattern } from './xrdMath'

export type { XrdPeak, XrdPattern } from './xrdMath'
export interface XrdState { sticks: boolean; curve: boolean; compare: boolean; hkl: boolean }

const DEFAULT_FWHM = 0.4
const HEAD = 0.88 // 强度 1 对应绘图区高度的比例，留出顶部放 (hkl)
const S = 0.47 // compare 时每条谱的纵向缩放
const A_BASE = 0.5 // compare 时第一条谱基线位置（占绘图区高度比例）

interface Layer {
  g: SVGGElement
  sticks: SVGLineElement[]
  curve: SVGPathElement
  name: SVGGElement
}

export class XrdChart implements ChartInstance<XrdState> {
  private f: ChartFrame
  private A: Layer
  private B?: Layer
  private hkls: { g: SVGGElement; v: number; x: number }[] = []
  private h: number

  constructor(host: HTMLElement, patterns: XrdPattern[], ctx: Ctx) {
    const P = ctx.palette
    const all = patterns.flatMap((p) => p.peaks.map((k) => k.twoTheta))
    const lo = Math.floor((Math.min(...all) - 6) / 10) * 10, hi = Math.ceil((Math.max(...all) + 4) / 10) * 10
    this.f = new ChartFrame(host, {
      esc: ctx.esc,
      x: { domain: [lo, hi], label: String.raw`$2\theta$ (°)`, tickCount: 6 },
      y: { domain: [0, 1], label: '强度 (a.u.)', ticks: [], grid: false },
    })
    const f = this.f
    this.h = f.plotH * HEAD
    const grid = makeGrid(lo, hi, (hi - lo) / 1200)

    const build = (p: XrdPattern, color: string, withSticks: boolean): Layer => {
      const g = svgEl('g', { class: 'tr' }, f.layers.data)
      const imax = Math.max(...p.peaks.map((k) => k.intensity))
      svgEl('line', { x1: 0, x2: f.plotW, y1: f.plotH, y2: f.plotH, stroke: P.line, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' }, g)
      const sticks = withSticks
        ? p.peaks.map((k) => {
            const x = f.x(k.twoTheta)
            return svgEl('line', { x1: x, x2: x, y1: f.plotH, y2: f.plotH - (k.intensity / imax) * this.h, stroke: P.muted, 'stroke-width': 6, 'stroke-linecap': 'round', 'vector-effect': 'non-scaling-stroke', class: 'tr', opacity: 0 }, g)
          })
        : []
      const y = normalize(broaden(p.peaks, p.fwhm ?? DEFAULT_FWHM, grid))
      const curve = svgEl('path', {
        d: pathD(grid.map((t, i) => [f.x(t), f.plotH - y[i] * this.h] as const)),
        fill: 'none', stroke: color, 'stroke-width': 6, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke', class: 'tr', opacity: 0,
      }, g)
      const name = f.htmlLabel(f.layers.marks, p.name, 0, 0, { anchor: 'start', baseline: 'top', w: 360, h: 50, color })
      name.querySelector('div')!.style.fontWeight = '700'
      return { g, sticks, curve, name }
    }

    this.A = build(patterns[0], P.accent, true)
    if (patterns[1]) this.B = build(patterns[1], P.amber, false)

    // (hkl) 标注：最高的 5 个峰（按第一条谱）
    const imax = Math.max(...patterns[0].peaks.map((k) => k.intensity))
    ;[...patterns[0].peaks].filter((k) => k.hkl).sort((a, b) => b.intensity - a.intensity).slice(0, 5).forEach((k) => {
      const g = f.htmlLabel(f.layers.marks, `(${k.hkl})`, 0, 0, { anchor: 'middle', baseline: 'bottom', w: 200, h: 46 })
      this.hkls.push({ g, v: k.intensity / imax, x: f.x(k.twoTheta) })
    })
  }

  apply(s: XrdState, _animate: boolean) {
    const H = this.f.plotH
    const sA = s.compare ? S : 1
    const byA = s.compare ? A_BASE * H : H
    // 点 y_px → byA - (H - y_px)·sA，即 translate(0, byA - H·sA) scale(1, sA)
    const topA = byA - H * sA
    this.A.g.style.transform = `translate(0px, ${topA}px) scale(1, ${sA})`
    this.A.g.style.transformOrigin = '0 0'
    this.A.sticks.forEach((l) => (l.style.opacity = s.sticks ? '1' : '0'))
    this.A.curve.style.opacity = s.curve ? '1' : '0'
    this.A.name.style.transform = `translate(16px, ${topA}px)`

    if (this.B) {
      const topB = H - H * S
      this.B.g.style.transform = `translate(0px, ${topB}px) scale(1, ${S})`
      this.B.g.style.transformOrigin = '0 0'
      this.B.g.style.opacity = s.compare ? '1' : '0'
      this.B.curve.style.opacity = '1'
      this.B.name.style.transform = `translate(16px, ${topB + 8}px)`
      this.B.name.style.opacity = s.compare ? '1' : '0'
    }
    this.hkls.forEach(({ g, v, x }) => {
      g.style.transform = `translate(${x}px, ${byA - v * this.h * sA - 8}px)`
      g.style.opacity = s.hkl ? '1' : '0'
    })
  }

  destroy() {
    this.f.destroy()
  }
}

export interface XrdSlideOpts {
  name: string
  patterns: XrdPattern[]
  steps: ChartStep<XrdState>[]
  notes?: string
  note?: string
}

export function xrdSlide(o: XrdSlideOpts): SlideDef {
  const base = chartSlide<XrdState>({
    name: o.name,
    notes: o.notes,
    initial: { sticks: false, curve: false, compare: false, hkl: false },
    steps: o.steps,
    create: (host, ctx) => new XrdChart(host, o.patterns, ctx),
  })
  return withNote(base, o.note)
}
