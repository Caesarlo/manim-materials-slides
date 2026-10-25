import { describe, expect, it } from 'vitest'
import { attention, causalMask, qkFromTokens, seededEmbedding, softmax } from './attentionMath'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('softmax', () => {
  it('和为 1，手算 [0, ln3] → [0.25, 0.75]', () => {
    const p = softmax([0, Math.log(3)])
    expect(p[0]).toBeCloseTo(0.25, 12)
    expect(p[1]).toBeCloseTo(0.75, 12)
    expect(sum(softmax([1, 2, 3, 4]))).toBeCloseTo(1, 12)
  })
  it('平移不变，且大数不溢出', () => {
    const a = softmax([1, 2, 3])
    const b = softmax([1001, 1002, 1003])
    a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 12))
  })
  it('-Infinity 项权重为 0', () => {
    expect(softmax([0, -Infinity, 0])).toEqual([0.5, 0, 0.5])
    expect(softmax([-Infinity, -Infinity])).toEqual([0, 0])
    expect(softmax([])).toEqual([])
  })
})

describe('causalMask', () => {
  it('严格上三角为 true', () => {
    expect(causalMask(3)).toEqual([
      [false, true, true],
      [false, false, true],
      [false, false, false],
    ])
  })
})

describe('attention', () => {
  const { Q, K } = qkFromTokens(['a', 'b', 'c', 'd', 'e'], 8, 3)
  it('全注意力每行和为 1，且全为正', () => {
    const W = attention(Q, K)
    W.forEach((row) => {
      expect(sum(row)).toBeCloseTo(1, 12)
      row.forEach((v) => expect(v).toBeGreaterThan(0))
    })
  })
  it('因果注意力：每行和为 1，严格上三角为 0', () => {
    const W = attention(Q, K, { causal: true })
    W.forEach((row, i) => {
      expect(sum(row)).toBeCloseTo(1, 12)
      row.forEach((v, j) => { if (j > i) expect(v).toBe(0) })
    })
    expect(W[0][0]).toBeCloseTo(1, 12) // 第一个词元只能看自己
  })
  it('n=1 时权重为 1', () => {
    expect(attention([[0.3, -2]], [[5, 1]])).toEqual([[1]])
    expect(attention([[0.3, -2]], [[5, 1]], { causal: true })).toEqual([[1]])
  })
  it('构造的 Q/K 使某一格显然最大，手算数值', () => {
    // d=1，√d=1：第 0 行的分数 [0, 2, 0] → 权重 e^2 / (e^2 + 2)
    const W = attention([[1], [0], [0]], [[0], [2], [0]])
    expect(W[0][1]).toBeCloseTo(Math.exp(2) / (Math.exp(2) + 2), 12)
    expect(W[0][1]).toBeGreaterThan(W[0][0])
    expect(W[0][1]).toBeGreaterThan(W[0][2])
    W[1].forEach((v) => expect(v).toBeCloseTo(1 / 3, 12)) // Q 为 0 → 分数全 0 → 均匀
  })
  it('缩放：d=4、q·k=4 时分数为 4/√4 = 2', () => {
    const W = attention([[1, 1, 1, 1], [0, 0, 0, 0]], [[1, 1, 1, 1], [0, 0, 0, 0]])
    // 第 0 行分数 [2, 0]
    expect(W[0][0]).toBeCloseTo(Math.exp(2) / (Math.exp(2) + 1), 12)
  })
  it('相同输入结果完全可复现', () => {
    const t = ['The', ' lat', 'tice']
    const a = qkFromTokens(t, 8, 42)
    const b = qkFromTokens(t, 8, 42)
    expect(a).toEqual(b)
    expect(attention(a.Q, a.K, { causal: true })).toEqual(attention(b.Q, b.K, { causal: true }))
  })
  it('长度不一致抛错', () => {
    expect(() => attention([[1]], [[1], [2]])).toThrow()
  })
})

describe('seededEmbedding', () => {
  it('同一词元在任何位置、任何上下文里向量相同', () => {
    const e1 = seededEmbedding(['x', 'y', 'x'], 6, 1)
    const e2 = seededEmbedding(['y', 'x'], 6, 1)
    expect(e1[0]).toEqual(e1[2])
    expect(e2[1]).toEqual(e1[0])
    expect(e2[0]).toEqual(e1[1])
  })
  it('不同词元或不同 seed 得到不同向量；维度正确', () => {
    const e = seededEmbedding(['x', 'y'], 6, 1)
    expect(e[0]).toHaveLength(6)
    expect(e[0]).not.toEqual(e[1])
    expect(seededEmbedding(['x'], 6, 2)[0]).not.toEqual(e[0])
  })
  it('统计上近似标准正态（大样本均值≈0、方差≈1）', () => {
    const v = seededEmbedding(['tok'], 20000, 5)[0]
    const mean = sum(v) / v.length
    const varr = sum(v.map((x) => (x - mean) ** 2)) / v.length
    expect(Math.abs(mean)).toBeLessThan(0.05)
    expect(varr).toBeGreaterThan(0.9)
    expect(varr).toBeLessThan(1.1)
  })
  it('Q 与 K 是不同的投影', () => {
    const { Q, K } = qkFromTokens(['x'], 6, 1)
    expect(Q).not.toEqual(K)
  })
})
