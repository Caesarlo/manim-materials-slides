// 折线图开发演讲：两页示范（示意数据，非真实测量）
import type { Deck } from '@/runtime/deck'
import { ztVsT } from './slides/ztVsT'
import { carrierTradeoff } from './slides/carrierTradeoff'

export const talkTitle = '折线图套件（开发）'

export function register(deck: Deck) {
  deck.slide(ztVsT)
  deck.slide(carrierTradeoff)
}
