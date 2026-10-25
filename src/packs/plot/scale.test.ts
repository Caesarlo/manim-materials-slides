import { describe, expect, it } from 'vitest'
import { formatTick, linear, log, niceDomain, niceTicks } from './scale'

describe('niceTicks', () => {
  it('按 1/2/5 步长，端点落在范围内', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10])
    expect(niceTicks(300, 800, 5)).toEqual([300, 400, 500, 600, 700, 800])
    expect(niceTicks(0, 1.4, 7)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.4])
  })
  it('消除浮点误差（0.1+0.2 这类）', () => {
    for (const v of niceTicks(0, 1, 10)) expect(String(v).length).toBeLessThan(6)
  })
  it('退化区间只返回一个点', () => {
    expect(niceTicks(3, 3)).toEqual([3])
  })
})

describe('niceDomain', () => {
  it('向外扩到整刻度', () => {
    expect(niceDomain(0.13, 1.92, 5)).toEqual([0, 2])
  })
})

describe('linear', () => {
  const s = linear([300, 800], [0, 1400])
  it('正向与反向映射互逆', () => {
    expect(s(300)).toBe(0)
    expect(s(800)).toBe(1400)
    expect(s(550)).toBeCloseTo(700)
    expect(s.invert(s(437))).toBeCloseTo(437)
  })
  it('range 可反向（SVG 的 y 向下）', () => {
    const y = linear([0, 2], [600, 0])
    expect(y(0)).toBe(600)
    expect(y(2)).toBe(0)
  })
})

describe('log', () => {
  const s = log([1, 1000], [0, 300])
  it('每个数量级等距', () => {
    expect(s(10)).toBeCloseTo(100)
    expect(s(100)).toBeCloseTo(200)
    expect(s.invert(200)).toBeCloseTo(100)
  })
  it('刻度是 10 的整数幂', () => {
    expect(s.ticks()).toEqual([1, 10, 100, 1000])
  })
  it('非正数据域报错', () => {
    expect(() => log([0, 10], [0, 1])).toThrow()
  })
})

describe('formatTick', () => {
  it('整数不带小数，其余按步长', () => {
    expect(formatTick(400, 100)).toBe('400')
    expect(formatTick(0.5, 0.5)).toBe('0.5')
    expect(formatTick(0.25, 0.05)).toBe('0.25')
    expect(formatTick(0)).toBe('0')
  })
  it('极大极小用 ×10ⁿ', () => {
    expect(formatTick(1e6)).toBe('1×10⁶')
    expect(formatTick(1e-4)).toBe('1×10⁻⁴')
  })
})
