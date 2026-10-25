// 开发演讲：筛选漏斗 + XRD 谱。全部为示意数据，不是真实测量/计算结果。
import type { Deck } from '@/runtime/deck'
import { funnel } from './slides/funnel'
import { xrd } from './slides/xrd'

export const talkTitle = '图表套件：漏斗与 XRD'

export function register(deck: Deck) {
  deck.slide(funnel)
  deck.slide(xrd)
}
