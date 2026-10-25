// 标签 / 高亮相关的纯函数（不依赖 three.js，可单测）。
import type { Built } from './structure'

/** 按首次出现顺序列出元素种类 */
export function elementsOf(built: Built): string[] {
  const out: string[] = []
  for (const a of built.atoms) if (!out.includes(a.el)) out.push(a.el)
  return out
}

/**
 * 每个元素种类选一个代表原子（返回 元素 → 原子下标）：
 * 取离超胞中心最近的一个（距离相同取下标小的）；prefer 给定时优先在满足它的原子里选
 * （例如按层聚焦时，标签挂在层内的原子上），一个都不满足则退回全部。
 * els 缺省 = 所有元素；els 里没有出现的元素被忽略。
 */
export function representatives(built: Built, els?: string[], prefer?: (i: number) => boolean): Map<string, number> {
  const out = new Map<string, number>()
  const c = built.center
  const d2 = (i: number) => built.atoms[i].pos.reduce((s, x, k) => s + (x - c[k]) ** 2, 0)
  for (const el of els ?? elementsOf(built)) {
    const all = built.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0)
    if (!all.length) continue
    const pref = prefer ? all.filter(prefer) : []
    const pool = pref.length ? pref : all
    let best = pool[0]
    for (const i of pool) if (d2(i) < d2(best) - 1e-9) best = i
    out.set(el, best)
  }
  return out
}

export interface HighlightSpec { els?: string[]; indices?: number[] }

/** 高亮规范 → 每个原子是否高亮（els 与 indices 取并集；越界下标忽略；null/空 = 都不高亮） */
export function resolveHighlight(built: Built, hl: HighlightSpec | null | undefined): boolean[] {
  const on = built.atoms.map(() => false)
  if (!hl) return on
  built.atoms.forEach((a, i) => { if (hl.els?.includes(a.el)) on[i] = true })
  for (const i of hl.indices ?? []) if (Number.isInteger(i) && i >= 0 && i < on.length) on[i] = true
  return on
}

// ---- 屏幕空间：选哪个原子来挂标签、标签怎么摆（相机转动时随之重算，纯函数可单测） ----
export interface ScreenAtom {
  x: number
  y: number
  /** 屏幕半径（像素） */
  r: number
  /** 到相机的深度，越小越靠前 */
  depth: number
  /** 是否实际显示（没被压暗/隐藏） */
  shown: boolean
}

/** 原子 i 的球心是否被更靠前的、显示着的原子盖住 */
export function isOccluded(i: number, atoms: ScreenAtom[]): boolean {
  const a = atoms[i]
  return atoms.some((b, j) => j !== i && b.shown && b.depth < a.depth - 1e-6 && Math.hypot(a.x - b.x, a.y - b.y) < b.r)
}

/**
 * 在候选原子里挑挂标签的那个：没被挡住的里面取最靠上的（引线最短），全被挡住就在全部候选里取最靠上的。
 * 只由当前画面决定（不记上一次的选择），所以“点过来”和“直接跳”得到同样的标签。
 */
export function pickLabelAtom(cands: number[], atoms: ScreenAtom[]): number | undefined {
  if (!cands.length) return undefined
  const free = cands.filter((i) => !isOccluded(i, atoms))
  const pool = free.length ? free : cands
  const top = (i: number) => atoms[i].y - atoms[i].r
  return pool.reduce((best, i) => (top(i) < top(best) - 1e-9 ? i : best), pool[0])
}

/**
 * 标签排成一行（在结构上方）：按期望的 x 从左到右摆，互相留 gap，避开 blocked 区间（如 a/b/c 标签），
 * 并限制在 [0, width] 内。items 的 x 是标签中心的期望位置，w 是标签宽度；返回与输入同序的中心 x。
 */
export function layoutRow(
  items: { x: number; w: number }[],
  gap: number,
  width: number,
  blocked: { x0: number; x1: number }[] = [],
): number[] {
  const order = items.map((_, k) => k).sort((a, b) => items[a].x - items[b].x)
  const out = items.map((it) => it.x)
  let edge = -Infinity // 已占用的右边界
  for (const k of order) {
    let x = Math.max(items[k].x, edge + gap + items[k].w / 2, items[k].w / 2)
    for (let again = true; again;) {
      again = false
      for (const b of blocked) if (x + items[k].w / 2 + gap > b.x0 && x - items[k].w / 2 - gap < b.x1) { x = b.x1 + gap + items[k].w / 2; again = true }
    }
    out[k] = x
    edge = x + items[k].w / 2
  }
  // 超出右边界就整体向左挤回来
  let limit = width
  for (const k of [...order].reverse()) {
    out[k] = Math.min(out[k], limit - items[k].w / 2)
    limit = out[k] - items[k].w / 2 - gap
  }
  return out
}
