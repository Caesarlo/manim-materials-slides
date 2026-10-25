import { nextTokenSlide } from '@/packs/llm/nextToken'
import { rounds } from './generate'

// 示意数据：同一组 logits，只改温度 T；概率与熵均由 softmax / 熵公式现算。
export const temperature = nextTokenSlide({
  name: '温度对比',
  rounds: [rounds[0]],
  showEntropy: true,
  note: '示意数据 · logits 为示意值',
  notes: '同一组 logits 除以温度 T 后再 softmax。T 小：高分者独占，熵接近 0；T 大：趋于均匀，熵趋近 log2(n)。n = 5 时上限约 2.32 bit。',
  steps: [
    { caption: String.raw`$T=1$：直接按 logits 做 softmax`, state: { temp: 1 } },
    { caption: String.raw`$T=0.5$：温度低，更确定，熵下降`, state: { temp: 0.5 } },
    { caption: String.raw`$T=2$：温度高，更发散，熵上升`, state: { temp: 2 } },
    { caption: String.raw`$T\to 0$：只剩 argmax，熵趋近 0`, state: { temp: 0.1 } },
  ],
})
