// 模型架构块图的纯逻辑：块的位置、相邻箭头、残差弧线、×N 括号的包围框。
// 不 import 任何 DOM / CSS，方便 vitest 在 node 环境里测试。
//
//   const rects = layoutBlocks(blocks, { direction: 'row', width: 1600, height: 780, gap: 74, margin: 50 })
//   arrowPath(rects[0], rects[1], 'row')                   // 相邻块之间箭头的起止点
//   residualPath(rects[2], rects[3], 'row', 74, 'start')   // 从 rects[2] 之前分出，绕过去，在 rects[3] 之后汇合
//   groupBounds(blocks, rects, 'layer', 24)                // ×N 括号的包围框

export type Direction = 'row' | 'column'
/** 残差弧线绕哪一侧：start = 上方（row）/ 左侧（column）；end = 下方 / 右侧 */
export type Side = 'start' | 'end'

export interface Rect { x: number; y: number; w: number; h: number }
export interface Pt { x: number; y: number }

export interface LayoutOpts {
  direction: Direction
  width: number
  height: number
  /** 相邻两块之间的间距（留给箭头） */
  gap: number
  /** 画布四周留白，默认 0 */
  margin?: number
  /** 块在交叉方向（row 时是高，column 时是宽）的尺寸，默认占满可用空间 */
  cross?: number
  /** 块在主方向（row 时是宽，column 时是高）的最大尺寸 */
  maxMain?: number
}

/** 等间距居中排布。返回的顺序与 blocks 一致。 */
export function layoutBlocks(blocks: ReadonlyArray<{ id: string }>, o: LayoutOpts): Rect[] {
  const n = blocks.length
  if (n === 0) return []
  const m = o.margin ?? 0
  const row = o.direction === 'row'
  const availMain = (row ? o.width : o.height) - 2 * m
  const availCross = (row ? o.height : o.width) - 2 * m
  const fit = (availMain - (n - 1) * o.gap) / n
  const main = Math.max(1, Math.min(o.maxMain ?? Infinity, fit))
  const cross = Math.max(1, Math.min(o.cross ?? availCross, availCross))
  const total = n * main + (n - 1) * o.gap
  const start = m + (availMain - total) / 2
  const crossStart = m + (availCross - cross) / 2
  return blocks.map((_, i) => {
    const p = start + i * (main + o.gap)
    return row ? { x: p, y: crossStart, w: main, h: cross } : { x: crossStart, y: p, w: cross, h: main }
  })
}

export const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** 相邻块 a → b 之间箭头的起止点：a 的出口中点 → b 的入口中点 */
export function arrowPath(a: Rect, b: Rect, direction: Direction): { from: Pt; to: Pt } {
  if (direction === 'row') return { from: { x: a.x + a.w, y: a.y + a.h / 2 }, to: { x: b.x, y: b.y + b.h / 2 } }
  return { from: { x: a.x + a.w / 2, y: a.y + a.h }, to: { x: b.x + b.w / 2, y: b.y } }
}

type Pad = number | Partial<{ l: number; r: number; t: number; b: number }>
const padOf = (p: Pad) => (typeof p === 'number' ? { l: p, r: p, t: p, b: p } : { l: 0, r: 0, t: 0, b: 0, ...p })

/** 同组的块的包围框（四周留 pad，可分边给）。组里没有块时返回 null。 */
export function groupBounds(
  blocks: ReadonlyArray<{ group?: string }>, rects: ReadonlyArray<Rect>, group: string, pad: Pad = 0,
): Rect | null {
  const idx = blocks.map((b, i) => (b.group === group ? i : -1)).filter((i) => i >= 0)
  if (idx.length === 0) return null
  const p = padOf(pad)
  const x0 = Math.min(...idx.map((i) => rects[i].x)), x1 = Math.max(...idx.map((i) => rects[i].x + rects[i].w))
  const y0 = Math.min(...idx.map((i) => rects[i].y)), y1 = Math.max(...idx.map((i) => rects[i].y + rects[i].h))
  return { x: x0 - p.l, y: y0 - p.t, w: x1 - x0 + p.l + p.r, h: y1 - y0 + p.t + p.b }
}

/**
 * 残差弧线的折线顶点（4 个点）：
 * 起点在 from 块**之前**的主干上（from 前面间隙的中点）→ 垂直于主干拐到旁边 → 沿主干方向平行走到 to 块**之后** → 拐回主干（to 后面间隙的中点）。
 */
export function residualPoints(from: Rect, to: Rect, direction: Direction, gap: number, side: Side, clearance = 70): Pt[] {
  if (direction === 'row') {
    const trunk = from.y + from.h / 2
    const out = side === 'start' ? Math.min(from.y, to.y) - clearance : Math.max(from.y + from.h, to.y + to.h) + clearance
    const a = from.x - gap / 2, b = to.x + to.w + gap / 2
    return [{ x: a, y: trunk }, { x: a, y: out }, { x: b, y: out }, { x: b, y: trunk }]
  }
  const trunk = from.x + from.w / 2
  const out = side === 'start' ? Math.min(from.x, to.x) - clearance : Math.max(from.x + from.w, to.x + to.w) + clearance
  const a = from.y - gap / 2, b = to.y + to.h + gap / 2
  return [{ x: trunk, y: a }, { x: out, y: a }, { x: out, y: b }, { x: trunk, y: b }]
}

/** 圆角折线的 SVG path：每个内部拐角用二次曲线切掉半径 r */
export function roundedPolyline(pts: ReadonlyArray<Pt>, r: number): string {
  const f = (v: number) => v.toFixed(2)
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1]
    const la = Math.hypot(p.x - a.x, p.y - a.y), lb = Math.hypot(b.x - p.x, b.y - p.y)
    const ra = Math.min(r, la / 2), rb = Math.min(r, lb / 2)
    const p1 = { x: p.x + ((a.x - p.x) / la) * ra, y: p.y + ((a.y - p.y) / la) * ra }
    const p2 = { x: p.x + ((b.x - p.x) / lb) * rb, y: p.y + ((b.y - p.y) / lb) * rb }
    d += `L${f(p1.x)},${f(p1.y)}Q${f(p.x)},${f(p.y)} ${f(p2.x)},${f(p2.y)}`
  }
  const last = pts[pts.length - 1]
  return d + `L${f(last.x)},${f(last.y)}`
}

/** 残差弧线的 SVG path（圆角折线，终点在主干上；箭头另画） */
export function residualPath(from: Rect, to: Rect, direction: Direction, gap: number, side: Side, clearance = 70, radius = 28): string {
  return roundedPolyline(residualPoints(from, to, direction, gap, side, clearance), radius)
}
