// Agent 编排回放图：用户 → 主 agent → 子 agent / 工具（并行时纵向排开），一个事件一步。自建 SVG（viewBox 1600×780）。
//
//   agentSlide({
//     name: '研究助手会话',
//     trace: fromMessages(session),        // 见 agentTrace.ts
//     note: '示意会话（手写数据，格式同 harness 线程）',
//     group: [[2, 3]],                     // 可选：把第 2、3 个事件合成一步
//   })
//
// state：{ at } = 回放到第几个事件（0 = 尚未开始）。画面完全由 at 决定：
// - 已出现的 actor 保留；状态色：运行中 amber、成功 teal、失败/超时/取消 red（带 ✗ 角标；成功带 ✓）。
// - 已走过的连线变淡；当前事件的连线加粗，带箭头，“信息包”小圆点用 CSS transform 过渡滑到目的地。
// - 重试：从失败 actor 到新 actor（或同一工具自身）的回路箭头。
// - 不涉及当前事件的 actor 压暗到 0.45。
import type { Ctx, SlideDef } from '@/runtime/types'
import { chartSlide, type ChartInstance, type ChartStep } from '@/packs/plot/chartSlide'
import { svgEl } from '@/packs/plot/chartFrame'
import {
  actorStatesAt, describeEvent, eventActors, eventFlows, stepsFromGroups, LEAD_ID, USER_ID,
  type Actor, type ActorState, type AgentTrace,
} from './agentTrace'
import './agentFlow.css'

export interface AgentFlowState { at: number }

const W = 1600, H = 780, CY = H / 2
const USER_BOX = { cx: 160, w: 200, h: 100 }
const LEAD_BOX = { cx: 640, w: 280, h: 124 }
const SIDE_BOX = { cx: 1300, w: 360 }
const LOOP_X = 130 // 回路箭头向右凸出的距离

interface Pt { x: number; y: number }
interface BoxEls { g: SVGGElement; rect: SVGRectElement; badge: SVGGElement; badgeCircle: SVGCircleElement; cross: SVGPathElement; tick: SVGPathElement; label: SVGTextElement }
interface EdgeEls { g: SVGGElement; line: SVGLineElement; headOut: SVGGElement; headIn: SVGGElement; a: Pt; b: Pt }
interface LoopEls { path: SVGPathElement; event: number }

export class AgentFlow implements ChartInstance<AgentFlowState> {
  readonly svg: SVGSVGElement
  private P: Ctx['palette']
  private box = new Map<string, BoxEls>()
  private pos = new Map<string, { cx: number; cy: number; w: number; h: number }>()
  private edge = new Map<string, EdgeEls>()
  private loops: LoopEls[] = []
  private packets: SVGCircleElement[] = []

  constructor(host: HTMLElement, private trace: AgentTrace, ctx: Ctx) {
    const P = (this.P = ctx.palette)
    this.svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart-svg agent-svg' })
    host.append(this.svg)

    // 回路箭头的箭头头（实心三角）
    const defs = svgEl('defs', {}, this.svg)
    const mid = `af-arrow-${Math.random().toString(36).slice(2, 8)}`
    const marker = svgEl('marker', { id: mid, viewBox: '0 0 28 28', refX: 24, refY: 14, markerWidth: 28, markerHeight: 28, markerUnits: 'userSpaceOnUse', orient: 'auto' }, defs)
    svgEl('path', { d: 'M2,3 L25,14 L2,25 Z', fill: P.fg }, marker)

    const edgeLayer = svgEl('g', {}, this.svg)
    const loopLayer = svgEl('g', {}, this.svg)
    const boxLayer = svgEl('g', {}, this.svg)
    const pktLayer = svgEl('g', {}, this.svg)

    // ── 布局 ──
    const side = trace.actors.filter((a) => a.kind === 'worker' || a.kind === 'tool')
    const n = side.length
    const pitch = n <= 1 ? 0 : Math.min(170, (H - 130) / n)
    const sideH = Math.min(100, Math.max(56, (pitch || 100) - 20))
    side.forEach((a, i) => {
      this.pos.set(a.id, { cx: SIDE_BOX.cx, cy: CY + (i - (n - 1) / 2) * pitch, w: SIDE_BOX.w, h: sideH })
    })
    this.pos.set(USER_ID, { cx: USER_BOX.cx, cy: CY, w: USER_BOX.w, h: USER_BOX.h })
    this.pos.set(LEAD_ID, { cx: LEAD_BOX.cx, cy: CY, w: LEAD_BOX.w, h: LEAD_BOX.h })

    // ── 连线：每个非主 agent 的 actor 一条（用户也是） ──
    const lead = this.pos.get(LEAD_ID)!
    for (const a of trace.actors) {
      if (a.id === LEAD_ID) continue
      const p = this.pos.get(a.id)!
      const toUser = a.id === USER_ID
      const A: Pt = toUser ? { x: lead.cx - lead.w / 2, y: CY } : { x: lead.cx + lead.w / 2, y: CY }
      const B: Pt = toUser ? { x: p.cx + p.w / 2, y: CY } : { x: p.cx - p.w / 2, y: p.cy }
      const g = svgEl('g', { class: 'tr', opacity: 0 }, edgeLayer)
      const line = svgEl('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, class: 'tr', 'stroke-linecap': 'round' }, g)
      const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI
      const head = (at: Pt, deg: number) => {
        const h = svgEl('g', { transform: `translate(${at.x},${at.y}) rotate(${deg})` }, g)
        const c = svgEl('path', { d: 'M-26,-18 L0,0 L-26,18', fill: 'none', 'stroke-width': 6, class: 'tr', opacity: 0 }, h)
        c.style.stroke = P.fg
        return h
      }
      // headOut = 指向该 actor（主 agent → 它）；headIn = 指向主 agent（它 → 主 agent）
      // 箭头头离端点 50 个单位，避免被落在端点的信息包盖住
      const len = Math.hypot(B.x - A.x, B.y - A.y), ux = (B.x - A.x) / len, uy = (B.y - A.y) / len
      const headOut = head({ x: B.x - ux * 50, y: B.y - uy * 50 }, ang)
      const headIn = head({ x: A.x + ux * 50, y: A.y + uy * 50 }, ang + 180)
      this.edge.set(a.id, { g, line, headOut, headIn, a: A, b: B })
    }

    // ── 回路箭头（重试） ──
    trace.events.forEach((ev, idx) => {
      if (ev.type !== 'retry') return
      for (const c of ev.calls) {
        const f = this.pos.get(c.from), t = this.pos.get(c.to)
        if (!f || !t) continue
        const x = f.cx + f.w / 2
        const d = c.from === c.to
          ? `M${x},${f.cy - 26} C${x + LOOP_X * 0.8},${f.cy - 70} ${x + LOOP_X * 0.8},${f.cy + 70} ${x},${f.cy + 26}`
          : `M${x},${f.cy} C${x + LOOP_X},${f.cy} ${x + LOOP_X},${t.cy} ${x},${t.cy}`
        const path = svgEl('path', { d, fill: 'none', class: 'tr', opacity: 0, 'marker-end': `url(#${mid})` }, loopLayer)
        path.style.stroke = P.fg
        this.loops.push({ path, event: idx })
      }
    })

    // ── actor 框 ──
    for (const a of trace.actors) this.makeBox(boxLayer, a)

    // ── 信息包：数量 = 单个事件里最多同时流动的条数 ──
    const nPk = Math.max(1, ...trace.events.map((e) => eventFlows(e).length))
    for (let i = 0; i < nPk; i++) {
      const c = svgEl('circle', { r: 17, class: 'af-pkt', opacity: 0, 'stroke-width': 4 }, pktLayer)
      c.style.fill = P.fg
      c.style.stroke = P.bg
      c.style.transform = `translate(${lead.cx}px,${CY}px)`
      this.packets.push(c)
    }
  }

  private makeBox(layer: SVGGElement, a: Actor) {
    const P = this.P
    const p = this.pos.get(a.id)!
    const g = svgEl('g', { class: 'tr', opacity: 0 }, layer)
    const rect = svgEl('rect', { x: p.cx - p.w / 2, y: p.cy - p.h / 2, width: p.w, height: p.h, rx: 22, class: 'tr' }, g)
    rect.style.strokeWidth = '4'
    const label = svgEl('text', { x: p.cx, y: p.cy, class: 'af-label tr' }, g)
    label.textContent = a.label
    // 右上角状态角标：失败 ✗ / 成功 ✓（用描边路径，不依赖字体）
    const bx = p.cx + p.w / 2 - 6, by = p.cy - p.h / 2 + 6
    const badge = svgEl('g', { transform: `translate(${bx},${by})`, class: 'tr', opacity: 0 }, g)
    const badgeCircle = svgEl('circle', { r: 24, class: 'tr' }, badge)
    badgeCircle.style.stroke = P.bg
    badgeCircle.style.strokeWidth = '4'
    const cross = svgEl('path', { d: 'M-9,-9 L9,9 M9,-9 L-9,9', fill: 'none', 'stroke-width': 5, class: 'tr' }, badge)
    const tick = svgEl('path', { d: 'M-10,1 L-3,8 L11,-8', fill: 'none', 'stroke-width': 5, class: 'tr' }, badge)
    cross.style.stroke = P.bg
    tick.style.stroke = P.bg
    this.box.set(a.id, { g, rect, badge, badgeCircle, cross, tick, label })
  }

  /** 信息包在流向终点的位置：落在目的地方框朝向主 agent 的那条边中点 */
  private flowEnd(to: string, from: string): Pt {
    const t = this.pos.get(to)!
    if (to === LEAD_ID) {
      return from === USER_ID ? { x: t.cx - t.w / 2, y: CY } : { x: t.cx + t.w / 2, y: CY }
    }
    return to === USER_ID ? { x: t.cx + t.w / 2, y: CY } : { x: t.cx - t.w / 2, y: t.cy }
  }

  apply(state: AgentFlowState, _animate: boolean) {
    const P = this.P
    const evs = this.trace.events
    const at = Math.max(0, Math.min(evs.length, Math.round(state.at)))
    const cur = at > 0 ? evs[at - 1] : undefined
    const states = actorStatesAt(this.trace, at)
    const involved = new Set(cur ? eventActors(cur) : [])

    // actor 框
    for (const a of this.trace.actors) {
      const b = this.box.get(a.id)!
      const s: ActorState = states[a.id]
      const shown = s !== 'hidden'
      const lead = a.kind === 'lead'
      b.g.setAttribute('opacity', String(shown ? (cur && !involved.has(a.id) ? 0.45 : 1) : 0))
      const color = lead ? P.accent : s === 'running' ? P.amber : s === 'ok' ? P.teal : s === 'idle' || s === 'hidden' ? P.muted : P.red
      b.rect.style.stroke = color
      b.rect.style.fill = lead ? P.accent : P.bg
      b.rect.style.strokeWidth = s === 'idle' || s === 'hidden' ? '3' : '5'
      b.label.style.fill = lead ? P.bg : P.fg
      const failed = s === 'failed' || s === 'cancelled' || s === 'timed_out'
      b.badge.setAttribute('opacity', failed || s === 'ok' ? '1' : '0')
      b.badgeCircle.style.fill = failed ? P.red : P.teal
      b.cross.setAttribute('opacity', failed ? '1' : '0')
      b.tick.setAttribute('opacity', s === 'ok' ? '1' : '0')
    }

    // 连线：已走过的变淡，当前事件的加粗并带箭头
    const used = new Map<string, number>() // 非主 agent 端 id → 最近一次使用的事件下标
    const curDir = new Map<string, 'out' | 'in'>()
    evs.slice(0, at).forEach((ev, i) => {
      for (const f of eventFlows(ev)) {
        const other = f.from === LEAD_ID ? f.to : f.from
        used.set(other, i)
        if (i === at - 1) curDir.set(other, f.from === LEAD_ID ? 'out' : 'in')
      }
    })
    for (const [id, e] of this.edge) {
      const isUsed = used.has(id)
      const isCur = curDir.has(id)
      e.g.setAttribute('opacity', isUsed ? '1' : '0')
      e.line.style.stroke = isCur ? P.fg : P.muted
      e.line.style.strokeWidth = isCur ? '7' : '3'
      e.line.setAttribute('opacity', isCur ? '1' : '0.35')
      const dir = curDir.get(id)
      ;(e.headOut.firstElementChild as SVGElement).setAttribute('opacity', dir === 'out' ? '1' : '0')
      ;(e.headIn.firstElementChild as SVGElement).setAttribute('opacity', dir === 'in' ? '1' : '0')
    }

    // 回路箭头
    for (const l of this.loops) {
      const seen = l.event < at
      const isCur = l.event === at - 1
      l.path.setAttribute('opacity', seen ? (isCur ? '1' : '0.35') : '0')
      l.path.style.strokeWidth = isCur ? '6' : '3'
    }

    // 信息包：停在当前事件各流向的终点；多余的包叠在第一个的位置并隐藏
    const flows = cur ? eventFlows(cur) : []
    const ends = flows.map((f) => this.flowEnd(f.to, f.from))
    const fallback = ends[0] ?? { x: this.pos.get(LEAD_ID)!.cx, y: CY }
    this.packets.forEach((pk, i) => {
      const p = ends[i] ?? fallback
      pk.style.transform = `translate(${p.x}px,${p.y}px)`
      pk.setAttribute('opacity', i < ends.length ? '1' : '0')
    })
  }

  destroy() {
    this.svg.remove()
  }
}

export interface AgentSlideOpts {
  name: string
  trace: AgentTrace
  /** 右下角小注，如“示意会话” */
  note?: string
  notes?: string
  /** 把相邻事件合并成一步：每组是事件下标列表，如 [[2, 3]]；其余事件各占一步 */
  group?: number[][]
}

export function agentSlide(o: AgentSlideOpts): SlideDef {
  const spans = stepsFromGroups(o.trace.events.length, o.group)
  const steps: ChartStep<AgentFlowState>[] = spans.map((sp) => ({
    caption: o.trace.events
      .slice(sp.from, sp.to + 1)
      .map((e) => describeEvent(e, o.trace))
      .join('，'),
    state: { at: sp.to + 1 },
  }))
  return chartSlide<AgentFlowState>({
    name: o.name,
    notes: o.notes,
    note: o.note,
    initial: { at: 0 },
    steps,
    create: (host, ctx) => new AgentFlow(host, o.trace, ctx),
  })
}
