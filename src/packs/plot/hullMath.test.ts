import { describe, expect, it } from 'vitest'
import { energyAboveHull, HULL_EPS, hullEnergyAt, lowerHull, withEndpoints } from './hullMath'

// 手算例子：A–B 体系，端点 (0,0)、(1,0)
//   深的 (0.5,-0.4)；(0.75,-0.3) 在 (0.5,-0.4)–(1,0) 连线(0.75 处为 -0.2)之下 → 在凸包上；
//   浅的 (0.25,-0.1) 在 (0,0)–(0.5,-0.4) 连线(0.25 处为 -0.2)之上 → Ehull = 0.1
const P = [
  { x: 0, e: 0 }, { x: 1, e: 0 },
  { x: 0.25, e: -0.1 }, { x: 0.5, e: -0.4 }, { x: 0.75, e: -0.3 },
]

describe('lowerHull', () => {
  it('例子：凸包顶点为 (0,0) (0.5,-0.4) (0.75,-0.3) (1,0)，x 递增', () => {
    expect(lowerHull(P).map((p) => [p.x, p.e])).toEqual([[0, 0], [0.5, -0.4], [0.75, -0.3], [1, 0]])
  })
  it('共线点被丢弃（只留拐点）', () => {
    const h = lowerHull([{ x: 0, e: 0 }, { x: 0.25, e: -0.1 }, { x: 0.5, e: -0.2 }, { x: 1, e: 0 }])
    expect(h.map((p) => p.x)).toEqual([0, 0.5, 1])
  })
  it('x 相同取 e 最小', () => {
    const h = lowerHull([{ x: 0, e: 0 }, { x: 0.5, e: -0.1 }, { x: 0.5, e: -0.3 }, { x: 1, e: 0 }])
    expect(h.map((p) => [p.x, p.e])).toEqual([[0, 0], [0.5, -0.3], [1, 0]])
  })
  it('乱序输入也按 x 递增；上方的点不进凸包', () => {
    const h = lowerHull([{ x: 1, e: 0 }, { x: 0.5, e: 0.2 }, { x: 0, e: 0 }, { x: 0.3, e: -0.1 }])
    expect(h.map((p) => p.x)).toEqual([0, 0.3, 1])
  })
  it('不修改入参', () => {
    const a = [{ x: 1, e: 0 }, { x: 0, e: 0 }]
    lowerHull(a)
    expect(a[0].x).toBe(1)
  })
})

describe('withEndpoints', () => {
  it('缺端点时补 (0,0)、(1,0)；有了就不补', () => {
    expect(withEndpoints([{ x: 0.5, e: -0.4 }]).map((p) => [p.x, p.e])).toEqual([[0, 0], [1, 0], [0.5, -0.4]])
    expect(withEndpoints(P)).toHaveLength(P.length)
    expect(withEndpoints([{ x: 0, e: 0 }, { x: 0.5, e: -0.1 }]).map((p) => p.x)).toEqual([1, 0, 0.5])
  })
})

describe('hullEnergyAt', () => {
  const hull = lowerHull(P)
  it('顶点处等于顶点能量', () => {
    expect(hullEnergyAt(hull, 0.5)).toBeCloseTo(-0.4, 12)
    expect(hullEnergyAt(hull, 0.75)).toBeCloseTo(-0.3, 12)
  })
  it('线性插值：0.25 → -0.2；0.625 → -0.35；0.9 → -0.12', () => {
    expect(hullEnergyAt(hull, 0.25)).toBeCloseTo(-0.2, 12)
    expect(hullEnergyAt(hull, 0.625)).toBeCloseTo(-0.35, 12)
    expect(hullEnergyAt(hull, 0.9)).toBeCloseTo(-0.12, 12)
  })
  it('范围外夹紧，空凸包为 0', () => {
    expect(hullEnergyAt(hull, -1)).toBe(0)
    expect(hullEnergyAt(hull, 2)).toBe(0)
    expect(hullEnergyAt([], 0.3)).toBe(0)
  })
})

describe('energyAboveHull', () => {
  it('例子：凸包上的点为 0，浅的 (0.25,-0.1) 为 0.1', () => {
    const d = energyAboveHull(P)
    expect(d[0]).toBe(0); expect(d[1]).toBe(0); expect(d[3]).toBe(0); expect(d[4]).toBe(0)
    expect(d[2]).toBeCloseTo(0.1, 12)
  })
  it('再加 (0.6,-0.2)：凸包在 0.6 处为 -0.36 → Ehull = 0.16；(0.9, 0.05) 在 -0.12 之上 → 0.17', () => {
    const d = energyAboveHull([...P, { x: 0.6, e: -0.2 }, { x: 0.9, e: 0.05 }])
    expect(d[5]).toBeCloseTo(0.16, 12)
    expect(d[6]).toBeCloseTo(0.17, 12)
  })
  it('共线点的 Ehull 为 0，且全部 ≥ 0', () => {
    const pts = [{ x: 0, e: 0 }, { x: 0.25, e: -0.1 }, { x: 0.5, e: -0.2 }, { x: 1, e: 0 }, { x: 0.8, e: 0.3 }]
    const d = energyAboveHull(pts)
    expect(d[1]).toBe(0)
    expect(d.every((v) => v >= 0)).toBe(true)
    expect(d[4]).toBeCloseTo(0.3 + 0.08, 12) // 0.8 处凸包 = -0.2*(0.2/0.5) = -0.08
  })
  it('容差：低于 1e-9 的残差记 0', () => {
    expect(energyAboveHull([{ x: 0, e: 0 }, { x: 0.5, e: -0.2 }, { x: 1, e: 0 }, { x: 0.25, e: -0.1 + HULL_EPS / 10 }])[3]).toBe(0)
  })
})
