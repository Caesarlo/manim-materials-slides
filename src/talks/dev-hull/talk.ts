// 散点图 + 凸包图开发演讲：两页示范（示意数据，非真实测量/计算）
import type { Deck } from '@/runtime/deck'
import { sigmaKappa } from './slides/sigmaKappa'
import { hullDemo } from './slides/hullDemo'

export const talkTitle = '散点图 + 凸包图（开发）'

export function register(deck: Deck) {
  deck.slide(sigmaKappa)
  deck.slide(hullDemo)
}
