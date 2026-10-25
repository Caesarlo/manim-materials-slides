// Bi2Te3：标签 + 图例 → 晶格矢量 → 高亮 Bi → 按层聚焦一个五重层。
import { crystalSlide } from '@/packs/materials/crystalSlide'
import { Bi2Te3_opts } from '@/packs/materials/presets'
import { Bi2Te3 } from '@/talks/example/data/bi2te3'

const T = String.raw

export const bi2te3Slide = crystalSlide({
  name: 'Bi₂Te₃ 层与高亮',
  crystal: Bi2Te3,
  options: Bi2Te3_opts,
  orientation: [0, Math.PI / 2, 0], // c 轴（30 Å）横过画面
  legend: true,
  notes: 'Bi2Te3 六方晶胞含 3 个五重层（z≈0.21–0.46 为其中一个）。步骤：标签 → 晶格矢量 → 高亮 Bi → 按层聚焦。',
  steps: [
    { caption: T`$\mathrm{Bi_2Te_3}$：Bi、Te 各标一个代表原子`, show: { cell: 1, atoms: 1 }, labels: 1, fly: { dir: [0.5, -1, 0.45], zoom: 1.75 } },
    { caption: T`$c$ 轴最长（约 30 Å），层沿 $c$ 堆叠`, axes: 1 },
    { caption: T`点名强调 Bi`, highlight: { els: ['Bi'] } },
    { caption: T`聚焦一个五重层：Te–Bi–Te–Bi–Te`, show: { bonds: 1, polyhedra: 1 }, highlight: null, axes: 0, layer: { axis: 'z', from: 0.2, to: 0.47 }, fly: { dir: [0, -1, 0.05], zoom: 1.75 } },
  ],
})
