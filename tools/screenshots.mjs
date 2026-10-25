// 生成 README 用的示例截图：npm run shots
// 逐项打开 ?talk=example#/页/步，等动画收敛后只截 .frame，保存到 docs/images/。
// 用本机 Chrome（找不到则用 Edge），不需要下载浏览器。
import { mkdir } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

const talk = 'example'
const SETTLE_MS = 1800 // 动画/3D 相机缓动收敛所需时间

// 页号、步号从 1 起算，顺序同 src/talks/example/talk.ts 里的 deck.slide
const SHOTS = [
  { slide: 2, step: 2, file: 'formula-step2', note: '公式逐项变形：S = QKᵀ/√d_k，蓝色高亮 S 并配旁白' },
  { slide: 3, step: 4, file: 'attention-arcs', note: '注意力弧线与百分比' },
  { slide: 4, step: 3, file: 'srtio3-octahedron', note: 'SrTiO₃ 的 TiO₆ 八面体' },
  { slide: 4, step: 4, file: 'srtio3-top', note: 'SrTiO₃ 沿 c 轴俯视' },
  { slide: 5, step: 2, file: 'bi2te3-octahedra', note: 'Bi₂Te₃ 的 BiTe₆ 八面体（c 轴横置）' },
  { slide: 5, step: 3, file: 'bi2te3-layers', note: 'Bi₂Te₃ 侧视：五层一组，层间是范德华间隙' },
  // 未选用：公式页第 4 步（O = AV，画面过空）
]

await mkdir('docs/images', { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
let browser
try {
  await server.listen()
  const url = server.resolvedUrls.local[0]

  for (const channel of ['chrome', 'msedge']) {
    try {
      browser = await chromium.launch({
        channel,
        headless: true,
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      })
      break
    } catch { /* 试下一个 */ }
  }
  if (!browser) throw new Error('找不到 Chrome 或 Edge')

  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
    try {
      await page.goto(`${url}?talk=${encodeURIComponent(talk)}#/${s.slide}/${s.step}`)
      await page.waitForFunction(() => window.__deck)
      await page.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 30000 })
      await page.waitForTimeout(SETTLE_MS)
      const out = `docs/images/${s.file}.png`
      await page.locator('.frame').screenshot({ path: out })
      console.log(`✓ ${out}  ${s.note}`)
    } finally {
      await page.close()
    }
  }
} finally {
  if (browser) await browser.close()
  await server.close()
}
