// 晶体 → 图（纯逻辑，不依赖 three.js）：原子 = 节点，键（或截断半径内的原子对）= 边。
// 只考虑当前显示的原子（built.atoms），不做周期性镜像。
import type { Built } from './structure'

export interface AtomGraph { n: number; edges: [number, number][]; adj: number[][] }

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** 默认用 built.bonds 作边；给 cutoff（Å）时改用“所有距离 ≤ cutoff 的原子对”（晶体图神经网络常见的截断半径建图） */
export function atomGraph(built: Built, opts: { cutoff?: number } = {}): AtomGraph {
  const n = built.atoms.length
  let edges: [number, number][]
  if (opts.cutoff === undefined) edges = built.bonds.map(([p, q]) => [p, q])
  else {
    edges = []
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++)
      if (dist(built.atoms[p].pos, built.atoms[q].pos) <= opts.cutoff + 1e-9) edges.push([p, q])
  }
  const adj: number[][] = Array.from({ length: n }, () => [])
  for (const [p, q] of edges) { adj[p].push(q); adj[q].push(p) }
  return { n, edges, adj }
}

/** 从 center 出发的 BFS 跳数；不可达 = Infinity；center 越界则全为 Infinity */
export function hopDistances(g: AtomGraph, center: number): number[] {
  const d = Array<number>(g.n).fill(Infinity)
  if (!Number.isInteger(center) || center < 0 || center >= g.n) return d
  d[center] = 0
  const queue = [center]
  for (let h = 0; h < queue.length; h++)
    for (const v of g.adj[queue[h]]) if (d[v] === Infinity) { d[v] = d[queue[h]] + 1; queue.push(v) }
  return d
}

/** hops 步内可达的原子下标（含 center 自己，升序） */
export function receptiveField(g: AtomGraph, center: number, hops: number): number[] {
  const out: number[] = []
  hopDistances(g, center).forEach((d, i) => { if (d <= hops) out.push(i) })
  return out
}

/** center 可以是原子下标，或元素符号（取该元素的第一个原子）；找不到返回 -1 */
export function resolveCenter(built: Built, center: number | string): number {
  if (typeof center === 'number') return Number.isInteger(center) && center >= 0 && center < built.atoms.length ? center : -1
  return built.atoms.findIndex((a) => a.el === center)
}

/** 每个原子的“消息传递强度”0..1：center 1，每多一跳减半档（1 跳 0.6，2 跳 0.35，更远 0.2），超出 hops 或不可达 = 0 */
export function gnnLevels(built: Built, g: AtomGraph, spec: { center: number | string; hops: number }): number[] {
  const c = resolveCenter(built, spec.center)
  return hopDistances(g, c).map((d) => (d > spec.hops ? 0 : d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.35 : 0.2))
}
