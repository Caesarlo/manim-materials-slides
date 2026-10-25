// 玩具能带（示意，不是任何真实材料的计算结果）。
// 用二维正方晶格的 s = (cos kx + cos ky)/2 构造余弦形能带，沿 Γ(0,0) – X(π,0) – M(π,π) – Γ 走一圈：
//   s 在 Γ=1，X=0，M=-1。
// 半导体：价带顶在 Γ（-0.2 eV），导带底在 X（+0.6 eV）→ 间接带隙 0.80 eV。
// 金属：一条能带穿过费米能级。
import type { BandData } from '@/packs/plot/bandMath'

const N = 60 // 每段 60 个间隔
const PATH_LABELS = [String.raw`$\Gamma$`, 'X', 'M', String.raw`$\Gamma$`]

function sAt(i: number): number {
  const seg = Math.min(2, Math.floor(i / N)), t = (i - seg * N) / N
  const [kx, ky] = seg === 0 ? [Math.PI * t, 0] : seg === 1 ? [Math.PI, Math.PI * t] : [Math.PI * (1 - t), Math.PI * (1 - t)]
  return (Math.cos(kx) + Math.cos(ky)) / 2
}

function build(fn: (s: number) => number[]): BandData {
  const nK = 3 * N + 1
  const k = Array.from({ length: nK }, (_, i) => i / (3 * N))
  const cols = Array.from({ length: nK }, (_, i) => fn(sAt(i)))
  const bands = cols[0].map((_, b) => cols.map((c) => c[b]))
  return { kpath: PATH_LABELS.map((label, i) => ({ label, k: i / 3 })), k, bands }
}

export const toySemiconductor = build((s) => [
  -2.4 - 0.5 * (1 - s), // 价带 2
  -0.2 - 0.9 * (1 - s), // 价带 1：顶在 Γ
  0.6 + 0.9 * s * s, // 导带 1：底在 X
  2.2 + 0.6 * s, // 导带 2
])

export const toyMetal = build((s) => [
  -2.6 - 0.6 * (1 - s),
  -0.5 + 1.2 * s, // 穿过费米能级
  1.4 - 0.9 * s,
])
