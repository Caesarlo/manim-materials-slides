// 声明式晶体页：每一步只写“要显示什么、聚焦谁、相机去哪”，后面的步骤自动继承前面的设置，
// 所以跳转/回退时合并 1..step 的设置即可得到与逐步点击完全一致的画面（满足 enter 的幂等要求）。
//
//   crystalSlide({
//     name: 'SrTiO3', crystal: SrTiO3, options: SrTiO3_opts,
//     steps: [
//       { caption: '晶胞', show: { cell: 1, atoms: 1 } },
//       { caption: '成键', show: { bonds: 1 } },
//       { caption: '八面体', show: { polyhedra: 1 }, dim: ['Sr'], fly: { dir: [1, 0.5, 1], zoom: 1.5 } },
//     ],
//   })
import { build, type BuildOptions, type Crystal, type Vec3 } from './structure'
import { CrystalView, type Parts } from './CrystalView'
import { captions, show as reveal } from '@/runtime/reveal'
import type { SlideDef } from '@/runtime/types'

export interface CrystalStep {
  caption: string
  show?: Partial<Record<Parts, number>>
  /** 压暗这些元素；[] 表示全部恢复；省略表示沿用上一步 */
  dim?: string[]
  fly?: { dir?: Vec3; target?: Vec3; zoom?: number }
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
      const view = new CrystalView(frame.querySelector('.view3d')!, build(def.crystal, def.options), { orientation: def.orientation })
      view.show({ cell: 0, atoms: 0, bonds: 0, polyhedra: 0 })
      view.snap()

      return {
        enter(step, animate) {
          const upto = def.steps.slice(0, step)
          const parts: Partial<Record<Parts, number>> = {}
          let dim: string[] = []
          let fly: CrystalStep['fly'] = {}
          for (const s of upto) {
            Object.assign(parts, s.show)
            if (s.dim) dim = s.dim
            if (s.fly) fly = s.fly
          }
          view.show(parts)
          view.dim(dim, 0.08)
          reveal(frame, step, animate)
          if (!animate) { view.snap(); return view.flyTo(fly, 0) }
          return view.flyTo(fly, 1400)
        },
        destroy: () => view.dispose(),
      }
    },
  }
}
