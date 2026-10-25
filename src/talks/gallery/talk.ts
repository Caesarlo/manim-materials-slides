// 组件画廊：把图表套件和晶体增强的每个组件各放一页，既是文档，也是回归检查（npm run check -- --talk gallery）。
// 所有示例数据均为示意数据，页面上都有小注。新增组件后在这里加一页示范。
import type { Deck } from '@/runtime/deck'
import { ztVsT } from './slides/ztVsT'
import { fromCsv } from './slides/fromCsv'
import { carrierTradeoff } from './slides/carrierTradeoff'
import { semiconductor, metal } from './slides/bands'
import { sigmaKappa } from './slides/sigmaKappa'
import { hullDemo } from './slides/hullDemo'
import { funnel } from './slides/funnel'
import { xrd } from './slides/xrd'
import { srtio3Slide, srtio3SupercellSlide } from './slides/srtio3'
import { bi2te3Slide } from './slides/bi2te3'
import { srtio3Gnn } from './slides/srtio3Gnn'

export const talkTitle = '组件画廊'

export function register(deck: Deck) {
  // 折线图
  deck.slide(ztVsT)
  deck.slide(fromCsv)
  deck.slide(carrierTradeoff)
  // 能带 + 态密度
  deck.slide(semiconductor)
  deck.slide(metal)
  // 散点图 / 相图凸包
  deck.slide(sigmaKappa)
  deck.slide(hullDemo)
  // 筛选漏斗 / XRD 谱
  deck.slide(funnel)
  deck.slide(xrd)
  // 3D 晶体：标签 + 图例 + 晶格矢量 + 高亮 / 按层聚焦 / 超胞
  deck.slide(srtio3Slide)
  deck.slide(bi2te3Slide)
  deck.slide(srtio3SupercellSlide)
  // 晶体 → 图 → GNN 消息传递
  deck.slide(srtio3Gnn)
}
