// 图表底座：一张 SVG（viewBox 1600×780）+ 坐标轴 + 分层容器。具体图表（折线、能带、散点…）在它上面画。
//
//   const f = new ChartFrame(host, { esc, x: { domain: [300, 800], label: '$T$ (K)' }, y: { domain: [0, 2], label: '$zT$' } })
//   f.x(500) / f.y(1.2)               // 数据 → 像素（在 f.plot 坐标系里）
//   f.layers.data.append(path)        // 图层顺序：grid < axes < data < marks < labels，data 被裁剪在绘图区内
//
// 约定（所有图表共用，保证风格一致）：
// - 像素单位是 viewBox 单位；页面上 1 单位 ≈ 1.1 个 1080p 像素，所以文字 ≥ 28 单位才满足“不写小字”。
// - 动画全靠 CSS transition：给元素加 class "tr"，然后改 opacity / stroke-dashoffset / transform / 颜色等属性即可。
//   跳转（animate=false）时 chartSlide 会给 .chart-host 加 no-tr，一次性关掉所有过渡，所以图表代码**不用**区分两种路径。
// - 画线用 setDrawn(path, on)：路径“画出来”的描边动画。
import { inlineTex } from '@/runtime/tex'
import { linear, log, formatTick, type Scale } from './scale'

const NS = 'http://www.w3.org/2000/svg'

type Attrs = Record<string, string | number | undefined>

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined) el.setAttribute(k, String(v))
  parent?.append(el)
  return el
}

/** 折线路径 d 属性 */
export function pathD(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('')
}

/** 让路径支持“画出来”的动画：之后用 setDrawn(path, true/false) 控制 */
export function prepareDraw(path: SVGPathElement) {
  path.setAttribute('pathLength', '1')
  path.style.strokeDasharray = '1'
  path.style.strokeDashoffset = '1'
  path.classList.add('tr')
}
export function setDrawn(path: SVGPathElement, on: boolean) {
  path.style.strokeDashoffset = on ? '0' : '1'
}

export interface AxisSpec {
  domain: [number, number]
  type?: 'linear' | 'log'
  /** 轴标签，支持 $…$ 行内 LaTeX，如 '$\\kappa$ (W m$^{-1}$ K$^{-1}$)' */
  label?: string
  ticks?: number[]
  tickCount?: number
  tickFormat?: (v: number) => string
  grid?: boolean
}

export interface ChartOpts {
  x: AxisSpec
  y: AxisSpec
  esc: (s: string) => string
  width?: number
  height?: number
  margin?: Partial<Record<'l' | 'r' | 't' | 'b', number>>
}

export class ChartFrame {
  readonly svg: SVGSVGElement
  /** 已平移到绘图区原点的 <g>；所有图表内容都放在它里面 */
  readonly plot: SVGGElement
  readonly x: Scale
  readonly y: Scale
  readonly plotW: number
  readonly plotH: number
  readonly width: number
  readonly height: number
  readonly margin: { l: number; r: number; t: number; b: number }
  readonly layers: Record<'grid' | 'axes' | 'data' | 'marks' | 'labels', SVGGElement>
  private esc: (s: string) => string

  constructor(host: HTMLElement, o: ChartOpts) {
    this.esc = o.esc
    this.width = o.width ?? 1600
    this.height = o.height ?? 780
    this.margin = { l: 130, r: 60, t: 70, b: 135, ...o.margin }
    this.plotW = this.width - this.margin.l - this.margin.r
    this.plotH = this.height - this.margin.t - this.margin.b

    this.svg = svgEl('svg', { viewBox: `0 0 ${this.width} ${this.height}`, class: 'chart-svg' })
    host.append(this.svg)
    this.plot = svgEl('g', { transform: `translate(${this.margin.l},${this.margin.t})` }, this.svg)

    const mk = (ax: AxisSpec, range: [number, number]) => (ax.type === 'log' ? log(ax.domain, range) : linear(ax.domain, range))
    this.x = mk(o.x, [0, this.plotW])
    this.y = mk(o.y, [this.plotH, 0])

    const clipId = `clip-${Math.random().toString(36).slice(2, 8)}`
    const defs = svgEl('defs', {}, this.svg)
    const clip = svgEl('clipPath', { id: clipId }, defs)
    svgEl('rect', { x: -4, y: -4, width: this.plotW + 8, height: this.plotH + 8 }, clip)

    const g = (name: string, clipped = false) => svgEl('g', { class: `layer-${name}`, 'clip-path': clipped ? `url(#${clipId})` : undefined }, this.plot)
    this.layers = { grid: g('grid'), axes: g('axes'), data: g('data', true), marks: g('marks'), labels: g('labels') }

    this.drawAxes(o.x, o.y)
  }

  private drawAxes(ax: AxisSpec, ay: AxisSpec) {
    const { plotW: W, plotH: H } = this
    const xt = ax.ticks ?? this.x.ticks(ax.tickCount ?? 6)
    const yt = ay.ticks ?? this.y.ticks(ay.tickCount ?? 5)
    const fmt = (spec: AxisSpec, ts: number[]) => spec.tickFormat ?? ((v: number) => formatTick(v, ts.length > 1 ? Math.abs(ts[1] - ts[0]) : undefined))
    const fx = fmt(ax, xt), fy = fmt(ay, yt)

    for (const v of xt) {
      const px = this.x(v)
      if (ax.grid) svgEl('line', { x1: px, x2: px, y1: 0, y2: H, class: 'ax-grid' }, this.layers.grid)
      svgEl('line', { x1: px, x2: px, y1: H, y2: H + 10, class: 'ax-tick' }, this.layers.axes)
      svgEl('text', { x: px, y: H + 46, 'text-anchor': 'middle', class: 'tick-label' }, this.layers.axes).textContent = fx(v)
    }
    for (const v of yt) {
      const py = this.y(v)
      if (ay.grid !== false) svgEl('line', { x1: 0, x2: W, y1: py, y2: py, class: 'ax-grid' }, this.layers.grid)
      svgEl('line', { x1: -10, x2: 0, y1: py, y2: py, class: 'ax-tick' }, this.layers.axes)
      svgEl('text', { x: -20, y: py + 10, 'text-anchor': 'end', class: 'tick-label' }, this.layers.axes).textContent = fy(v)
    }
    svgEl('line', { x1: 0, x2: W, y1: H, y2: H, class: 'ax-line' }, this.layers.axes)
    svgEl('line', { x1: 0, x2: 0, y1: 0, y2: H, class: 'ax-line' }, this.layers.axes)

    // 轴标签：y 在轴顶端左上方（水平，好读），x 在右下
    if (ay.label) this.htmlLabel(this.layers.axes, ay.label, 0, -22, { anchor: 'start', baseline: 'bottom', cls: 'ax-label' })
    if (ax.label) this.htmlLabel(this.layers.axes, ax.label, W, H + 128, { anchor: 'end', baseline: 'bottom', cls: 'ax-label' })
  }

  /**
   * 用 foreignObject 放一段 HTML 文字（支持 $…$ 公式）。(x, y) 是锚点，anchor/baseline 决定它在锚点的哪一侧。
   * 返回包着它的 <g>，可以对 g 设 transform / opacity 做动画。
   */
  htmlLabel(
    parent: Element, text: string, x: number, y: number,
    o: { anchor?: 'start' | 'middle' | 'end'; baseline?: 'top' | 'middle' | 'bottom'; cls?: string; color?: string; w?: number; h?: number } = {},
  ): SVGGElement {
    const w = o.w ?? 560, h = o.h ?? 56
    const ox = o.anchor === 'end' ? -w : o.anchor === 'middle' ? -w / 2 : 0
    const oy = o.baseline === 'bottom' ? -h : o.baseline === 'middle' ? -h / 2 : 0
    const g = svgEl('g', { transform: `translate(${x},${y})`, class: 'tr' }, parent)
    const fo = svgEl('foreignObject', { x: ox, y: oy, width: w, height: h, class: 'fo' }, g)
    const div = document.createElement('div')
    div.className = `fo-text ${o.cls ?? ''}`
    div.style.textAlign = o.anchor === 'end' ? 'right' : o.anchor === 'middle' ? 'center' : 'left'
    div.style.justifyContent = o.baseline === 'bottom' ? 'flex-end' : o.baseline === 'middle' ? 'center' : 'flex-start'
    if (o.color) div.style.color = o.color
    // 包进 span：否则公式与文字会成为 flex 容器里并列的两项而被拆成两行
    div.innerHTML = `<span>${inlineTex(text, this.esc)}</span>`
    fo.append(div)
    return g
  }

  destroy() {
    this.svg.remove()
  }
}
