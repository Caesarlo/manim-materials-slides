import { nextTokenSlide, type Round } from '@/packs/llm/nextToken'

// 示意数据：logits 为手写的示意值，不是任何真实模型的输出；概率由 softmax 现算。
export const rounds: Round[] = [
  {
    prefix: ['The', 'lattice', 'was'],
    candidates: [
      { label: 'stable', logit: 3.0 },
      { label: 'unstable', logit: 1.6 },
      { label: 'metallic', logit: 1.0 },
      { label: 'cubic', logit: 0.4 },
      { label: 'cracked', logit: -0.5 },
    ],
    chosen: 0,
  },
  {
    prefix: ['The', 'lattice', 'was', 'stable'],
    candidates: [
      { label: 'at', logit: 2.6 },
      { label: 'under', logit: 1.8 },
      { label: 'up', logit: 1.2 },
      { label: 'and', logit: 0.9 },
      { label: 'only', logit: -0.2 },
    ],
    chosen: 0,
  },
  {
    prefix: ['The', 'lattice', 'was', 'stable', 'at'],
    candidates: [
      { label: 'room', logit: 2.2 },
      { label: 'high', logit: 1.9 },
      { label: 'low', logit: 1.0 },
      { label: 'ambient', logit: 0.8 },
      { label: 'every', logit: -0.4 },
    ],
    chosen: 0,
  },
  {
    prefix: ['The', 'lattice', 'was', 'stable', 'at', 'room'],
    candidates: [
      { label: 'temperature', logit: 4.0 },
      { label: 'pressure', logit: 1.2 },
      { label: 'conditions', logit: 0.9 },
      { label: 'light', logit: -0.5 },
      { label: 'air', logit: -1.0 },
    ],
    chosen: 0,
  },
]

export const generate = nextTokenSlide({
  name: '逐词生成',
  rounds,
  note: '示意数据 · logits 为示意值',
  notes: '自回归生成：每一轮模型对词表给出 logits，经 softmax 变成概率，再按某种规则选出一个词元追加到前缀，然后重复。这里的 logits 是手写的示意值，概率由 softmax 实时计算。',
  steps: [
    { caption: '给定前缀，模型给每个候选词元打分', state: { round: 0, phase: 'dist' } },
    { caption: '选中 stable，追加到前缀', state: { phase: 'pick' } },
    { caption: '前缀变长，再算一次下一个词元的分布', state: { round: 1, phase: 'dist' } },
    { caption: '选中 at', state: { phase: 'pick' } },
    { caption: '分布变得更分散：high 与 room 不相上下', state: { round: 2, phase: 'dist' } },
    { caption: '这次选中 room', state: { phase: 'pick' } },
    { caption: 'room 之后几乎只会接 temperature', state: { round: 3, phase: 'dist' } },
    { caption: '词元一个接一个，这就是自回归', state: { phase: 'pick' } },
  ],
})
