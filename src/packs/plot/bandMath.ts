// 能带图的纯逻辑（无 DOM，可单测）：带隙分析、高斯展宽态密度、能带配色。
import { palette } from '@/runtime/palette'

export interface BandData {
  /** 高对称点：label 支持 $…$，k 为沿路径的累计坐标（0..1） */
  kpath: { label: string; k: number }[]
  /** 所有 k 点坐标（递增，与 kpath 同一坐标系） */
  k: number[]
  /** nBands × nK，单位 eV，相对费米能级（费米能级 = 0） */
  bands: number[][]
  dos?: { E: number[]; g: number[] }
}

export interface BandEdge { k: number; E: number; band: number; /** k 点下标 */ ik: number }

export interface GapInfo {
  metal: boolean
  vbm?: BandEdge
  cbm?: BandEdge
  gap?: number
  direct?: boolean
}

/**
 * 带隙分析：VBM = 所有 E ≤ 0 中的最大值，CBM = 所有 E > 0 中的最小值。
 * 只要有一条能带既有 ≤0 又有 >0 的点（穿过费米能级）就是金属，不给出带隙。
 * direct：VBM 与 CBM 的 k 下标相差不超过一个格点。
 */
export function findGap(bands: number[][], k: number[]): GapInfo {
  let vbm: BandEdge | undefined, cbm: BandEdge | undefined
  for (let b = 0; b < bands.length; b++) {
    let below = false, above = false
    for (let i = 0; i < bands[b].length; i++) {
      const E = bands[b][i]
      if (E <= 0) {
        below = true
        if (!vbm || E > vbm.E) vbm = { k: k[i], E, band: b, ik: i }
      } else {
        above = true
        if (!cbm || E < cbm.E) cbm = { k: k[i], E, band: b, ik: i }
      }
    }
    if (below && above) return { metal: true }
  }
  if (!vbm || !cbm) return { metal: false } // 只有价带或只有导带：无法定义带隙
  return { metal: false, vbm, cbm, gap: cbm.E - vbm.E, direct: Math.abs(vbm.ik - cbm.ik) <= 1 }
}

/**
 * 把所有能量用高斯展宽累加成态密度，对 k 点平均，使 ∫g dE = 能带总数（范围足够宽时）。
 * range 缺省为 [最低能量 − 4σ, 最高能量 + 4σ]。E 取各 bin 的中心。
 */
export function dosFromBands(bands: number[][], bins: number, sigma: number, range?: [number, number]): { E: number[]; g: number[] } {
  const all = bands.flat()
  const lo = range?.[0] ?? Math.min(...all) - 4 * sigma
  const hi = range?.[1] ?? Math.max(...all) + 4 * sigma
  const dE = (hi - lo) / bins
  const E = Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * dE)
  const g = new Array<number>(bins).fill(0)
  const norm = 1 / (sigma * Math.sqrt(2 * Math.PI))
  for (const band of bands) {
    const w = 1 / band.length
    for (const e of band) {
      // 只累加 ±5σ 内的 bin
      const i0 = Math.max(0, Math.floor((e - 5 * sigma - lo) / dE)), i1 = Math.min(bins - 1, Math.ceil((e + 5 * sigma - lo) / dE))
      for (let i = i0; i <= i1; i++) {
        const d = (E[i] - e) / sigma
        g[i] += w * norm * Math.exp(-0.5 * d * d)
      }
    }
  }
  return { E, g }
}

/** 全部 ≤0 → 价带（蓝）；全部 >0 → 导带（琥珀）；跨越 0 → 青绿 */
export function bandColor(band: number[]): string {
  if (band.every((e) => e <= 0)) return palette.accent
  if (band.every((e) => e > 0)) return palette.amber
  return palette.teal
}
