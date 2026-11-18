# 01 运行时与版式

本章讲三件事：一张 slide 是怎样注册、挂载、进入和离开的（运行时）；一个 talk 怎样拼起来；以及版式系统（画框、字号 token、网格、组件）。图表（`Deck.groupedBars`）、manim-web（`Deck.manim`）和 3D 附加组件不在本章范围。

本章只描述已经存在于 `web/deck.js`、`web/deck.css` 和下列示例中的东西：

- `talks/example/slides/title.js`、`outline.js`、`figure_points.js`、`closing.js`
- `talks/materials-demo/slides/title.js`、`outline.js`

写新 talk 时的总原则：**尺寸只用 `--u` 或 `em`，颜色只用 CSS 变量或 `palette`，每张 slide 用自己的类名前缀，所有 slide 的 `enter` 都要能被直接跳转到任意一步。**

---

## 1. 幻灯片契约（slide contract）

### 1.1 注册一张 slide

每张 slide 是一个普通的 `<script>` 文件，在加载时调用一次 `Deck.slide`：

```js
Deck.slide('name', {
  steps: 3,                 // 总步数（含到达时的第 1 步）
  notes: '演讲者备注',       // 按 S 显示
  interactive: true,        // 吃拖拽/滚轮（3D）时打开，关闭触摸滑动翻页
  smoothBack: true,         // 只有 Deck.start 的 smoothBack 为 '3d' 或 'all' 时才有效
  before: 'other-name',     // 可选：插到已注册的 slide 之前
  mount(frame, { theme, palette, data, M, css, esc }) {
    frame.innerHTML = `...`;
    return { enter(step, animate) {}, leave() {}, freeze() {}, destroy() {} };
  },
});
```

| 字段 | 默认 | 含义 |
|---|---|---|
| `name` | 必填 | 全 talk 内唯一。`Deck.topics`、`Deck.hide`、`before` 都靠它找 slide。 |
| `steps` | `1` | 总步数。代码为每个 slide 加 `steps - 1` 个 `.deck-step` 片段（`fragment`），所以 `steps: 3` 是到达时的第 1 步加两次点击。 |
| `notes` | 无 | 写进 `<aside class="notes">`，按 S 在演讲者视图显示。 |
| `interactive` | `false` | 为真时该 section 带 `data-prevent-swipe`，触摸滑动不翻页。 |
| `smoothBack` | `false` | 见 1.5。 |
| `before` | 无 | 找不到目标时 `console.warn` 并追加到末尾。 |
| `mount` | 必填 | 返回控制器（1.2）。 |

`Deck.slide` 被调用时，slide 记录的分组是当时最近一次 `Deck.section(n)` 的值（第 2 章）。

### 1.2 mount 与控制器

`mount(frame, ctx)` 把内容写进 `frame`。`frame` 是 deck 已经建好的 `.deck-frame`（16:9 画框，第 3 章）。它返回一个对象：

| 方法 | 何时被调用 | 要求 |
|---|---|---|
| `enter(step, animate)` | 到达本页、每次点击、片段显示/隐藏、overview 结束 | **幂等、跳转安全**（1.4）。可返回 Promise；未 resolve 期间，页码旁的 busy 点闪烁。 |
| `leave()` | 页面离开视野；或刚被"预建"（见下）；或进入 overview | 可选。停止循环、暂停动画。必须可以重复调用。 |
| `freeze()` | 每次 `enter` 完成后截图前，且仅当这一页是当前页 | 可选。WebGL 画布在这里重绘，否则缩略图是空的。 |
| `destroy()` | 这一页距离当前页超过 3 张 | 可选。释放 WebGL、监听器。deck 先调 `leave()`，再调 `destroy()`，然后画布被移除。 |

最小完整 slide：

```js
{
Deck.slide('my-first', {
  steps: 2,
  notes: '第 1 步是标题；第 2 步显示说明。',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('我的第一页')}</h2>
      <p class="deck-caption reveal-in" data-from="2">${esc('第二步才出现的图注')}</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

**生命周期**（`web/deck.js` 中 `sync`、`ahead`、`fillOverview`、`freeze`、`mount`）：

- **挂载是可重复的。** 一页离开当前位置超过 3 张，会被 `freeze`（`leave` → `destroy` → 画布换成截图），其 `ctrl` 被置空；再回到它时 `mount` 会重新执行，且执行前 `frame.replaceChildren()` 清空旧内容。因此**模块级变量不能保存这一页的状态**，所有 DOM 与状态都要在 `mount` 的闭包里创建。
- **预建。** 下一页在到达前就被 `mount`，并立即 `leave()`（画面已经画好，但未进入）。上一页在停留 400 ms 后也会被预建。所以 `mount` 里不要启动定时器或动画，要放到 `enter` 里。
- **overview。** 未访问过的页在 overview 中依次 `mount` 并以 `enter(steps, false)` 跳到最后一步，截图后 `leave` 或 `freeze`。进入 overview 时，已经挂载的页都被 `enter(steps, false)` 跳到最后一步。
- **只有 `state` 为 live 的页才会 `freeze`/`destroy`。** 从未挂载的页保持空白，不占用资源。

### 1.3 `enter(step, animate)` 的参数

`step` 从 1 开始，是当前应显示到第几步（包含）。`animate` 由 deck 决定，来源见下表（对应 `sync` 中的计算）：

| `animate` | 何时 | 含义 |
|---|---|---|
| `true` | 启动时；`ready`；`fragmentshown`（前进一步）；`slidechanged` 且 `step === 1` | 播放本步的过渡 |
| `'back'` | `fragmenthidden`（后退一步），且 `smoothBack` 允许，且距上一次后退超过 700 ms（`BACK_REPEAT`） | 可以倒放（比前进快约一半），但终态必须与跳转相同 |
| `false` | 从后面的页回来（`slidechanged` 且 `step > 1`）；第二次快速后退；overview 结束（`overviewhidden`）；overview 的预填 | 直接跳到终态，不播动画 |

`Deck.show(frame, step, animate)` 会按 `animate` 给画框加/去 `instant` 类（`false` 时加），`.instant` 下 CSS 的过渡被关掉（`deck.css` 中 `.deck-frame .instant .reveal-in`）。

### 1.4 `enter` 必须幂等、跳转安全

规则：**`enter(k, false)` 直接调用的画面，必须与从第 1 步逐次点到第 k 步的画面完全一致。** 写"当前状态"，不写"增量"。`enter` 也可能对同一个 step 被多次调用（例如片段事件重复触发、overview 结束），每次都应得到同样的画面。

```js
// 错：依赖上一步。直接跳到第 3 步时，第 2 步的元素不会出现。
enter(step) {
  if (step === 2) showA();
  if (step === 3) showB();
}

// 对：每次都由 step 决定整体状态。Deck.show 就是这样做的。
enter(step, animate) {
  Deck.show(frame, step, animate);
  // 复杂的非 data-from 元素也要按 step 计算 on/off，而不是 toggle
}
```

`enter` 返回 Promise 时，deck 显示 busy 点（150 ms 后才显示，避免闪烁）。用于等待一段动画（例如 manim-web 的一个步骤）结束。

### 1.5 后退（smoothBack）

在 `Deck.start({ smoothBack })` 里设置，整个 talk 生效：

| 值 | 效果 |
|---|---|
| `'none'`（默认） | 后退一律跳转（`animate = false`）。 |
| `'3d'` | 声明了 `smoothBack: true` 的页，后退一步收到 `'back'`；其余页跳转。 |
| `'all'` | 所有页后退都收到 `'back'`，`Deck.show` 的渐入也会倒放。 |

只倒放能倒着读的动作（相机移动、回落）。内容在倒放时看起来不对（例如"裂缝愈合"）就直接跳。无论如何，`'back'` 结束时的终态必须与 `false` 的终态相同。连续两次后退（间隔 < 700 ms）或从后面的页回来，都会收到 `false`。

### 1.6 `ctx` 的内容

`mount` 的第二个参数，解构使用：`mount(frame, { theme, palette, data, M, css, esc })`。

| 字段 | 内容 |
|---|---|
| `theme` | `'light'` 或 `'dark'`，由 URL `?theme=dark` 决定（第 2 章）。 |
| `palette` | `Deck.palette`，即当前主题的颜色表（键见第 5 章）。 |
| `data` | `window.DATA`（未定义时为 `{}`），即 `talks/<talk>/data/*.js` 写入的数据。 |
| `M` | `window.ManimWeb`（manim-web 的 IIFE 全局）。只有 manim 页需要。 |
| `css` | `Deck.css(text)`：把一段样式注入 `<head>`，同一段文本只注入一次。 |
| `esc` | HTML 转义函数。拼接模板字符串中**任何**来自数据或文字的内容都要过它。 |

### 1.7 模块写法

- **用 `{ ... }` 包住整个文件**（块作用域）。普通 `<script>` 的顶层 `const`、`let`、`function` 共享同一个全局词法环境，两个文件声明同名的 `const` 会在加载时直接报错。`figure_points.js` 就是这样写的。
- 注意：`talks/example/slides/outline.js` 和 `talks/materials-demo/slides/outline.js` 的顶层 `const OUTLINE`、`FOOTER` 没有包块，它们是各自 talk 中唯一定义这些名字的文件。**新写的 slide 必须包块。**
- 每张 slide 的 CSS 类名用自己的前缀（`fp-`、`ti-`、`cl-`、`o-` 等，示例中的写法），避免跨文件冲突（见第 9 章）。

---

## 2. 怎样组装一个 talk

### 2.1 目录

```
talks/<name>/
  index.html      页面结构和 slide 顺序（script 标签的顺序）
  slides/*.js     每张（或每组）slide 一个文件
  data/*.js       window.DATA.<name> = {...}，由 tools/ 下的脚本生成
```

`talks/materials-demo/` 是可以直接复制的最小起点。

### 2.2 `index.html` 的结构

示例（`talks/materials-demo/index.html`，节选并去掉注释）：

```html
<link rel="stylesheet" href="../../vendor/reveal/reveal.css">
<link rel="stylesheet" href="../../web/deck.css">
<body>
<div class="reveal"><div class="slides"></div></div>

<script src="../../vendor/reveal/reveal.js"></script>
<script src="../../vendor/reveal/notes.js"></script>
<script src="../../vendor/manim-web/manim-web.iife.js"></script>
<script src="../../web/deck.js"></script>
<script src="../../web/manim.js"></script>
<script src="../../web/plots.js"></script>
<script src="data/srtio3.js"></script>

<script>Deck.section(null)</script>          <!-- 标题页：不在任何分组 -->
<script src="slides/title.js"></script>
<script src="slides/outline.js"></script>

<script>Deck.section(1)</script>             <!-- 分组 1 的 slide -->
<script src="slides/srtio3.js"></script>

<script>Deck.section(2)</script>
<script src="slides/bi2te3.js"></script>

<script>Deck.start({ title: 'Crystal structures, live', smoothBack: '3d' });</script>
</body>
```

顺序要求：

1. Reveal 与 notes 插件在 `deck.js` 之前（`deck.js` 读取 `window.RevealNotes`，并调用 `Reveal`）。
2. `manim-web` 在 slide 之前（`ctx.M` 来自它）。`web/manim.js`、`web/plots.js` 也在 slide 之前。
3. 附加组件（`web/addons/…`）在用到它们的 slide 之前。只有用到的 talk 才加载。
4. 数据文件在 `Deck.start` 之前（`ctx.data` 在挂载时读取）。
5. `Deck.start(...)` 必须最后调用：它建立每一页的 `<section>`，并初始化 Reveal。

### 2.3 分组、隐藏与启动

- **`Deck.section(n)`**：之后注册的 slide 属于分组 `n`（内部存为字符串）。`Deck.section(null)` 之后的 slide 不在任何分组，页脚隐藏。标题页和结束页通常用它。
- **`Deck.hide('name', ...)`**：从 talk 中去掉已注册的 slide，不删除代码。必须在 `Deck.start` 之前调用，因为 `start` 时才建立 DOM。
- **`Deck.start({ title, smoothBack })`**：设置 `document.title`，为每张 slide 建 `<section>`，初始化 Reveal（`hash: true`、`slideNumber: 'c'`、`transition: 'fade'`、`progress: true`，箭头只在触屏设备上显示），并注册 T、L 键和鼠标点击翻页。

### 2.4 数据

`talks/<talk>/data/<name>.js` 写入 `window.DATA.<name>`，slide 通过 `ctx.data.<name>` 读取。这些文件由 `tools/` 下的脚本生成（见 `AGENTS.md`），不要在 slide 里手写大段数据。

### 2.5 URL 参数与 hash

- `?theme=dark` 使用暗色；`light` 为默认。按 **T** 时，deck 把 `theme` 参数改写后整页刷新（`location.href = ...`），所以主题切换不是即时的。
- `#/n`：Reveal 的 hash 导航，`n` 从 0 起算（`#/0` 是第一张，`#/2` 是第三张；已在浏览器里确认）。

---

## 3. 版式系统

这是本章最重要的部分。所有 slide 都应当遵守这里的网格和字号。

### 3.1 画框与 `--u`

`web/deck.css` 第 25 行：

```css
--u: min(1vw, calc(100vh * 16 / 900));
```

- `.deck-frame` 宽 `100 * var(--u)`，宽高比 `16 / 9`，在窗口中居中（信箱式留白）。它的 `font-size` 为 `var(--u)`，所以**画框内 `1em` 等于 `1u`**。
- 因此 **`1u` = 画框宽度的 1%**。在 1920 × 1080 的窗口里 `--u` 为 19.2 px，画框就是 1920 × 1080；在别的窗口里所有尺寸等比缩放。
- 画框高度是 `56.25u`（= 100u × 9/16）。
- **百分比的基准不同**：`left`、`right`、`width` 的百分比相对于画框宽（100u）；`top`、`bottom`、`height` 的百分比相对于画框高（56.25u）。`top: 20%` 是 `11.25u`，不是 `20u`。

### 3.2 字号 token

| token | 定义 | 1920 宽时约 | 用途（deck.css 中的用法） |
|---|---|---|---|
| `--t-display` | `4.9u` | 94 px | 标题页标题 `.deck-title` |
| `--t-heading` | `3.4u` | 65 px | 每页标题 `.deck-heading`（加粗、accent 色） |
| `--t-lead` | `2.6u` | 50 px | 副标题 `.deck-subtitle`；目录行；关键陈述；`Deck.points` 的标题可用 `--col-title` 改成它 |
| `--t-body` | `2.25u` | 43 px | 导语 `.deck-lead`；署名 `.deck-byline`；点列标题的默认字号 |
| `--t-small` | `1.9u` | 36 px | 点列的副标题 `.deck-point-s`；署名下的单位行；次要文字 |
| `--t-caption` | `1.75u` | 34 px | 图注 `.deck-caption`；图例；开关 `.deck-switch` 的文字 |
| `--t-micro` | `1.4u` | 27 px | 提示、版权、来源小字（示例中结束页的致谢行用它） |

同一组文件里还有几个页脚的尺寸，只用于页脚本身：`--footer-h: 2.9u`，页脚文字和页码 `1.2u`。

**不要**写 `px`、`pt`、`rem`，也不要为一页单独写一个字号。需要更大或更小的字时，在 token 之间选；都不合适时，先想想是不是版式有问题。

### 3.3 竖向与横向网格

以下数值全部来自 `web/deck.css`。"u" 是画框宽度的 1%；竖向的数字换算为画框高（56.25u）。

| 区域 | 选择器 | 左 / 宽 | 上 / 高 | 字号 |
|---|---|---|---|---|
| 页边距 | — | 左右各 **4.2%**（4.2u） | — | — |
| 标题 | `.deck-heading` | 左 4.2%，无宽度限制 | 上 **5%**；行高 1.15 | `--t-heading`，700，accent |
| 导语 | `.deck-lead` | 左 4.2%，宽 **64%** | 上 **15.5%** | `--t-body`，muted |
| 图 | `.deck-figure` | 左 4.2%，宽 **52%** | 上 **17%**，高 **66%**（到 83%） | — |
| 点列 | `.deck-col` | 左 `--col-left`（默认 **59%**），到右边距 95.8% | 上 `--col-top`（默认 **19%**） | 标题 `--col-title`（默认 `--t-body`）；间距 `--col-gap`（默认 `1.4u`） |
| 图注 | `.deck-caption` | 左右各 4.2% | 上 **87%** | `--t-caption`，muted |
| 页脚 | `.deck-footer` | 贴窗口底边，全宽 | 高 `2.9u` | 1.2u，muted |
| 页码 | `.reveal .slide-number` | 右边距内 | 同页脚文字线 | 1.2u，600 |

标题页（`talks/example/slides/title.js` 和 `talks/materials-demo/slides/title.js`）用它自己的版式：标题左 8%、宽 84%，上 34%；副标题上 52%；署名上 70%。结束页、版权行等也都是各 slide 自己的定位（见第 4.10 节）。

竖向的带状划分（按画框高 56.25u 换算）：

- 0 – 约 12%：标题（5% 起，单行约占 7%）。
- 15.5% – 83%：内容带。导语在顶部，图和点列在中部，图注之前的留白约 4%。
- 87% – 约 91%：图注行。
- 页脚：2.9u 高，贴窗口底边。窗口恰为 16:9 时，它盖住画框底部约 5.2%，图注的行盒在 91% 之前结束，不会被遮住。

画框示意（`•` 为 `.deck-col` 的起点，数字为相对画框的百分比）：

```
  画框 = 100u × 56.25u                 水平百分比相对宽度，竖直百分比相对高度
 0% ┌──────────────────────────────────────────────────────────────────────┐
    │ 4.2%                                                          4.2%    │
 5% │ .deck-heading（--t-heading，加粗，accent）                              │
12% │                                                                      │
15.5%│ .deck-lead（宽 64%，--t-body，muted）                                 │
17% │ ┌───── .deck-figure（左 4.2%，宽 52%，高 66%）─────┐  •.deck-col      │
    │ │                                                 │   左 59%，上 19%  │
    │ │          canvas / svg 填满这个框                  │   到 95.8%       │
    │ │                                                 │                  │
83% │ └─────────────────────────────────────────────────┘                  │
87% │ .deck-caption（左右 4.2%，--t-caption，一行）                           │
91% │                                                                      │
100%└──────────────────────────────────────────────────────────────────────┘
      页脚 .deck-footer：2.9u 高，贴窗口底边，在画框之外（窗口恰为 16:9 时盖住底部约 5%）
```

几何检查：图框宽 52u，高 66% × 56.25u ≈ 37.1u，宽高比约 1.40。所以 `viewBox="0 0 640 460"`（1.39）的 SVG 正好填满它（`talks/example/slides/figure_points.js`）。

### 3.4 版式规则（做与不做）

- 做：标题固定在左上（不要移动），内容从 15.5% 以下开始，图注放在 `.deck-caption` 里。
- 做：用 `left: 4.2%` 或 `right: 4.2%` 对齐页边距。
- 做：图和点列对齐同一个上边（`--col-top` 与 `.deck-figure` 的 top 17% 接近即可，示例用 22%）。
- 不做：用 `px` 或新的字号。
- 不做：把内容放进标题与图注之间以外的地方，除非它就是那一页的主角（如全幅舞台）。
- 不做：让正文超出 `left: 4.2%` 到 `right: 4.2%` 的范围。

---

## 4. 版式组件

每个组件按下面的结构写：用途，何时用 / 何时不用，最小示例，参数与变量，排版建议，限制与坑，示例位置。

### 4.1 `.deck-heading`

**用途**：每页的标题，左上角，`--t-heading`，加粗，accent 色。

**何时用**：几乎所有内容页。**何时不用**：标题页与结束页（用 `.deck-title`）；需要超过一行的标题。

**最小示例**：

```html
<h2 class="deck-heading reveal-in in">A figure and its points</h2>
```

`in` 是静态写的，让标题从到达时就显示。如果标题要随步骤变化，改为 `class="deck-heading reveal-in" data-from="1"`（`talks/example/slides/outline.js` 用的是这种写法）。`talks/example/slides/alphabet.js` 用 `data-show="1 2 3"` 让标题随步骤切换。

| 项目 | 值 |
|---|---|
| 元素 | `h2`（标题页用 `h1.deck-title`） |
| 位置 | 固定 `left: 4.2%`，`top: 5%`（样式内置，不要覆盖） |
| 字号 | `--t-heading`，`font-weight: 700`，`line-height: 1.15` |
| 颜色 | `var(--accent)` |

**排版建议**：标题一行为宜。它没有宽度限制，过长会压到导语（15.5%）。字数上限未实测，待确认（第 10 章）。

**限制与坑**：带 `reveal-in` 却既没有 `data-from`/`data-show` 也没有静态 `in`，标题会一直透明（`opacity: 0`）。

**示例位置**：`talks/example/slides/figure_points.js`（`in`）；`talks/example/slides/outline.js`（`data-from`）；`talks/example/slides/alphabet.js`（`data-show`）。

### 4.2 `.deck-lead`

**用途**：标题下面的一句导语，`--t-body`，muted 色，宽 64%。

**何时用**：需要一句说明而不是列表。**何时不用**：超过两行的段落；要列出要点的时候（用 `Deck.points`）。

**最小示例**：

```html
<p class="deck-lead">一句话说明这一页在讲什么。</p>
```

| 项目 | 值 |
|---|---|
| 位置 | `left: 4.2%`，`top: 15.5%`，`width: 64%` |
| 字号 / 颜色 | `--t-body`，`var(--muted)` |

**排版建议**：导语与图并排时，图仍从 17% 开始，导语只占 15.5% 到约 20% 之间的一行。

**限制与坑**：`.deck-lead` 在两个示例 talk 中都没有使用（只在 CSS 中定义）。它的宽度是固定的 64%，导语写得很长时会换行，并与图重叠。

**示例位置**：没有示例 slide 使用它（仅 `web/deck.css` 第 186 行定义）。

### 4.3 `.deck-figure` + `Deck.points` + `.deck-col`

**用途**：左边一张图（`.deck-figure`），右边一列编号的要点（`Deck.points` 生成 `.deck-col`），每点击一次出现一个要点和图中对应的部分。这是本仓库最标准的"讲图"版式。

**何时用**：一张图（SVG、canvas 或 manim 舞台）配 2 到 4 个要点。**何时不用**：要点超过 4 个（页面会挤）；纯文字（用 `.deck-lead` 或单独的 slide）；图表（用 `Deck.groupedBars`，见 `web/plots.js`，本章不展开）。

**最小示例**（`talks/example/slides/figure_points.js` 的核心部分）：

```js
{
const POINTS = [
  { title: 'A slide is a module', sub: 'one JS file in slides/', from: 1 },
  { title: 'Steps are clicks',    sub: 'enter(step) shows steps 1..step', from: 2 },
  { title: 'The deck does the rest', sub: 'footer, themes, notes, overview', from: 3 },
];

Deck.slide('figure-points', {
  steps: 3,
  mount(frame, { palette: P, css, esc }) {
    css(`
      .fp-col { --col-top: 22%; --col-gap: calc(2.2 * var(--u)); }
      .fp-fig text { font-family: Lato, sans-serif; }
      .fp-fig .reveal-in { transform: none; }
    `);
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">A figure and its points</h2>
      <div class="deck-figure fp-fig"><svg viewBox="0 0 640 460">
        <!-- 图的各部分带 class="reveal-in" data-from="k"，与对应的要点同一步出现 -->
        <rect class="reveal-in" data-from="1" x="40" y="40" width="230" height="90" rx="14"
          fill="${P.accent}" fill-opacity=".12" stroke="${P.accent}" stroke-width="2.5"/>
      </svg></div>
      ${Deck.points(POINTS, { className: 'fp-col' })}
      <p class="deck-caption reveal-in" data-from="3">Captions sit on one line along the bottom.</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

`Deck.points` **返回字符串**（HTML），要放进 `innerHTML` 的模板里，不能直接 `appendChild`。

**参数与变量**：

`Deck.points(list, { className })` 的 `list` 每项：

| 键 | 默认 | 含义 |
|---|---|---|
| `title` | — | 要点标题；会被转义。 |
| `sub` | 无 | 标题下的小字；会被转义。 |
| `from` | 本项序号（从 1 起） | 从第几步开始显示（生成 `data-from`）。 |
| `num` | 本项序号 | 编号文字（默认显示 1, 2, 3……）。 |
| `html` | `false` | 为真时 `title` 与 `sub` 按 HTML 原样输出（示例中用于 `<code class="deck-code">`）。 |

`className` 加在 `.deck-col` 上，用来设置下面的变量。

CSS 变量（设在 `.deck-col` 或它的祖先上）：

| 变量 | 默认 | 控制 |
|---|---|---|
| `--col-left` | `59%` | 列的左缘；列宽 = `95.8% - --col-left`，右边距固定。 |
| `--col-top` | `19%` | 列的上缘。 |
| `--col-title` | `var(--t-body)` | 点的标题字号。 |
| `--col-gap` | `calc(1.4 * var(--u))` | 点与点之间的间距（`margin-bottom`）。 |

点的结构：`.deck-point` 包一个 `.deck-point-t`（标题，600，`<span>` 为 accent 色的编号，宽 1.4em）和一个可选的 `.deck-point-s`（副标题，`--t-small`，muted，左缩进 1.4em）。

**排版建议**：

- 图 `left: 4.2%`，`width: 52%`，`top: 17%`，`height: 66%`（样式内置）。SVG 用 `viewBox="0 0 640 460"` 可以不变形。
- 列的默认 `--col-left: 59%` 给图和列之间留约 2.8u 的缝。若图更窄，可以把 `--col-left` 调到 55%–60% 之间；不要调到 65% 以上，列会太窄。
- 列的 `--col-top` 示例用 22%，让首个要点与图的上半部分对齐。
- 要点数 = 步数：`Deck.points` 的 `from` 默认为 1, 2, 3……，所以 `steps` 要不小于最大的 `from`，并且每个要点的 `from` 要与图中对应元素的 `data-from` 相同。

**限制与坑**：

- 点列是流式布局，不能单独定位某一个点。要精确定位用 `Deck.show` 之外的手写 `.deck-col` 结构。
- `Deck.points` 的标题与副标题默认转义。要放 `<code>` 等标记，必须逐项加 `html: true`，并自己转义其中的数据。
- 点的 `reveal-in` 由 `Deck.show` 切换；列必须放在 `frame` 内，否则不会显示。

**示例位置**：`talks/example/slides/figure_points.js`（3 个要点，`.fp-col`）；`talks/example/slides/closing.js`（`.cl-col`，`html: true`，`--col-left: 8%`，`--col-title: var(--t-lead)`）。

### 4.4 `.deck-caption`

**用途**：页面底部的一行图注或来源，`--t-caption`，muted 色，左右各 4.2%，上 87%。

**何时用**：图的图注、一句说明、示例中结束页的仓库地址。**何时不用**：超过一行的文字（用 `.deck-lead` 或拆成几个点）。

**最小示例**：

```html
<p class="deck-caption reveal-in" data-from="3">Figure: the same cell, viewed along c.</p>
```

**参数与变量**：无。字号、颜色、位置都在样式里。

**排版建议**：在内容带底部放一行，不要放两行。图注与内容之间至少留一点距离（画框内 87% 与图的 83% 之间约 4%）。

**限制与坑**：没有自动换行控制（`white-space` 未设）。按 `--t-caption` 估算，中文约 55 字、拉丁字母约 110 字符即满一行（按平均字宽估算，未实测）。长图注要缩短。

**示例位置**：`talks/example/slides/figure_points.js`（`data-from="3"`）；`talks/example/slides/manim_graph.js`；`talks/example/slides/closing.js`（`.cl-repo`，并重设 `left`）。

### 4.5 `.deck-stage`

**用途**：一个铺满整个画框（`position: absolute; inset: 0`）的容器，给 manim-web 舞台、3D 视图或一张大图用。

**何时用**：整页是一张图或一段动画，只需要标题和一行图注叠在上面。**何时不用**：标准的"图 + 点列"（用 `.deck-figure`）。

**最小示例**（`talks/example/slides/manim_shapes.js` 的骨架，manim-web 部分省略）：

```js
frame.innerHTML = `
  <div class="deck-stage"></div>
  <h2 class="deck-heading reveal-in in">${esc('Shapes and transforms')}</h2>`;
const stage = Deck.manim(frame.querySelector('.deck-stage'), { /* build, steps */ });
```

**参数与变量**：

| 变量 / 类 | 效果 |
|---|---|
| `.deck-stage` | 铺满画框，透明背景，子元素相对于它定位。 |
| `.turnable` | 光标变为抓手（`grab`/`grabbing`，并关闭触摸滚动），用于可拖拽的 3D 视图。 |

**排版建议**：`.deck-stage` 放在 DOM 中**最前面**，标题和图注放在后面，它们会叠在舞台之上（后出现的定位元素在上层）。舞台中的图形要避开标题区（约 y < 15%）和图注区（约 y > 85%）。

**限制与坑**：舞台覆盖整个画框，所以它会吞掉标题和图注上的鼠标事件；需要点击的控件（`button`）放在舞台之上，且 `.deck-stage` 放在它之前。

**示例位置**：`talks/example/slides/manim_shapes.js`、`talks/example/slides/manim_graph.js`（manim-web 舞台）。`web/addons/turntable.js` 中也使用 `.deck-stage`（3D，不在本章范围）。

### 4.6 `<code class="deck-code">`

**用途**：行内代码，等宽，略小于正文，带浅色底。

**何时用**：一段 API、命令或文件名。**何时不用**：整段代码块（slide 上不放代码块，用截图或图）。

**最小示例**：

```html
<p class="deck-lead">Call <code class="deck-code">enter(step, animate)</code> on every click.</p>
```

**参数与变量**：无。字体为等宽栈，`font-size` 为父元素的 0.92em。

**限制与坑**：只用于行内。要放进 `Deck.points` 的副标题，必须加 `html: true`（见 4.3）。

**示例位置**：`talks/example/slides/closing.js`（`html: true` 的副标题）；`talks/example/slides/manim_shapes.js`（同样用法）。

### 4.7 `<kbd>` 按键

**用途**：画出一个键帽，例如 `<kbd>F</kbd>`。

**何时用**：标题页或结束页上列出按键。**何时不用**：正文中的一般说明。

**最小示例**（`talks/example/slides/title.js`）：

```js
`<p class="ti-keys deck-detail reveal-in" data-from="1" style="--i:3">${KEYS.map(([k, what]) =>
  `<span><kbd>${esc(k)}</kbd>${esc(what)}</span>`).join('')}</p>`
```

`kbd` 的样式只作用于 `.deck-frame kbd`，所以必须在画框之内使用。

**参数与变量**：无。

**排版建议**：示例页把按键行放在 86.5% 附近，用 `--t-caption` 字号，并用 `.deck-detail` 让它比正文安静。

**示例位置**：`talks/example/slides/title.js`（`.ti-keys`）。

### 4.8 强调类

| 类 | 效果 | 何时用 |
|---|---|---|
| `.deck-accent` | 文字为 accent 色（`var(--accent)`） | 一个词或短语需要和正文分开。 |
| `<mark class="deck-mark">` | 高亮笔划背景（`var(--mark)`），`padding: 0 .15em` | 一句话中真正承载结论的词。 |
| `.deck-muted` | 文字为 muted 色（`var(--muted)`） | 次要信息，不想抢眼。 |
| `.deck-detail` | 文字为 detail 色（比 muted 更淡） | 数据来源、致谢、版权。覆盖 slide 自己设的颜色。 |

**排版建议**：一页最多一个强调色（accent）的主体和一种高亮。强调要稀少，否则失去作用（第 8 章的规则）。

**限制与坑**：`.deck-mark` 是行内元素。要让它随步骤出现，把它包进一个 `display: inline-block` 的 `span` 上加 `reveal-in`（第 8.5 节的示例）。`.deck-accent`、`.deck-muted`、`.deck-mark` 在两个示例 talk 中没有直接使用，只在 CSS 中定义。`.deck-detail` 在示例中用于标题页按键行、结束页致谢行、蛋白页的来源行。

**示例位置**：`talks/example/slides/title.js`（`.deck-detail`）；`talks/example/slides/closing.js`（`.cl-credits.deck-detail`）。

### 4.9 步骤显示：`reveal-in`、`data-from`、`data-show`、`--i`、`Deck.show`

**用途**：让一页的元素一步一步出现。这是本仓库里所有 slide 的标准做法。

**何时用**：几乎所有有多步的 slide。**何时不用**：只有一步的页（不需要）。

**最小示例**：

```js
frame.innerHTML = `
  <h2 class="deck-heading reveal-in in">Title</h2>                       <!-- 始终显示 -->
  <p class="deck-lead reveal-in" data-from="2">第 2 步起显示</p>
  <p class="deck-caption reveal-in" data-show="1 3">只在第 1 步和第 3 步显示</p>
  <div class="reveal-in" data-from="2" style="--i:1">第二个元素，比前一个晚 0.09 s</div>`;
return { enter: (step, animate) => Deck.show(frame, step, animate) };
```

**`Deck.show(frame, step, animate = true)`** 对 `frame` 内所有带 `data-from` 或 `data-show` 的元素做这件事：

- 有 `data-show="1 3"`：在第 1、3 步显示，第 2 步隐藏（`data-show` 优先）。
- 有 `data-from="k"`：第 k 步及以后显示。
- 满足条件则加上类 `in`，否则去掉 `in`。
- `animate` 为 `false` 时，画框加 `instant`，没有过渡。

**`.reveal-in`** 的样式（`web/deck.css`）：未加 `in` 时 `opacity: 0` 并向左偏移 0.6em；加 `in` 后淡入并归位，过渡 0.5 s。`--i` 设置延迟，每单位 0.09 s，用于同时出现的兄弟元素依次进场。

**参数与变量**：

| 名称 | 类型 | 含义 |
|---|---|---|
| `data-from="k"` | 属性 | 从第 k 步起显示。 |
| `data-show="a b"` | 属性 | 只在列出的步骤显示（空格分隔）。 |
| `.reveal-in` | 类 | 淡入和位移的过渡（需要在 `.deck-frame` 之内）。 |
| `.in` | 类 | 显示状态。可以静态写上，表示始终显示。 |
| `--i` | CSS 变量 | 进场延迟的序号（0.09 s × i）。 |

**排版建议**：

- 同一步出现的元素共用同一个 `data-from`，用 `--i` 错开。
- 图（SVG）中的部分也用 `reveal-in` 和 `data-from`；SVG 里可设 `.fp-fig .reveal-in { transform: none; }`，让图形只淡入、不位移（`figure_points.js` 的做法）。

**限制与坑**：

- `reveal-in` 没有 `data-from`、`data-show` 也没有静态 `in`，会永远透明。
- `data-from` 大于 `steps` 的元素永远不会出现。
- `reveal-in` 用在行内元素（如 `<mark>`）上时，`transform` 不生效，只剩淡入。行内元素要加 `display: inline-block`。
- `Deck.show` 只切换带 `data-from` 或 `data-show` 的元素；其他元素要在 `enter` 里自己处理。
- `data-show` 的元素在 `alphabet.js` 中被大量使用，它还有自己的显示逻辑（`alphabet.js` 第 227 行起），新 slide 不要照抄那部分。

**示例位置**：`talks/example/slides/title.js`（`data-from`、`--i`）；`talks/materials-demo/slides/title.js`（`data-from`、`--i`）；`talks/example/slides/alphabet.js`（`data-show`）。

### 4.10 标题页与结束页：`.deck-title`、`.deck-subtitle`、`.deck-byline`

**用途**：标题页的标题、副标题、署名。它们定位在 8% 的左缘，宽 84%。

| 类 | 位置 | 字号 | 备注 |
|---|---|---|---|
| `.deck-title` | 左 8%，上 34%，宽 84% | `--t-display`，700，行高 1.12 | `h1` |
| `.deck-subtitle` | 左 8%，上 52%，宽 84% | `--t-lead`，muted | `p` |
| `.deck-byline` | 左 8%，上 70% | `--t-body` | 内部 `<span>` 为块级，`--t-small`，muted，上边距 .3em |

**最小示例**（`talks/materials-demo/slides/title.js`）：

```js
frame.innerHTML = `
  <h1 class="deck-title reveal-in" data-from="1">Crystal structures, live</h1>
  <p class="deck-subtitle reveal-in" data-from="1" style="--i:1">Bonds, coordination polyhedra and layers</p>
  <div class="deck-byline reveal-in" data-from="2">${esc('Your Name')}<span>${esc('Your group · Your institution · Date')}</span></div>`;
```

**限制与坑**：标题超过一行时，第二行会压到副标题（副标题固定在 52%）。标题要短，或者在该页自己的样式里调整 `top`。一行能放多少字未实测（第 10 章）。

**结束页**：`talks/example/slides/closing.js` 用 `.deck-heading`、`Deck.points`（`--col-left: 8%`）和 `.deck-caption` 组成，不使用 `.deck-title`。它的致谢行为 `.cl-credits`，位置与字号由该页自己定义（`--t-micro`）。

**示例位置**：`talks/example/slides/title.js`；`talks/materials-demo/slides/title.js`；`talks/example/slides/closing.js`。

### 4.11 `.deck-switch`：画上的开关

**用途**：一个绝对定位的开关，用于在图上打开/关闭某个内容（例如"显示晶胞"）。

**何时用**：一张图需要观众自己切换两种状态。**何时不用**：每一步都要变化的内容（用步骤）。

**最小示例**：

```js
css(`.sw-cells { left: 4.2%; top: 14%; }`);
frame.innerHTML = `<button class="deck-switch sw-cells" aria-pressed="true"><i></i>Show cell</button>`;
frame.querySelector('.sw-cells').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', String(on));
  e.currentTarget.blur();   // 让方向键回到演示，而不是停在按钮上
  /* 在这里更新图 */
});
```

**参数与变量**：

| 属性 / 类 | 效果 |
|---|---|
| `aria-pressed="true"` | 开启状态（accent 色轨道，滑块在右）。 |
| `<i></i>` | 轨道；必须包含。 |
| `.off-stage` | 隐藏并禁用点击（用于在某一步之前不显示开关）。 |

按钮位置由 slide 自己设定（样式里只设了 `position: absolute`）。

**限制与坑**：deck 忽略按钮上的点击（`button` 属于 `CONTROLS`），所以点开关不会翻页；但开关被点击后要 `blur()`，否则方向键会作用在按钮上。

**示例位置**：`talks/example/slides/` 中目前没有使用 `.deck-switch` 的 slide（`AGENTS.md` 提到分子页使用，但在 `molecule.js` 中未找到）。见第 10 章。

---

## 5. 颜色

### 5.1 规则

- **CSS 用变量**：`var(--fg)`、`var(--muted)`、`var(--accent)`、`var(--detail)`、`var(--done)`、`var(--mark)`，以及图表用的 `var(--plot-1..5)`。
- **canvas、SVG 属性、manim-web 对象用 `palette`**（即 `ctx.palette`，或 `Deck.palette`）：`P.fg`、`P.muted`、`P.accent`、`P.series[i]`、`P.ss`、`P.cpk` 等。`palette` 与 CSS 变量取同样的颜色。
- **不要硬编码颜色**：不要写白色、黑色或任何 hex 颜色。两个主题都必须可读。
- 改了某个主题颜色，要同时改 `web/deck.css`（`:root` 和 `:root[data-theme="dark"]`）与 `web/deck.js` 中的 `PALETTES`，两者必须一致。

### 5.2 CSS 变量（来自 `web/deck.css`）

| 变量 | 亮色（默认） | 暗色 | 用途 |
|---|---|---|---|
| `--bg` | `#fbfaf8` | `#0f1218` | 背景 |
| `--fg` | `#1d2129` | `#e8eaed` | 正文 |
| `--muted` | `#5c6370` | `#9aa0a6` | 导语、图注、次要文字 |
| `--accent` | `#2f55d4` | `#7aa2f7` | 标题、编号、要点的指向 |
| `--done` | `#1f9d55` | `#5cc98a` | 已完成的主题（页脚的圆点） |
| `--detail` | `#9ba1aa` | `#6e747c` | 来源、致谢（比 muted 更淡） |
| `--mark` | `rgba(255, 212, 0, .45)` | `rgba(250, 204, 21, .32)` | `<mark class="deck-mark">` 的底色 |
| `--plot-1..5` | `#98a6bc`、`#dfaa3e`、`var(--accent)`、`var(--done)`、`#cf3434` | `#7d8aa0`、`#d9a93f`、`var(--accent)`、`var(--done)`、`#ef6b6b` | 图表颜色（见 `Deck.groupedBars`，本章不展开） |

### 5.3 `Deck.palette` 的键（来自 `web/deck.js`）

| 键 | 含义 |
|---|---|
| `bg`、`fg`、`muted`、`detail`、`accent`、`done` | 与上表的 CSS 变量一一对应。 |
| `series[0..4]` | 与 `--plot-1..5` 对应的五种颜色。 |
| `rainbow[0..5]` | 六色序列，用于需要多个类别的场合。 |
| `neutral` | 灰色，给"背景"的部分（非重点）。 |
| `ligand`、`metal` | 3D 小分子的配体碳、金属离子颜色（3D 不在本章范围）。 |
| `ss` | `{H, E, C}`：螺旋、折叠、线圈，3D 用。 |
| `el` | `{C, N, O, S, P, other}`：元素颜色，平面图用。 |
| `ambient` | 3D 环境光强度（亮色 1.1，暗色 0.35）。 |
| `cpk` | Jmol CPK 颜色表。 |

### 5.4 建议（不是代码强制的）

- 一页最多**一个主色**（正文 `--fg`）加**一个强调色**（`--accent`）。`--muted` 和 `--detail` 用于次要文字，不算主色。
- 高亮（`<mark>`）和 `--done` 不要与强调色同时用在同一句话上。

---

## 6. 节页脚（section footer）

页脚是一条贴在窗口底边的栏，列出 talk 的各个分组，当前分组高亮，并可以按主题（topic）显示小圆点。它由 `Deck.sections`、`Deck.section`、`Deck.topics`、`Deck.expand`、`Deck.topicsOf` 与 `Deck.hide` 配置。

### 6.1 API

| 调用 | 作用 |
|---|---|
| `Deck.sections([[num, name], ...])` | 设定页脚的分组，`num` 转为字符串。`name` 是页脚显示的短名。 |
| `Deck.section(num)` | 之后注册的 slide 属于分组 `num`；`null` 表示不属于任何分组（不显示页脚）。 |
| `Deck.topics({ num: [[title, [slideNames], blurb], ...] })` | 把分组拆成主题。每个主题列出它包含的 slide 名。`blurb` 不在页脚显示，只能通过 `Deck.topicsOf` 取得。 |
| `Deck.topicsOf(num)` | 返回该分组的主题数组（没有则为 `[]`）。 |
| `Deck.expand(...nums)` | 当处于该分组时，页脚整条让给它：前面的分组缩成数字，主题展开为分段（`num.1`、`num.2`……），按进度填充。 |
| `Deck.hide(...names)` | 从 talk 中去掉这些 slide（在 `Deck.start` 之前调用）。被隐藏的 slide 仍可出现在主题列表中，页脚会跳过它。 |

### 6.2 页脚的行为

- 页脚只在有分组的 slide 上显示；标题页和结束页（`Deck.section(null)`）隐藏它。概览（O）中隐藏。
- 点击分组名跳到该分组的第一张 slide；点击展开的分段跳到该主题的第一张 slide。
- 当前分组的每个主题一个圆点：已完成的为 `--done` 色实心，当前的为 accent 色实心，之后的为空心。不属于任何主题的 slide 归入"已经开始的最后一个主题"。
- 展开的分组（`expand`）中，每个分段顶部有一条 2 px 的进度线，已完成的满格，当前的按本主题内的进度填充。

### 6.3 工作示例

来自 `talks/materials-demo/slides/outline.js`（略去注释）：

```js
const OUTLINE = [
  ['1', 'Perovskites: cell, bonds, octahedra'],
  ['2', 'Layered structures: quintuple layers'],
];
const FOOTER = { 1: 'Perovskites', 2: 'Layered structures' };
Deck.sections(OUTLINE.map(([num, heading]) => [num, FOOTER[num] || heading]));

Deck.topics({
  1: [['SrTiO₃', ['srtio3'], 'cubic cell, Ti–O bonds, the TiO₆ octahedron']],
  2: [['Bi₂Te₃', ['bi2te3'], 'hexagonal cell, Bi–Te bonds, one quintuple layer']],
});

Deck.slide('outline', {
  steps: 1 + OUTLINE.length,
  mount(frame, { css, esc }) {
    css(`.o-list { position: absolute; left: 6.5%; top: 20%; }
      .o-row { display: flex; align-items: baseline; font-size: var(--t-lead); margin-bottom: 1.25em; }
      .o-num { width: 1.45em; font-weight: 700; color: var(--accent); }`);
    frame.innerHTML = `<h2 class="deck-heading reveal-in" data-from="1">Outline</h2>
      <div class="o-list">${OUTLINE.map(([num, heading], i) => `
        <div class="o-row reveal-in" data-from="${i + 2}"><span class="o-num">${esc(num)}</span>${esc(heading)}</div>`).join('')}</div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
```

并在 `index.html` 中，每个分组的 slide 前加 `<script>Deck.section(n)</script>`（见第 2.2 节）。

`talks/example/slides/outline.js` 演示了 `Deck.expand('2')`：分组 2 有两个主题（`2.1`、`2.2`），进入它时页脚整条展开。它的概览 slide 还支持 `highlight` 参数，让同一张目录页在分组之间重复使用，已经点亮的分组保持高亮、其余变暗（`outlineSlide({ highlight: '2' })`）。

### 6.4 `Deck.topicsOf` 的用法

`Deck.topicsOf` 用来做一张"清单"页，列出某个分组的主题。它在示例中没有使用，只按 `web/deck.js` 中的实现描述：

```js
Deck.slide('checklist-2', {
  steps: 1,
  mount(frame, { esc }) {
    const rows = Deck.topicsOf('2').map(([title, , blurb]) =>
      `<p class="ck-row">${esc(title)} · <span class="deck-muted">${esc(blurb)}</span></p>`).join('');
    frame.innerHTML = `<h2 class="deck-heading reveal-in in">${esc('Section 2')}</h2>${rows}`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
```

（`ck-row` 的样式需要该页自己定义；它不在 deck.css 中。）

---

## 7. 演示时的按键

| 键 / 操作 | 作用 | 来源 |
|---|---|---|
| →、← | 前进、后退一步（含片段） | Reveal |
| 左键单击 | 前进一步 | `web/deck.js` |
| 右键单击 | 后退一步 | `web/deck.js` |
| S | 演讲者备注（含计时器与下一页） | Reveal notes 插件 |
| O | 概览（overview）；Esc 退出 | Reveal |
| F | 全屏 | Reveal |
| T | 切换亮/暗主题（刷新页面，改写 `?theme=`） | `web/deck.js` |
| L | 激光笔（红点跟随鼠标，鼠标移动后才出现） | `web/deck.js` |
| `#/n` | 直接跳到下标为 n 的那张（从 0 起算，`#/0` 是第一张） | Reveal |

鼠标点击的判定（`web/deck.js` 中 `pointerup`）：移动超过 6 px 视为拖拽，不翻页；点在 `button`、`a`、`input`、`select`、`textarea`、`label` 或 `[role="button"]` 上不翻页。3D 页需要拖拽的时候要考虑这一点。

---

## 8. 版式配方（Recipes）

以下五种版式都可以直接复制。每种给出一个草图、用到的类与变量、一段可运行的 slide，以及做与不做。

### 8.1 标题页（title）

草图：

```
┌────────────────────────────────────────────┐
│                                            │
│   8%  ┌──────────────────────────────┐     │  34%  .deck-title（display）
│       │ Title                        │     │
│       └──────────────────────────────┘     │
│       Subtitle（lead，muted）              │  52%  .deck-subtitle
│                                            │
│       Name                                 │  70%  .deck-byline
│       Group · Institution · Date（small）  │
└────────────────────────────────────────────┘
```

完整代码（与 `talks/materials-demo/slides/title.js` 相同的结构）：

```js
{
Deck.slide('title', {
  steps: 2,
  notes: '标题页。',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <h1 class="deck-title reveal-in" data-from="1">${esc('Talk title')}</h1>
      <p class="deck-subtitle reveal-in" data-from="1" style="--i:1">${esc('One line on what the talk is')}</p>
      <div class="deck-byline reveal-in" data-from="2">${esc('Your Name')}<span>${esc('Your group · Institution · Date')}</span></div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

在 `index.html` 中它必须在 `Deck.section(null)` 之后，且是第一张。

- 做：标题尽量短（一行）；副标题一句话。
- 做：署名放在第二步出现，标题先出现。
- 不做：在标题页放列表或正文段落。
- 不做：把 `.deck-title` 的 `top` 改成超过 40%；底部留给署名。

### 8.2 目录页（outline）

草图（两个分组，分组号与标题左对齐，按步出现）：

```
┌────────────────────────────────────────────┐
│ Outline                                    │  5%  .deck-heading
│                                            │
│  1   First section                         │  20%  .ol-list，每行 --t-lead
│                                            │
│  2   Second section                        │
│                                            │
│  3   Third section                         │
│                                            │
└────────────────────────────────────────────┘
```

完整代码（每点击一次显示一行；与 `talks/materials-demo/slides/outline.js` 的做法一致，左缘取页边距 4.2%）：

```js
{
const OL = [
  ['1', 'First section'],
  ['2', 'Second section'],
  ['3', 'Third section'],
];
Deck.slide('outline-recipe', {
  steps: 1 + OL.length,
  notes: '目录：每点击一次显示一节。',
  mount(frame, { css, esc }) {
    css(`
      .ol-list { position: absolute; left: 4.2%; top: 20%; }
      .ol-row { display: flex; align-items: baseline; font-size: var(--t-lead); margin-bottom: 1.25em; }
      .ol-num { width: 1.45em; font-weight: 700; color: var(--accent); }
    `);
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Outline')}</h2>
      <div class="ol-list">${OL.map(([n, t], i) => `
        <div class="ol-row reveal-in" data-from="${i + 2}"><span class="ol-num">${esc(n)}</span>${esc(t)}</div>`).join('')}</div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

- 做：分组名保持短（页脚中使用）；在 `Deck.sections` 中给出短名。
- 做：页面只放编号和名字，不放描述。
- 不做：在目录页放副标题超过一行的内容。
- 注意：示例 `outline.js` 中 `.o-list` 的左缘是 6.5%，那是示例自己的缩进，不是版式规范。本配方取 4.2%（待确认，第 10 章）。

### 8.3 图左 + 点列右（figure-left + points-right）

草图：

```
┌────────────────────────────────────────────┐
│ Heading（accent，加粗）                    │  5%
│ Lead（可选，muted）                        │  15.5%
│ ┌──────────────────┐  1  Point title       │  22%  .rf-col（--col-top）
│ │                  │     sub line          │
│ │    .deck-figure  │  2  Point title       │
│ │    （SVG）       │     sub line          │
│ │                  │  3  Point title       │
│ └──────────────────┘                       │  83%
│ Caption（一行）                            │  87%
└────────────────────────────────────────────┘
```

完整代码（与 `figure_points.js` 同一结构，图用三个元素示意）：

```js
{
const RF_POINTS = [
  { title: '第一点', sub: '一句话说明', from: 1 },
  { title: '第二点', sub: '一句话说明', from: 2 },
  { title: '第三点', sub: '一句话说明', from: 3 },
];
Deck.slide('figure-points-recipe', {
  steps: 3,
  notes: '图与点列同步出现。',
  mount(frame, { palette: P, css, esc }) {
    css(`
      .rf-col { --col-top: 22%; --col-gap: calc(2.2 * var(--u)); }
      .rf-fig text { font-family: Lato, sans-serif; }
      .rf-fig .reveal-in { transform: none; }
    `);
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Figure and points')}</h2>
      <div class="deck-figure rf-fig"><svg viewBox="0 0 640 460">
        <rect class="reveal-in" data-from="1" x="60" y="60" width="260" height="110" rx="14"
          fill="${P.accent}" fill-opacity=".12" stroke="${P.accent}" stroke-width="2.5"/>
        <rect class="reveal-in" data-from="2" x="320" y="200" width="260" height="110" rx="14"
          fill="${P.accent}" fill-opacity=".12" stroke="${P.accent}" stroke-width="2.5"/>
        <rect class="reveal-in" data-from="3" x="120" y="330" width="260" height="90" rx="14"
          fill="none" stroke="${P.muted}" stroke-width="2.5"/>
      </svg></div>
      ${Deck.points(RF_POINTS, { className: 'rf-col' })}
      <p class="deck-caption reveal-in" data-from="3">${esc('图注：一行，说明图是什么。')}</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

- 做：图的 `viewBox` 取 `640 × 460`（与 52u × 37.1u 的框对应）；图中的部件与要点的 `from` 一一对应。
- 做：要点 2 到 4 个，每个标题一行，副标题一行。
- 做：`--col-top` 与图的起点接近（示例 22%，图 17%）。
- 不做：列宽过窄（`--col-left` 不要超过 65%）。
- 不做：在图和列之间放额外的文字框。

### 8.4 整幅舞台 + 图注（full-width stage with caption）

草图：

```
┌────────────────────────────────────────────┐
│ Heading（左上，叠在舞台上）                │  5%
│                                            │
│   ○       ○       ○    .deck-stage 的图    │  17%–83%（SVG 占 91.6% × 66%）
│                                            │
│ Caption：一行                              │  87%
└────────────────────────────────────────────┘
```

完整代码（`.deck-stage` 放最前，标题和图注在它之上）：

```js
{
Deck.slide('stage-recipe', {
  steps: 2,
  notes: '整幅图；第二步给出图注。',
  mount(frame, { palette: P, css, esc }) {
    css(`
      .rst-fig { position: absolute; left: 4.2%; top: 17%; width: 91.6%; height: 66%; }
      .rst-fig text { font-family: Lato, sans-serif; }
    `);
    frame.innerHTML = `
      <div class="deck-stage">
        <svg class="rst-fig reveal-in" data-from="1" viewBox="0 0 1500 600" preserveAspectRatio="xMidYMid meet">
          <g fill="${P.accent}" fill-opacity=".15" stroke="${P.accent}" stroke-width="3">
            <circle cx="300" cy="300" r="90"/>
            <circle cx="750" cy="300" r="90"/>
            <circle cx="1200" cy="300" r="90"/>
          </g>
        </svg>
      </div>
      <h2 class="deck-heading reveal-in in">${esc('Three sites')}</h2>
      <p class="deck-caption reveal-in" data-from="2">${esc('图注：一行。')}</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

- 做：舞台内的图形避开标题区（y 在画框的 17%–83% 之间）和图注区。
- 做：如果舞台是 manim-web 或 3D，把 `Deck.manim(frame.querySelector('.deck-stage'), …)` 或同类调用放在 `enter` 之前的 `mount` 中，并在 `destroy` 中释放。
- 不做：在舞台之上再放 `.deck-figure`。
- 不做：把 `.deck-stage` 放在标题之后（它会盖住需要点击的控件，且透明背景也会挡住标题上的鼠标事件）。

### 8.5 陈述页（statement / quote）

草图：

```
┌────────────────────────────────────────────┐
│ Heading（可选，accent）                    │  5%
│                                            │
│   一句话结论，其中 [关键词] 用高亮。        │  34%  .rs-text（--t-lead，居中偏左）
│                                            │
│   — 来源（detail 色）                      │  66%  .rs-by
│                                            │
└────────────────────────────────────────────┘
```

完整代码（只放一句陈述，关键词用 `<mark>` 高亮，并随第 2 步出现）：

```js
{
Deck.slide('statement-recipe', {
  steps: 3,
  notes: '一句结论；第二步高亮关键词；第三步给出来源。',
  mount(frame, { css, esc }) {
    css(`
      .rs-text { position: absolute; left: 8%; right: 8%; top: 34%; margin: 0;
        font-size: var(--t-lead); font-weight: 600; line-height: 1.35; }
      .rs-by { position: absolute; left: 8%; top: 66%; margin: 0; font-size: var(--t-small); }
      .rs-key { display: inline-block; }
    `);
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Result')}</h2>
      <p class="rs-text reveal-in" data-from="1">${esc('Bi₂Te₃ is a layered semiconductor whose layers are held together by ')}<span class="rs-key reveal-in" data-from="2"><mark class="deck-mark">${esc('van der Waals forces')}</mark></span>${esc('.')}</p>
      <p class="rs-by deck-detail reveal-in" data-from="3">${esc('Source: your reference, year')}</p>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
}
```

- 做：一句陈述，不超过两行；关键词（一到两个）用 `<mark class="deck-mark">`。
- 做：来源用 `.deck-detail`，放在下方，比正文淡。
- 做：陈述用 `--t-lead`（不要用 `--t-display`，那是标题页的字号）。
- 不做：用多句陈述或引用列表。
- 不做：在一页里同时使用 `<mark>`、强调色和加粗；选一个。

（这个配方中 `.rs-text` 的字号用 `--t-lead` 只是本仓库的约定，deck.css 没有给 quote 单独定义。）

### 8.6 通用规则（做与不做）

- 做：每页一个标题（`.deck-heading`）、一个主题、一个图或一组点。
- 做：所有文字用 token；所有位置用百分比或 `u`；颜色用变量。
- 做：每个 `data-from` 对应 `steps` 内的一步。
- 做：每张 slide 用自己的类前缀，并把样式通过 `css()` 注入。
- 不做：`px`、`pt`、`rem`，或 `font-size: 17px` 之类的字号。
- 不做：段落、项目符号列表。要列的东西用 `Deck.points` 或一行一个的短行（见 4.3）。
- 不做：硬编码颜色（白色、黑色、hex）。
- 不做：超过一行的图注。
- 不做：同一页里超过一个强调色。

---

## 9. 易错点（Pitfalls）

1. **同名类在不同 slide 之间冲突。** `css()` 按文本去重，不按选择器。两张 slide 各自定义 `.o-row`，规则不同，后挂载的那张会覆盖前一张的样式（样式在 `mount` 时才注入）。每张 slide 用唯一前缀。
2. **忘了写 `destroy`。** 3D 或 manim-web 的页被卸载时，WebGL 上下文不释放，浏览器只能保留约 16 个，超过后最老的画布会被丢弃，包括仍在屏上的那一页。
3. **`enter` 不是跳转安全的。** 只依赖上一步的变量或做增量（`if (step === 2)`），直接跳到第 3 步时第 2 步的内容不会出现。
4. **在 `mount` 外保存状态。** `mount` 在一张页被冻结后会再次执行，模块级变量和旧的 DOM 引用会失效。
5. **在 `mount` 中启动动画或定时器。** 页面会被预建（到达前）并立即 `leave`，动画会在看不见时跑完，或在看见时已经结束。动画放进 `enter`，并在 `leave` 中停止。
6. **用 `px` 或新的字号。** 在不同的窗口里会失去比例。
7. **百分比的基准混淆。** `top`、`height` 相对画框高（56.25u）；`left`、`width` 相对画框宽（100u）。
8. **`reveal-in` 没有出现条件。** 既没有 `data-from`、`data-show`，也没有静态 `in`，元素会一直透明。
9. **`data-from` 大于 `steps`。** 元素永远不出现。`steps` 必须不小于最大的 `data-from`。
10. **`reveal-in` 用在行内元素上。** `transform` 对行内元素无效，只会淡入。行内元素加 `display: inline-block`。
11. **`Deck.points` 的返回值当成 DOM 节点。** 它是字符串，放进 `innerHTML` 模板中。
12. **点列的 `html` 未设置却放了标记。** 默认会被转义，`<code>` 显示为文字。需要标记时逐项加 `html: true`。
13. **忘了 `Deck.section(...)`。** 之后的 slide 进入了上一个分组，或在标题页的 `Deck.section(null)` 之前。检查 `index.html` 中的顺序。
14. **`Deck.hide` 放在 `Deck.start` 之后。** `start` 已经建好了 DOM，隐藏无效。
15. **顶层 `const` 冲突。** 普通脚本共享全局词法环境。整个文件用 `{ ... }` 包住。
16. **可点击的非按钮元素会翻页。** deck 只忽略 `button`、`a`、`input`、`select`、`textarea`、`label` 和 `[role="button"]` 上的点击。自制的可点击元素要加 `role="button"`。
17. **3D 页没有设 `interactive: true`。** 触摸拖拽会被当作滑动翻页。
18. **标题换行压到副标题。** 副标题固定在 52%，长标题会与它重叠。
19. **图注超过一行。** `.deck-caption` 不会换行控制，会被截断或压到页脚。
20. **舞台放在标题之后。** `.deck-stage` 覆盖整个画框，会挡住标题和图注上的点击。
21. **颜色只改了一边。** 改了 `deck.css` 没改 `PALETTES`（或反过来），canvas 与 CSS 的颜色会不一致。
22. **不实现 `freeze`。** 画布（WebGL）页在缩略图（O 键概览）中会是空白。
23. **`--i` 过大。** 延迟为 0.09 s × i，`--i: 10` 就是 0.9 s，观众会觉得卡顿。同一步的兄弟元素用 2 至 4 之间的值。

---

## 10. 待确认

以下各项在阅读代码时无法确定，或与其他文档不一致。本章没有擅自给出结论：

1. **页面冻结的距离。** `web/deck.js` 中 `KEEP = 3`（超过 3 张冻结），注释也写的是"3 keeps at most 7 slides live"。`AGENTS.md` 写的是"within 2 of the current one"（约 2 张）。以代码为准，`AGENTS.md` 可能已过时，需要确认。
2. （已解决）`#/n` 的 `n` 从 0 起算：浏览器里 `#/2` 打开的是第三张；`AGENTS.md` 已改。
3. **背景颜色。** `web/deck.css` 的亮色背景 `--bg` 为 `#fbfaf8`（略带暖色的白）。如果项目偏好纯白，需要确认并同步修改 `deck.css` 与 `PALETTES`。
4. **`.deck-switch` 的用例。** `AGENTS.md` 提到分子页（`molecule.js`、`protein.js`、`design_check.js`）使用 `.deck-switch`，但在 `talks/example/slides/molecule.js` 与 `protein.js` 中未找到该类。本章的开关示例是按 `web/deck.css` 写的，未经示例核对。
5. **顶层 `const`。** `talks/example/slides/outline.js` 与 `talks/materials-demo/slides/outline.js` 的顶层 `const OUTLINE`、`FOOTER` 没有包块。这是有意的（每个 talk 只有一份），还是应当统一包块，需要确认。
6. **标题与副标题的字数上限、图注的字数上限。** 上面给出的字数是按平均字宽的估算，未在浏览器中测量。
7. **`Deck.topics` 的 `blurb`。** `web/deck.js` 不在页脚显示 `blurb`，只通过 `Deck.topicsOf` 返回。是否有意如此，没有示例演示。
8. **`Deck.hide`、`Deck.topicsOf`、`Deck.expand` 之外的用例。** `Deck.hide` 与 `Deck.topicsOf` 在 `talks/` 中没有使用；`Deck.expand` 只在 `talks/example/slides/outline.js` 中使用。
9. **目录页的左缘。** `talks/example/slides/outline.js` 与 `talks/materials-demo/slides/outline.js` 使用 `left: 6.5%`，而页边距为 4.2%。是否有意缩进，需要确认。本章的目录配方使用 4.2%。
10. **`.deck-lead`、`.deck-accent`、`.deck-muted`、`.deck-mark` 没有示例用例。** 只按 CSS 写。
11. **quote 字号。** 陈述页的 `--t-lead` 是本章的建议，`web/deck.css` 中没有为引文单独定义字号。
