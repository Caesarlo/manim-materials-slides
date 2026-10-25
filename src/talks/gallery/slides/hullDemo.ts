// 凸包页：二元体系 A–B 的形成能凸包。数据是示意（手算好的小例子），不是某个真实体系的计算结果。
import { hullSlide } from '@/packs/plot/hullChart'

// 点的顺序 = 出现顺序。凸包：(0,0) → AB(0.5,-0.4) → A B₃(0.75,-0.3) → (1,0)
//   A₃B(0.25,-0.1) 在 (0,0)–(0.5,-0.4) 连线(-0.2)之上 → Ehull = 0.10
//   AB₂(0.6,-0.2)   凸包在 0.6 处 = -0.36 → Ehull = 0.16
//   A₂B(0.35, -0.2)  凸包在 0.35 处 = -0.28 → Ehull = 0.08
const points = [
  { x: 0.5, e: -0.4, label: 'AB' },
  { x: 0.25, e: -0.1, label: 'A$_3$B' },
  { x: 0.75, e: -0.3, label: 'AB$_3$' },
  { x: 0.35, e: -0.2, label: 'A$_2$B' },
  { x: 0.6, e: -0.2, label: 'AB$_2$' },
]

export const hullDemo = hullSlide({
  name: '形成能凸包',
  points,
  note: '示意数据，非真实计算',
  notes: '凸包上的点是稳定相；凸包上方的点会分解成凸包上相邻的两相，竖直距离 Ehull 越大越不稳定。数据为示意。',
  steps: [
    { caption: '一个化合物一个点：成分与形成能', state: { shown: 1 } },
    { caption: '再加几个化合物', state: { shown: 3 } },
    { caption: '全部候选', state: { shown: 5 } },
    { caption: '把最低的点连起来：凸包', state: { hull: true } },
    { caption: '空心点在凸包之上：离凸包越远越不稳定', state: { drops: true } },
    { caption: '最稳定的化合物：AB', state: { focus: 0 } },
  ],
})
