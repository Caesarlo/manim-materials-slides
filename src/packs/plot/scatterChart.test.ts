import { describe, expect, it } from 'vitest'
import { centroid, inRegion, pointsInRegion } from './scatterMath'

describe('centroid', () => {
  it('(0,0) (4,0) (2,6) → (2,2)', () => {
    expect(centroid([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 6 }])).toEqual({ x: 2, y: 2 })
  })
  it('单点就是它自己；空数组为 NaN', () => {
    expect(centroid([{ x: 3, y: -1 }])).toEqual({ x: 3, y: -1 })
    expect(centroid([]).x).toBeNaN()
  })
})

describe('inRegion', () => {
  const r = { x0: 1, x1: 3, y0: 10, y1: 20 }
  it('内部为真，外部为假', () => {
    expect(inRegion({ x: 2, y: 15 }, r)).toBe(true)
    expect(inRegion({ x: 0.9, y: 15 }, r)).toBe(false)
    expect(inRegion({ x: 2, y: 20.1 }, r)).toBe(false)
  })
  it('边界和角点包含在内', () => {
    expect(inRegion({ x: 1, y: 10 }, r)).toBe(true)
    expect(inRegion({ x: 3, y: 20 }, r)).toBe(true)
    expect(inRegion({ x: 3, y: 9.999 }, r)).toBe(false)
  })
  it('端点写反也能用', () => {
    expect(inRegion({ x: 2, y: 15 }, { x0: 3, x1: 1, y0: 20, y1: 10 })).toBe(true)
  })
})

describe('pointsInRegion', () => {
  it('返回区域内点的下标', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 1, y: 2 }]
    expect(pointsInRegion(pts, { x0: 1, x1: 2, y0: 1, y1: 2 })).toEqual([1, 2, 4])
    expect(pointsInRegion(pts, { x0: 5, x1: 6, y0: 5, y1: 6 })).toEqual([])
  })
})
