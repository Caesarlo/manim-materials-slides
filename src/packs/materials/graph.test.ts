import { describe, expect, it } from 'vitest'
import { build } from './structure'
import { atomGraph, gnnLevels, hopDistances, receptiveField, resolveCenter } from './graph'
import { Bi2Te3_opts, SrTiO3_opts } from './presets'
import { SrTiO3 } from '@/talks/example/data/srtio3'
import { Bi2Te3 } from '@/talks/example/data/bi2te3'

const sr = build(SrTiO3, SrTiO3_opts)
const bi = build(Bi2Te3, Bi2Te3_opts)
const idx = (b: typeof sr, el: string) => b.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0)

describe('atomGraph', () => {
  it('默认用 built.bonds 作边，adj 对称', () => {
    const g = atomGraph(sr)
    expect(g.n).toBe(sr.atoms.length)
    expect(g.edges).toEqual(sr.bonds)
    expect(g.edges.length).toBe(6) // TiO6：6 根 Ti–O 键
    g.edges.forEach(([p, q]) => { expect(g.adj[p]).toContain(q); expect(g.adj[q]).toContain(p) })
  })
  it('cutoff 建图：边数随 cutoff 单调不减；小于最短距离时为空', () => {
    const counts = [0.5, 1.5, 2.0, 2.5, 3.0, 4.0, 6.0].map((c) => atomGraph(sr, { cutoff: c }).edges.length)
    for (let k = 1; k < counts.length; k++) expect(counts[k]).toBeGreaterThanOrEqual(counts[k - 1])
    expect(counts[0]).toBe(0)
    expect(counts[counts.length - 1]).toBeGreaterThan(counts[1])
  })
  it('cutoff = 2.2 Å 时恰好是 Ti–O 键（Ti–O 1.95 Å；O–O 2.76 Å 在外）', () => {
    expect(atomGraph(sr, { cutoff: 2.2 }).edges.length).toBe(6)
    expect(atomGraph(sr, { cutoff: 2.8 }).edges.length).toBeGreaterThan(6) // 加入 O–O（2.76 Å）和 Sr–O
  })
})

describe('跳数与感受野（SrTiO3 的 TiO6 八面体）', () => {
  const g = atomGraph(sr)
  const ti = idx(sr, 'Ti')[0]
  const os = idx(sr, 'O')
  it('Ti 到 6 个 O 都是 1 跳', () => {
    expect(os.length).toBe(6)
    const d = hopDistances(g, ti)
    expect(d[ti]).toBe(0)
    os.forEach((o) => expect(d[o]).toBe(1))
  })
  it('O 到 O 是 2 跳（经 Ti）；Sr 与八面体不成键 → 不可达', () => {
    const d = hopDistances(g, os[0])
    expect(d[ti]).toBe(1)
    os.slice(1).forEach((o) => expect(d[o]).toBe(2))
    idx(sr, 'Sr').forEach((s) => expect(d[s]).toBe(Infinity))
  })
  it('receptiveField：hops=0 只有自己，=1 是 Ti+6O，随 hops 单调扩大', () => {
    expect(receptiveField(g, ti, 0)).toEqual([ti])
    expect(receptiveField(g, ti, 1)).toEqual([ti, ...os].sort((a, b) => a - b))
    expect(receptiveField(g, os[0], 1)).toEqual([ti, os[0]].sort((a, b) => a - b))
    expect(receptiveField(g, os[0], 2).length).toBe(7)
  })
})

describe('Bi2Te3', () => {
  it('Bi 的 1 跳邻居数 = 6（BiTe6 八面体），都是 Te', () => {
    const g = atomGraph(bi)
    const b0 = idx(bi, 'Bi')[0]
    const near = receptiveField(g, b0, 1).filter((i) => i !== b0)
    expect(near.length).toBe(6)
    near.forEach((i) => expect(bi.atoms[i].el).toBe('Te'))
  })
})

describe('resolveCenter / gnnLevels', () => {
  const g = atomGraph(sr)
  it('元素符号取第一个该元素的原子；下标越界 / 未知元素 → -1', () => {
    expect(resolveCenter(sr, 'Ti')).toBe(idx(sr, 'Ti')[0])
    expect(resolveCenter(sr, 3)).toBe(3)
    expect(resolveCenter(sr, 999)).toBe(-1)
    expect(resolveCenter(sr, 'Xx')).toBe(-1)
  })
  it('强度：中心 1，1 跳 0.6，2 跳 0.35，超出 hops 为 0', () => {
    const lv0 = gnnLevels(sr, g, { center: 'Ti', hops: 0 })
    expect(lv0.filter((v) => v > 0)).toEqual([1])
    const lv1 = gnnLevels(sr, g, { center: 'Ti', hops: 1 })
    expect(lv1.filter((v) => v === 0.6).length).toBe(6)
    const o = idx(sr, 'O')[0]
    const lv2 = gnnLevels(sr, g, { center: o, hops: 2 })
    expect(lv2.filter((v) => v === 0.35).length).toBe(5)
    expect(lv2[o]).toBe(1)
  })
})
