// HTML 元素按 step 淡入：
//   <p class="reveal-in" data-from="2">…</p>                第 2 步起显示
//   <p class="reveal-in" data-from="2" data-until="4">…</p> 仅第 2、3 步显示（until 为开区间）
//   同级元素可用 style="--i:1/2/3" 做错落延迟
// 在 enter(step, animate) 里调用 show(frame, step, animate)。
import { inlineTex } from './tex'

export function show(frame: HTMLElement, step: number, animate: boolean) {
  const items = frame.querySelectorAll<HTMLElement>('.reveal-in')
  for (const el of items) {
    const from = Number(el.dataset.from ?? 1)
    const until = el.dataset.until ? Number(el.dataset.until) : Infinity
    const on = step >= from && step < until
    if (!animate) {
      el.style.transition = 'none'
      el.classList.toggle('in', on)
      void el.offsetWidth // 立刻应用，再恢复过渡
      el.style.transition = ''
    } else {
      el.classList.toggle('in', on)
    }
  }
}

/** 每一步一句旁白：同一位置叠放，按 step 切换。文字里的 $…$ 按 LaTeX 排版。 */
export function captions(lines: string[], esc: (s: string) => string): string {
  return lines
    .map((t, i) => (t ? `<p class="deck-caption reveal-in" data-from="${i + 1}" data-until="${i + 2}">${inlineTex(t, esc)}</p>` : ''))
    .join('')
}
