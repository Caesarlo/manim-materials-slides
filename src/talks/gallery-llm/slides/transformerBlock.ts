import { blockSlide } from '@/packs/llm/blockDiagram'

const BTd = String.raw`$B\times T\times d$`

export const transformerBlock = blockSlide({
  name: '单个 Transformer 块',
  direction: 'column',
  blocks: [
    { id: 'ln1', label: 'LayerNorm', kind: 'norm', shape: BTd },
    { id: 'attn', label: '多头注意力', kind: 'attn', shape: BTd },
    { id: 'add1', label: '相加', kind: 'add', shape: BTd },
    { id: 'ln2', label: 'LayerNorm', kind: 'norm', shape: BTd },
    { id: 'ffn', label: '前馈', kind: 'ffn', shape: BTd },
    { id: 'add2', label: '相加', kind: 'add', shape: BTd },
  ],
  residuals: [
    { from: 'ln1', to: 'attn', label: '残差' },
    { from: 'ln2', to: 'ffn', label: '残差' },
  ],
  steps: [
    { caption: '先做层归一化，稳住数值尺度', state: { shown: 1, active: 0 } },
    { caption: '多头注意力：看前文，决定关注谁', state: { shown: 2, active: 1 } },
    { caption: '把注意力的输出加回去', state: { shown: 3, active: 2 } },
    { caption: '再归一化一次', state: { shown: 4, active: 3 } },
    { caption: '前馈：逐位置做非线性变换', state: { shown: 5, active: 4 } },
    { caption: '再加回去，得到这一层的输出', state: { shown: 6, active: 5 } },
    { caption: '第一条残差：绕过注意力，原样送到相加处', state: { active: null, residuals: 1 } },
    { caption: '第二条绕过前馈：残差保留原信息', state: { residuals: 2 } },
  ],
  notes: '结构示意：这里画的是 Pre-LN 排布；B 批大小，T 序列长度，d 隐藏维度。',
  note: '结构示意',
})
