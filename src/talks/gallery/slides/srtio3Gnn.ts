// SrTiO₃：球棍模型 → 图 → 消息传递（Ti 的 0/1 轮，再换 O 看 2 轮）。
// 图的边 = TiO₆ 里的 6 根 Ti–O 键；Sr 与八面体不成键，在这张图里是孤立点。
import { crystalSlide } from '@/packs/materials/crystalSlide'
import { SrTiO3_opts } from '@/packs/materials/presets'
import { SrTiO3 } from '@/talks/example/data/srtio3'

const T = String.raw

export const srtio3Gnn = crystalSlide({
  name: 'SrTiO₃ 晶体图与消息传递',
  crystal: SrTiO3,
  options: SrTiO3_opts,
  legend: true,
  notes: '步骤：球棍 → 图（nodes）→ Ti 为中心 0 轮 → 1 轮（6 个 O）→ 换 O 为中心 1 轮（只有 Ti）→ 2 轮（经 Ti 看到另外 5 个 O）。',
  steps: [
    { caption: T`球棍模型：原子是球，键是棍`, show: { cell: 1, atoms: 1, bonds: 1 }, fly: { dir: [1, 0.6, 0.35], zoom: 1.0 } },
    { caption: T`晶体 = 图：原子是节点，键是边`, nodes: 1 },
    { caption: T`第 0 轮：每个原子只知道自己`, gnn: { center: 'Ti', hops: 0 } },
    { caption: T`第 1 轮：Ti 收到 6 个相邻 O 的消息`, gnn: { center: 'Ti', hops: 1 } },
    { caption: T`换成 O 看：第 1 轮它只认识 Ti`, gnn: { center: 'O', hops: 1 } },
    { caption: T`第 2 轮：经 Ti 看到另外 5 个 O，感受野扩大`, gnn: { center: 'O', hops: 2 } },
  ],
})
