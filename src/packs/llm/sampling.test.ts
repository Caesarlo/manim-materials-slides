import { describe, expect, it } from 'vitest'
import { argmax, entropy, renormalize, softmaxT, topK, topP } from './sampling'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('softmaxT', () => {
  it('logits [2,1,0], T=1：e²/(e²+e+1) 等', () => {
    const e = Math.E
    const Z = e * e + e + 1
    const p = softmaxT([2, 1, 0], 1)
    expect(p[0]).toBeCloseTo((e * e) / Z, 12)
    expect(p[1]).toBeCloseTo(e / Z, 12)
    expect(p[2]).toBeCloseTo(1 / Z, 12)
    expect(p[0]).toBeCloseTo(0.665241, 6)
  })
  it('T=2 更平：等价于 logits/2 = [1, 0.5, 0]', () => {
    const Z = Math.E + Math.sqrt(Math.E) + 1
    const p = softmaxT([2, 1, 0], 2)
    expect(p[0]).toBeCloseTo(Math.E / Z, 12)
    expect(p[0]).toBeCloseTo(0.50648, 5)
    expect(p[0]).toBeLessThan(softmaxT([2, 1, 0], 1)[0])
    expect(p[2]).toBeGreaterThan(softmaxT([2, 1, 0], 1)[2])
  })
  it('和为 1；对 logits 平移不变', () => {
    const a = softmaxT([2, 1, 0], 0.7)
    const b = softmaxT([102, 101, 100], 0.7)
    expect(sum(a)).toBeCloseTo(1, 12)
    b.forEach((v, i) => expect(v).toBeCloseTo(a[i], 12))
  })
  it('T→0 趋近 argmax（one-hot），T→∞ 趋近均匀；不溢出', () => {
    const cold = softmaxT([2, 1, 0], 0.01)
    expect(cold[0]).toBeCloseTo(1, 9)
    expect(softmaxT([1000, 0], 0.001)).toEqual([1, 0])
    const hot = softmaxT([2, 1, 0], 1e6)
    hot.forEach((v) => expect(v).toBeCloseTo(1 / 3, 5))
  })
  it('T<=0 抛错', () => {
    expect(() => softmaxT([1, 2], 0)).toThrow(RangeError)
    expect(() => softmaxT([1, 2], -1)).toThrow(RangeError)
  })
})

describe('argmax / topK', () => {
  it('argmax 并列取靠前者', () => {
    expect(argmax([0.1, 0.4, 0.4, 0.1])).toBe(1)
    expect(argmax([3, 1, 2])).toBe(0)
  })
  it('topK 降序并带 index；并列保持原顺序', () => {
    const r = topK([0.2, 0.4, 0.1, 0.4], ['a', 'b', 'c', 'd'], 3)
    expect(r).toEqual([
      { label: 'b', p: 0.4, index: 1 },
      { label: 'd', p: 0.4, index: 3 },
      { label: 'a', p: 0.2, index: 0 },
    ])
  })
  it('k 超长返回全部，k=0 返回空', () => {
    expect(topK([0.5, 0.5], ['x', 'y'], 9)).toHaveLength(2)
    expect(topK([0.5, 0.5], ['x', 'y'], 0)).toEqual([])
  })
})

describe('entropy', () => {
  it('均匀分布 = log2(n)', () => {
    expect(entropy([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(2, 12)
    expect(entropy(new Array(8).fill(1 / 8))).toBeCloseTo(3, 12)
  })
  it('one-hot = 0', () => {
    expect(entropy([0, 1, 0])).toBe(0)
  })
  it('[0.5,0.25,0.25] = 1.5 bit', () => {
    expect(entropy([0.5, 0.25, 0.25])).toBeCloseTo(1.5, 12)
  })
  it('温度越高熵越大', () => {
    const h = [0.5, 1, 2].map((T) => entropy(softmaxT([2, 1, 0], T)))
    expect(h[0]).toBeLessThan(h[1])
    expect(h[1]).toBeLessThan(h[2])
    expect(h[2]).toBeLessThan(Math.log2(3))
  })
})

describe('topP / renormalize', () => {
  const p = [0.5, 0.3, 0.15, 0.05]
  it('累计 ≥ p 的最小集合（边界取等号）', () => {
    expect(topP(p, 0.5)).toEqual([0]) // 0.5 ≥ 0.5
    expect(topP(p, 0.8)).toEqual([0, 1]) // 0.5+0.3 = 0.8
    expect(topP(p, 0.81)).toEqual([0, 1, 2])
    expect(topP(p, 1)).toEqual([0, 1, 2, 3])
  })
  it('下标按升序返回，与输入顺序无关', () => {
    expect(topP([0.1, 0.6, 0.3], 0.85)).toEqual([1, 2])
  })
  it('p 很小也至少保留一项', () => {
    expect(topP(p, 0.01)).toEqual([0])
  })
  it('renormalize：保留项按比例放大，和为 1，其余为 0', () => {
    const r = renormalize(p, [0, 1])
    expect(r[0]).toBeCloseTo(0.5 / 0.8, 12)
    expect(r[1]).toBeCloseTo(0.3 / 0.8, 12)
    expect(r[2]).toBe(0)
    expect(r[3]).toBe(0)
    expect(sum(r)).toBeCloseTo(1, 12)
  })
})
