// 柱状图示范（同时是新图表的最小参考实现，见 packs/plot/barChart.ts）。数据为示意。
import { barSlide } from '@/packs/plot/barChart'

export const barDemo = barSlide({
  name: '柱状图',
  items: [
    { label: '材料 A', value: 3.2 },
    { label: '材料 B', value: 7.1 },
    { label: '材料 C', value: 5.4 },
    { label: '材料 D', value: 4.0 },
  ],
  note: '示意数据',
  notes: '柱状图：逐根出现，最后聚焦最大的一根，其余压暗。它也是写新图表时照抄的最小参考实现。',
  steps: [
    { caption: '先看材料 A', state: { shown: 1 } },
    { caption: '再依次加入 B、C、D', state: { shown: 4 } },
    { caption: '聚焦最大的材料 B', state: { focus: 1 } },
  ],
})
