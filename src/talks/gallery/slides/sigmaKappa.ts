// 散点页：三类材料的 σ–κ 性能图（Ashby 式）。
// 数据全部是示意：由固定种子的伪随机数在对数空间里按“类中心 ± 抖动”生成，不对应任何真实材料或文献。
import { scatterSlide, pointsInRegion, type ScatterPoint } from '@/packs/plot/scatterChart'

// 线性同余伪随机（固定种子 → 每次打开都是同一批点），取近似正态（三个均匀数之和）
let seed = 20260
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 2

// [组, 个数, log10κ 中心, κ 抖动, log10σ 中心, σ 抖动]
const SPEC: [number, number, number, number, number, number][] = [
  [0, 16, 0.75, 0.3, 1.4, 0.6],
  [1, 22, 0.15, 0.4, 4.3, 0.55],
  [2, 14, 2.0, 0.3, 6.5, 0.25],
]
const points: ScatterPoint[] = SPEC.flatMap(([group, n, kc, kj, sc, sj]) =>
  Array.from({ length: n }, () => ({
    group,
    x: Math.pow(10, Math.min(2.9, Math.max(-0.9, kc + kj * gauss()))),
    y: Math.pow(10, Math.min(7.6, Math.max(0.2, sc + sj * gauss()))),
  })))

// 目标区域：低 κ（≤ 2）且高 σ（≥ 10⁴）
const region = { x0: 0.1, x1: 2, y0: 1e4, y1: 1e8 }
const hit = pointsInRegion(points, region)
// 只给彼此分得开的几个候选加标签（挑 4 个，避免在密集处文字压点）
;[0, 2, 3, 7].forEach((h, k) => { const i = hit[h]; if (i !== undefined) points[i].label = `P${k + 1}` })


const sup = (n: number) => [...String(n)].map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'['0123456789-'.indexOf(c)]).join('')

export const sigmaKappa = scatterSlide({
  name: 'σ–κ 散点',
  points,
  groups: [{ name: 'A 类' }, { name: 'B 类' }, { name: 'C 类' }],
  x: { domain: [0.1, 1000], type: 'log', label: String.raw`$\kappa$ (W m$^{-1}$ K$^{-1}$)`, tickFormat: (v) => String(v) },
  y: { domain: [1, 1e8], type: 'log', label: String.raw`$\sigma$ (S m$^{-1}$)`, tickFormat: (v) => `10${sup(Math.round(Math.log10(v)))}` },
  note: '示意数据，非真实测量',
  notes: '三类材料的电导率 σ 与热导率 κ 的示意点云。热电材料想要高 σ、低 κ，落在左上角的目标区域。数据为示意，不对应真实材料。',
  steps: [
    { caption: 'A 类：导电差，导热也不高', state: { groupsShown: 1 } },
    { caption: 'B 类：导电好一些，导热仍低', state: { groupsShown: 2 } },
    { caption: 'C 类：导电最好，但导热也最高', state: { groupsShown: 3 } },
    { caption: String.raw`目标：高 $\sigma$、低 $\kappa$`, state: { region } },
    { caption: '落在目标区域里的候选', state: { highlight: hit, labels: true } },
  ],
})
