// 公式逐项变形（manim-web 的 TransformMatchingTex）：注意力的计算，一步一式。
// 步骤：1 S = QKᵀ · 2 除以 √d · 3 A = softmax(S) · 4 O = A·V
// 相同的部分（S、A、=）会“飞”到新位置，不同的部分淡入淡出。
import { manimStage } from '@/runtime/manimStage'
import { captions, show } from '@/runtime/reveal'
import type { SlideDef } from '@/runtime/types'

export const formula: SlideDef = {
  name: '公式变形',
  steps: 4,
  notes: '注意力：打分 → 缩放 → 归一化 → 加权求和。每一步只改一小块，其余保持位置。',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      ${captions(['先给每一对词打分', String.raw`除以 $\sqrt{d_k}$，防止数值过大`, '归一化成注意力权重', '用权重对值加权求和'], esc)}`

    const stage = manimStage(frame.querySelector<HTMLElement>('.deck-stage')!, {
      build: ({ M, P }) => {
        const eq = (parts: string[]) => new M.MathTex({ latex: parts, fontSize: 110, color: P.fg })
        return {
          e1: eq(['S', '=', String.raw`QK^{\top}`]),
          e2: eq(['S', '=', String.raw`\frac{QK^{\top}}{\sqrt{d_k}}`]),
          e3: eq(['A', '=', String.raw`\mathrm{softmax}(S)`]),
          e4: eq(['O', '=', 'A', 'V']),
        }
      },
      // 字形渲染完成后再上色：颜色即对应关系（S 蓝、A 琥珀、O 青绿）
      prepare: ({ e1, e2, e3, e4 }, { P }) => {
        e1.getPart(0).setColor(P.accent)
        e2.getPart(0).setColor(P.accent)
        e3.getPart(0).setColor(P.amber)
        e3.getPart(2).setColor(P.accent)
        e4.getPart(0).setColor(P.teal)
        e4.getPart(2).setColor(P.amber)
      },
      steps: [
        ({ e1 }, { M }) => [new M.Write(e1, { duration: 1 })],
        ({ e1, e2 }, { morphTex }) => morphTex(e1, e2),
        ({ e2, e3 }, { morphTex }) => morphTex(e2, e3),
        ({ e3, e4 }, { morphTex }) => morphTex(e3, e4),
      ],
    })

    return {
      enter(step, animate) { show(frame, step, animate); return stage.go(step, animate) },
      destroy: stage.dispose,
    }
  },
}
