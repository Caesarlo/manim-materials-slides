import type { Palette } from './palette'

/** 幻灯片可用的运行时上下文。 */
export interface Ctx {
  palette: Palette
  /** HTML 转义，拼模板字符串时对外部文本使用 */
  esc(s: string): string
}

/**
 * enter 的 animate 参数：
 *  true  = 向前一步，播放这一步的动画
 *  false = 跳转（回退、换页、刷新），必须立刻给出与“逐步点过来”完全一致的画面
 */
export type Animate = boolean

export interface SlideInstance {
  /** 显示第 1..step 步。必须幂等、可跳转：写“每一步的状态”，不要写“相对上一步的增量”。 */
  enter(step: number, animate: Animate): void | Promise<void>
  /** 可选：离开时停掉循环、动画 */
  leave?(): void
  /** 可选：销毁 WebGL / 监听器。幻灯片切走后一定会调用 */
  destroy?(): void
}

export interface SlideDef {
  name: string
  /** 点击次数（默认 1）。第 1 步是进入该页时显示的画面 */
  steps?: number
  /** 演讲者备注，按 S 显示 */
  notes?: string
  /** 页面自己处理拖拽/滚轮（3D）。拖动不会被当成翻页点击 */
  interactive?: boolean
  mount(frame: HTMLElement, ctx: Ctx): SlideInstance
}
