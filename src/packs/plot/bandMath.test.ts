import { describe, expect, it } from 'vitest'
import { palette } from '@/runtime/palette'
import { bandColor, dosFromBands, findGap } from './bandMath'

const k = [0, 0.25, 0.5, 0.75, 1]

describe('findGap', () => {
  it('直接带隙：VBM 与 CBM 在同一 k 点，带隙值精确', () => {
    const g = findGap([[-1.5, -1, -0.2, -1, -1.5], [1.2, 0.9, 0.6, 0.9, 1.2]], k)
    expect(g.metal).toBe(false)
    expect(g.direct).toBe(true)
    expect(g.vbm).toMatchObject({ k: 0.5, E: -0.2, band: 0 })
    expect(g.cbm).toMatchObject({ k: 0.5, E: 0.6, band: 1 })
    expect(g.gap).toBeCloseTo(0.8, 12)
  })
  it('间接带隙：VBM 在 k=0，CBM 在 k=1', () => {
    const g = findGap([[-0.3, -1, -1.4, -1, -0.9], [1.4, 1.1, 0.9, 0.7, 0.5]], k)
    expect(g.direct).toBe(false)
    expect(g.vbm?.k).toBe(0)
    expect(g.cbm?.k).toBe(1)
    expect(g.gap).toBeCloseTo(0.8, 12)
  })
  it('相差一个格点仍算直接', () => {
    const g = findGap([[-0.5, -0.1, -0.5, -0.5, -0.5], [0.4, 0.5, 0.5, 0.5, 0.5]], k)
    expect(g.vbm?.ik).toBe(1)
    expect(g.cbm?.ik).toBe(0)
    expect(g.direct).toBe(true)
  })
  it('E = 0 的点算价带（≤0），E > 0 才是导带', () => {
    const g = findGap([[-1, 0, -1, -1, -1], [0.5, 0.5, 0.25, 0.5, 0.5]], k)
    expect(g.vbm?.E).toBe(0)
    expect(g.cbm?.E).toBe(0.25)
    expect(g.gap).toBe(0.25)
  })
  it('金属：有能带穿过费米能级，不给带隙', () => {
    const g = findGap([[-2, -1.5, -1, -1.5, -2], [-0.5, 0.2, 0.7, 0.2, -0.5]], k)
    expect(g).toEqual({ metal: true })
  })
})

describe('dosFromBands', () => {
  const bands = [[-1, -0.8, -0.9, -1.1], [0.6, 0.9, 1.2, 1.0], [2, 2.1, 1.9, 2.2]]
  it('积分 = 能带总数（k 点平均）', () => {
    const { E, g } = dosFromBands(bands, 600, 0.05)
    const dE = E[1] - E[0]
    const area = g.reduce((s, v) => s + v * dE, 0)
    expect(area).toBeCloseTo(3, 3)
  })
  it('单条平带 → 峰值在该能量，峰高 = 1/(σ√2π)', () => {
    const { E, g } = dosFromBands([[0.5, 0.5, 0.5]], 400, 0.1, [-1, 2])
    const i = g.indexOf(Math.max(...g))
    expect(Math.abs(E[i] - 0.5)).toBeLessThan(0.01)
    expect(g[i]).toBeCloseTo(1 / (0.1 * Math.sqrt(2 * Math.PI)), 2)
  })
  it('带隙内态密度近似为 0', () => {
    const { E, g } = dosFromBands([[-1, -0.9], [1, 1.1]], 400, 0.04, [-2, 2])
    const mid = E.findIndex((e) => e > 0)
    expect(g[mid]).toBeLessThan(1e-6)
  })
  it('指定 range 时 E 覆盖该范围', () => {
    const { E } = dosFromBands(bands, 100, 0.05, [-3, 3])
    expect(E).toHaveLength(100)
    expect(E[0]).toBeCloseTo(-3 + 0.03, 10)
    expect(E[99]).toBeCloseTo(3 - 0.03, 10)
  })
})

describe('bandColor', () => {
  it('价带蓝、导带琥珀、跨越 0 青绿', () => {
    expect(bandColor([-1, -0.2, 0])).toBe(palette.accent)
    expect(bandColor([0.1, 1])).toBe(palette.amber)
    expect(bandColor([-0.3, 0.4])).toBe(palette.teal)
  })
})
