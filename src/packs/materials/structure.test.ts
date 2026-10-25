import { describe, expect, it } from 'vitest'
import { build, cart } from './structure'
import { Bi2Te3_opts, SrTiO3_opts } from './presets'
import { SrTiO3 } from '@/talk/data/srtio3'
import { Bi2Te3 } from '@/talk/data/bi2te3'

const count = (b: ReturnType<typeof build>, el: string) => b.atoms.filter((a) => a.el === el).length

describe('cart', () => {
  it('立方晶格：分数坐标按边长缩放', () => {
    const p = cart([[4, 0, 0], [0, 4, 0], [0, 0, 4]], [0.5, 0.25, 1])
    expect(p).toEqual([2, 1, 4])
  })

  it('六方晶格：b 矢量带 x 分量', () => {
    const lat: [[number, number, number], [number, number, number], [number, number, number]] = [[4, 0, 0], [-2, 3.4641, 0], [0, 0, 10]]
    const p = cart(lat, [0, 1, 0])
    expect(p[0]).toBeCloseTo(-2)
    expect(p[1]).toBeCloseTo(3.4641)
  })
})

describe('SrTiO3 (Pm-3m)', () => {
  const b = build(SrTiO3, SrTiO3_opts)

  it('晶胞内原子：8 个角上的 Sr（含周期像）+ 1 Ti + 6 O', () => {
    expect(count(b, 'Sr')).toBe(8)
    expect(count(b, 'Ti')).toBe(1)
    expect(count(b, 'O')).toBe(6)
  })

  it('只有一个 TiO6 八面体，6 个配体', () => {
    expect(b.polyhedra).toHaveLength(1)
    expect(b.polyhedra[0].ligands).toHaveLength(6)
    expect(b.atoms[b.polyhedra[0].center].el).toBe('Ti')
  })

  it('键只有 Ti–O，共 6 根，长度为 a/2', () => {
    expect(b.bonds).toHaveLength(6)
    for (const [i, j] of b.bonds) {
      const [p, q] = [b.atoms[i], b.atoms[j]]
      expect([p.el, q.el].sort()).toEqual(['O', 'Ti'])
      expect(Math.hypot(p.pos[0] - q.pos[0], p.pos[1] - q.pos[1], p.pos[2] - q.pos[2])).toBeCloseTo(3.905 / 2, 3)
    }
  })

  it('晶胞 8 个角点，包围球半径 ≥ 体对角线的一半', () => {
    expect(b.corners).toHaveLength(8)
    expect(b.radius).toBeGreaterThanOrEqual((Math.sqrt(3) * 3.905) / 2 - 1e-6)
  })

  it('超胞 2×1×1：Ti 数量翻倍', () => {
    const s = build(SrTiO3, { ...SrTiO3_opts, repeat: [2, 1, 1] })
    expect(count(s, 'Ti')).toBe(2)
    expect(s.polyhedra).toHaveLength(2)
  })
})

describe('Bi2Te3 (R-3m, 六方设置)', () => {
  const b = build(Bi2Te3, Bi2Te3_opts)

  it('晶体数据：15 个原子/晶胞（Bi 6 + Te 9）', () => {
    expect(Bi2Te3.atoms).toHaveLength(15)
    expect(Bi2Te3.atoms.filter((a) => a.el === 'Bi')).toHaveLength(6)
    expect(Bi2Te3.atoms.filter((a) => a.el === 'Te')).toHaveLength(9)
  })

  it('每个 Bi 都是 6 配位（BiTe6 八面体）', () => {
    // 晶胞边界上的 Bi 会在 4 条棱上各出现一次（周期像，和 VESTA 一致）：6 个原子 → 12 个显示的 Bi
    expect(count(b, 'Bi')).toBe(12)
    expect(b.polyhedra).toHaveLength(12)
    for (const p of b.polyhedra) expect(p.ligands).toHaveLength(6)
  })

  it('Bi–Te 键长：3 × 3.06 Å + 3 × 3.26 Å（文献 3.07 / 3.25 Å）', () => {
    const c = b.polyhedra[0]
    const d = c.ligands.map((l) => Math.hypot(...[0, 1, 2].map((k) => b.atoms[c.center].pos[k] - b.atoms[l].pos[k]))).sort()
    expect(d.slice(0, 3).every((x) => Math.abs(x - 3.06) < 0.03)).toBe(true)
    expect(d.slice(3).every((x) => Math.abs(x - 3.26) < 0.03)).toBe(true)
  })

  it('键数 = 多面体数 × 6，且全是 Bi–Te（范德华间隙处的 Te–Te 不成键）', () => {
    expect(b.bonds).toHaveLength(72)
    for (const [i, j] of b.bonds) expect(new Set([b.atoms[i].el, b.atoms[j].el])).toEqual(new Set(['Bi', 'Te']))
  })

  it('c 轴方向的晶胞高度为 30.497 Å', () => {
    const zs = b.corners.map((c) => c[2])
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(30.497, 3)
  })
})
