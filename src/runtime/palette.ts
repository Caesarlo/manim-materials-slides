// 唯一的颜色来源：CSS 变量与 manim-web / three.js 代码都从这里取，不要在幻灯片里写死十六进制。
// 白底、低饱和，每页最多 1 个主色 + 1 个辅色。
export const palette = {
  bg: '#ffffff',
  fg: '#1a1d24',
  muted: '#6b7280',
  detail: '#9aa1ad',
  line: '#e2e5ea',
  accent: '#3b6fb6',
  amber: '#d98e04',
  red: '#c8553d',
  teal: '#3f8f7b',
  violet: '#7a62a8',
  series: ['#3b6fb6', '#d98e04', '#c8553d', '#3f8f7b', '#7a62a8'],
  /** 元素配色（晶体）。没列出的元素回退为 muted。 */
  cpk: {
    O: '#c8553d', Ti: '#3b6fb6', Sr: '#3f8f7b', Ba: '#3f8f7b', Ca: '#6fae9c',
    Bi: '#7a62a8', Te: '#d98e04', Se: '#e0b04a', Sb: '#a58bc9', Pb: '#6b7280',
    Sn: '#8c9aa8', Si: '#9aa1ad', Ge: '#7d8896', Li: '#c98ca8', Na: '#8aa3d4',
    Cu: '#c9743d', Fe: '#9a5a3c', Mg: '#6aa27a', Zn: '#7a8fa6', S: '#d6b73a',
  } as Record<string, string>,
}

export type Palette = typeof palette

/** 把调色板写入 CSS 变量，让样式表与脚本共用同一份颜色。 */
export function applyPalette(root: HTMLElement = document.documentElement) {
  const set = (k: string, v: string) => root.style.setProperty(`--${k}`, v)
  set('bg', palette.bg)
  set('fg', palette.fg)
  set('muted', palette.muted)
  set('detail', palette.detail)
  set('line', palette.line)
  set('accent', palette.accent)
  set('amber', palette.amber)
  set('red', palette.red)
  set('teal', palette.teal)
  set('violet', palette.violet)
  palette.series.forEach((c, i) => set(`plot-${i + 1}`, c))
}
