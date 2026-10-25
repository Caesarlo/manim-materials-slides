// 能带 + 态密度示范页（玩具能带，示意）。
import { bandSlide } from '@/packs/plot/bandChart'
import { toyMetal, toySemiconductor } from '../toyBands'

export const semiconductor = bandSlide({
  name: '能带：半导体',
  data: toySemiconductor,
  note: '示意能带',
  notes: '玩具能带（余弦形），不是真实材料的计算结果。价带顶在 Γ，导带底在 X，间接带隙 0.80 eV。',
  steps: [
    { caption: String.raw`沿 $\Gamma$–X–M–$\Gamma$ 路径的能带`, state: { bands: true } },
    { caption: String.raw`费米能级 $E_F$ 落在两簇能带之间`, state: { fermi: true } },
    { caption: '价带顶与导带底错开：间接带隙', state: { gap: true } },
    { caption: '态密度：带隙里没有态', state: { dos: true } },
  ],
})

export const metal = bandSlide({
  name: '能带：金属对比',
  data: toyMetal,
  note: '示意能带',
  notes: '玩具能带，示意。一条能带穿过费米能级 → 金属，没有带隙，费米能级处态密度不为零。',
  steps: [
    { caption: '另一种材料的能带', state: { bands: true, fermi: true } },
    { caption: String.raw`一条能带穿过 $E_F$：没有带隙`, state: { focusBand: 1 } },
    { caption: String.raw`态密度在 $E_F$ 处不为零：金属`, state: { dos: true, focusBand: null } },
  ],
})
