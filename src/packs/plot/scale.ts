// 比例尺与刻度（纯函数，无 DOM，可单测）。
//   const x = linear([0, 600], [0, 1400])      // 数据域 → 像素范围
//   x(300) === 700;  x.invert(700) === 300;  x.ticks(6) → 漂亮的刻度值
//   const y = log([1, 1000], [700, 0])         // 对数轴；range 可以反向（SVG 的 y 向下）
export interface Scale {
  (v: number): number
  readonly type: 'linear' | 'log'
  readonly domain: [number, number]
  readonly range: [number, number]
  invert(px: number): number
  /** 约 count 个“好看”的刻度值（线性：1/2/5×10ⁿ 步长；对数：10 的整数幂） */
  ticks(count?: number): number[]
}

/** 1、2、5×10ⁿ 步长的刻度，落在 [min, max] 内（含端点附近的整刻度） */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min]
  const raw = (max - min) / Math.max(1, count)
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow
  // 用整数下标生成（v = i × step）：不累加浮点误差，0 刻度恰为 0（不会出现 -6e-17）
  const out: number[] = []
  const i0 = Math.ceil(min / step - 1e-9), i1 = Math.floor(max / step + 1e-9)
  for (let i = i0; i <= i1; i++) out.push(Number((i * step).toPrecision(12)) + 0)
  return out
}

/** 把 [min, max] 向外扩到整刻度，用于让坐标轴端点落在刻度上 */
export function niceDomain(min: number, max: number, count = 5): [number, number] {
  if (!(max > min)) return [min, min + 1]
  const t = niceTicks(min, max, count)
  const step = t.length > 1 ? t[1] - t[0] : 1
  return [Math.floor(min / step + 1e-9) * step, Math.ceil(max / step - 1e-9) * step]
}

export function linear(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain, [r0, r1] = range
  const f = ((v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)) as Scale & { -readonly [K in keyof Scale]: Scale[K] }
  Object.assign(f, {
    type: 'linear' as const, domain, range,
    invert: (px: number) => d0 + ((px - r0) / (r1 - r0)) * (d1 - d0),
    ticks: (count = 5) => niceTicks(Math.min(d0, d1), Math.max(d0, d1), count),
  })
  return f
}

export function log(domain: [number, number], range: [number, number]): Scale {
  if (!(domain[0] > 0 && domain[1] > 0)) throw new Error('对数轴的数据域必须为正')
  const [l0, l1] = [Math.log10(domain[0]), Math.log10(domain[1])], [r0, r1] = range
  const f = ((v: number) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0)) as Scale & { -readonly [K in keyof Scale]: Scale[K] }
  Object.assign(f, {
    type: 'log' as const, domain, range,
    invert: (px: number) => Math.pow(10, l0 + ((px - r0) / (r1 - r0)) * (l1 - l0)),
    ticks: () => {
      const lo = Math.ceil(Math.min(l0, l1) - 1e-9), hi = Math.floor(Math.max(l0, l1) + 1e-9)
      return Array.from({ length: hi - lo + 1 }, (_, i) => Math.pow(10, lo + i))
    },
  })
  return f
}

/** 刻度文字：整数不带小数点，其余按步长决定小数位；极大/极小用科学计数 */
export function formatTick(v: number, step?: number): string {
  if (v === 0) return '0'
  const a = Math.abs(v)
  if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace('e+', '×10^').replace('e-', '×10^-').replace(/\^(-?\d+)/, (_, n) => sup(n))
  // 小数位数 = 步长本身需要的位数（0.25 → 2，0.5 → 1，100 → 0），这样 0.25、0.5、0.75 不会被四舍五入成 0.3、0.5、0.8
  let dec = Number.isInteger(v) ? 0 : 2
  if (step) {
    dec = 0
    while (dec < 6 && Math.abs(step * 10 ** dec - Math.round(step * 10 ** dec)) > 1e-9) dec++
  }
  return v.toFixed(dec)
}

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }
const sup = (n: string) => [...n].map((c) => SUP[c] ?? c).join('')
