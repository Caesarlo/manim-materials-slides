// 演示运行时：幻灯片注册、点击步进、回退、备注、总览、全屏。
// 同一时刻只挂载当前这一页（WebGL 上下文有限），切走即销毁。
import { applyPalette, palette } from './palette'
import type { Ctx, SlideDef, SlideInstance } from './types'

interface Pos { slide: number; step: number } // 都从 1 起算，和 URL #/页/步 一致

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

class Deck {
  private defs: SlideDef[] = []
  private frame!: HTMLElement
  private host!: HTMLElement
  private notesEl!: HTMLElement
  private overviewEl!: HTMLElement
  private ctx: Ctx = { palette, esc }

  private cur: { def: SlideDef; el: HTMLElement; inst: SlideInstance } | null = null
  private pos: Pos = { slide: 0, step: 0 } // slide 0 = 尚未显示
  private pending: Pos | null = null
  private busy = false

  slide(def: SlideDef) { this.defs.push(def) }

  private steps(i: number) { return this.defs[i - 1].steps ?? 1 }

  start({ title }: { title?: string } = {}) {
    if (title) document.title = title
    applyPalette()
    const app = document.getElementById('app')!
    app.innerHTML = `
      <div class="frame"><div class="slide-host"></div></div>
      <div class="deck-notes" hidden></div>
      <div class="deck-overview" hidden></div>
      <div class="deck-busy"></div>`
    this.frame = app.querySelector('.frame')!
    this.host = app.querySelector('.slide-host')!
    this.notesEl = app.querySelector('.deck-notes')!
    this.overviewEl = app.querySelector('.deck-overview')!
    this.bindInput()
    // 供 tools/check-deck.mjs 读取页数/步数；busy 由 body.busy 指示
    ;(window as unknown as { __deck: unknown }).__deck = {
      slides: this.defs.map((d) => ({ name: d.name, steps: d.steps ?? 1 })),
    }
    window.addEventListener('hashchange', () => this.request(this.fromHash()))
    this.request(this.fromHash())
  }

  // ---- 导航 ------------------------------------------------------------
  private fromHash(): Pos {
    const m = /^#\/(\d+)(?:\/(\d+))?$/.exec(location.hash)
    const slide = Math.min(Math.max(Number(m?.[1] ?? 1), 1), this.defs.length)
    const step = Math.min(Math.max(Number(m?.[2] ?? 1), 1), this.steps(slide))
    return { slide, step }
  }

  private target(): Pos { return this.pending ?? this.pos }

  next() {
    const t = this.target()
    if (t.step < this.steps(t.slide)) this.request({ slide: t.slide, step: t.step + 1 })
    else if (t.slide < this.defs.length) this.request({ slide: t.slide + 1, step: 1 })
  }

  prev() {
    const t = this.target()
    if (t.step > 1) this.request({ slide: t.slide, step: t.step - 1 })
    else if (t.slide > 1) this.request({ slide: t.slide - 1, step: this.steps(t.slide - 1) })
  }

  goto(slide: number, step = 1) { this.request({ slide, step }) }

  /** 忙时只记住最新目标，做完当前动画再处理，避免连点叠加动画 */
  private request(t: Pos) {
    if (this.busy) { this.pending = t; return }
    void this.run(t)
  }

  private async run(t: Pos) {
    this.busy = true
    document.body.classList.add('busy')
    try {
      const same = this.cur && t.slide === this.pos.slide
      if (same) {
        if (t.step !== this.pos.step) await this.cur!.inst.enter(t.step, t.step === this.pos.step + 1)
      } else {
        await this.swap(t.slide, t.step, t.slide === this.pos.slide + 1 && t.step === 1)
      }
      this.pos = t
      const h = `#/${t.slide}/${t.step}`
      if (location.hash !== h) history.replaceState(null, '', h)
      this.renderNotes()
    } catch (e) {
      console.error(e)
    } finally {
      this.busy = false
      document.body.classList.remove('busy')
      if (this.pending) {
        const p = this.pending
        this.pending = null
        void this.run(p)
      }
    }
  }

  private async swap(slide: number, step: number, animate: boolean) {
    if (this.cur) {
      this.cur.inst.leave?.()
      this.cur.inst.destroy?.()
      this.cur.el.remove()
      this.cur = null
    }
    const def = this.defs[slide - 1]
    const el = document.createElement('section')
    el.className = 'slide'
    this.host.append(el)
    const inst = def.mount(el, this.ctx)
    this.cur = { def, el, inst }
    el.classList.toggle('interactive', !!def.interactive)
    await inst.enter(step, animate)
    el.classList.add('ready')
  }

  // ---- 输入 ------------------------------------------------------------
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter':
          e.preventDefault(); this.overviewEl.hidden ? this.next() : this.toggleOverview(false); break
        case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace':
          e.preventDefault(); this.prev(); break
        case 'Home': this.goto(1); break
        case 'End': this.goto(this.defs.length, this.steps(this.defs.length)); break
        case 's': case 'S': this.notesEl.hidden = !this.notesEl.hidden; this.renderNotes(); break
        case 'o': case 'O': this.toggleOverview(); break
        case 'f': case 'F':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen()
          break
        case 'Escape': this.toggleOverview(false); break
      }
    })
    // 点击翻页；拖动（旋转 3D）不算点击
    let down: { x: number; y: number } | null = null
    this.frame.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
    this.frame.addEventListener('pointerup', (e) => {
      if (!down || e.button !== 0) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6
      down = null
      if (!moved && !(e.target as HTMLElement).closest('button, a, input')) this.next()
    })
    this.frame.addEventListener('contextmenu', (e) => { e.preventDefault(); this.prev() })
  }

  private renderNotes() {
    if (this.notesEl.hidden) return
    this.notesEl.textContent = this.cur?.def.notes ?? '（本页没有备注）'
  }

  private toggleOverview(force?: boolean) {
    const open = force ?? this.overviewEl.hidden
    this.overviewEl.hidden = !open
    if (!open) return
    this.overviewEl.innerHTML = this.defs
      .map((d, i) => `<button data-i="${i + 1}"${i + 1 === this.pos.slide ? ' class="cur"' : ''}><b>${i + 1}</b>${esc(d.name)}<small>${d.steps ?? 1} 步</small></button>`)
      .join('')
    this.overviewEl.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation()
        this.toggleOverview(false)
        this.goto(Number((b as HTMLElement).dataset.i))
      }))
  }
}

export const deck = new Deck()
export type { Deck }
