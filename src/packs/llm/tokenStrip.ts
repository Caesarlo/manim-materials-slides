// 词元条：整句文字 → 切成词元框 → 显示 id → 聚焦一个词元。自建 SVG（viewBox 1600×780）。
//
//   tokenStripSlide({
//     name: '分词', text: 'The lattice was stable', tokenizer: makeTokenizer(vocab),
//     steps: [
//       { caption: '一句话', state: { split: false } },
//       { caption: '切成词元', state: { split: true } },
//       { caption: '每个词元一个 id', state: { ids: true } },
//       { caption: '聚焦', state: { focus: 2 } },
//     ],
//     note: '玩具分词器，词表为示意',
//   })
//
// state：split = 各框拉开（未切分时文字连成一行、框不可见）；ids = 框下方显示 id；focus = 高亮第几个词元（其余压暗）。
// 配色：同一个词（词首带空格的词元 + 后续子词）同一色系，相邻的词在 accent / amber 间交替，词内子词深浅交替。
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import { svgEl } from '@/packs/plot/chartFrame'
import { displayToken, isWordStart, type Tokenizer } from './tokenize'
import './tokens.css'

export interface TokenStripState { split: boolean; ids: boolean; focus: number | null }

const W = 1600, H = 780
const FONT = 56, PAD = 20, GAP = 14, BOX_H = 104, BASE_Y = 360

/** 文本宽度估计（无 DOM 时的后备）：宽字符 1em，ASCII 约 0.58em */
export function estimateWidth(s: string, size: number): number {
  let w = 0
  for (const ch of s) w += ch.charCodeAt(0) > 0x2e80 ? size : size * 0.58
  return w
}

export class TokenStrip implements ChartInstance<TokenStripState> {
  readonly svg: SVGSVGElement
  private items: { g: SVGGElement; rect: SVGRectElement; text: SVGTextElement; id: SVGTextElement; unsplitX: number; splitX: number; hue: string; shade: number }[] = []
  private P: Ctx['palette']

  constructor(host: HTMLElement, tokens: string[], ids: number[], ctx: Ctx) {
    const P = (this.P = ctx.palette)
    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg' })
    host.append(this.svg)

    const measure = makeMeasure(this.svg)
    const shown = tokens.map(displayToken)
    const tw = shown.map((s) => measure(s))
    const spaceW = measure(' ')
    const lead = tokens.map((t) => (t.length - t.replace(/^ +/, '').length) * spaceW)

    // 未切分：文字紧挨着排成正常的一行（词首空格留成间隙）
    let total0 = 0
    const unsplitX: number[] = []
    tokens.forEach((_, i) => { total0 += lead[i]; unsplitX.push(total0); total0 += tw[i] })
    const x0u = (W - total0) / 2
    // 切分：每个框 = 文字 + 两侧内边距，框与框之间留缝
    const total1 = tw.reduce((a, b) => a + b + 2 * PAD, 0) + GAP * (tokens.length - 1)
    const x0s = (W - total1) / 2
    const splitX: number[] = []
    let cur = x0s
    tw.forEach((w) => { splitX.push(cur + PAD); cur += w + 2 * PAD + GAP })

    // 色系：按词分组
    let word = -1, inWord = 0
    tokens.forEach((t, i) => {
      if (isWordStart(t, i)) { word++; inWord = 0 } else inWord++
      const hue = word % 2 === 0 ? P.accent : P.amber
      const g = svgEl('g', { class: 'tr' }, this.svg)
      const rect = svgEl('rect', { x: -PAD, y: -BOX_H * 0.68, width: tw[i] + 2 * PAD, height: BOX_H, rx: 18, class: 'tr' }, g)
      rect.style.fill = hue
      rect.style.stroke = hue
      rect.style.strokeWidth = '3'
      const text = svgEl('text', { x: 0, y: 0, class: 'tok-text tr' }, g)
      text.textContent = shown[i]
      const id = svgEl('text', { x: tw[i] / 2, y: BOX_H * 0.32 + 52, class: 'tok-id tr' }, g)
      id.textContent = String(ids[i])
      this.items.push({ g, rect, text, id, unsplitX: x0u + unsplitX[i], splitX: splitX[i], hue, shade: inWord % 2 })
    })
  }

  apply(s: TokenStripState, _animate: boolean) {
    const P = this.P
    this.items.forEach((it, i) => {
      const x = s.split ? it.splitX : it.unsplitX
      it.g.style.transform = `translate(${x}px, ${BASE_Y}px)`
      const hot = s.focus === i
      const dim = s.focus !== null && !hot
      it.g.style.opacity = dim ? '0.3' : '1'
      it.rect.style.opacity = s.split ? '1' : '0'
      it.rect.style.fillOpacity = hot ? '1' : it.shade ? '0.30' : '0.14'
      it.text.style.fill = hot ? P.bg : P.fg
      it.id.style.opacity = s.ids ? '1' : '0'
      it.id.style.fill = hot ? it.hue : P.muted
    })
  }

  destroy() {
    this.svg.remove()
  }
}

/** 优先用 canvas 实测宽度（与页面字体一致），不可用时退回估计 */
function makeMeasure(svg: SVGSVGElement): (s: string) => number {
  try {
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) throw new Error('no canvas')
    const family = getComputedStyle(svg).fontFamily || 'sans-serif'
    ctx.font = `500 ${FONT}px ${family}`
    return (s) => ctx.measureText(s).width
  } catch {
    return (s) => estimateWidth(s, FONT)
  }
}

export interface TokenStripSlideOpts {
  name: string
  text: string
  tokenizer: Tokenizer
  steps: ChartStep<TokenStripState>[]
  note?: string
  notes?: string
}

export function tokenStripSlide(o: TokenStripSlideOpts): SlideDef {
  const { tokens, ids } = o.tokenizer.encode(o.text)
  return chartSlide<TokenStripState>({
    name: o.name,
    notes: o.notes,
    note: o.note,
    initial: { split: false, ids: false, focus: null },
    steps: o.steps,
    create: (host, ctx) => new TokenStrip(host, tokens, ids, ctx),
  })
}
