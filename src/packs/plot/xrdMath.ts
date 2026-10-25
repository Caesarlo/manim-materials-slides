// XRD 谱的纯逻辑（无 DOM，可单测）。
export interface XrdPeak { twoTheta: number; intensity: number; hkl?: string }
/** fwhm：展宽用半高全宽（°），缺省由图表给默认值 */
export interface XrdPattern { name: string; peaks: XrdPeak[]; fwhm?: number }

const FWHM_TO_SIGMA = 1 / (2 * Math.sqrt(2 * Math.LN2))

/** 等间隔网格 [min, min+step, …, ≤ max]（含端点，容忍浮点误差） */
export function makeGrid(min: number, max: number, step: number): number[] {
  if (!(step > 0) || !(max >= min)) throw new Error('makeGrid: 需要 step > 0 且 max ≥ min')
  const n = Math.floor((max - min) / step + 1e-9)
  return Array.from({ length: n + 1 }, (_, i) => min + i * step)
}

/**
 * 高斯展宽叠加：每个峰是一个高斯，σ = fwhm / (2√(2 ln 2))。
 * 面积约定：每个峰的面积 = intensity × 1（单位 °），即高斯归一化 1/(σ√(2π)) 乘以 intensity；
 * 因此同一 fwhm 下峰高 ∝ intensity，峰越宽越矮。显示时通常再用 normalize 缩放。
 */
export function broaden(peaks: XrdPeak[], fwhm: number, grid: number[]): number[] {
  const sigma = fwhm * FWHM_TO_SIGMA
  const norm = 1 / (sigma * Math.sqrt(2 * Math.PI))
  return grid.map((x) => {
    let s = 0
    for (const p of peaks) {
      const d = (x - p.twoTheta) / sigma
      s += p.intensity * norm * Math.exp(-0.5 * d * d)
    }
    return s
  })
}

/** 缩放使最大值 = max（全为 0 时原样返回） */
export function normalize(y: number[], max = 1): number[] {
  const m = Math.max(...y)
  return m > 0 ? y.map((v) => (v / m) * max) : y.slice()
}
