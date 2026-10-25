// 声明式晶体页：每一步只写“要显示什么、聚焦谁、相机去哪”，后面的步骤自动继承前面的设置，
// 所以跳转/回退时合并 1..step 的设置即可得到与逐步点击完全一致的画面（满足 enter 的幂等要求）。
//
//   crystalSlide({
//     name: 'SrTiO3', crystal: SrTiO3, options: SrTiO3_opts,
//     steps: [
//       { caption: '晶胞', show: { cell: 1, atoms: 1 } },
//       { caption: '成键', show: { bonds: 1 } },
//       { caption: '八面体', show: { polyhedra: 1 }, dim: ['Sr'], fly: { dir: [1, 0.5, 1], zoom: 1.5 } },
//       // 以下都可在步骤里声明，同样“后面继承前面”；null 表示取消：
//       { caption: '标签与晶格矢量', labels: 1, axes: 1 },                       // 元素标签 / a b c 箭头（0..1）
//       { caption: '强调 Ti', highlight: { els: ['Ti'] } },                      // 放大 1.25 倍 + 描边，其余不变暗
//       { caption: '一个五重层', layer: { axis: 'z', from: 0.2, to: 0.47 } },     // 区间外压暗到 0.1
//     ],
//     legend: true,                                                              // 左下角元素图例（随 dim 变淡）
//   })
import { build, type BuildOptions, type Crystal, type LayerSpec, type Vec3 } from './structure'
import { elementsOf, type HighlightSpec } from './labels'
import { palette } from '@/runtime/palette'
import { CrystalView, type Parts } from './CrystalView'
import { captions, show as reveal } from '@/runtime/reveal'
import type { SlideDef } from '@/runtime/types'

export interface CrystalStep {
  caption: string
  show?: Partial<Record<Parts, number>>
  /** 压暗这些元素；[] 表示全部恢复；省略表示沿用上一步 */
  dim?: string[]
  fly?: { dir?: Vec3; target?: Vec3; zoom?: number }
  /** 元素标签可见度 0..1（默认 0）；每种元素标一个代表原子 */
  labels?: number
  /** 只给这些元素标标签；省略沿用上一步，缺省 = 全部元素 */
  labelFor?: string[]
  /** a、b、c 晶格矢量箭头可见度 0..1（默认 0） */
  axes?: number
  /** 点名强调这些原子（放大 + 描边，其余不变暗）；null 取消；省略沿用上一步 */
  highlight?: HighlightSpec | null
  /** 按层聚焦：沿晶格矢量方向（x=a, y=b, z=c）的分数坐标区间（按整个超胞归一化），区间外压暗到 0.1；null 取消 */
  layer?: LayerSpec | null
}

export interface CrystalSlideDef {
  name: string
  crystal: Crystal
  options?: BuildOptions
  steps: CrystalStep[]
  heading?: string
  notes?: string
  /** 整体旋转模型（弧度，欧拉角 XYZ）。层状/细长晶胞转 90° 让长轴横过画面 */
  orientation?: Vec3
  /** 左下角元素图例（色点 + 元素符号），随 dim 同步变淡 */
  legend?: boolean
}

export function crystalSlide(def: CrystalSlideDef): SlideDef {
  return {
    name: def.name,
    steps: def.steps.length,
    notes: def.notes,
    interactive: true,
    mount(frame, { esc }) {
      frame.innerHTML = `
        <div class="view3d"></div>
        ${def.heading ? `<h2 class="deck-heading">${esc(def.heading)}</h2>` : ''}
        ${captions(def.steps.map((s) => s.caption), esc)}`
      const built = build(def.crystal, def.options)
      const view = new CrystalView(frame.querySelector('.view3d')!, built, { orientation: def.orientation })
      let legend: Map<string, HTMLElement> | null = null
      if (def.legend) {
        const box = document.createElement('div')
        box.className = 'crystal-legend'
        box.style.cssText = 'position:absolute;left:calc(var(--u) * 3);bottom:calc(var(--u) * 9);display:grid;gap:calc(var(--u) * 0.8);font-size:var(--t-body);font-weight:600;pointer-events:none;'
        legend = new Map()
        for (const el of elementsOf(built)) {
          const row = document.createElement('div')
          row.style.cssText = 'display:flex;align-items:center;gap:calc(var(--u) * 1);transition:opacity .4s ease;'
          row.innerHTML = `<span style="width:calc(var(--u) * 1.8);height:calc(var(--u) * 1.8);border-radius:50%;background:${palette.cpk[el] ?? palette.muted}"></span><span>${esc(el)}</span>`
          box.append(row)
          legend.set(el, row)
        }
        frame.append(box)
      }
      view.show({ cell: 0, atoms: 0, bonds: 0, polyhedra: 0 })
      view.snap()

      return {
        enter(step, animate) {
          const upto = def.steps.slice(0, step)
          const parts: Partial<Record<Parts, number>> = {}
          let dim: string[] = []
          let fly: CrystalStep['fly'] = {}
          let labels = 0, axes = 0
          let labelFor: string[] | undefined
          let highlight: HighlightSpec | null = null
          let layer: LayerSpec | null = null
          for (const s of upto) {
            Object.assign(parts, s.show)
            if (s.dim) dim = s.dim
            if (s.fly) fly = s.fly
            if (s.labels !== undefined) labels = s.labels
            if (s.labelFor !== undefined) labelFor = s.labelFor
            if (s.axes !== undefined) axes = s.axes
            if (s.highlight !== undefined) highlight = s.highlight
            if (s.layer !== undefined) layer = s.layer
          }
          view.show(parts)
          view.dim(dim, 0.08)
          view.setLabels(labels, labelFor)
          view.setAxes(axes)
          view.highlight(highlight)
          view.focusLayer(layer)
          legend?.forEach((row, el) => {
            row.style.transition = animate ? 'opacity .4s ease' : 'none'
            row.style.opacity = dim.includes(el) ? '0.2' : '1'
          })
          reveal(frame, step, animate)
          if (!animate) { view.snap(); return view.flyTo(fly, 0) }
          return view.flyTo(fly, 1400)
        },
        destroy: () => view.dispose(),
      }
    },
  }
}
