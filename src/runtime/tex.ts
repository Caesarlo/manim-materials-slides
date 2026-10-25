// 行内公式：文字里用 $…$ 包住的部分按 LaTeX 排版（KaTeX，离线可用，字体随构建打包）。
//   inlineTex('除以 $\\sqrt{d_k}$，防止数值过大', esc)
// 在 TS 里写 LaTeX 请用 String.raw，避免 \t \f 被当成转义：String.raw`除以 $\sqrt{d_k}$`
// 非公式部分会做 HTML 转义，公式部分由 KaTeX 生成。
import katex from 'katex'
import 'katex/dist/katex.min.css'

export function inlineTex(text: string, esc: (s: string) => string): string {
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) =>
      part.length > 2 && part.startsWith('$') && part.endsWith('$')
        ? katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' })
        : esc(part),
    )
    .join('')
}
