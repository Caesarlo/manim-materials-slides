import { describe, expect, it } from 'vitest'
import { broaden, makeGrid, normalize } from './xrdMath'

describe('makeGrid', () => {
  it('含端点、等间隔', () => {
    expect(makeGrid(10, 11, 0.25)).toEqual([10, 10.25, 10.5, 10.75, 11])
    expect(makeGrid(0, 1, 0.1)).toHaveLength(11)
  })
  it('非法参数抛错', () => {
    expect(() => makeGrid(0, 1, 0)).toThrow()
    expect(() => makeGrid(2, 1, 0.1)).toThrow()
  })
})

describe('broaden', () => {
  const grid = makeGrid(0, 100, 0.01)
  it('单峰最大值在峰位', () => {
    const y = broaden([{ twoTheta: 40, intensity: 1 }], 0.5, grid)
    expect(grid[y.indexOf(Math.max(...y))]).toBeCloseTo(40, 6)
  })
  it('半高全宽≈fwhm（容差为两端各一个网格步长）', () => {
    const fwhm = 1.2
    const y = broaden([{ twoTheta: 40, intensity: 3 }], fwhm, grid)
    const half = Math.max(...y) / 2
    const above = grid.filter((_, i) => y[i] >= half)
    expect(above[above.length - 1] - above[0]).toBeCloseTo(fwhm, 1)
    expect(Math.abs(above[above.length - 1] - above[0] - fwhm)).toBeLessThanOrEqual(0.02 + 1e-9)
  })
  it('面积 = intensity（数值积分）', () => {
    const y = broaden([{ twoTheta: 50, intensity: 7 }], 0.8, grid)
    const area = y.reduce((s, v) => s + v * 0.01, 0)
    expect(area).toBeCloseTo(7, 3)
  })
  it('两个远离的峰可叠加，互不影响', () => {
    const a = { twoTheta: 20, intensity: 1 }, b = { twoTheta: 80, intensity: 2 }
    const both = broaden([a, b], 0.5, grid)
    const ya = broaden([a], 0.5, grid), yb = broaden([b], 0.5, grid)
    both.forEach((v, i) => expect(v).toBeCloseTo(ya[i] + yb[i], 12))
    const iA = grid.findIndex((x) => Math.abs(x - 20) < 1e-6), iB = grid.findIndex((x) => Math.abs(x - 80) < 1e-6)
    expect(both[iB] / both[iA]).toBeCloseTo(2, 6)
  })
  it('无峰时全 0', () => {
    expect(broaden([], 1, [1, 2, 3])).toEqual([0, 0, 0])
  })
})

describe('normalize', () => {
  it('最大值缩放到 1（默认）或指定值', () => {
    expect(normalize([1, 2, 4])).toEqual([0.25, 0.5, 1])
    expect(normalize([1, 2, 4], 100)).toEqual([25, 50, 100])
  })
  it('全 0 不产生 NaN', () => {
    expect(normalize([0, 0])).toEqual([0, 0])
  })
})
