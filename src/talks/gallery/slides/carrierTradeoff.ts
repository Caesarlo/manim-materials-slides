// 载流子浓度的取舍：S 随 n 增大而降，σ 随 n 增大而升，功率因子 S²σ 在中间有峰。
// 数据【示意】：由简单的 Logistic 解析式生成并各自归一化，不是任何真实材料的数据。
import { lineChartSlide, type LineSeries } from '@/packs/plot/lineChart'

const U0 = 18, U1 = 22, N = 161 // lg n 从 18 到 22

const S_RAW = (u: number) => 1 / (1 + Math.exp(1.6 * (u - 19.6)))   // 随 n 增大而降
const SIGMA_RAW = (u: number) => 1 / (1 + Math.exp(-1.6 * (u - 20.4))) // 随 n 增大而升

function curve(f: (u: number) => number): [number, number][] {
  const raw = Array.from({ length: N }, (_, i) => {
    const u = U0 + ((U1 - U0) * i) / (N - 1)
    return [Math.pow(10, u), f(u)] as [number, number]
  })
  const max = Math.max(...raw.map((p) => p[1]))
  return raw.map(([x, y]) => [x, y / max])
}

const series: LineSeries[] = [
  { name: '$S$', points: curve(S_RAW), peak: false },
  { name: '$\\sigma$', points: curve(SIGMA_RAW), peak: false },
  { name: '$S^2\\sigma$', points: curve((u) => S_RAW(u) ** 2 * SIGMA_RAW(u)) },
]

export const carrierTradeoff = lineChartSlide({
  name: '载流子浓度的取舍',
  series,
  x: { domain: [1e18, 1e22], type: 'log', label: '$n$ (cm$^{-3}$)' },
  y: { domain: [0, 1.2], label: '归一化数值', ticks: [0, 0.5, 1] },
  note: '归一化，示意数据',
  notes: '三条曲线均由 Logistic 解析式生成并各自归一化到最大值 1，仅示意趋势。',
  peakLabel: () => String.raw`最优浓度`,
  steps: [
    { caption: '载流子越多，塞贝克系数 $S$ 越小', state: { shown: 1 } },
    { caption: '但电导率 $\\sigma$ 越大', state: { shown: 2 } },
    { caption: '功率因子 $S^2\\sigma$ 是两者的乘积', state: { shown: 3 } },
    { caption: '最优浓度在中间', state: { focus: 2, peaks: true } },
  ],
})
