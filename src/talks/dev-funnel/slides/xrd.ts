import { xrdSlide } from '@/packs/plot/xrdChart'
import type { XrdPeak } from '@/packs/plot/xrdMath'

// 示意数据：峰位 / 强度 / hkl 为手写演示值，不对应任何真实材料；实验谱是在计算谱基础上手动平移并加宽。
const calc: XrdPeak[] = [
  { twoTheta: 28.4, intensity: 100, hkl: '111' },
  { twoTheta: 32.9, intensity: 28, hkl: '200' },
  { twoTheta: 47.3, intensity: 62, hkl: '220' },
  { twoTheta: 56.1, intensity: 45, hkl: '311' },
  { twoTheta: 58.8, intensity: 9, hkl: '222' },
  { twoTheta: 69.2, intensity: 14, hkl: '400' },
  { twoTheta: 76.4, intensity: 22, hkl: '331' },
  { twoTheta: 78.7, intensity: 12, hkl: '420' },
]
const shift = [0.3, 0.2, 0.35, 0.25, 0.3, 0.4, 0.3, 0.35]
const gain = [0.9, 1.2, 0.8, 1.1, 1.3, 0.9, 1, 1.1]
const expt: XrdPeak[] = calc.map((p, i) => ({ twoTheta: p.twoTheta + shift[i], intensity: p.intensity * gain[i] }))

export const xrd = xrdSlide({
  name: 'XRD 谱',
  patterns: [
    { name: '计算谱', peaks: calc, fwhm: 0.5 },
    { name: '实验谱', peaks: expt, fwhm: 1.1 },
  ],
  steps: [
    { caption: '每个晶面给出一条衍射线：位置与强度', state: { sticks: true } },
    { caption: '有限的峰宽把竖线展成连续的谱', state: { curve: true } },
    { caption: '标出最强峰对应的晶面 $(hkl)$', state: { hkl: true } },
    { caption: '与实验谱对比：峰位略有偏移，峰更宽', state: { compare: true, hkl: false } },
  ],
  notes: '展宽用高斯，FWHM 与 σ 的关系为 FWHM = 2√(2 ln 2)·σ，每个峰面积正比于强度。数据为示意。',
  note: '示意数据',
})
