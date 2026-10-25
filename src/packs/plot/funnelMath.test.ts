import { describe, expect, it } from 'vitest'
import { formatCount, funnelWidths, passRates } from './funnelMath'

describe('funnelWidths', () => {
  it('与 log10 线性：10^5→maxW，10^2→minW，10^3.5 正好在中点', () => {
    const w = funnelWidths([1e5, 1e3 * Math.sqrt(10), 100], 200, 1400)
    expect(w[0]).toBeCloseTo(1400, 9)
    expect(w[2]).toBeCloseTo(200, 9)
    expect(w[1]).toBeCloseTo(800, 6) // log10 = 3.5，在 [2,5] 的中点
  })
  it('每降一个数量级宽度等量减少', () => {
    const w = funnelWidths([1e5, 1e4, 1e3, 1e2], 100, 1000)
    expect(w).toEqual([1000, 700, 400, 100].map((v) => expect.closeTo(v, 9)))
  })
  it('全部相等时取 maxW', () => {
    expect(funnelWidths([50, 50, 50], 100, 900)).toEqual([900, 900, 900])
  })
  it('count ≤ 0 抛错', () => {
    expect(() => funnelWidths([10, 0], 1, 2)).toThrow()
    expect(() => funnelWidths([10, -5], 1, 2)).toThrow()
  })
})

describe('passRates', () => {
  it('后/前的百分比，保留 1 位小数', () => {
    expect(passRates([1000, 125, 50])).toEqual([12.5, 40])
    expect(passRates([3, 1])).toEqual([33.3])
  })
  it('单级无通过率', () => {
    expect(passRates([10])).toEqual([])
  })
})

describe('formatCount', () => {
  it('千分位', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(12)).toBe('12')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(100000)).toBe('100,000')
    expect(formatCount(1.2e6)).toBe('1,200,000')
  })
})
