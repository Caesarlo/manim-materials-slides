import { makeTokenizer } from '@/packs/llm/tokenize'
import { tokenStripSlide } from '@/packs/llm/tokenStrip'

// 玩具词表（示意）：词首带前导空格，lat+tice、relax+ed 是子词。
export const toyVocab = ['The', ' lat', 'tice', ' was', ' stable', ' because', ' it', ' relax', 'ed']

export const tokensDemo = tokenStripSlide({
  name: '分词',
  text: 'The lattice was stable because it relaxed',
  tokenizer: makeTokenizer(toyVocab),
  steps: [
    { caption: '模型看到的是一整串字符', state: { split: false } },
    { caption: '先切成词元：常见的词是一块，生僻的词拆成子词', state: { split: true } },
    { caption: '每个词元对应词表里的一个编号', state: { ids: true } },
    { caption: '一个词拆成两个子词，各有各的编号', state: { focus: 2 } },
  ],
  note: '玩具分词器，词表为示意',
  notes: '贪心最长匹配；词表和编号都是示意，不对应任何真实模型。',
})
