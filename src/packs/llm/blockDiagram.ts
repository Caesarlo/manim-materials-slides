// 模型架构块图：圆角块 + 相邻箭头 + 残差弧线 + ×N 括号。自建 SVG（viewBox 1600×780），沿用 .chart-svg / .tr 样式。
//
//   blockSlide({
//     name: 'Decoder-only 流程', direction: 'row',
//     blocks: [{ id: 'in', label: '输入词元', kind: 'io', shape: String.raw`$B\times T$` },
//              { id: 'attn', label: '注意力', kind: 'attn', group: 'layer' }, …],
//     residuals: [{ from: 'ln1', to: 'attn', label: '残差' }],
//     steps: [{ caption: '先有输入', state: { shown: 1, active: 0 } }, …, { caption: '叠 N 层', state: { group: true, active: null } }],
//     note: '结构示意',
//   })
//
// state：shown = 前 n 个块已出现；active = 当前高亮块下标（accent 填充 + 白字，其余压暗到 0.4；null = 都不压暗）；
//        residuals = 显示前 n 条残差弧线；group = 是否显示 ×N 括号。
// 块内只写短标签，张量形状写在块下（row）或块右侧（column）。
import { inlineTex } from '@/runtime/tex'
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import { svgEl } from '@/packs/plot/chartFrame'
import {
  arrowPath, groupBounds, layoutBlocks, residualPoints, roundedPolyline,
  type Direction, type Pt, type Rect, type Side,
} from './blockLayout'

export type BlockKind = 'io' | 'embed' | 'attn' | 'ffn' | 'norm' | 'add' | 'head'
export interface Block {
  id: string
  /** 块内短标签，支持 $…$ */
  label: string
  kind?: BlockKind
  /** 张量形状，如 $B\times T\times d$ */
  shape?: string
  /** 同组的块会被一个“×N”括号包住 */
  group?: string
}
export interface Residual {
  from: string
  to: string
  label?: string
  /** 绕哪一侧：start = 上/左（默认），end = 下/右 */
  side?: Side
}
export interface BlockState {
  shown: number
  active: number | null
  residuals: number
  group: boolean
}

export interface BlockLayoutOpts {
  gap?: number
  margin?: number
  cross?: number
  maxMain?: number
  /** 残差弧线离块的距离 */
  clearance?: number
}

const W = 1600, H = 780
const DIM = 0.4

export class BlockDiagram implements ChartInstance<BlockState> {
  readonly svg: SVGSVGElement
  private rects: Rect[]
  private nodes: { g: SVGGElement; rect: SVGRectElement; label: HTMLElement; block: Block }[] = []
  private arrows: SVGGElement[] = []
  private resGs: SVGGElement[] = []
  private groupGs: SVGGElement[] = []
  private P: Ctx['palette']
  private dashed: boolean[] = []

  constructor(host: HTMLElement, blocks: Block[], residuals: Residual[], direction: Direction, ctx: Ctx, o: BlockLayoutOpts = {}) {
    const P = (this.P = ctx.palette)
    const row = direction === 'row'
    const gap = o.gap ?? (row ? 74 : 60)
    const clearance = o.clearance ?? 90
    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' })
    host.append(this.svg)
    this.rects = layoutBlocks(blocks, {
      direction, width: W, height: H, gap, margin: o.margin ?? (row ? 50 : 30),
      cross: o.cross ?? (row ? 170 : 400), maxMain: o.maxMain ?? (row ? undefined : 62),
    })

    const fo = (parent: Element, x: number, y: number, w: number, h: number, html: string, align: string, extra = '') => {
      const f = svgEl('foreignObject', { x, y, width: w, height: h, class: 'fo' }, parent)
      const div = document.createElement('div')
      div.className = 'fo-text'
      div.style.cssText = `height:100%;justify-content:center;text-align:${align};transition:color .5s;${extra}`
      div.innerHTML = `<span>${html}</span>`
      f.append(div)
      return div
    }

    // 括号先画（在块后面）
    const groups = [...new Set(blocks.map((b) => b.group).filter((g): g is string => !!g))]
    const hasShape = blocks.some((b) => b.shape)
    for (const gr of groups) {
      const pad = row ? { l: 26, r: 26, t: 30, b: hasShape ? 62 : 30 } : { l: 26, r: hasShape ? 250 : 26, t: 26, b: 26 }
      const bb = groupBounds(blocks, this.rects, gr, pad)!
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      svgEl('rect', { x: bb.x, y: bb.y, width: bb.w, height: bb.h, rx: 24, fill: 'none', stroke: P.muted, 'stroke-width': 2 }, g)
      fo(g, bb.x + bb.w - 200, bb.y - 52, 200, 48, inlineTex(String.raw`$\times N$`, ctx.esc), 'right', 'justify-content:flex-end;')
      this.groupGs.push(g)
    }

    // 箭头
    for (let i = 0; i + 1 < blocks.length; i++) {
      const { from, to } = arrowPath(this.rects[i], this.rects[i + 1], direction)
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      this.arrow(g, from, to, 8, P.muted)
      this.arrows.push(g)
    }

    // 块
    blocks.forEach((b, i) => {
      const r = this.rects[i]
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      const rect = svgEl('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 22, class: 'tr' }, g)
      rect.style.strokeWidth = '3'
      const dashed = b.kind === 'io' || b.kind === 'norm'
      this.dashed.push(dashed)
      const label = fo(g, r.x + 8, r.y, r.w - 16, r.h, inlineTex(b.label, ctx.esc), 'center', 'line-height:1.15;')
      if (b.shape) {
        const sh = row
          ? fo(g, r.x + r.w / 2 - 150, r.y + r.h + 8, 300, 46, inlineTex(b.shape, ctx.esc), 'center')
          : fo(g, r.x + r.w + 22, r.y, 330, r.h, inlineTex(b.shape, ctx.esc), 'left')
        sh.style.fontSize = '28px'
        sh.style.color = P.muted
      }
      this.nodes.push({ g, rect, label, block: b })
    })

    // 残差弧线
    const idx = (id: string) => blocks.findIndex((b) => b.id === id)
    for (const res of residuals) {
      const a = idx(res.from), b = idx(res.to)
      if (a < 0 || b < 0) throw new Error(`残差引用了不存在的块：${res.from} → ${res.to}`)
      const side = res.side ?? 'start'
      const pts = residualPoints(this.rects[a], this.rects[b], direction, gap, side, clearance)
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      const path = svgEl('path', { d: roundedPolyline(pts, 30), fill: 'none', stroke: P.amber, 'stroke-width': 4, 'stroke-dasharray': '16 12', 'stroke-linecap': 'round' }, g)
      path.style.strokeWidth = '4'
      svgEl('circle', { cx: pts[0].x, cy: pts[0].y, r: 8, fill: P.amber }, g)
      // 起点到第一个块的主干短线（第一个块前面没有箭头时）
      if (a === 0) {
        const edge = row ? { x: this.rects[0].x, y: pts[0].y } : { x: pts[0].x, y: this.rects[0].y }
        this.arrow(g, pts[0], edge, 0, P.muted)
      }
      // 终点箭头：沿 out → trunk 方向
      const e = pts[3], p = pts[2]
      const dx = Math.sign(e.x - p.x), dy = Math.sign(e.y - p.y)
      const s = 12
      const bx = e.x - dx * s, by = e.y - dy * s
      const px = dy * s, py = dx * s
      svgEl('path', { d: `M${bx + px},${by + py} L${e.x},${e.y} L${bx - px},${by - py}`, fill: 'none', stroke: P.amber, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g)
      if (res.label) {
        const mid: Pt = { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 }
        const outward = side === 'start' ? -1 : 1
        const lab = row
          ? fo(g, mid.x - 150, outward < 0 ? mid.y - 58 : mid.y + 10, 300, 48, inlineTex(res.label, ctx.esc), 'center')
          : fo(g, outward < 0 ? mid.x - 12 - 200 : mid.x + 12, mid.y - 24, 200, 48, inlineTex(res.label, ctx.esc), outward < 0 ? 'right' : 'left')
        lab.style.color = P.amber
        lab.style.fontWeight = '700'
      }
      this.resGs.push(g)
    }
  }

  /** 画一条带箭头的直线，终点往回缩 inset */
  private arrow(parent: Element, from: Pt, to: Pt, inset: number, color: string) {
    const len = Math.hypot(to.x - from.x, to.y - from.y)
    if (len < 1) return
    const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len
    const e = { x: to.x - ux * inset, y: to.y - uy * inset }
    svgEl('line', { x1: from.x, y1: from.y, x2: e.x, y2: e.y, stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round' }, parent)
    if (inset > 0) {
      const s = 13
      const bx = e.x - ux * s, by = e.y - uy * s
      svgEl('path', { d: `M${bx - uy * s},${by + ux * s} L${e.x},${e.y} L${bx + uy * s},${by - ux * s}`, fill: 'none', stroke: color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, parent)
    }
  }

  apply(state: BlockState, _animate: boolean) {
    const P = this.P
    const anyActive = state.active !== null
    const dimOf = (i: number) => (anyActive && i !== state.active ? DIM : 1)
    this.nodes.forEach(({ g, rect, label, block }, i) => {
      const hot = i === state.active
      const visible = i < state.shown
      g.setAttribute('opacity', String(visible ? dimOf(i) : 0))
      const light = block.kind === 'embed' || block.kind === 'head' || block.kind === 'add'
      rect.style.fill = hot ? P.accent : light ? P.line : P.bg
      rect.style.stroke = hot ? P.accent : block.kind === 'attn' || block.kind === 'ffn' ? P.fg : P.muted
      label.style.color = hot ? P.bg : P.fg
      rect.style.strokeDasharray = this.dashed[i] && !hot ? '12 9' : 'none'
    })
    this.arrows.forEach((g, i) => {
      const both = anyActive && state.active !== i && state.active !== i + 1
      g.setAttribute('opacity', String(i + 1 < state.shown ? (both ? DIM : 1) : 0))
    })
    this.resGs.forEach((g, k) => g.setAttribute('opacity', String(k < state.residuals ? 1 : 0)))
    this.groupGs.forEach((g) => g.setAttribute('opacity', String(state.group ? 1 : 0)))
  }

  destroy() {
    this.svg.remove()
  }
}

export interface BlockSlideOpts {
  name: string
  blocks: Block[]
  residuals?: Residual[]
  direction?: Direction
  steps: ChartStep<BlockState>[]
  layout?: BlockLayoutOpts
  notes?: string
  /** 右下角小注，如“结构示意” */
  note?: string
}

export function blockSlide(o: BlockSlideOpts): SlideDef {
  return chartSlide<BlockState>({
    name: o.name,
    notes: o.notes,
    note: o.note,
    initial: { shown: 0, active: null, residuals: 0, group: false },
    steps: o.steps,
    create: (host, ctx) => new BlockDiagram(host, o.blocks, o.residuals ?? [], o.direction ?? 'row', ctx, o.layout),
  })
}
