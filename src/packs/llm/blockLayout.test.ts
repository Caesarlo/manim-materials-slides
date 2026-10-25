import { describe, expect, it } from 'vitest'
import { arrowPath, groupBounds, layoutBlocks, residualPath, residualPoints, roundedPolyline } from './blockLayout'

const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `b${i}` }))

describe('layoutBlocks', () => {
  it('row：宽度均分，间距相等，垂直居中（手算）', () => {
    // (1000 - 3*50)/4 = 212.5；高 200 居中 → y = 100
    const r = layoutBlocks(mk(4), { direction: 'row', width: 1000, height: 400, gap: 50, cross: 200 })
    expect(r.map((b) => b.x)).toEqual([0, 262.5, 525, 787.5])
    r.forEach((b) => { expect(b.w).toBe(212.5); expect(b.y).toBe(100); expect(b.h).toBe(200) })
  })
  it('maxMain 限制块大小后整体居中', () => {
    // 总长 4*100+3*50 = 550，起点 (1000-550)/2 = 225
    const r = layoutBlocks(mk(4), { direction: 'row', width: 1000, height: 400, gap: 50, maxMain: 100 })
    expect(r.map((b) => b.x)).toEqual([225, 375, 525, 675])
    expect(r[0].h).toBe(400)
  })
  it('column：沿高度排布，水平居中', () => {
    const r = layoutBlocks(mk(3), { direction: 'column', width: 800, height: 700, gap: 50, margin: 50, cross: 400, maxMain: 100 })
    // 可用 600，总长 3*100+2*50=400，起点 50+100=150
    expect(r.map((b) => b.y)).toEqual([150, 300, 450])
    r.forEach((b) => { expect(b.x).toBe(200); expect(b.w).toBe(400); expect(b.h).toBe(100) })
  })
  it('所有块在留白后的画布内，顺序单调，间距相等', () => {
    for (const direction of ['row', 'column'] as const) {
      const W = 1600, H = 780, m = 40, gap = 60
      const r = layoutBlocks(mk(7), { direction, width: W, height: H, gap, margin: m, cross: 150 })
      for (const b of r) {
        expect(b.x).toBeGreaterThanOrEqual(m - 1e-9); expect(b.y).toBeGreaterThanOrEqual(m - 1e-9)
        expect(b.x + b.w).toBeLessThanOrEqual(W - m + 1e-9); expect(b.y + b.h).toBeLessThanOrEqual(H - m + 1e-9)
      }
      const pos = r.map((b) => (direction === 'row' ? b.x : b.y))
      const end = r.map((b) => (direction === 'row' ? b.x + b.w : b.y + b.h))
      for (let i = 1; i < r.length; i++) {
        expect(pos[i]).toBeGreaterThan(pos[i - 1])
        expect(pos[i] - end[i - 1]).toBeCloseTo(gap, 9)
      }
    }
  })
  it('单块居中；空数组返回空', () => {
    const r = layoutBlocks(mk(1), { direction: 'row', width: 1000, height: 400, gap: 50, maxMain: 200, cross: 100 })
    expect(r[0]).toEqual({ x: 400, y: 150, w: 200, h: 100 })
    expect(layoutBlocks([], { direction: 'row', width: 1, height: 1, gap: 1 })).toEqual([])
  })
})

describe('arrowPath', () => {
  it('row：a 右边中点 → b 左边中点，长度恰为间距', () => {
    const r = layoutBlocks(mk(2), { direction: 'row', width: 1000, height: 400, gap: 100, cross: 200, maxMain: 300 })
    const a = arrowPath(r[0], r[1], 'row')
    expect(a.from).toEqual({ x: r[0].x + 300, y: 200 })
    expect(a.to).toEqual({ x: r[1].x, y: 200 })
    expect(a.to.x - a.from.x).toBe(100)
  })
  it('column：a 下边中点 → b 上边中点', () => {
    const c = layoutBlocks(mk(2), { direction: 'column', width: 400, height: 1000, gap: 80, cross: 200, maxMain: 100 })
    const a = arrowPath(c[0], c[1], 'column')
    expect(a.from.x).toBe(200); expect(a.to.x).toBe(200)
    expect(a.to.y - a.from.y).toBe(80)
  })
})

describe('groupBounds', () => {
  const blocks = [{ group: undefined }, { group: 'g' }, { group: 'g' }, { group: undefined }] as { group?: string }[]
  const rects = layoutBlocks(mk(4), { direction: 'row', width: 1000, height: 400, gap: 50, cross: 200 })
  it('恰好包住组内块并留边', () => {
    const b = groupBounds(blocks, rects, 'g', 20)!
    expect(b.x).toBe(rects[1].x - 20)
    expect(b.x + b.w).toBe(rects[2].x + rects[2].w + 20)
    expect(b.y).toBe(100 - 20)
    expect(b.h).toBe(240)
    // 不包含组外的块
    expect(b.x).toBeGreaterThan(rects[0].x + rects[0].w)
    expect(b.x + b.w).toBeLessThan(rects[3].x)
  })
  it('分边留白与不存在的组', () => {
    const b = groupBounds(blocks, rects, 'g', { b: 50 })!
    expect(b.h).toBe(250); expect(b.y).toBe(100)
    expect(groupBounds(blocks, rects, 'none')).toBeNull()
  })
})

describe('residual', () => {
  const rects = layoutBlocks(mk(5), { direction: 'row', width: 1500, height: 400, gap: 100, cross: 100 })
  it('row 向上：起点在 from 之前、终点在 to 之后，都在主干上', () => {
    const p = residualPoints(rects[1], rects[3], 'row', 100, 'start', 60)
    const trunk = 200
    expect(p[0]).toEqual({ x: rects[1].x - 50, y: trunk })
    expect(p[3]).toEqual({ x: rects[3].x + rects[3].w + 50, y: trunk })
    expect(p[0].x).toBeLessThan(rects[1].x)
    expect(p[3].x).toBeGreaterThan(rects[3].x + rects[3].w)
    // 绕到块上方 60
    expect(p[1].y).toBe(150 - 60); expect(p[2].y).toBe(90)
  })
  it('side=end 绕到下方', () => {
    const p = residualPoints(rects[0], rects[1], 'row', 100, 'end', 60)
    expect(p[1].y).toBe(250 + 60)
  })
  it('column 向左：起点在 from 上方、终点在 to 下方', () => {
    const c = layoutBlocks(mk(4), { direction: 'column', width: 800, height: 700, gap: 50, cross: 300, maxMain: 100 })
    const p = residualPoints(c[0], c[1], 'column', 50, 'start', 80)
    expect(p[0].y).toBe(c[0].y - 25)
    expect(p[3].y).toBe(c[1].y + c[1].h + 25)
    expect(p[1].x).toBe(c[0].x - 80)
    expect(p[0].x).toBe(400); expect(p[3].x).toBe(400)
  })
  it('path 圆角折线', () => {
    const d = residualPath(rects[1], rects[3], 'row', 100, 'start', 60, 20)
    expect(d.startsWith('M')).toBe(true)
    expect((d.match(/Q/g) ?? []).length).toBe(2)
    expect(roundedPolyline([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 20)).toBe('M0.00,0.00L80.00,0.00Q100.00,0.00 100.00,20.00L100.00,100.00')
  })
})
