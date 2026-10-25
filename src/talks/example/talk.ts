// 一场演讲 = 幻灯片的注册顺序。新增一页：写一个 SlideDef（或用 crystalSlide 等工厂），在 register() 里 deck.slide(...)。
// 新建一场演讲：复制整个 talks/example/ 目录改名，然后用 ?talk=新名字 打开。
import type { Deck } from '@/runtime/deck'
import { crystalSlide } from '@/packs/materials/crystalSlide'
import { Bi2Te3_opts, SrTiO3_opts } from '@/packs/materials/presets'
import { SrTiO3 } from './data/srtio3'
import { Bi2Te3 } from './data/bi2te3'
import { title } from './slides/title'
import { formula } from './slides/formula'
import { attention } from './slides/attention'

export const talkTitle = '大模型 × 材料'

export function register(deck: Deck) {
  deck.slide(title)
  deck.slide(formula)
  deck.slide(attention)

  deck.slide(crystalSlide({
    name: 'SrTiO₃ 钙钛矿',
    crystal: SrTiO3,
    options: SrTiO3_opts,
    notes: '立方钙钛矿：Sr 在角上，Ti 在体心，O 在面心。Ti 与 6 个 O 组成八面体。',
    steps: [
      { caption: 'SrTiO₃ 晶胞', show: { cell: 1, atoms: 1 } },
      { caption: 'Ti–O 成键', show: { bonds: 1 } },
      { caption: 'TiO₆ 八面体', show: { polyhedra: 1, cell: 0 }, dim: ['Sr'], fly: { dir: [1, 0.8, 0.5], zoom: 1.45 } },
      { caption: '沿 c 轴俯视', show: { cell: 1 }, dim: [], fly: { dir: [0.001, 0.001, 1], zoom: 1 } },
    ],
  }))

  deck.slide(crystalSlide({
    name: 'Bi₂Te₃ 层状结构',
    crystal: Bi2Te3,
    options: Bi2Te3_opts,
    orientation: [0, Math.PI / 2, 0], // c 轴（30 Å）横过画面，层状结构铺满宽度
    notes: 'Bi₂Te₃ 是经典热电材料：Te–Bi–Te–Bi–Te 五层为一组（五重层），层间靠范德华力结合。',
    steps: [
      { caption: 'Bi₂Te₃ 六方晶胞', show: { cell: 1, atoms: 1 }, fly: { dir: [0.5, -1, 0.45], zoom: 1.75 } },
      { caption: 'BiTe₆ 八面体', show: { bonds: 1, polyhedra: 1 } },
      { caption: '五层一组，层间是范德华间隙', fly: { dir: [0, -1, 0.05], zoom: 1.75 } },
    ],
  }))
}
