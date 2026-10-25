// 能带结构 + 态密度图。
//
//   bandSlide({
//     name: '能带', data: myBandData,           // BandData：kpath / k / bands(nBands×nK, eV, 相对 E_F) / dos?
//     steps: [
//       { caption: '能带', state: { bands: true } },
//       { caption: '费米能级', state: { fermi: true } },
//       { caption: '带隙', state: { gap: true } },
//       { caption: '态密度', state: { dos: true } },
//     ],
//     note: '示意能带',                          // 非空时在右下角用 .deck-detail 显示
//   })
//
// state：bands 显示能带 · fermi 费米能级虚线 · gap 标出 VBM/CBM 与带隙 · dos 右侧态密度 · focusBand 突出某一条（其余压暗到 0.25）
// 价带蓝、导带琥珀、穿过费米能级的能带青绿（见 bandColor）。
import '@/packs/plot/bandChart.css'
import { palette } from '@/runtime/palette'
import { niceDomain } from './scale'
import { ChartFrame, pathD, prepareDraw, setDrawn, svgEl } from './chartFrame'
import { chartSlide, type ChartInstance, type ChartStep } from './chartSlide'
import { bandColor, dosFromBands, findGap, type BandData } from './bandMath'

export interface BandState {
  bands: boolean
  fermi: boolean
  gap: boolean
  dos: boolean
  focusBand: number | null
}

export const bandInitial: BandState = { bands: false, fermi: false, gap: false, dos: false, focusBand: null }

const DOS_GAP = 90 // 能带区右缘到 DOS 轴的距离
const DOS_W = 270 // DOS 区宽度

export class BandChart implements ChartInstance<BandState> {
  private f: ChartFrame
  private paths: SVGPathElement[] = []
  private colors: string[]
  private ef: SVGGElement
  private gapEls: SVGElement[] = []
  private dosEls: SVGElement[] = []

  constructor(host: HTMLElement, esc: (s: string) => string, data: BandData) {
    const all = data.bands.flat()
    const [y0, y1] = niceDomain(Math.min(...all) - 0.2, Math.max(...all) + 0.2, 6)
    this.f = new ChartFrame(host, {
      esc,
      x: { domain: [0, 1], ticks: [], tickFormat: () => '' },
      y: { domain: [y0, y1], label: String.raw`$E-E_F$ (eV)`, tickCount: 6, grid: false },
      margin: { r: 400 },
    })
    const f = this.f
    const W = f.plotW, H = f.plotH

    // 高对称点：竖直细线 + 下方标签
    for (const p of data.kpath) {
      const px = f.x(p.k)
      svgEl('line', { x1: px, x2: px, y1: 0, y2: H, class: 'hs-line' }, f.layers.grid)
      f.htmlLabel(f.layers.axes, p.label, px, H + 14, { anchor: 'middle', baseline: 'top', w: 120, h: 56 })
    }

    // 能带
    this.colors = data.bands.map(bandColor)
    data.bands.forEach((b, i) => {
      const d = pathD(b.map((e, j) => [f.x(data.k[j]), f.y(e)] as const))
      const p = svgEl('path', { d, class: 'band-line', stroke: this.colors[i], 'stroke-width': 5 }, f.layers.data)
      prepareDraw(p)
      this.paths.push(p)
    })

    // 费米能级
    const y0px = f.y(0)
    this.ef = svgEl('g', { class: 'tr', opacity: 0 }, f.layers.marks)
    svgEl('line', { x1: 0, x2: W, y1: y0px, y2: y0px, class: 'ef-line' }, this.ef)
    f.htmlLabel(this.ef, '$E_F$', W + 14, y0px, { anchor: 'start', baseline: 'middle', w: 70, h: 56 })

    // 带隙
    const gi = findGap(data.bands, data.k)
    if (!gi.metal && gi.vbm && gi.cbm && gi.gap !== undefined) {
      const gm = svgEl('g', { class: 'tr', opacity: 0 }, f.layers.marks)
      const xv = f.x(gi.vbm.k), xc = f.x(gi.cbm.k)
      const yv = f.y(gi.vbm.E), yc = f.y(gi.cbm.E)
      // 箭头竖线画在 CBM 的 k 处；VBM 若不在同一 k，用点线引过去
      if (Math.abs(xv - xc) > 1) svgEl('line', { x1: xv, x2: xc, y1: yv, y2: yv, class: 'gap-guide' }, gm)
      const ah = 14
      svgEl('path', {
        d: `M${xc},${yc + 2}V${yv - 2}M${xc - ah},${yc + ah * 1.6 + 2}L${xc},${yc + 2}L${xc + ah},${yc + ah * 1.6 + 2}M${xc - ah},${yv - ah * 1.6 - 2}L${xc},${yv - 2}L${xc + ah},${yv - ah * 1.6 - 2}`,
        class: 'gap-arrow',
      }, gm)
      svgEl('circle', { cx: xv, cy: yv, r: 13, fill: palette.accent, stroke: palette.bg, 'stroke-width': 3 }, gm)
      svgEl('circle', { cx: xc, cy: yc, r: 13, fill: palette.amber, stroke: palette.bg, 'stroke-width': 3 }, gm)
      // 文字放在带隙中间（右侧）；底下垫一块白底，盖住穿过的费米能级虚线
      const ym = (yv + yc) / 2
      svgEl('rect', { x: xc + 22, y: ym - 27, width: 400, height: 54, fill: palette.bg }, gm)
      f.htmlLabel(gm, `$E_g$ = ${gi.gap.toFixed(2)} eV（${gi.direct ? '直接' : '间接'}）`, xc + 32, ym, { anchor: 'start', baseline: 'middle', w: 420, h: 54 })
      this.gapEls.push(gm)
    }

    // 态密度：与能带共享 y
    const dos = data.dos ?? dosFromBands(data.bands, 240, 0.06, [y0, y1])
    const gmax = Math.max(...dos.g, 1e-9)
    const x0 = W + DOS_GAP
    const sx = (g: number) => x0 + (g / gmax) * DOS_W
    const gd = svgEl('g', { class: 'tr', opacity: 0 }, f.layers.marks)
    const draw = (keep: (e: number) => boolean, c: string) => {
      const seg = dos.E.map((e, i) => [e, dos.g[i]] as const)
        .filter(([e]) => keep(e))
        .map(([e, g]) => [sx(g), f.y(e)] as const)
        .filter(([, y]) => y >= -1 && y <= H + 1)
      if (!seg.length) return
      const o = pathD(seg)
      svgEl('path', { d: `${o}L${x0},${seg[seg.length - 1][1].toFixed(2)}L${x0},${seg[0][1].toFixed(2)}Z`, fill: c, 'fill-opacity': 0.25 }, gd)
      svgEl('path', { d: o, fill: 'none', stroke: c, 'stroke-width': 4, 'stroke-linejoin': 'round' }, gd)
    }
    if (gi.metal) draw(() => true, palette.teal)
    else {
      // 价带部分蓝、导带部分琥珀（以 E_F 为界），与能带同色
      draw((e) => e <= 0, palette.accent)
      draw((e) => e > 0, palette.amber)
    }
    svgEl('line', { x1: x0, x2: x0, y1: 0, y2: H, class: 'dos-axis' }, gd)
    f.htmlLabel(gd, 'DOS', x0 + DOS_W / 2, H + 14, { anchor: 'middle', baseline: 'top', cls: 'ax-label', w: 200, h: 56 })
    this.dosEls.push(gd)
  }

  apply(s: BandState, _animate: boolean) {
    this.paths.forEach((p, i) => {
      setDrawn(p, s.bands)
      const focus = s.focusBand === null || s.focusBand === i
      p.style.opacity = focus ? '1' : '0.25'
      p.style.strokeWidth = s.focusBand === i ? '9' : '5'
    })
    this.ef.style.opacity = s.fermi ? '1' : '0'
    for (const g of this.gapEls) g.style.opacity = s.gap ? '1' : '0'
    for (const g of this.dosEls) g.style.opacity = s.dos ? '1' : '0'
  }

  destroy() {
    this.f.destroy()
  }
}

export interface BandSlideOpts {
  name: string
  data: BandData
  steps: ChartStep<BandState>[]
  heading?: string
  notes?: string
  /** 右下角小注（.deck-detail），如“示意能带” */
  note?: string
}

export function bandSlide(o: BandSlideOpts) {
  return chartSlide<BandState>({
    name: o.name,
    heading: o.heading,
    notes: o.notes,
    initial: bandInitial,
    steps: o.steps,
    create(host, { esc }) {
      const chart = new BandChart(host, esc, o.data)
      let note: HTMLElement | null = null
      if (o.note) {
        note = document.createElement('p')
        note.className = 'deck-detail'
        note.style.cssText = 'position:absolute;right:3%;bottom:2%;margin:0'
        note.textContent = o.note
        host.parentElement?.append(note)
      }
      return { apply: (s, a) => chart.apply(s, a), destroy: () => { chart.destroy(); note?.remove() } }
    },
  })
}
