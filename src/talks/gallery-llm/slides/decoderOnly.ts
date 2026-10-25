import { blockSlide } from '@/packs/llm/blockDiagram'

const BTd = String.raw`$B\times T\times d$`

export const decoderOnly = blockSlide({
  name: 'Decoder-only 整体流程',
  direction: 'row',
  blocks: [
    { id: 'in', label: '输入词元', kind: 'io', shape: String.raw`$B\times T$` },
    { id: 'emb', label: '嵌入', kind: 'embed', shape: BTd },
    { id: 'attn', label: '注意力', kind: 'attn', shape: BTd, group: 'layer' },
    { id: 'ffn', label: '前馈', kind: 'ffn', shape: BTd, group: 'layer' },
    { id: 'head', label: '输出头', kind: 'head', shape: String.raw`$B\times T\times V$` },
    { id: 'out', label: '输出概率', kind: 'io', shape: String.raw`$B\times T\times V$` },
  ],
  steps: [
    { caption: '输入是一串词元', state: { shown: 1, active: 0 } },
    { caption: '嵌入：把词元变成向量', state: { shown: 2, active: 1 } },
    { caption: '注意力：看前文，决定关注谁', state: { shown: 3, active: 2 } },
    { caption: '前馈：逐位置做非线性变换', state: { shown: 4, active: 3 } },
    { caption: '输出头：映射回词表', state: { shown: 5, active: 4 } },
    { caption: '得到下一个词元的概率', state: { shown: 6, active: 5 } },
    { caption: String.raw`注意力和前馈合成一层，重复 $N$ 次`, state: { active: null, group: true } },
  ],
  notes: '结构示意：B 批大小，T 序列长度，d 隐藏维度，V 词表大小。真实模型还有归一化、位置编码等细节，见下一页。',
  note: '结构示意',
})
