// 无头浏览器检查：逐页逐步跳转，抓控制台错误，并验证 enter() 的契约——
// “一步步点过来”和“直接跳到该步”必须得到同样的画面。
//
//   npm run check                   # 全部页
//   npm run check -- --slide 4      # 只检查第 4 页
//   npm run check -- --no-compare   # 只看控制台错误，不做两种路径的画面对比（更快）
//   npm run check -- --talk 名称    # 检查 src/talks/<名称>/（默认 example）
//
// 用本机的 Chrome（找不到则用 Edge），不需要下载浏览器。截图在 check/ 下（已 git 忽略）：
//   live-页-步.png  点过来   jump-页-步.png  直接跳   diff-页-步.png  两者不一致时的差异图
import { mkdir, rm } from 'node:fs/promises'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const only = args.includes('--slide') ? Number(args[args.indexOf('--slide') + 1]) : null
const compare = !args.includes('--no-compare')
const talk = args.includes('--talk') ? args[args.indexOf('--talk') + 1] : 'example'
const TOLERANCE = 0.001 // 两种路径的画面差异比例上限（0.1%）；目前各页实测均为 0.00%
const SETTLE_MS = 1800 // 动画/3D 相机缓动收敛所需时间

await rm('check', { recursive: true, force: true })
await mkdir('check', { recursive: true })

const server = await createServer({ logLevel: 'error', server: { port: 0, host: '127.0.0.1' } })
await server.listen()
const url = server.resolvedUrls.local[0]

let browser
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
if (!browser) {
  console.error('找不到 Chrome 或 Edge')
  await server.close()
  process.exit(2)
}

const problems = []
const note = (msg) => { problems.push(msg); console.log('  ✗ ' + msg) }

async function openPage(hash) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } })
  const where = () => page.url().split('#')[1] ?? ''
  page.on('console', (m) => {
    if (m.type() === 'error') note(`[${where()}] console.error: ${m.text().slice(0, 200)}`)
  })
  page.on('pageerror', (e) => note(`[${where()}] 未捕获异常: ${String(e).slice(0, 200)}`))
  await page.goto(`${url}?talk=${encodeURIComponent(talk)}${hash}`)
  await page.waitForFunction(() => window.__deck)
  return page
}

async function settle(page) {
  await page.waitForFunction(() => !document.body.classList.contains('busy'), null, { timeout: 30000 })
  await page.waitForTimeout(SETTLE_MS)
}

const shot = async (page, name) => { await page.screenshot({ path: `check/${name}.png` }) }

// 先取页数/步数
const probe = await openPage('#/1/1')
const slides = await probe.evaluate(() => window.__deck.slides)
await probe.close()

console.log(`检查演讲「${talk}」${slides.length} 页（${url}）`)
let steps = 0
for (let i = 1; i <= slides.length; i++) {
  if (only && i !== only) continue
  const { name, steps: n } = slides[i - 1]
  console.log(`\n[${i}] ${name}  (${n} 步)`)

  // 1. 点过来
  const live = await openPage(`#/${i}/1`)
  await settle(live)
  await shot(live, `live-${i}-1`)
  for (let k = 2; k <= n; k++) {
    await live.keyboard.press('ArrowRight')
    await settle(live)
    await shot(live, `live-${i}-${k}`)
  }
  await live.close()

  // 2. 直接跳 + 对比
  for (let k = 1; k <= n; k++) {
    steps++
    if (!compare) continue
    const jump = await openPage(`#/${i}/${k}`)
    await settle(jump)
    await shot(jump, `jump-${i}-${k}`)
    await jump.close()

    const a = PNG.sync.read(readFileSync(`check/live-${i}-${k}.png`))
    const b = PNG.sync.read(readFileSync(`check/jump-${i}-${k}.png`))
    const diff = new PNG({ width: a.width, height: a.height })
    const bad = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 })
    const ratio = bad / (a.width * a.height)
    const ok = ratio <= TOLERANCE
    console.log(`  ${ok ? '✓' : '✗'} 第 ${k} 步  点过来 vs 直接跳：差异 ${(ratio * 100).toFixed(2)}%`)
    if (!ok) {
      writeFileSync(`check/diff-${i}-${k}.png`, PNG.sync.write(diff))
      problems.push(`[${i}/${k}] ${name}：两种路径画面不一致（${(ratio * 100).toFixed(2)}%），见 check/diff-${i}-${k}.png`)
    }
  }
}

await browser.close()
await server.close()

console.log(`\n共检查 ${steps} 步，截图在 check/`)
if (problems.length) {
  console.log(`\n发现 ${problems.length} 个问题：`)
  for (const p of [...new Set(problems)]) console.log('  - ' + p)
  process.exit(1)
}
console.log('全部通过 ✓')
