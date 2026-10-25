import { describe, expect, it } from 'vitest'
import { palette } from '@/runtime/palette'
import { fromColumnTable, peakLabelSide, peakOf, seriesOpacity, spreadLabels } from './lineChart'

const minGapOf = (a: number[]) => {
  const s = [...a].sort((p, q) => p - q)
  return Math.min(...s.slice(1).map((v, i) => v - s[i]))
}

describe('spreadLabels', () => {
  it('已满足间距与边界时原样不动', () => {
    expect(spreadLabels([100, 200, 300], 50, 0, 400)).toEqual([100, 200, 300])
  })
  it('两个重合的标签各让一半，质心不变', () => {
    const r = spreadLabels([200, 200], 40, 0, 400)
    expect(r[1] - r[0]).toBeCloseTo(40)
    expect((r[0] + r[1]) / 2).toBeCloseTo(200)
  })
  it('三个挤在一起：间距 ≥ minGap，中间那条不动', () => {
    const r = spreadLabels([200, 205, 210], 44, 0, 400)
    expect(minGapOf(r)).toBeGreaterThanOrEqual(44 - 1e-9)
    expect(r[1]).toBeCloseTo(205) // 均值 205，中间位置保持
    expect(r[0]).toBeCloseTo(161)
    expect(r[2]).toBeCloseTo(249)
  })
  it('保持输入顺序：不同序输入也按原下标返回', () => {
    const r = spreadLabels([300, 100, 105], 40, 0, 400)
    expect(r[1]).toBeLessThan(r[2])
    expect(r[2]).toBeLessThan(r[0])
    expect(r[2] - r[1]).toBeGreaterThanOrEqual(40 - 1e-9)
  })
  it('不越界：贴着下边界时整体上移', () => {
    const r = spreadLabels([395, 398, 400], 40, 20, 400)
    expect(r[2]).toBeCloseTo(400)
    expect(r[1]).toBeCloseTo(360)
    expect(r[0]).toBeCloseTo(320)
  })
  it('贴着上边界时整体下移；越界输入被夹回', () => {
    const r = spreadLabels([-10, 0, 5], 40, 20, 400)
    expect(r[0]).toBeCloseTo(20)
    expect(r[1]).toBeCloseTo(60)
    expect(r[2]).toBeCloseTo(100)
  })
  it('空间不够放时均分到 [min, max]', () => {
    const r = spreadLabels([10, 11, 12], 100, 0, 100)
    expect(r[0]).toBeCloseTo(0)
    expect(r[1]).toBeCloseTo(50)
    expect(r[2]).toBeCloseTo(100)
  })
  it('空数组与单个元素', () => {
    expect(spreadLabels([], 10, 0, 1)).toEqual([])
    expect(spreadLabels([5], 10, 0, 100)).toEqual([5])
    expect(spreadLabels([-5], 10, 0, 100)).toEqual([0])
  })
})

describe('peakOf', () => {
  it('取最大 y 的点', () => {
    expect(peakOf([[1, 1], [2, 5], [3, 2]])).toEqual([2, 5])
  })
  it('并列取最左（与顺序无关）', () => {
    expect(peakOf([[1, 1], [2, 5], [3, 5]])).toEqual([2, 5])
    expect(peakOf([[3, 5], [2, 5], [1, 1]])).toEqual([2, 5])
  })
  it('单点与空', () => {
    expect(peakOf([[7, -3]])).toEqual([7, -3])
    expect(peakOf([])).toBeUndefined()
  })
  it('全为负值也能取到最大者', () => {
    expect(peakOf([[0, -5], [1, -2], [2, -9]])).toEqual([1, -2])
  })
})

describe('fromColumnTable', () => {
  const t = {
    x: [300, 400, 500, 600],
    xName: 'T',
    series: [
      { name: 'A', y: [0.1, null, 0.3, 0.4] },
      { name: 'B', y: [null, null, 1, 2] },
    ],
  }
  it('跳过 null 点，保留 x 对应关系', () => {
    const r = fromColumnTable(t)
    expect(r[0].points).toEqual([[300, 0.1], [500, 0.3], [600, 0.4]])
    expect(r[1].points).toEqual([[500, 1], [600, 2]])
    expect(r.map((s) => s.name)).toEqual(['A', 'B'])
  })
  it('按 palette.series 依次配色并轮转', () => {
    const n = palette.series.length
    const many = { x: [1], xName: 'x', series: Array.from({ length: n + 2 }, (_, i) => ({ name: `s${i}`, y: [i] })) }
    const r = fromColumnTable(many)
    expect(r[0].color).toBe(palette.series[0])
    expect(r[n - 1].color).toBe(palette.series[n - 1])
    expect(r[n].color).toBe(palette.series[0])
    expect(r[n + 1].color).toBe(palette.series[1])
  })
  it('y 比 x 短、含 NaN 时不产生脏点', () => {
    const r = fromColumnTable({ x: [1, 2, 3], xName: 'x', series: [{ name: 'a', y: [1, NaN] }] })
    expect(r[0].points).toEqual([[1, 1]])
  })
})

describe('seriesOpacity / peakLabelSide', () => {
  it('未画出的线不透明度为 0', () => {
    expect(seriesOpacity(2, { shown: 2, focus: null })).toBe(0)
    expect(seriesOpacity(1, { shown: 2, focus: null })).toBe(1)
  })
  it('聚焦时其余压暗到 0.25，聚焦者保持 1', () => {
    expect(seriesOpacity(0, { shown: 3, focus: 1 })).toBe(0.25)
    expect(seriesOpacity(1, { shown: 3, focus: 1 })).toBe(1)
  })
  it('峰值文字：上方放得下放上方，否则放下方', () => {
    expect(peakLabelSide(200, 56)).toBe('above')
    expect(peakLabelSide(60, 56)).toBe('below')
    expect(peakLabelSide(76, 56)).toBe('above') // 76 − 20 − 56 = 0 刚好放得下
  })
})
