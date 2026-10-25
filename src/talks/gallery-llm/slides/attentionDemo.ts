import { attention, qkFromTokens } from '@/packs/llm/attentionMath'
import { attentionMapSlide } from '@/packs/llm/attentionMap'
import { makeTokenizer } from '@/packs/llm/tokenize'
import { toyVocab } from './tokensDemo'

// 权重是真算出来的：随机小模型（哈希伪随机向量）→ softmax(QKᵀ/√d)。
const { tokens } = makeTokenizer(toyVocab).encode('The lattice was stable because it relaxed')
const { Q, K } = qkFromTokens(tokens, 16, 7)
const full = attention(Q, K)
const causal = attention(Q, K, { causal: true })

export const attentionDemo = attentionMapSlide({
  name: '注意力热图',
  tokens,
  weights: full,
  causalWeights: causal,
  steps: [
    { caption: '行是查询词元，列是被查询的词元', state: { rowsShown: 1 } },
    { caption: String.raw`每一行都是 $\mathrm{softmax}(QK^\top/\sqrt{d})$，和为 1`, state: { rowsShown: tokens.length } },
    { caption: '聚焦一行：它把注意力分给了谁', state: { focusRow: 6 } },
    { caption: '因果掩码：不能看未来，每行重新归一化', state: { focusRow: null, masked: true } },
  ],
  note: '随机小模型的注意力，非真实模型输出',
  notes: '权重由 qkFromTokens(种子 7, d=16) 与 attention 真实计算得到，不是手填。',
})
