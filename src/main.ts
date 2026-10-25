// 入口：按 ?talk=名称 加载 src/talks/<名称>/talk.ts（默认 example）。
// 新建一场演讲只需复制 talks/example/ 并改名，不需要在这里登记。
import '@/styles/deck.css'
import { deck } from '@/runtime/deck'

const talks = import.meta.glob<{ register(d: typeof deck): void; talkTitle?: string }>('./talks/*/talk.ts')

const name = new URLSearchParams(location.search).get('talk') ?? 'example'
const load = talks[`./talks/${name}/talk.ts`]

if (!load) {
  const names = Object.keys(talks).map((k) => k.split('/')[2])
  document.getElementById('app')!.innerHTML =
    `<p style="padding:2em;font:16px system-ui">找不到演讲“${name.replace(/[<>&"]/g, '')}”。可用：${names.join('、')}（用 ?talk=名称 打开）</p>`
} else {
  const mod = await load()
  mod.register(deck)
  deck.start({ title: mod.talkTitle })
}
