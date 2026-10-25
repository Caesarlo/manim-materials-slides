// SrTiO3：标签 + 图例 → 晶格矢量 → 高亮 Ti；另有一页 2×2×1 超胞。
import { crystalSlide } from '@/packs/materials/crystalSlide'
import { SrTiO3_opts } from '@/packs/materials/presets'
import { SrTiO3 } from '@/talks/example/data/srtio3'

const T = String.raw

export const srtio3Slide = crystalSlide({
  name: 'SrTiO₃ 标签与矢量',
  crystal: SrTiO3,
  options: SrTiO3_opts,
  legend: true,
  notes: '步骤：元素标签 + 图例 → 晶格矢量 a、b、c → 点名强调体心的 Ti（其余不变暗）。',
  steps: [
    { caption: T`$\mathrm{SrTiO_3}$ 晶胞：Sr、Ti、O 各标一个代表原子`, show: { cell: 1, atoms: 1 }, labels: 1, fly: { dir: [1, 0.6, 0.3], zoom: 1.0 } },
    { caption: T`晶格矢量 $a$、$b$、$c$ 从原点出发`, axes: 1 },
    { caption: T`点名强调体心的 Ti，其余原子不变暗`, show: { bonds: 1 }, highlight: { els: ['Ti'] } },
  ],
})

export const srtio3SupercellSlide = crystalSlide({
  name: 'SrTiO₃ 超胞 2×2×1',
  crystal: SrTiO3,
  options: { ...SrTiO3_opts, repeat: [2, 2, 1] },
  legend: true,
  notes: 'repeat: [2,2,1]：a、b 方向各重复两次，Ti 数量 4，TiO6 八面体 4 个；相机距离按超胞自动适配。',
  steps: [
    { caption: T`超胞 $2\times2\times1$：4 个 Ti`, show: { cell: 1, atoms: 1 }, labels: 1 },
    { caption: T`4 个 $\mathrm{TiO_6}$ 八面体共顶点连成层`, show: { bonds: 1, polyhedra: 1 }, dim: ['Sr'] },
    { caption: T`矢量仍是单个晶胞的 $a$、$b$、$c$`, axes: 1, dim: [] },
  ],
})
