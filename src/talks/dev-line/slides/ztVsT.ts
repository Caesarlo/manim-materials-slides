// zT–T：三种材料（泛称 A/B/C）的热电优值随温度变化。
// 数据【示意】：由下面的平滑函数生成（单峰、左右宽度不同的高斯形），不是任何真实材料的测量或计算结果。
import { lineChartSlide, type LineSeries } from '@/packs/plot/lineChart'

/** 示意曲线：峰位 Tp(K)、峰高 zmax、左/右宽度 */
function bump(Tp: number, zmax: number, wl: number, wr: number): [number, number][] {
  const pts: [number, number][] = []
  for (let T = 300; T <= 800; T += 10) {
    const w = T < Tp ? wl : wr
    pts.push([T, zmax * Math.exp(-(((T - Tp) / w) ** 2))])
  }
  return pts
}

const series: LineSeries[] = [
  { name: '材料 A', points: bump(680, 0.8, 260, 260) },
  { name: '材料 B', points: bump(700, 1.4, 260, 220) },
  { name: '材料 C', points: bump(440, 1.0, 150, 170) },
]

export const ztVsT = lineChartSlide({
  name: 'zT–T 曲线',
  series,
  x: { domain: [300, 800], label: '$T$ (K)', ticks: [300, 400, 500, 600, 700, 800] },
  y: { domain: [0, 1.6], label: '$zT$', ticks: [0, 0.4, 0.8, 1.2, 1.6] },
  note: '示意数据',
  notes: '三条 zT–T 曲线均为光滑函数生成的示意数据，A/B/C 是泛称，不对应具体材料。',
  peakLabel: (_s, p) => String.raw`$zT_{\max}$ = ${p[1].toFixed(1)}`,
  steps: [
    { caption: '材料 A 的 $zT$ 随温度先升后降', state: { shown: 1 } },
    { caption: '再看材料 B', state: { shown: 2 } },
    { caption: '以及材料 C', state: { shown: 3 } },
    { caption: '每条曲线都有自己的峰值', state: { peaks: true } },
    { caption: '峰值最高的是材料 B', state: { focus: 1 } },
  ],
})
