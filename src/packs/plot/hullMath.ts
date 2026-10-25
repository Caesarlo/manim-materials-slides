// 凸包图的纯逻辑（无 DOM，可单测）：二元体系 A–B 的形成能凸包。
//   x = B 的摩尔分数（0..1），e = 形成能 eV/atom。元素端点 (0,0)、(1,0) 的形成能按定义为 0。
//   lowerHull(points)        → 下凸包的顶点（x 递增）
//   hullEnergyAt(hull, x)    → 凸包线上 x 处的能量（线性插值）
//   energyAboveHull(points)  → 每个点到凸包的竖直距离 Ehull ≥ 0（稳定点为 0）
export interface HullPoint {
  /** B 的摩尔分数 0..1 */
  x: number
  /** 形成能 eV/atom */
  e: number
  label?: string
}

/** 数值容差：|Ehull| 小于它就视为“在凸包上” */
export const HULL_EPS = 1e-9

/** 若数据里没有 x=0 / x=1 处的点，就补上元素端点 (0,0)、(1,0)（不修改入参，端点排在前面） */
export function withEndpoints<T extends HullPoint>(points: readonly T[]): (T | HullPoint)[] {
  const out: (T | HullPoint)[] = []
  if (!points.some((p) => Math.abs(p.x) < HULL_EPS)) out.push({ x: 0, e: 0 })
  if (!points.some((p) => Math.abs(p.x - 1) < HULL_EPS)) out.push({ x: 1, e: 0 })
  return [...out, ...points]
}

const cross = (o: HullPoint, a: HullPoint, b: HullPoint) => (a.x - o.x) * (b.e - o.e) - (a.e - o.e) * (b.x - o.x)

/**
 * 下凸包（Andrew monotone chain 的下半部分），按 x 递增返回。
 * - x 相同的点只保留 e 最小的那个。
 * - **共线点丢弃**：只返回真正的拐点（严格凸的顶点）；共线点其实仍在凸包线上，
 *   它们的 Ehull 由 energyAboveHull 算出来就是 0，不受影响。
 * 不自动补端点——想要端点请先 withEndpoints。
 */
export function lowerHull<T extends HullPoint>(points: readonly T[]): T[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.e - b.e)
  const uniq: T[] = []
  for (const p of sorted) if (!uniq.length || uniq[uniq.length - 1].x !== p.x) uniq.push(p) // 同 x 已按 e 升序，取第一个
  const h: T[] = []
  for (const p of uniq) {
    while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop() // <= 0：右转或共线都弹出
    h.push(p)
  }
  return h
}

/** 在凸包折线上线性插值；x 超出范围时取端点值（夹紧）；空凸包返回 0 */
export function hullEnergyAt(hull: readonly HullPoint[], x: number): number {
  if (!hull.length) return 0
  if (x <= hull[0].x) return hull[0].e
  const last = hull[hull.length - 1]
  if (x >= last.x) return last.e
  for (let i = 1; i < hull.length; i++) {
    const a = hull[i - 1], b = hull[i]
    if (x <= b.x) return a.e + ((x - a.x) / (b.x - a.x)) * (b.e - a.e)
  }
  return last.e
}

/** 每个点相对凸包的能量 e − E_hull(x)，保证 ≥ 0；|值| < 1e-9 的记为 0（在凸包上）。凸包由 points 自己算出（不自动补端点）。 */
export function energyAboveHull(points: readonly HullPoint[]): number[] {
  const hull = lowerHull(points)
  return points.map((p) => {
    const d = p.e - hullEnergyAt(hull, p.x)
    return Math.abs(d) < HULL_EPS ? 0 : Math.max(0, d)
  })
}
