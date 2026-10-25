import { describe, expect, it } from 'vitest'
import { build, cart, fracAlong, inLayer, layerMask, toFrac } from './structure'
import { elementsOf, isOccluded, layoutRow, pickLabelAtom, representatives, resolveHighlight, type ScreenAtom } from './labels'
import { Bi2Te3_opts, SrTiO3_opts } from './presets'
import { SrTiO3 } from '@/talks/example/data/srtio3'
import { Bi2Te3 } from '@/talks/example/data/bi2te3'

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

// ---- 层区间 / 超胞 / 标签 / 高亮（纯逻辑） ----
describe('toFrac（cart 的逆）', () => {
  it('六方晶格：cart 再 toFrac 还原分数坐标', () => {
    const lat: [[number, number, number], [number, number, number], [number, number, number]] = [[4, 0, 0], [-2, 3.4641, 0], [0, 0, 10]]
    const f = toFrac(lat, cart(lat, [0.25, 0.5, 0.75]))
    expect(f[0]).toBeCloseTo(0.25)
    expect(f[1]).toBeCloseTo(0.5)
    expect(f[2]).toBeCloseTo(0.75)
  })
})

describe('inLayer', () => {
  it('闭区间，边界按容差算在内', () => {
    expect(inLayer(0.2, { from: 0.2, to: 0.47 })).toBe(true)
    expect(inLayer(0.47, { from: 0.2, to: 0.47 })).toBe(true)
    expect(inLayer(0.1999, { from: 0.2, to: 0.47 })).toBe(true) // 容差 1e-3
    expect(inLayer(0.19, { from: 0.2, to: 0.47 })).toBe(false)
    expect(inLayer(0.48, { from: 0.2, to: 0.47 })).toBe(false)
  })
  it('没有区间 = 全部在内；from > to 视为互换', () => {
    expect(inLayer(5, null)).toBe(true)
    expect(inLayer(5, undefined)).toBe(true)
    expect(inLayer(0.3, { from: 0.47, to: 0.2 })).toBe(true)
  })
})

describe('layerMask：Bi2Te3 的五重层（沿 c，分数坐标 0.2–0.47）', () => {
  const b = build(Bi2Te3, Bi2Te3_opts)
  const mask = layerMask(b, { axis: 'z', from: 0.2, to: 0.47 })
  it('原子的 c 分数坐标就是晶体数据里的 z（Bi 0.4008 存在）', () => {
    const found = b.atoms.some((a, i) => a.el === 'Bi' && Math.abs(fracAlong(b, i, 'z') - 0.4008) < 1e-3)
    expect(found).toBe(true)
  })
  it('层内恰好是一个五重层：5 个不同的 z（Te 0.2097 / Bi 0.2659 / Te 0.3333 / Bi 0.4008 / Te 0.4570）', () => {
    const zs = new Map<number, string>()
    b.atoms.forEach((a, i) => { if (mask[i]) zs.set(Math.round(fracAlong(b, i, 'z') * 1e4) / 1e4, a.el) })
    expect([...zs.entries()].sort((p, q) => p[0] - q[0])).toEqual([
      [0.2097, 'Te'], [0.2659, 'Bi'], [0.3333, 'Te'], [0.4008, 'Bi'], [0.457, 'Te'],
    ])
  })
  it('层内 Bi = 5 个显示的原子（z=0.4008 的 Bi 在 4 个角上各一个周期像 + z=0.2659 的 1 个）', () => {
    expect(b.atoms.filter((a, i) => mask[i] && a.el === 'Bi')).toHaveLength(5)
  })
  it('层内多面体都以 Bi 为中心，数量 = 层内 Bi 数；层外的 Bi 中心不算', () => {
    const polys = b.polyhedra.filter((p) => mask[p.center])
    expect(polys).toHaveLength(5)
    for (const p of polys) expect(b.atoms[p.center].el).toBe('Bi')
    expect(b.polyhedra.length).toBeGreaterThan(polys.length)
  })
  it('layer 为空时全部为 true', () => {
    expect(layerMask(b, null).every(Boolean)).toBe(true)
  })
})

describe('超胞 repeat 与原子/多面体数', () => {
  const base = build(SrTiO3, SrTiO3_opts)
  const s = build(SrTiO3, { ...SrTiO3_opts, repeat: [2, 2, 1] })
  it('repeat [2,2,1]：Ti 与八面体数 = 4，每个八面体 6 配体，键 4×6 = 24', () => {
    expect(count(s, 'Ti')).toBe(4)
    expect(s.polyhedra).toHaveLength(4)
    for (const p of s.polyhedra) expect(p.ligands).toHaveLength(6)
    expect(s.bonds).toHaveLength(24)
  })
  it('Sr 是 (nx+1)(ny+1)(nz+1) 个格点（含边界周期像）：1×1×1 为 8，2×2×1 为 18', () => {
    expect(count(base, 'Sr')).toBe(8)
    expect(count(s, 'Sr')).toBe(18)
  })
  it('超胞矢量 = 晶格矢量 × repeat，中心与包围球随之变化', () => {
    expect(s.repeat).toEqual([2, 2, 1])
    expect(s.supercell[0][0]).toBeCloseTo(7.81, 6)
    expect(s.supercell[2][2]).toBeCloseTo(3.905, 6)
    expect(s.radius).toBeGreaterThan(base.radius)
    expect(s.center[0]).toBeCloseTo(3.905, 6)
  })
  it('层区间按整个超胞归一化：沿 a 取 [0, 0.5] 恰好含第一列晶胞的 2 个 Ti', () => {
    const m = layerMask(s, { axis: 'x', from: 0, to: 0.5 })
    const ti = s.atoms.map((a, i) => (a.el === 'Ti' && m[i] ? i : -1)).filter((i) => i >= 0)
    expect(ti).toHaveLength(2) // x = 0.25 处的两个 Ti（y = 0.25, 0.75）
  })
})

describe('代表原子 / 元素列表', () => {
  const b = build(SrTiO3, SrTiO3_opts)
  const firstO = b.atoms.findIndex((a) => a.el === 'O')
  it('elementsOf 按首次出现顺序，不重复', () => {
    expect(elementsOf(b)).toEqual(['Sr', 'Ti', 'O'])
  })
  it('每种元素一个代表：Ti 只有一个；O 到中心距离相同，取下标最小的', () => {
    const r = representatives(b)
    expect([...r.keys()]).toEqual(['Sr', 'Ti', 'O'])
    expect(b.atoms[r.get('Ti')!].el).toBe('Ti')
    expect(r.get('O')).toBe(firstO)
  })
  it('els 限定元素并忽略不存在的；prefer 优先，都不满足则退回全部', () => {
    expect([...representatives(b, ['Ti', 'Xx']).keys()]).toEqual(['Ti'])
    const lastO = b.atoms.map((a, i) => (a.el === 'O' ? i : -1)).filter((i) => i >= 0).pop()!
    expect(representatives(b, ['O'], (i) => i === lastO).get('O')).toBe(lastO)
    expect(representatives(b, ['O'], () => false).get('O')).toBe(firstO)
  })
})

describe('resolveHighlight', () => {
  const b = build(SrTiO3, SrTiO3_opts)
  it('els 选出该元素的全部原子', () => {
    const on = resolveHighlight(b, { els: ['Ti'] })
    expect(on.filter(Boolean)).toHaveLength(1)
    expect(b.atoms[on.indexOf(true)].el).toBe('Ti')
    expect(resolveHighlight(b, { els: ['Sr'] }).filter(Boolean)).toHaveLength(8)
  })
  it('els 与 indices 取并集；越界/非整数下标忽略', () => {
    const o = b.atoms.findIndex((a) => a.el === 'O')
    const on = resolveHighlight(b, { els: ['Ti'], indices: [o, 999, -1, 1.5] })
    expect(on.filter(Boolean)).toHaveLength(2)
    expect(on[o]).toBe(true)
  })
  it('null / 空 = 都不高亮', () => {
    expect(resolveHighlight(b, null).some(Boolean)).toBe(false)
    expect(resolveHighlight(b, {}).some(Boolean)).toBe(false)
  })
})

describe('标签选点与排版（屏幕空间）', () => {
  const A = (x: number, y: number, r: number, depth: number, shown = true): ScreenAtom => ({ x, y, r, depth, shown })
  it('球心被更靠前、显示着的原子盖住才算被挡', () => {
    const atoms = [A(100, 100, 20, 10), A(110, 100, 30, 5), A(300, 300, 20, 1)]
    expect(isOccluded(0, atoms)).toBe(true) // 距离 10 < 前面那个的半径 30
    expect(isOccluded(1, atoms)).toBe(false)
    expect(isOccluded(0, [atoms[0], A(110, 100, 30, 5, false)])).toBe(false) // 前面的被压暗 → 不算挡
  })
  it('pickLabelAtom：没被挡住的里取最靠上的；全被挡住也有结果；空候选 → undefined', () => {
    const atoms = [A(100, 100, 20, 10), A(110, 100, 30, 5), A(300, 50, 20, 8)]
    expect(pickLabelAtom([0, 1, 2], atoms)).toBe(2) // 2 的顶部 y = 30 最小
    expect(pickLabelAtom([0], atoms)).toBe(0) // 唯一候选被挡，仍然返回
    expect(pickLabelAtom([], atoms)).toBeUndefined()
  })
  it('layoutRow：标签互不重叠、保持左右顺序、限制在宽度内', () => {
    const xs = layoutRow([{ x: 100, w: 60 }, { x: 110, w: 60 }, { x: 120, w: 60 }], 10, 1000)
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThanOrEqual(70 - 1e-9)
    const right = layoutRow([{ x: 990, w: 60 }, { x: 995, w: 60 }], 10, 1000)
    expect(Math.max(...right) + 30).toBeLessThanOrEqual(1000 + 1e-9)
    expect(right[1] - right[0]).toBeGreaterThanOrEqual(70 - 1e-9)
  })
  it('layoutRow：绕开 blocked 区间', () => {
    const xs = layoutRow([{ x: 100, w: 40 }], 10, 1000, [{ x0: 80, x1: 120 }])
    expect(xs[0] - 20).toBeGreaterThanOrEqual(120 + 10 - 1e-9)
  })
})
