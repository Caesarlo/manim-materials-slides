// 能带 + 态密度图的开发演讲
import type { Deck } from '@/runtime/deck'
import { semiconductor, metal } from './slides/bands'

export const talkTitle = '开发：能带与态密度'

export function register(deck: Deck) {
  deck.slide(semiconductor)
  deck.slide(metal)
}
