# AGENTS.md — working in this repo

Instructions for coding agents (Claude Code, Codex, and others) and for people. `CLAUDE.md` points here; keep
one copy of the rules, in this file.

## What this is

A template for **live slide decks for materials-science talks**: every slide is a small JavaScript module that
draws itself in the browser while you present — HTML and SVG for text and diagrams,
[manim-web](https://github.com/maloyan/manim-web) (a TypeScript port of manim) for anything that animates, and
3D add-ons: a **crystal-structure view** (atoms, bonds, coordination polyhedra, layers, lattice vectors; bonds by
pymatgen's rule) and a turntable stage for molecules. Reveal.js supplies only navigation, click-steps and speaker
notes. No build step, no rendered video: edit a file, refresh the browser. Decks work offline and straight from
disk (`file://`).

The repo started as a fork of [ramithuh/protein-design-interactive-slides](https://github.com/ramithuh/protein-design-interactive-slides)
(MIT). `talks/example/` is that project's demo, kept unchanged as the reference for every feature: its molecule and
protein slides are biology-flavoured, and are there to show the turntable stage, not as content for our talks.
`talks/materials-demo/` is the materials one — start from it. **To build a talk, read [docs/handbook/README.md](docs/handbook/README.md) first**: it says which component fits which need and how to lay slides out; this file keeps the rules.

## Layout

| Path | What it is |
| --- | --- |
| `web/deck.js` | The runtime: slide registry, steps, section footer, themes, laser pointer, click navigation, WebGL budget. Also `Deck.show` and `Deck.points`. |
| `web/deck.css` | **The design language**: type scale, colours, layout grid, footer, step reveals, points column, chart layout. |
| `web/manim.js` | `Deck.manim`: a manim-web scene that plays one step per click. |
| `web/plots.js` | `Deck.groupedBars`: the one bar-chart layout. |
| `web/echarts.js` | `Deck.echart`: thin lifecycle/theme bridge to locally vendored Apache ECharts. Standard charts use native ECharts options; demo in `talks/plot-gallery/slides/echarts.js`. |
| `web/line_chart.js`, `funnel_chart.js`, `hull_chart.js`, `phonon_chart.js`, `spectra.js` | Optional data-driven line/scatter, funnel, binary hull, phonon, band/DOS and XRD components. Load after `deck.js` and `manim.js`; hull and phonon also load `line_chart.js` first. |
| `web/llm_math.js`, `llm.js`, `llm_flow.js` | Optional educational LLM calculations and slides: tokens, attention, sampling, diagrams, agent traces and embeddings. Load in that order after `deck.js`. |
| `web/addons/crystal_legend.js` | Optional element legend for a hand-built crystal view, loaded after `crystal.js`. |
| `web/addons/crystal.js`, `crystal_logic.js`, `bond_rules.js` | **The crystal add-on** (see below): `Deck.CrystalView`, `Deck.crystalSlide`, `Deck.crystalLogic`. `bond_rules.js` is generated (pymatgen's bonding rule); load it, then `crystal_logic.js`, then `crystal.js`. |
| `web/addons/` (others) | The molecule add-on: `molstar.js` (a Mol*-like look), `cartoon.js` (protein cartoons), `turntable.js` (drag/zoom/rock stage with camera moves), `atoms.js` (ball-and-stick, target cages). Only talks that show molecules load these. |
| `talks/<name>/` | One talk: `index.html` (the slide order), `slides/*.js`, `data/*.js`. `talks/materials-demo/` shows the crystal view; `talks/example/` shows every other feature. |
| `tools/` | `check_deck.py` (headless check of a deck), `export_pdf.py` (a PDF of pictures, per slide or per click), `build_site.sh` (the published site), `deploy_pages.sh` (manual upload to Cloudflare Pages), `prep_crystal.py` (CIF → unit-cell data for the crystal view), `prep_csv.py` (CSV → offline line-chart data), `export_bond_rules.py` (pymatgen's bonding rule → `web/addons/bond_rules.js`), `prep_protein.py` (structure → cartoon data), `prep_amino_acids.py` (the alphabet slides' RDKit drawings and 3D stretch), `vendor_manim_web.sh`, `gen_components.py` (writes `docs/components.md` from the `web/` header comments), `check_docs.py` (the docs checks: headers, AGENTS.md mentions, the generated index, slide headers). |
| `docs/handbook/` | **The component handbook — read `docs/handbook/README.md` before building a talk**: which component for which need, how to lay slides out, copy-pasteable recipes, tools, the verification checklist. Includes the optional migrated components. `python tools/check_docs.py` checks that it only names components that exist. |
| `docs/components.md` | Generated API index of every `web/` component, from its header comment; regenerate with `python tools/gen_components.py`. |
| `vendor/` | manim-web, Reveal.js, the Lato font — each with its licence. Never load anything from a CDN. |

## The slide contract

```js
Deck.slide('name', {
  steps: 3,                 // clicks on this slide (default 1); step 1 is what shows on arrival
  notes: 'speaker notes',   // press S
  interactive: true,        // the slide takes drags/wheel (3D); no swipe navigation on touch
  smoothBack: true,         // it plays steps in reverse on one click back, when the deck's smoothBack is '3d'
  before: 'other-name',     // optional: insert ahead of an already registered slide
  mount(frame, { theme, palette, data, M, css, esc }) {
    // build into `frame` (16:9; 1em = 1/100 of its width)
    return {
      enter(step, animate) {},   // show steps 1..step. animate: true = going forward, play the step;
                                 //   'back' = one click back, may play it in reverse (quickly); false = jump
      leave() {},                // optional: off screen, stop loops
      freeze() {},               // optional: redraw canvases now so the deck can picture them
      destroy() {},              // optional: free WebGL/listeners (slides > 2 away are unmounted)
    };                           // enter may return a Promise; the busy dot pulses until it settles
  },
});
```

- **Going back** is set for the whole deck: `Deck.start({ title, smoothBack })`, `'none'` (the default: back
  always jumps), `'3d'` (slides that declare `smoothBack: true` get one click back as `animate === 'back'`;
  everything else jumps) or `'all'` (every slide gets 'back', so `Deck.show` and the charts also fade back). A
  second click within 0.7 s, or arriving from a later slide, always passes `false`. A slide with its own motion
  may play that step in reverse, faster than forward (about half). Reverse only motion that reads well backwards
  (camera moves, a lift settling back); content that would look odd undone (a tear healing) should just jump.
  Every 'back' must still end in exactly the state a jump gives.
- `enter` must be **idempotent and jump-safe**: `enter(4, false)` straight after mount must give exactly the
  picture you get by clicking through 1→4. Write state per step, not deltas.
- Wrap a module's constants in `{ ... }` (a block) so names don't collide across files.
- `ctx.css(text)` adds a style once; prefix a slide's classes with a short slide-specific prefix (`fp-`, `ms-`).
- The order of slides is the order of `<script>` tags in the talk's `index.html`. `Deck.section(n)` before a
  group of tags puts those slides in footer section n; `Deck.section(null)` for title/closing slides.
  `Deck.hide('name')` after the tags takes a slide out without deleting it.

## The design language — use it, don't reinvent it

**Preserve the styles of existing components by default.** Reuse the original component's appearance and
rendering parameters (including colours, typography, spacing, lines and arrowheads); do not alter shared styles,
component implementations, or existing component styling in a talk merely to adapt a slide. For a new visual
need, create a separate, talk-scoped element or variant without changing existing components. Change an existing
component's style only when the user explicitly requests that change.

Everything is sized in `--u` (1/100 of the frame width), so slides scale to any screen. **Never use px or ad
hoc font sizes for slide text**; use the tokens:

| Token | Use |
| --- | --- |
| `--t-display` | title slide's title (`.deck-title`) |
| `--t-heading` | slide heading (`<h2 class="deck-heading">`, accent colour, top left) |
| `--t-lead` | list items, key statements, outline rows |
| `--t-body` | running text, point titles |
| `--t-small` | secondary text, point sub-lines |
| `--t-caption` | legends, labels, captions |
| `--t-micro` | hints |

Layout grid: margins 4.2% left/right; heading at the top; content between ~15% and ~85% of the height;
one caption line at 87% (`.deck-caption`); the section footer below. Components:

- **Figure + points**: `.deck-figure` (left ~52%) plus `Deck.points([{title, sub, from}], {className})`
  (`.deck-col`). Move the column only through `--col-left`, `--col-top`, `--col-title`, `--col-gap`.
- **Lead line** under the heading: `.deck-lead`. **Code**: `<code class="deck-code">`. **Keys**: `<kbd>F</kbd>`.
- **Emphasis**: `.deck-accent` (accent colour), `<mark class="deck-mark">` (highlighter), `.deck-muted`,
  `.deck-detail` (credits, data sources — quieter than muted).
- **Charts**: `Deck.groupedBars` (`web/plots.js`) for bars; the optional data-driven components in the table cover lines, scatter, funnel, binary hull, phonons, bands/DOS and XRD. See the component headers and `talks/plot-gallery/` and `talks/spectra-gallery/` for their contracts.
- **Step reveals**: give elements `class="reveal-in" data-from="k"` (or `data-show="1 3"`) and call
  `Deck.show(frame, step, animate)` from `enter`. `--i` on siblings staggers them.
- **Title / closing**: `.deck-title`, `.deck-subtitle`, `.deck-byline`.

**Colours**: CSS uses `var(--fg)`, `var(--muted)`, `var(--accent)`, `var(--detail)`, `var(--plot-1..8)`.
Canvas, SVG and manim-web code uses `palette` (`P.fg`, `P.muted`, `P.accent`, `P.series[i]`, `P.ss`, `P.cpk`),
which mirrors the CSS. **Never hard-code white/black or a hex colour in a slide** — both themes must work:
light is the default, dark is `T` or `?theme=dark`. If you change a theme colour, change it in both `deck.css` and `PALETTES` in
`deck.js`.

### 项目默认配色（现有与后续讲稿均沿用）

采用**蓝橙主色 + 彩虹辅助色**。用户明确要求：浅色页面背景 `#FBFAF8`、暗色页面背景
`#0F1218` 均保持不变，不替换成参考图的雾灰或海军蓝。配色调整不应附带修改字体、字号或版式。

| 角色 / CSS 变量 | 浅色 | 暗色 | 使用规则 |
| --- | --- | --- | --- |
| bg / `--bg` | `#FBFAF8` | `#0F1218` | 页面背景，固定不变 |
| fg / `--fg` | `#11224E` | `#EDF0F4` | 正文、主要数字 |
| accent / `--accent` | `#3166DD` | `#82A7FF` | 标题、编号、链接、当前章节 |
| highlight / `--highlight` | `#FF7200` | `#FF9A4D` | 图形重点、当前步骤、重点填充 |
| highlightText / `--highlight-text` | `#A84600` | `#FF9A4D` | 橙色文字，使用 `.deck-highlight` |
| muted / `--muted` | `#5C6370` | `#9AA0A6` | 次级正文 |
| detail / `--detail` | `#687386` | `#929DAD` | 来源、注释和说明 |
| done / `--done` | `#007F73` | `#4DB6AC` | 完成、通过，配合文字或符号 |
| surface / `--surface` | `#FFFFFF` | `#192333` | 代码等局部内容面板 |

- 中性色约占 80%、蓝色约占 15%、橙色约占 5%，作为视觉参考。橙色集中强调每页一两处重点。
- 浅色主题的普通橙色文字用 `highlightText`，不要直接用品牌橙；橙底标签配深色字。
- HTML/CSS、SVG、Canvas 和 manim-web 必须使用同一套语义颜色；同步维护
  `web/deck.css` 与 `web/deck.js` 中的 `PALETTES`，页面不另写硬编码色值。
- 两种主题分别验证可读性；普通文字对比度至少 4.5:1，图表不只靠颜色传达类别和状态。

**图表与彩虹辅助色：**

| 索引 | 默认 series / `--plot-1..8`（浅色） | rainbow 分类色库（浅色） |
| --- | --- | --- |
| 1 | 蓝 `#3166DD` | 亮蓝 `#448AFF` |
| 2 | 品牌橙 `#FF7200` | 深蓝 `#1565C0` |
| 3 | 青绿 `#009688` | 青绿 `#009688` |
| 4 | 莓红 `#AD1457` | 草绿 `#8BC34A` |
| 5 | 深蓝 `#1565C0` | 琥珀黄 `#FFC107` |
| 6 | 亮蓝 `#448AFF` | 橙 `#FF9800` |
| 7 | 草绿 `#8BC34A` | 红 `#F44336` |
| 8 | 琥珀黄 `#FFC107` | 莓红 `#AD1457` |

- 暗色读取 `PALETTES.dark` 的对应提亮色，保持类别索引一致，不直接套用浅色值。
- 两组对比优先用蓝与品牌橙；通常每图使用 3–5 色，同一对象跨页保持同色。
- 品牌橙与辅助橙通常不在同一图中充当两个类别；相近蓝色也需要线型、点形或文字辅助区分。
- 浅底黄色、草绿等亮色填充配深色边线或标签。彩虹色用于离散类别；连续大小用单色明度变化，
  正负偏差用蓝—中性—橙。
- 保留元素、CPK、晶体和结构的专业配色含义，原始网页证据截图不重着色。

补充说明见 [docs/color-system.md](docs/color-system.md)。

### 标准图表优先使用成熟库

新建或迁移柱状、折线、散点、热力等常规数据图表，优先使用本地 `vendor/echarts/` 的 Apache ECharts，
通过 `web/echarts.js` 的 `Deck.echart` 接入。直接写原生 ECharts option 和数据；不要重新实现坐标轴、
刻度、图例、提示框、数值标签或常规图表动画。适配代码只负责主题、尺寸、幻灯片步骤和实例生命周期。
接线示例见 `talks/plot-gallery/slides/echarts.js`。示例放在 plot-gallery，保留上游 example 原样。

离线使用本地固定版本，保留 LICENSE/NOTICE，不增加 CDN 或强制构建步骤。图表读取上述配色和字号，
页面背景透明；后退与直接跳转还原完整目标状态；控制器接入 leave/freeze/destroy，销毁实例并保留 SVG 缩略图。
manim-web 保留给镜头运动、几何构造和专门的讲解动画，晶体组件继续负责晶体结构。
已有图表按需迁移，不为采用图表库而重写科学计算、数据来源或非图表动画。

## manim-web animation (the click-step centrepiece)

```js
const stage = Deck.manim(frame.querySelector('.deck-stage'), {
  build: ({ M, P }) => ({ circle: new M.Circle({ color: P.accent }), square: new M.Square({ color: P.fg }) }),
  steps: [
    ({ circle }, { M }) => [new M.Create(circle)],                          // step 1, plays on arrival
    async ({ circle, square }, { M, play, wait }) => {                      // step 2: several plays in sequence
      await play(new M.Transform(circle, square)); await wait(0.3); await play(new M.Indicate(circle));
    },
  ],
});
return { enter(step, animate) { Deck.show(frame, step, animate); return stage.go(step, animate); },
         freeze: stage.freeze, destroy: stage.dispose };
```

- `build` must create **fresh objects** every call: going back a step rebuilds the scene and replays steps
  instantly. Never keep mobjects in module-level variables.
- A step returns animations to play together, or calls `play()`/`wait()`/`add()` itself. In the instant
  path `play` applies animations at their end state and `wait` is a no-op, so the same code serves both.
- The scene is transparent and spans the frame: 16 × 9 world units, origin at the centre, y up. Keep shapes
  clear of the heading (y > ~3.3) and of any HTML column on the right.
- `Transform` morphs point to point; between unlike shapes (rectangles → area, shape → text) fade one out
  and the other in, or manim-web throws "mismatched point counts".
- Text: `M.Text({ fontFamily: 'Lato', ... })` for words, `M.MathTex({ latex })` for maths (KaTeX is bundled
  and works offline). Prefer HTML for long text; keep manim text for things that move.
- The manim-web API mirrors Python manim (camelCase: `getRiemannRectangles`, `moveTo`, `nextTo`). Its type
  declarations are in the npm package (`npm pack manim-web@0.39.4`) when you need an exact signature.

## The crystal add-on

Load `web/addons/{bond_rules,crystal_logic,crystal}.js` in the talk's `index.html` (see `talks/materials-demo/`). It is a
port of the `CrystalView` of the earlier manim-materials-slides, which renders better than the molecule stage for crystals:
its own renderer, matte ball-and-stick, muted element colours, labels in a row above the structure with leader lines.

- **Data**: `uv run tools/prep_crystal.py my.cif talks/<talk>/data/my_crystal.js --name "Bi₂Te₃"` writes the unit
  cell (lattice vectors, fractional atoms, symmetry applied by gemmi) to `window.DATA.my_crystal`. Bonds and polyhedra are
  not stored: the browser finds them with **pymatgen's JmolNN rule** (bonded when `0.4 Å < d ≤ r_a + r_b + 0.45 Å`, Jmol
  radii), exported by `uv run tools/export_bond_rules.py` into `web/addons/bond_rules.js`. Re-run that after upgrading pymatgen.
- **A whole slide**: `Deck.crystalSlide({ name, data, heading, polyhedra: ['Ti'], repeat, orientation, steps: [...] })`. A
  step may set `show` (`cell`/`atoms`/`bonds`/`polyhedra`, 0..1), `dim`, `fly` (`{ dir, target, zoom }`), `labels`, `labelFor`,
  `axes`, `highlight`, `layer`, `nodes`, `cutoff`, `gnn`. A later step inherits what an earlier one set, so jumping and going
  back match clicking through. Each step gets a line in the points column (`title`, `sub`).
- **By hand**: `new Deck.CrystalView(host, Deck.crystalLogic.build(data, { repeat, polyhedra }), { orientation })`; the methods
  are listed at the top of `crystal.js`. Call `dispose()` in `destroy`.
- **Looks**: colours come from `ELEMENT_COLOURS` in `crystal.js` (muted, one hue per element), then `palette.cpk`. The lights ride on
  the camera, so the crystal is lit from the viewer's side, slanted from above left, however you turn it; do not fix lights in the scene.
- c is up. Tall cells (Bi₂Te₃ has c = 30 Å) are laid on their side with `orientation: [0, Math.PI / 2, 0]` and a side `fly.dir`.
- Cells with partial occupancy or disorder are not handled; a repeat above about 3×3×3 gets slow (pair search is quadratic).

## The molecule add-on (turntable stage)

Load `web/addons/{molstar,cartoon,turntable,atoms}.js` in the talk's `index.html`. Pattern (see
`talks/example/slides/molecule.js`, `protein.js`, `design_check.js`):

- `const view = Deck.turntable(host, { radius, scale })` — `radius` in scene units (the model's half-size),
  `scale` = scene units per Å. Drag turns, wheel zooms, idle rock; a plain click still steps the deck.
- Add `M.Molecule3D` (positions **and radii** scaled by `scale`) or three.js meshes with `view.add`.
- `Deck.cartoon(data, { color } | { ss: P.ss })` builds in **Å**; scale its mesh (`mesh.scale.setScalar(scale)`),
  never the Cα coordinates (ribbon widths are Å, so scaling coordinates makes fat ribbons).
- `view.model` is a group in Å (scaled by `scale`): put three.js content there. `await view.focus(pointÅ, zoom, ms)`
  moves the camera's turning point and zoom (the close-up / pan / zoom-out transitions); `view.project(pointÅ)`
  gives screen pixels for HTML labels, placed in `view.onRender`. Fade the context (cartoon) in close-ups, or it
  fills the view.
- `Deck.ballStick(points, colours, bonds)` and `Deck.cages(points)` (`atoms.js`): instanced, fade as one. Cages
  mark where atoms were asked to be.
- Protein data: `python tools/prep_protein.py my.cif talks/<talk>/data/my_protein.json [--atoms]` → load
  `data/my_protein.js`, read `data.my_protein`.
- On/off over a figure: `<button class="deck-switch" aria-pressed="true"><i></i>label</button>` (deck.css).
- Mark 3D slides `interactive: true`; wire `leave: view.stop`, `freeze: view.render`, `destroy: view.dispose`.
- Browsers keep ~16 WebGL contexts; the deck keeps only slides within 3 of the current one alive (KEEP in `web/deck.js`) and
  pictures the rest. Always implement `destroy`.

## Data

Slides read `ctx.data.<name>` from `window.DATA`, filled by `talks/<talk>/data/<name>.js` files loaded with
`<script>` tags (browsers won't `fetch` JSON from `file://`). Generate these with a script in `tools/` that
writes both `.json` and `.js`; don't hand-type large data into slides. Record where data came from in the
prep script's docstring and in the slide's notes or a `.deck-detail` credit.

## Checking your work

```bash
pip install playwright && playwright install chromium     # once
python tools/check_deck.py talks/example                  # every slide and step, dark and light
python tools/check_deck.py talks/example --slide manim-graph --back   # one slide, also stepping backwards
```

It fails on any console error or warning and writes a picture per slide (at its last step) to
`talks/<talk>/check/` (git-ignored). **Look at the pictures** in both themes — text overlapping a figure,
something under the heading, or a colour invisible in one theme are the usual faults and are not
console errors. For live work: `python -m http.server 8000` in the repo root, then open
`http://localhost:8000/talks/<talk>/index.html` (add `?theme=dark`, `#/4` for the fifth slide: the hash counts from 0).

## Publishing

If GitHub is connected to Cloudflare Pages, pushes to the production branch publish the site
(`tools/build_site.sh`: front page, `talks/`, `web/`, `vendor/` only). Push only when the person asks,
and run `check_deck.py` first. `tools/deploy_pages.sh` uploads the working copy by hand; run it only
from a checkout containing talks intended for publication. A new talk appears at `/talks/<name>/`;
link it from the root `index.html` if it should be findable.

## Conventions

- Keep the template generic: talk-specific content lives under `talks/<name>/`, never in `web/`.
- A new reusable component goes in `web/` with a usage comment at the top of the file (like `plots.js`),
  styles in `deck.css`, and a demo in `talks/example/`. Update this file's tables.
- A new component's header comment is its documentation: write the usage comment at the top of the file, run
  `python tools/gen_components.py`, and `python tools/check_docs.py` must pass.
- Comments explain *why* and what a step shows; every slide file starts with a short comment listing its steps.
- Upgrading manim-web: `tools/vendor_manim_web.sh <version>`, then run `check_deck.py` on every talk.
- Don't add CDN links, npm builds or frameworks; the deck must open offline from disk.

## Keys while presenting

→/← or left/right click: step · S: speaker notes · O: overview · F: fullscreen · T: dark/light · L: laser
pointer · Esc: leave overview. The laser pointer is shared with the speaker view: the dot you move in the audience window
appears at the same place on the speaker view's current-slide preview, and the other way round (BroadcastChannel in
`web/deck.js`, so it needs http(s) like the speaker view itself; every talk gets it from the runtime). The same channel carries the pose
of the 3D views, so turning a crystal or a molecule in one window turns it in the other: a component registers with
`Deck.shareView(host, { get, set })` (the crystal view and the turntable already do); a new 3D component should do the same. URL `#/n` jumps to the slide with index n, counting from 0 (`#/0` is the first).
