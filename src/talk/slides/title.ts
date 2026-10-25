// 标题页。步骤：1 标题 · 2 副标题
import { show } from '@/runtime/reveal'
import type { SlideDef } from '@/runtime/types'

export const title: SlideDef = {
  name: '标题',
  steps: 2,
  notes: '封面：先出标题，再出一句话副标题。',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-center"><div>
        <h1 class="deck-title reveal-in">${esc('大模型 × 材料')}</h1>
        <p class="deck-subtitle reveal-in" data-from="2">${esc('用一句话讲清楚这次汇报')}</p>
      </div></div>`
    return { enter: (step, animate) => show(frame, step, animate) }
  },
}
