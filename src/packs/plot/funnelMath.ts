// 筛选漏斗的纯逻辑（无 DOM，可单测）。

/** 条宽与 log10(count) 线性：最大 count → maxW，最小 → minW；全部相等时都取 maxW；count ≤ 0 抛错 */
export function funnelWidths(counts: number[], minW: number, maxW: number): number[] {
  if (counts.some((c) => !(c > 0))) throw new Error('漏斗各级数量必须为正')
  const logs = counts.map((c) => Math.log10(c))
  const lo = Math.min(...logs), hi = Math.max(...logs)
  if (hi - lo < 1e-12) return counts.map(() => maxW)
  return logs.map((l) => minW + ((l - lo) / (hi - lo)) * (maxW - minW))
}

/** 相邻阶段通过率（后 / 前，百分比，保留 1 位小数的数值）；长度 = counts.length - 1 */
export function passRates(counts: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < counts.length; i++) out.push(Math.round((counts[i] / counts[i - 1]) * 1000) / 10)
  return out
}

/** 整数千分位：1234 → '1,234'，1.2e6 → '1,200,000' */
export function formatCount(n: number): string {
  const s = String(Math.round(n))
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
