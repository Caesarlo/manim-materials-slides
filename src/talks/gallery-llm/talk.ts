// 大模型组件画廊：词元 / 注意力 / 采样 / 架构块图 / Agent 回放 各一页示范，也是回归检查（npm run check -- --talk gallery-llm）。
// 所有数据均为示意（页面上有小注）；agent 页的消息数组字段名与 harness 线程一致，可换成真实导出的线程。
import type { Deck } from '@/runtime/deck'
import { tokensDemo } from './slides/tokensDemo'
import { attentionDemo } from './slides/attentionDemo'
import { generate } from './slides/generate'
import { temperature } from './slides/temperature'
import { decoderOnly } from './slides/decoderOnly'
import { transformerBlock } from './slides/transformerBlock'
import { researchSession } from './slides/researchSession'

export const talkTitle = '大模型组件画廊'

export function register(deck: Deck) {
  // 词元 / 注意力
  deck.slide(tokensDemo)
  deck.slide(attentionDemo)
  // 自回归采样 / 温度
  deck.slide(generate)
  deck.slide(temperature)
  // 模型架构
  deck.slide(decoderOnly)
  deck.slide(transformerBlock)
  // Agent 编排回放
  deck.slide(researchSession)
}
