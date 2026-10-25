// 从 CSV 到折线图的完整链路：
//   tools/samples/zT_vs_T.csv --(uv run tools/csv_to_ts.py)--> data/zt.ts --(fromColumnTable)--> 折线图
// 数据【示意】（CSV 文件头的注释已写明）。C 在 550 K 故意留空：缺失点被跳过，曲线不会掉到 0。
import { fromColumnTable, lineChartSlide } from '@/packs/plot/lineChart'
import { zTData } from '../data/zt'

export const fromCsv = lineChartSlide({
  name: '来自 CSV 的 zT',
  series: fromColumnTable(zTData),
  x: { domain: [300, 800], label: '$T$ (K)', ticks: [300, 400, 500, 600, 700, 800] },
  y: { domain: [0, 1], label: '$zT$', ticks: [0, 0.25, 0.5, 0.75, 1] },
  note: '示意数据',
  notes: '数据由 tools/csv_to_ts.py 从 CSV 生成，再经 fromColumnTable 转成折线图的系列。C 在 550 K 缺一个点，被自动跳过。',
  steps: [
    { caption: '数据直接来自一份 CSV', state: { shown: 1 } },
    { caption: '再读入另外两列', state: { shown: 3 } },
    { caption: '缺失的点会被跳过，曲线照常连接', state: { focus: 2 } },
  ],
})
