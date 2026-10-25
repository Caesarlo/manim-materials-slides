// 图表页工厂：把“每一步的状态”交给图表，和 crystalSlide 同一套思路。
//
//   chartSlide<MyState>({
//     name: 'zT–T',
//     initial: { shown: 0, focus: null },                    // 第 0 步之前的状态
//     steps: [
//       { caption: '基线', state: { shown: 1 } },            // 每步只写变化的字段，后面的步骤继承前面的
//       { caption: '加入掺杂', state: { shown: 2 } },
//       { caption: '最优组分', state: { focus: 1 } },
//     ],
//     create: (host, ctx) => new MyChart(host, ctx),         // 返回 { apply(state, animate), destroy() }
//   })
//
// 契约：apply(state, animate) 必须幂等，只依赖传入的完整 state（不依赖上一次调用）。
// 动画请用 CSS transition（给元素加 class "tr"）；跳转时 chartSlide 会临时关掉所有过渡，图表代码不必区分两种路径。
import { captions, show } from '@/runtime/reveal'
import type { Ctx, SlideDef } from '@/runtime/types'

export interface ChartInstance<S> {
  apply(state: S, animate: boolean): void
  destroy(): void
}

export interface ChartStep<S> {
  caption: string
  /** 本步相对上一步变化的字段（浅合并；数组整体替换） */
  state?: Partial<S>
}

export interface ChartSlideDef<S extends object> {
  name: string
  heading?: string
  notes?: string
  /** 右下角小注（如“示意数据”），用 .deck-detail 样式 */
  note?: string
  initial: S
  steps: ChartStep<S>[]
  create(host: HTMLElement, ctx: Ctx): ChartInstance<S>
}

/** 合并 1..step 步的状态：与“一步步点过来”完全一致 */
export function stateAt<S extends object>(initial: S, steps: ChartStep<S>[], step: number): S {
  return steps.slice(0, step).reduce<S>((acc, s) => ({ ...acc, ...s.state }), { ...initial })
}

export function chartSlide<S extends object>(def: ChartSlideDef<S>): SlideDef {
  return {
    name: def.name,
    steps: def.steps.length,
    notes: def.notes,
    mount(frame, ctx) {
      frame.innerHTML = `
        <div class="chart-host"></div>
        ${def.heading ? `<h2 class="deck-heading">${ctx.esc(def.heading)}</h2>` : ''}
        ${def.note ? `<p class="deck-detail" style="position:absolute;right:3%;bottom:2%;margin:0">${ctx.esc(def.note)}</p>` : ''}
        ${captions(def.steps.map((s) => s.caption), ctx.esc)}`
      const host = frame.querySelector<HTMLElement>('.chart-host')!
      const chart = def.create(host, ctx)
      return {
        enter(step, animate) {
          const state = stateAt(def.initial, def.steps, step)
          if (!animate) host.classList.add('no-tr')
          chart.apply(state, animate)
          show(frame, step, animate)
          if (!animate) {
            void host.getBoundingClientRect() // 先让“无过渡”的样式生效，再恢复
            requestAnimationFrame(() => requestAnimationFrame(() => host.classList.remove('no-tr')))
          }
        },
        destroy: () => chart.destroy(),
      }
    },
  }
}
