// 晶体结构 → 可渲染的数据（纯函数，不依赖 three.js）。
// 输入：晶格矢量（Å）+ 分数坐标原子。输出：超胞内的笛卡尔坐标原子、键、配位多面体、晶胞角点。
// CIF 解析请在 tools/ 里用 Python 做（对称操作展开），这里只吃展开后的原子。
export type Vec3 = [number, number, number]

export interface Crystal {
  name: string
  /** 晶格矢量 a, b, c（Å，笛卡尔） */
  lattice: [Vec3, Vec3, Vec3]
  atoms: { el: string; frac: Vec3 }[]
}

export interface BondRule { a: string; b: string; max: number }
/** 以 center 为中心、距离 ≤ max 的 ligand 构成配位多面体（如 Ti–O6 八面体） */
export interface PolyRule { center: string; ligand: string; max: number }

export interface BuildOptions {
  /** 超胞重复次数，默认 [1,1,1] */
  repeat?: Vec3
  bonds?: BondRule[]
  polyhedra?: PolyRule[]
}

export interface BuiltAtom { el: string; pos: Vec3 }
export interface Built {
  atoms: BuiltAtom[]
  bonds: [number, number][]
  polyhedra: { center: number; ligands: number[] }[]
  /** 超胞的 8 个角点（顺序：按 (i,j,k) ∈ {0,1}³ 的二进制 ijk） */
  corners: Vec3[]
  center: Vec3
  /** 包围球半径（Å） */
  radius: number
  /** 单个晶胞的晶格矢量 a, b, c（Å，原点为 corners[0]） */
  lattice: [Vec3, Vec3, Vec3]
  /** 超胞矢量 = 晶格矢量 × repeat，分数坐标 / 层区间按它归一化 */
  supercell: [Vec3, Vec3, Vec3]
  repeat: Vec3
}

export type Axis = 'x' | 'y' | 'z'
/** 按层聚焦：沿晶格矢量（x=a, y=b, z=c）的分数坐标区间，按整个超胞归一化到 0..1 */
export interface LayerSpec { axis: Axis; from: number; to: number }

const EPS = 1e-4
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

export function cart(lat: Crystal['lattice'], f: Vec3): Vec3 {
  return [0, 1, 2].map((d) => f[0] * lat[0][d] + f[1] * lat[1][d] + f[2] * lat[2][d]) as Vec3
}

/**
 * 画出“晶胞内全部原子（含边界上的周期像）+ 中心原子配位所需的配体”，和 VESTA 的默认显示一致：
 * 边界原子会在对面重复出现；配位多面体不会被晶胞边界切断。
 */
export function build(c: Crystal, opts: BuildOptions = {}): Built {
  const [nx, ny, nz] = opts.repeat ?? [1, 1, 1]
  const polyRules = opts.polyhedra ?? []
  const bondRules: BondRule[] =
    opts.bonds ?? polyRules.map((r) => ({ a: r.center, b: r.ligand, max: r.max }))

  // 1. 带一圈 padding 的候选原子（用来补全配位）
  interface Cand { el: string; pos: Vec3; inside: boolean }
  const cands: Cand[] = []
  for (let i = -1; i <= nx; i++) for (let j = -1; j <= ny; j++) for (let k = -1; k <= nz; k++)
    for (const at of c.atoms) {
      const f: Vec3 = [at.frac[0] + i, at.frac[1] + j, at.frac[2] + k]
      const inside =
        f[0] >= -EPS && f[0] <= nx + EPS && f[1] >= -EPS && f[1] <= ny + EPS && f[2] >= -EPS && f[2] <= nz + EPS
      cands.push({ el: at.el, pos: cart(c.lattice, f), inside })
    }

  // 2. 保留：内部原子 + 内部中心原子的配体
  const keep = new Set<number>()
  cands.forEach((a, i) => { if (a.inside) keep.add(i) })
  for (const rule of polyRules)
    cands.forEach((a) => {
      if (!a.inside || a.el !== rule.center) return
      cands.forEach((b, j) => { if (b.el === rule.ligand && dist(a.pos, b.pos) <= rule.max) keep.add(j) })
    })
  const idx = [...keep]
  const remap = new Map(idx.map((old, n) => [old, n]))
  const atoms: BuiltAtom[] = idx.map((i) => ({ el: cands[i].el, pos: cands[i].pos }))

  // 3. 键
  const bonds: [number, number][] = []
  for (let p = 0; p < atoms.length; p++) for (let q = p + 1; q < atoms.length; q++) {
    const A = atoms[p], B = atoms[q]
    const d = dist(A.pos, B.pos)
    if (bondRules.some((r) => d <= r.max && ((A.el === r.a && B.el === r.b) || (A.el === r.b && B.el === r.a))))
      bonds.push([p, q])
  }

  // 4. 配位多面体（只给内部中心原子画）
  const polyhedra: Built['polyhedra'] = []
  for (const rule of polyRules)
    cands.forEach((a, i) => {
      if (!a.inside || a.el !== rule.center) return
      const ligands: number[] = []
      cands.forEach((b, j) => { if (b.el === rule.ligand && dist(a.pos, b.pos) <= rule.max) ligands.push(remap.get(j)!) })
      if (ligands.length >= 4) polyhedra.push({ center: remap.get(i)!, ligands })
    })

  // 5. 晶胞角点与包围球
  const corners: Vec3[] = []
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) for (let k = 0; k <= 1; k++)
    corners.push(cart(c.lattice, [i * nx, j * ny, k * nz]))
  const center = [0, 1, 2].map((d) => corners.reduce((s, p) => s + p[d], 0) / 8) as Vec3
  const radius = Math.max(
    ...corners.map((p) => dist(p, center)),
    ...atoms.map((a) => dist(a.pos, center)),
  )
  const supercell = c.lattice.map((v, d) => v.map((x) => x * [nx, ny, nz][d])) as [Vec3, Vec3, Vec3]
  return { atoms, bonds, polyhedra, corners, center, radius, lattice: c.lattice, supercell, repeat: [nx, ny, nz] }
}

/** 笛卡尔坐标 → 以 vectors 为基的分数坐标（cart 的逆，Cramer 法则）。 */
export function toFrac(vectors: Crystal['lattice'], p: Vec3): Vec3 {
  const [a, b, c] = vectors
  const det3 = (u: Vec3, v: Vec3, w: Vec3) =>
    u[0] * (v[1] * w[2] - v[2] * w[1]) - u[1] * (v[0] * w[2] - v[2] * w[0]) + u[2] * (v[0] * w[1] - v[1] * w[0])
  const D = det3(a, b, c)
  return [det3(p, b, c) / D, det3(a, p, c) / D, det3(a, b, p) / D]
}

const LAYER_EPS = 1e-3
/** 分数坐标 frac 是否落在层区间内（闭区间，容差 1e-3）；没有区间 = 全部在内。区间 from>to 视为互换。 */
export function inLayer(frac: number, layer: { from: number; to: number } | null | undefined): boolean {
  if (!layer) return true
  const lo = Math.min(layer.from, layer.to), hi = Math.max(layer.from, layer.to)
  return frac >= lo - LAYER_EPS && frac <= hi + LAYER_EPS
}

/** 某原子沿 axis 的超胞分数坐标 */
export function fracAlong(built: Built, atom: number, axis: Axis): number {
  const f = toFrac(built.supercell, built.atoms[atom].pos)
  return f['xyz'.indexOf(axis)]
}

/** 每个原子是否在层内；layer 为空时全部为 true */
export function layerMask(built: Built, layer: LayerSpec | null | undefined): boolean[] {
  return built.atoms.map((_, i) => !layer || inLayer(fracAlong(built, i, layer.axis), layer))
}
