// 下一个词元的概率条形图：自回归生成的“一轮”= 当前前缀 + 候选词元的 logits → softmax(logits/T) → 选一个追加到前缀。
// 不是坐标轴图，自建 SVG（viewBox 1600×780），沿用 .chart-svg / .tr 样式。概率一律由 softmaxT 现算，不手填。
//
//   nextTokenSlide({
//     name: '逐词生成',
//     rounds: [
//       { prefix: ['The', 'lattice', 'was'], candidates: [{ label: 'stable', logit: 3 }, { label: 'unstable', logit: 1.6 }], chosen: 0 },
//       { prefix: ['The', 'lattice', 'was', 'stable'], candidates: [...], chosen: 0 },
//     ],
//     steps: [
//       { caption: '看分布', state: { round: 0, phase: 'dist' } },
//       { caption: '选中并追加', state: { phase: 'pick' } },
//       { caption: '下一轮', state: { round: 1, phase: 'dist' } },
//     ],
//     note: 'logits 为示意值',
//     showEntropy: true,        // 右上角显示 T 与当前分布的熵 H（bit），公式走 KaTeX
//   })
//
// state：round = 第几轮（0 起）；phase = 'dist' 显示本轮候选分布，'pick' 选中该行并把词元飞到前缀末尾；
//        temp = 温度 T（条长平滑变化）；k = 显示前 k 个候选（按概率降序；被选中者排在 k 之外时自动多显示到它）。
// 约定：整次生成的词元序列 = rounds[0].prefix + 各轮 chosen 对应的 label；每轮的 prefix 只用于说明，布局按这条序列。
// 条长 = 概率（满条代表 p = 1），百分比是对**全部候选**做 softmax 的结果（k 只决定显示几行，不重新归一化）。
import { inlineTex } from '@/runtime/tex'
import type { Ctx } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import { svgEl } from '@/packs/plot/chartFrame'
import type { SlideDef } from '@/runtime/types'
import { entropy, softmaxT, topK } from './sampling'

export interface TokenCandidate { label: string; logit: number }
export interface Round {
  prefix: string[]
  candidates: TokenCandidate[]
  /** 被选中的候选下标（对应 candidates） */
  chosen: number
}
export interface NextTokenState { round: number; phase: 'dist' | 'pick'; temp: number; k: number }

const W = 1600, H = 780
const TOK_Y = 8, TOK_H = 84, TOK_GAP = 14
const ROW0 = 150, MAX_PITCH = 100
const LABEL_X = 20, LABEL_W = 300
const BAR_X = 340, BAR_W = 820
const PCT_X = 1190, PCT_W = 390

/** 词元框宽度估计：拉丁字符约 19 单位，其余约 32，加左右内边距 */
export function tokenWidth(label: string): number {
  let w = 0
  for (const ch of label) w += ch.charCodeAt(0) > 0xff ? 32 : 19
  return Math.max(84, Math.round(w + 48))
}

export class NextTokenChart implements ChartInstance<NextTokenState> {
  readonly svg: SVGSVGElement
  private base: number
  private seq: string[]
  private slotX: number[] = []
  private pitch: number
  private nSlots: number
  private toks: { g: SVGGElement; rect: SVGRectElement }[] = []
  private holes: SVGRectElement[] = []
  private rows: { g: SVGGElement; bar: SVGRectElement; label: HTMLElement; pct: HTMLElement; labelSpan: HTMLElement; pctSpan: HTMLElement }[] = []
  private hl: SVGRectElement
  private info: HTMLElement | null = null
  private infoKey = ''

  constructor(host: HTMLElement, private rounds: Round[], ctx: Ctx, showEntropy = false) {
    const P = ctx.palette
    this.base = rounds[0].prefix.length
    this.seq = [...rounds[0].prefix, ...rounds.map((r) => r.candidates[r.chosen].label)]
    this.nSlots = Math.min(8, Math.max(...rounds.map((r) => r.candidates.length)))
    this.pitch = Math.min(MAX_PITCH, (H - ROW0 - 10) / this.nSlots)
    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' })
    host.append(this.svg)

    const fo = (parent: Element, x: number, y: number, w: number, h: number, align: string, extra = '') => {
      const f = svgEl('foreignObject', { x, y, width: w, height: h, class: 'fo' }, parent)
      const div = document.createElement('div')
      div.className = 'fo-text'
      div.style.cssText = `height:100%;justify-content:center;text-align:${align};${extra}`
      const span = document.createElement('span')
      div.append(span)
      f.append(div)
      return { div, span }
    }

    // 前缀行：占位虚线框 + 词元框
    let x = 0
    this.seq.forEach((label, i) => {
      const w = tokenWidth(label)
      this.slotX.push(x)
      const hole = svgEl('rect', { x, y: TOK_Y, width: w, height: TOK_H, rx: 20, class: 'tr', opacity: 0 }, this.svg)
      hole.style.fill = 'none'
      hole.style.stroke = P.muted
      hole.style.strokeWidth = '3'
      hole.style.strokeDasharray = '10 9'
      this.holes.push(hole)
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      const rect = svgEl('rect', { x, y: TOK_Y, width: w, height: TOK_H, rx: 20 }, g)
      rect.style.fill = P.bg
      rect.style.stroke = i < this.base ? P.muted : P.accent
      rect.style.strokeWidth = i < this.base ? '3' : '5'
      const t = fo(g, x, TOK_Y, w, TOK_H, 'center', i < this.base ? '' : `color:${P.accent};font-weight:600;`)
      t.span.textContent = label
      this.toks.push({ g, rect })
      x += w + TOK_GAP
    })

    // 高亮选中行的外框
    this.hl = svgEl('rect', { x: 0, y: ROW0, width: W, height: this.pitch - 6, rx: 22, class: 'tr', opacity: 0 }, this.svg)
    this.hl.style.fill = 'none'
    this.hl.style.stroke = P.accent
    this.hl.style.strokeWidth = '4'

    // 候选行
    const barH = Math.round(this.pitch * 0.58)
    for (let i = 0; i < this.nSlots; i++) {
      const y = ROW0 + i * this.pitch
      const g = svgEl('g', { class: 'tr', opacity: 0 }, this.svg)
      const label = fo(g, LABEL_X, y, LABEL_W, this.pitch - 6, 'left')
      const bar = svgEl('rect', { x: BAR_X, y: y + (this.pitch - 6 - barH) / 2, width: BAR_W, height: barH, rx: 12, class: 'tr' }, g)
      bar.style.fill = P.accent
      bar.style.transformBox = 'fill-box'
      bar.style.transformOrigin = 'left center'
      bar.style.transform = 'scaleX(0)'
      const pct = fo(g, PCT_X, y, PCT_W, this.pitch - 6, 'right', 'font-weight:700;')
      this.rows.push({ g, bar, label: label.div, pct: pct.div, labelSpan: label.span, pctSpan: pct.span })
    }

    if (showEntropy) {
      const f = fo(this.svg, W - 620, TOK_Y, 620, TOK_H, 'right')
      this.info = f.span
      f.div.style.color = P.fg
    }
  }

  apply(state: NextTokenState, _animate: boolean) {
    const r = Math.max(0, Math.min(this.rounds.length - 1, state.round))
    const round = this.rounds[r]
    const pick = state.phase === 'pick'
    const probs = softmaxT(round.candidates.map((c) => c.logit), state.temp)
    const order = topK(probs, round.candidates.map((c) => c.label), probs.length)
    const rank = order.findIndex((o) => o.index === round.chosen)
    const kEff = Math.min(this.nSlots, order.length, Math.max(state.k, rank + 1))

    // 候选行
    this.rows.forEach((row, i) => {
      const it = i < kEff ? order[i] : null
      if (it) {
        row.labelSpan.textContent = it.label
        row.pctSpan.textContent = `${(it.p * 100).toFixed(1)}%`
      }
      row.bar.style.transform = `scaleX(${it ? it.p : 0})`
      row.g.setAttribute('opacity', String(!it ? 0 : pick && i !== rank ? 0.22 : 1))
    })
    this.hl.style.transform = `translateY(${rank * this.pitch}px)`
    this.hl.setAttribute('opacity', String(pick && rank < kEff ? 1 : 0))

    // 前缀行
    const cur = this.base + r
    const visible = cur + (pick ? 1 : 0)
    const rowCy = ROW0 + rank * this.pitch + (this.pitch - 6) / 2
    this.toks.forEach(({ g }, i) => {
      g.setAttribute('opacity', String(i < visible ? 1 : 0))
      // 本轮要追加的词元：dist 时停在被选中行的词元位置（透明），pick 时飞到前缀末尾
      const away = i === cur && !pick
      g.style.transform = away ? `translate(${LABEL_X - this.slotX[i]}px, ${rowCy - (TOK_Y + TOK_H / 2)}px)` : 'translate(0px, 0px)'
      this.holes[i].setAttribute('opacity', String(i === cur && !pick ? 1 : 0))
    })

    // 温度与熵
    if (this.info) {
      const key = `${state.temp}|${entropy(probs).toFixed(2)}`
      if (key !== this.infoKey) {
        this.infoKey = key
        const T = Number.isInteger(state.temp) ? String(state.temp) : String(+state.temp.toFixed(2))
        this.info.innerHTML = inlineTex(String.raw`$T$ = ${T}　　$H$ = ${entropy(probs).toFixed(2)} bit`, (s) => s)
      }
    }
  }

  destroy() {
    this.svg.remove()
  }
}

export interface NextTokenSlideOpts {
  name: string
  rounds: Round[]
  steps: ChartStep<NextTokenState>[]
  note?: string
  notes?: string
  /** 右上角显示温度 T 与当前分布的熵 H（bit） */
  showEntropy?: boolean
  /** 初始温度（默认 1） */
  temp?: number
  /** 初始显示的候选数（默认 5） */
  k?: number
}

export function nextTokenSlide(o: NextTokenSlideOpts): SlideDef {
  return chartSlide<NextTokenState>({
    name: o.name,
    notes: o.notes,
    note: o.note,
    initial: { round: 0, phase: 'dist', temp: o.temp ?? 1, k: o.k ?? 5 },
    steps: o.steps,
    create: (host, ctx) => new NextTokenChart(host, o.rounds, ctx, o.showEntropy),
  })
}
