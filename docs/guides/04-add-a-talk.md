# 04 新建一场汇报（演讲）并接入你的数据

## 1. 建目录

```bash
# 在项目根目录，PowerShell
Copy-Item -Recurse src/talks/example src/talks/my-talk
```
`my-talk` 就是网址里的名字：`http://localhost:4100/?talk=my-talk`。**目录名只用小写字母、数字、连字符**。

然后编辑 `src/talks/my-talk/talk.ts`：
- 改 `talkTitle`（浏览器标题）；
- 在 `register(deck)` 里按顺序 `deck.slide(...)` 你要的页面（删掉不要的示例页，文件也一并删）。

**新增演讲不需要登记**（`src/main.ts` 用 `import.meta.glob` 自动发现）。

## 2. 页面从哪来

| 想放什么 | 用什么 | 示范 |
|---|---|---|
| 公式一步步变形 | `manimStage` + `morphTex` | `talks/example/slides/formula.ts` |
| 晶体 | `crystalSlide`（见 03） | `talks/gallery/slides/srtio3.ts` |
| 折线（zT–T 等） | `lineChartSlide` | `talks/gallery/slides/ztVsT.ts` |
| 能带 / 散点 / 凸包 / 漏斗 / XRD / 柱状 | `bandSlide` / `scatterSlide` / `hullSlide` / `funnelSlide` / `xrdSlide` / `barSlide` | `talks/gallery/slides/` |
| 词元 / 注意力 / 采样 / 架构 / Agent 回放 | `tokenStripSlide` / `attentionMapSlide` / `nextTokenSlide` / `blockSlide` / `agentSlide` | `talks/gallery-llm/slides/` |
| 自己写的一页 | 手写 `SlideDef`（契约见 `AGENTS.md`） | `talks/example/slides/title.ts` |

**最省事的做法**：从画廊里把最接近的那页的文件复制到你的演讲，改数据和旁白。

## 3. 接入真实数据

### 晶体（CIF）
```bash
uv run tools/cif_to_ts.py path/to/my.cif src/talks/my-talk/data/my.ts --export MyCrystal --name "显示名"
```
然后：
```ts
import { MyCrystal } from '../data/my'
deck.slide(crystalSlide({
  name: '我的结构', crystal: MyCrystal,
  options: { polyhedra: [{ center: 'Ti', ligand: 'O', max: 2.2 }] },   // 配位规则：中心元素、配体元素、最大键长(Å)
  steps: [{ caption: '晶胞', show: { cell: 1, atoms: 1 } }, { caption: '成键', show: { bonds: 1, polyhedra: 1 } }],
}))
```
键长上限怎么定：查文献的键长，上限取比最长的配位键大约 0.2~0.3 Å。显示不对时先看 `check/` 截图里键和多面体有没有连对。

### 曲线（CSV）
```bash
uv run tools/csv_to_ts.py my.csv src/talks/my-talk/data/curves.ts --name myData --x T --y "A,B,C"
```
```ts
import { fromColumnTable, lineChartSlide } from '@/packs/plot/lineChart'
import { myData } from '../data/curves'
deck.slide(lineChartSlide({ name: '我的曲线', series: fromColumnTable(myData), x: {...}, y: {...}, steps: [...] }))
```
CSV 里用 `#` 开头的行写单位和来源，会被原样保留到生成文件头部。

### Agent 回放（线程 JSON）
```ts
import { fromMessages } from '@/packs/llm/agentTrace'
import { agentSlide } from '@/packs/llm/agentFlow'
const trace = fromMessages(messagesFromYourThreadJson)      // LangChain 风格消息数组
deck.slide(agentSlide({ name: '一次会话', trace, note: '真实会话（已脱敏）' }))
```
**注意脱敏**：线程里可能有密钥、内部路径、个人信息；放进仓库前先清理。

## 4. 检查

```bash
npm run check -- --talk my-talk            # 逐页逐步检查
```
然后亲眼看 `check/my-talk/` 下每一张图。放映前再用 `npm run dev` 在浏览器里从头点一遍（按 F 全屏，S 看备注，O 看总览）。

## 5. 放映

- 开发机：`npm run dev`，打开 `http://localhost:4100/?talk=my-talk`，按 F 全屏。
- 另一台电脑：`npm run build`，把 `dist/` 放到任意静态服务器（如 `npx vite preview`）；直接双击 `index.html` **目前打不开**（见 feature `M1-OFFLINE-001`）。
- 操作：→ / 空格 / 翻页笔前进；← / 右键后退；`[`、`]` 不可用，用 O 打开总览跳页；也可以直接在网址里改 `#/页/步`。

## 数据诚实（必须）

- 不是真实测量/计算的数据，页面必须有 `note: '示意数据'`。
- 真实数据在页面或备注里写明来源（论文/数据库/计算条件）。
