// 注意力的直觉：“it” 指向谁？（HTML + SVG，随步骤淡入；权重为示意值，不是某个模型的真实输出）
// 步骤：1 句子 · 2 选中“it” · 3 画出注意力弧线 · 4 标出权重
import { captions, show } from '@/runtime/reveal'
import type { SlideDef } from '@/runtime/types'

const TOKENS = ['The', 'lattice', 'was', 'stable', 'because', 'it', 'relaxed']
const FROM = 5
const WEIGHTS: Record<number, number> = { 0: 0.04, 1: 0.55, 2: 0.03, 3: 0.2, 4: 0.08 }
const W = 1600, H = 560, GAP = 218, X0 = 150, Y = 400, BW = 176, BH = 84
const cx = (i: number) => X0 + i * GAP

export const attention: SlideDef = {
  name: '注意力',
  steps: 4,
  notes: '“it” 把注意力主要放在 “lattice” 上。权重是示意值。第 4 步标出各词的权重。',
  mount(frame, { esc, palette: P }) {
    const boxes = TOKENS
      .map((t, i) => `<g class="reveal-in" style="--i:${i}">
          <rect class="tok" data-i="${i}" x="${cx(i) - BW / 2}" y="${Y - BH / 2}" width="${BW}" height="${BH}" rx="18"
            fill="#fff" stroke="${P.line}" stroke-width="4" style="transition: fill .5s, stroke .5s"/>
          <text class="tok-t" data-i="${i}" x="${cx(i)}" y="${Y + 12}" text-anchor="middle" font-size="40" font-weight="600"
            fill="${P.fg}" style="transition: fill .5s">${esc(t)}</text>
        </g>`)
      .join('')

    const arcs = Object.entries(WEIGHTS)
      .map(([j, w]) => {
        const a = cx(FROM), b = cx(Number(j))
        const top = Y - BH / 2 - 14
        const lift = 70 + Math.abs(a - b) * 0.32
        return `<path class="reveal-in" data-from="3" d="M${a},${top} Q${(a + b) / 2},${top - lift * 1.6} ${b},${top}"
          fill="none" stroke="${P.amber}" stroke-width="${6 + w * 40}" stroke-linecap="round" opacity="${0.35 + w}"/>`
      })
      .join('')

    const labels = Object.entries(WEIGHTS)
      .map(([j, w]) => `<text class="reveal-in" data-from="4" x="${cx(Number(j))}" y="${Y + BH / 2 + 62}" text-anchor="middle"
          font-size="38" font-weight="600" fill="${w > 0.3 ? P.amber : P.muted}">${Math.round(w * 100)}%</text>`)
      .join('')

    frame.innerHTML = `
      <div class="deck-center"><svg viewBox="0 0 ${W} ${H}" style="width:90%">${arcs}${boxes}${labels}</svg></div>
      ${captions(['一个句子，被切成词元', '“it” 指的是什么？', '注意力：它回头看了谁', '权重最大的是 “lattice”'], esc)}
      <p class="deck-detail" style="position:absolute;right:3%;bottom:2%;margin:0">${esc('权重为示意值')}</p>`

    return {
      enter(step, animate) {
        show(frame, step, animate)
        // 第 2 步起高亮 “it”：按步骤写状态，不依赖上一步
        const hot = step >= 2
        frame.querySelectorAll<SVGElement>('.tok').forEach((el) => {
          const on = hot && Number(el.dataset.i) === FROM
          el.setAttribute('fill', on ? P.accent : '#fff')
          el.setAttribute('stroke', on ? P.accent : P.line)
        })
        frame.querySelectorAll<SVGElement>('.tok-t').forEach((el) => {
          el.setAttribute('fill', hot && Number(el.dataset.i) === FROM ? '#fff' : P.fg)
        })
      },
    }
  },
}
