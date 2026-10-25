// 注意力热图：n×n 权重矩阵，行 = 查询词元（左侧标注），列 = 键词元（上方标注，旋转 -45°（-35° 时长词元会压到相邻的标签））。自建 SVG（viewBox 1600×780）。
//
//   attentionMapSlide({
//     name: '注意力', tokens: ['The', 'lattice', …], weights: attention(Q, K),
//     causalWeights: attention(Q, K, { causal: true }),   // 可选：masked 时换用这一组（各行重新归一化）
//     steps: [
//       { caption: '每行是一个查询', state: { rowsShown: 9 } },
//       { caption: '看某一行', state: { focusRow: 5 } },
//       { caption: '因果掩码', state: { masked: true } },
//     ],
//     note: '随机小模型的注意力，非真实模型输出',
//   })
//
// 格子深浅 = 权重（accent 的不透明度，全矩阵共用同一比例尺），格内不写数字。
// state：rowsShown = 已出现的行数（逐行淡入）；focusRow = 聚焦某一行（其余压暗），并在右侧用条形显示该行各列权重；
//        masked = 上三角盖上灰色斜纹（因果掩码），权重换成 causalWeights（没给就把上三角置 0 不重新归一化）。
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import { svgEl } from '@/packs/plot/chartFrame'
import { displayToken } from './tokenize'
import './tokens.css'

export interface AttentionMapState { rowsShown: number; focusRow: number | null; masked: boolean }

const W = 1600, H = 780
const ML = 360, MT = 205, MAX_CELL = 64
const BAR_X = 1150, BAR_LEN = 360

let uid = 0

export class AttentionMap implements ChartInstance<AttentionMapState> {
  readonly svg: SVGSVGElement
  private rows: { g: SVGGElement; cells: SVGRectElement[]; hatch: SVGRectElement[]; label: SVGTextElement }[] = []
  private bars: { g: SVGGElement; rect: SVGRectElement; label: SVGTextElement }[] = []
  private frame: SVGRectElement
  private title: SVGTextElement
  private panel: SVGGElement
  private n: number
  private scale: number

  constructor(
    host: HTMLElement,
    private tokens: string[],
    private weights: number[][],
    private causalWeights: number[][] | undefined,
    ctx: Ctx,
  ) {
    const P = ctx.palette
    const n = (this.n = tokens.length)
    if (weights.length !== n) throw new Error('weights 必须是 n×n，n = tokens 数')
    const cell = Math.min(MAX_CELL, Math.floor((H - MT - 12) / Math.max(n, 1)))
    this.scale = Math.max(1e-9, ...weights.flat(), ...(causalWeights ?? []).flat())

    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' })
    host.append(this.svg)
    const shown = tokens.map(displayToken)

    // 斜纹图案（因果掩码）
    const id = `att-hatch-${uid++}`
    const defs = svgEl('defs', {}, this.svg)
    const pat = svgEl('pattern', { id, width: 14, height: 14, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs)
    svgEl('rect', { width: 14, height: 14, fill: P.line }, pat)
    svgEl('line', { x1: 0, y1: 0, x2: 0, y2: 14, stroke: P.detail, 'stroke-width': 4 }, pat)

    // 列标签（上方，旋转 -45°（-35° 时长词元会压到相邻的标签），始终显示）
    shown.forEach((t, j) => {
      const x = ML + j * cell + cell / 2, y = MT - 14
      const text = svgEl('text', { x, y, class: 'att-label', transform: `rotate(-45 ${x} ${y})` }, this.svg)
      text.textContent = t
    })

    // 空格子底（始终显示，让矩阵形状一直可见）
    const base = svgEl('g', {}, this.svg)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      svgEl('rect', { x: ML + j * cell + 1.5, y: MT + i * cell + 1.5, width: cell - 3, height: cell - 3, rx: 6, fill: P.line, opacity: 0.45 }, base)
    }

    // 每行一个组：行标签 + 权重格 + 斜纹格（上三角）
    for (let i = 0; i < n; i++) {
      const g = svgEl('g', { class: 'tr' }, this.svg)
      const label = svgEl('text', { x: ML - 16, y: MT + i * cell + cell / 2 + 10, 'text-anchor': 'end', class: 'att-label' }, g)
      label.textContent = shown[i]
      const cells: SVGRectElement[] = []
      const hatch: SVGRectElement[] = []
      for (let j = 0; j < n; j++) {
        const geo = { x: ML + j * cell + 1.5, y: MT + i * cell + 1.5, width: cell - 3, height: cell - 3, rx: 6 }
        const r = svgEl('rect', { ...geo, class: 'tr' }, g)
        r.style.fill = P.accent
        cells.push(r)
        const h = svgEl('rect', { ...geo, class: 'tr', fill: `url(#${id})`, opacity: 0 }, g)
        hatch.push(h)
      }
      this.rows.push({ g, cells, hatch, label })
    }

    // 聚焦行的外框
    this.frame = svgEl('rect', { x: ML - 4, y: MT, width: n * cell + 8, height: cell, rx: 10, fill: 'none', stroke: P.fg, 'stroke-width': 4, class: 'tr', opacity: 0 }, this.svg)

    // 右侧条形面板：每个键词元一条，与矩阵的行对齐，长度 = 权重（1.0 → BAR_LEN）
    this.panel = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
    this.title = svgEl('text', { x: BAR_X - 60, y: MT - 52, class: 'att-title' }, this.panel)
    shown.forEach((t, j) => {
      const g = svgEl('g', {}, this.panel)
      const label = svgEl('text', { x: BAR_X - 16, y: MT + j * cell + cell / 2 + 10, 'text-anchor': 'end', class: 'att-label' }, g)
      label.textContent = t
      const rect = svgEl('rect', { x: BAR_X, y: MT + j * cell + cell * 0.2, width: 0, height: cell * 0.6, rx: 6, class: 'tr att-bar' }, g)
      rect.style.fill = P.accent
      this.bars.push({ g, rect, label })
    })
    this.cell = cell
  }
  private cell: number

  apply(s: AttentionMapState, _animate: boolean) {
    const n = this.n
    const W_ = s.masked && this.causalWeights ? this.causalWeights : this.weights
    this.rows.forEach((row, i) => {
      const visible = i < s.rowsShown
      const dim = s.focusRow !== null && s.focusRow !== i
      row.g.style.transitionDelay = `${i * 0.07}s`
      row.g.style.opacity = visible ? (dim ? '0.25' : '1') : '0'
      for (let j = 0; j < n; j++) {
        const masked = s.masked && j > i
        const w = masked ? 0 : W_[i][j]
        row.cells[j].style.opacity = String(w <= 0 ? 0 : 0.06 + 0.94 * (w / this.scale))
        row.hatch[j].style.opacity = masked ? '1' : '0'
      }
    })
    const f = s.focusRow
    this.frame.style.transform = `translateY(${(f ?? 0) * this.cell}px)`
    this.frame.style.opacity = f !== null && f < s.rowsShown ? '1' : '0'
    this.panel.style.opacity = f !== null && f < s.rowsShown ? '1' : '0'
    if (f !== null) {
      this.title.textContent = `「${displayToken(this.tokens[f])}」的注意力`
      this.bars.forEach((b, j) => {
        const masked = s.masked && j > f
        const w = masked ? 0 : W_[f][j]
        b.rect.style.width = `${Math.max(0, w * BAR_LEN)}px`
        b.label.style.opacity = masked ? '0.3' : '1'
      })
    }
  }

  destroy() {
    this.svg.remove()
  }
}

export interface AttentionMapSlideOpts {
  name: string
  tokens: string[]
  weights: number[][]
  /** masked 时改用的权重（因果注意力，各行重新归一化）；不给则只是把上三角置 0 */
  causalWeights?: number[][]
  steps: ChartStep<AttentionMapState>[]
  note?: string
  notes?: string
}

export function attentionMapSlide(o: AttentionMapSlideOpts): SlideDef {
  return chartSlide<AttentionMapState>({
    name: o.name,
    notes: o.notes,
    note: o.note,
    initial: { rowsShown: 0, focusRow: null, masked: false },
    steps: o.steps,
    create: (host, ctx) => new AttentionMap(host, o.tokens, o.weights, o.causalWeights, ctx),
  })
}
