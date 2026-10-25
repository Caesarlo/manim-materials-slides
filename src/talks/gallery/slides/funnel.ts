import { funnelSlide } from '@/packs/plot/funnel'

// 示意数据：各级数量为演示用，并非真实筛选结果。
export const funnel = funnelSlide({
  name: '筛选漏斗',
  stages: [
    { label: '候选库', count: 100000 },
    { label: '热力学稳定', count: 8000 },
    { label: '有合适带隙', count: 1200 },
    { label: '低热导', count: 150 },
    { label: '可合成', count: 40 },
    { label: '入选', count: 12 },
  ],
  steps: [
    { caption: '从十万个候选结构出发', state: { shown: 1 } },
    { caption: '先保留热力学稳定的', state: { shown: 2 } },
    { caption: String.raw`再要求有合适的带隙 $E_g$`, state: { shown: 3 } },
    { caption: String.raw`低晶格热导 $\kappa_L$ 又去掉一大半`, state: { shown: 4 } },
    { caption: '能合成出来的所剩无几', state: { shown: 5 } },
    { caption: '最终入选 12 个，交给实验', state: { shown: 6, focusLast: true } },
  ],
  notes: '漏斗宽度按 log10(数量) 线性映射，所以每缩小一个数量级宽度等量减少。数字为示意。',
  note: '示意数据',
})
