// 散点图的纯逻辑（无 DOM，可单测）。由 scatterChart.ts 重新导出。
export interface Pt { x: number; y: number }
export interface Region { x0: number; x1: number; y0: number; y1: number }

/** 质心（算术平均）。空数组返回 NaN 坐标 */
export function centroid(points: readonly Pt[]): Pt {
  const n = points.length
  if (!n) return { x: NaN, y: NaN }
  let sx = 0, sy = 0
  for (const p of points) { sx += p.x; sy += p.y }
  return { x: sx / n, y: sy / n }
}

/** 点是否在矩形区域内（含边界；x0>x1 或 y0>y1 时按区间端点排序处理） */
export function inRegion(p: Pt, r: Region): boolean {
  const [xa, xb] = r.x0 <= r.x1 ? [r.x0, r.x1] : [r.x1, r.x0]
  const [ya, yb] = r.y0 <= r.y1 ? [r.y0, r.y1] : [r.y1, r.y0]
  return p.x >= xa && p.x <= xb && p.y >= ya && p.y <= yb
}

/** 落在区域内的点的下标（升序） */
export function pointsInRegion(points: readonly Pt[], r: Region): number[] {
  const out: number[] = []
  points.forEach((p, i) => { if (inRegion(p, r)) out.push(i) })
  return out
}
