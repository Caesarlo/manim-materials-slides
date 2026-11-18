# 05 工作流与工具

本章回答两个问题：一个 agent 怎样从"用户想做一场关于 X 的 talk"走到"经过验证、可以发布的 deck"；`tools/` 里每个工具做什么、怎么调用。其他章节讲组件本身（01 基础、02 manim 与图表、03 晶体、04 分子）。

本章只描述仓库里真实存在的东西。命令与参数取自各脚本的 argparse 与 usage 文本；未在本机运行验证的部分放在末尾"待确认"里。

## 0. 先读什么

1. `AGENTS.md`：幻灯片契约、设计语言、规则。本章第 6 节是它的摘要，冲突以 `AGENTS.md` 为准。
2. `README.md`：面向人的入门与发布说明。
3. `talks/materials-demo/`：材料学范例，新 talk 从它复制。`talks/example/` 是上游的生物学示例，只作为"每个功能怎么写"的参照，**不要改它**。
4. `web/deck.js` 文件头：幻灯片模块的写法与 `Deck.*` 辅助函数一览。

## 1. 新建一个 talk 的步骤

### 1.1 复制模板

```bash
cp -r talks/materials-demo talks/my_talk
rm -rf talks/my_talk/check          # 复制来的截图目录，不需要
```

`talks/<name>/` 的名字只用于路径与 `window.DATA` 的键，建议小写加下划线（`my_talk`）。talk 专属内容只放在这个目录里，`web/` 不允许出现 talk 专属代码。

### 1.2 编辑 `talks/my_talk/index.html`

这个文件决定加载什么、幻灯片的顺序和页脚分节。骨架（取自 `talks/materials-demo/index.html`，路径相对于 `talks/<name>/`）：

```html
<link rel="stylesheet" href="../../vendor/reveal/reveal.css">
<link rel="stylesheet" href="../../web/deck.css">
<div class="reveal"><div class="slides"></div></div>

<!-- 运行时：顺序固定 -->
<script src="../../vendor/reveal/reveal.js"></script>
<script src="../../vendor/reveal/notes.js"></script>
<script src="../../vendor/manim-web/manim-web.iife.js"></script>
<script src="../../web/deck.js"></script>
<script src="../../web/manim.js"></script>
<script src="../../web/plots.js"></script>

<!-- 只加载用到的 add-on -->
<script src="../../web/addons/bond_rules.js"></script>      <!-- 晶体：先 bond_rules，再 crystal_logic，再 crystal -->
<script src="../../web/addons/crystal_logic.js"></script>
<script src="../../web/addons/crystal.js"></script>
<!-- 分子：molstar.js, cartoon.js, turntable.js, atoms.js（见 talks/example/index.html） -->

<!-- 数据：window.DATA，由 tools/ 生成的 .js -->
<script src="data/my_crystal.js"></script>

<!-- 幻灯片：Deck.section(n) 之后的幻灯片进入页脚第 n 节；null 为无节（标题、结束页） -->
<script>Deck.section(null)</script>
<script src="slides/title.js"></script>
<script src="slides/outline.js"></script>

<script>Deck.section(1)</script>
<script src="slides/my_first_topic.js"></script>

<script>Deck.start({ title: 'My talk', smoothBack: '3d' });</script>
```

要点：

- **脚本顺序就是幻灯片顺序**。加一张幻灯片 = 新建一个 `slides/*.js` 并在这里加一行 `<script>`。删除 = 删掉这一行（或用 `Deck.hide('name')`，见下）。
- `Deck.section(n)` 必须写在该组幻灯片的 `<script src>` 之前；`Deck.section(null)` 用于标题页和结束页（页脚隐藏）。
- `Deck.hide('name')` 写在所有 `<script>` 之后、`Deck.start` 之前，可以临时隐藏一张幻灯片而不删文件。被 `Deck.topics` 引用的隐藏幻灯片会被页脚跳过。
- `Deck.start({ title, smoothBack })`：`title` 是浏览器标签标题；`smoothBack` 取 `'none'`（默认，后退直接跳）、`'3d'`（声明了 `smoothBack: true` 的 3D 幻灯片后退时播放反向动画）或 `'all'`。
- 数据脚本要放在使用它的幻灯片脚本**之前**（`ctx.data` 在 `mount` 时取值）。
- 页脚的节名与分节在 `slides/outline.js` 里写：`Deck.sections([[num, name], ...])` 与 `Deck.topics({num: [[title, [slide names], blurb], ...]})`。新 talk 可以把 `outline.js` 整个改写，或者只在 `index.html` 里全部用 `Deck.section(null)`（这样页脚不出现）。

### 1.3 写幻灯片

每个 `slides/*.js` 的第一行必须是 `//` 注释，列出这张幻灯片的步骤（`check_docs.py` 检查这一点）。最常见的两种写法：

- **整张幻灯片是晶体**：`Deck.crystalSlide({...})`，只写数据与每一步的文字、显示项，不写 DOM（见第 2 节表格与 `talks/materials-demo/slides/srtio3.js`）。
- **普通幻灯片**：`Deck.slide(name, { steps, notes, mount })`，`mount` 返回 `{ enter, leave, freeze, destroy }`。契约与设计语言见 `AGENTS.md`（"The slide contract"、"The design language"）。

标题页与结束页直接套用 `talks/materials-demo/slides/title.js` 的写法：`.deck-title`、`.deck-subtitle`、`.deck-byline`，用 `data-from` 控制逐步出现。

### 1.4 准备数据

数据不要手抄到幻灯片里。用 `tools/` 脚本生成 `data/<name>.js`（同时写一个 `.json`），例如：

```bash
uv run tools/prep_crystal.py path/to/my.cif talks/my_talk/data/my_crystal.js --name "Bi₂Te₃"
```

脚本把数据写成 `window.DATA["<文件名不含扩展名>"]`。**键必须与 `Deck.crystalSlide({ data: '...' })` 或 `ctx.data.<name>` 的名字一致**，否则读到 `undefined`。来源（数据库编号、论文）记在幻灯片的 `notes` 或 `.deck-detail` 里。

### 1.5 链接到首页（如需可被找到）

根目录 `index.html` 目前用 `<meta http-equiv="refresh">` 直接跳到 `talks/materials-demo/`，页面上有一行链接。要让新 talk 可被找到，在这一行加 `<a href="talks/my_talk/">...</a>`。是否改动首页跳转方式由用户决定（见第 8 节）。

### 1.6 验证

按第 4 节的清单执行。最少是：

```bash
python tools/check_deck.py talks/my_talk
python tools/check_docs.py
```

## 2. 规划 talk：从大纲到幻灯片

这一节给 agent 用：拿到一份材料学 talk 的大纲以后，怎样拆成幻灯片、用哪个组件。

### 2.1 原则

- **一页一个想法**。标题就是这一页的结论（"TiO₆ 八面体是 Ti 的配位多面体"），而不是话题名（"结构"）。
- **步骤是叙事单位**。一张幻灯片的 2 至 4 个步骤，每一步加一样东西（一个键、一个多面体、一条曲线），而不是把所有东西一次摆出来。步骤越多，越要保证每一步只新增一件事。
- **图比字多**。能用图、表、动画表达的，不写成段落。
- **不要段落，不要项目符号堆叠**。要点最多 3 条，放在 `Deck.points` 的右侧一栏里，每条一个短标题加一行副文字（`sub`）。
- **说明文字（caption）**：一句，放在底部一行（`.deck-caption`）。好的 caption 说明"这张图要看什么"，例如"虚线为 JmolNN 判定的键，Ti 位于八面体中心"，不写"如图所示"。数值与单位写全（Å、K、meV）。
- **讲者要的细节放进 `notes`**，不放进幻灯片。
- **文字字号只用 token**（`--t-display` 到 `--t-micro`），颜色只用 `var(--fg)`、`var(--muted)`、`var(--accent)` 等或 `palette`。这些规则是 `AGENTS.md` 的硬性规定，不是风格建议。

一个大纲到幻灯片的粗略映射：大纲的一个小节 → 一个 `Deck.section`（页脚一节）；小节里的一个论点 → 一张幻灯片；论点里的一个证据 → 一个步骤。

### 2.2 需求 → 组件对照表

只列出仓库中已经存在的组件。

| 需求 | 用什么 | 说明 | 详见 |
| --- | --- | --- | --- |
| 晶体结构：单胞、原子、键、配位多面体、层、晶格矢量、元素标签 | `Deck.crystalSlide({...})`（整张幻灯片）；或 `new Deck.CrystalView(host, Deck.crystalLogic.build(data, {...}))`（手写） | 数据用 `tools/prep_crystal.py` 生成；键由 pymatgen 的 JmolNN 规则在浏览器里算出 | 章 03 |
| 小分子、团簇：可拖动旋转的 3D | `Deck.turntable(host, {radius, scale})` + `M.Molecule3D`，或 `Deck.ballStick(points, colours, bonds)` | 需要加载 `molstar.js, turntable.js, atoms.js`（molecule add-on） | 章 04 |
| 蛋白质卡通 | `Deck.cartoon(data, {color})` | 数据用 `tools/prep_protein.py` 生成 | 章 04 |
| 曲线、公式、动画示意（会随步骤变化的图） | `Deck.manim(host, {build, steps})`，配合 `M.Axes`、`M.MathTex`、`M.Transform` 等 | 写法见 `talks/example/slides/manim_graph.js`；`build` 每次都要新建对象 | 章 02 |
| 数值对比（几组、几个方法的柱状图） | `Deck.groupedBars(frame, {...})` | 单系列即普通柱状图；按组或按系列逐步长出；数值用 `max`、`format` | 章 02 |
| 章节进度（页脚与每节的小圆点） | `Deck.sections`、`Deck.topics`、`Deck.expand` | 写在 `slides/outline.js`；`Deck.topicsOf(n)` 可给检查表用 | 章 01 |
| 图 + 解释要点 | `.deck-figure`（左约 52%）+ `Deck.points([{title, sub, from}])`（`.deck-col`） | 写法见 `talks/example/slides/figure_points.js`；图可以是 SVG、`<img>`、canvas 或 manim 舞台 | 章 01 |
| 逐步出现的普通元素 | HTML 上写 `class="reveal-in" data-from="k"` 或 `data-show="1 3"`，`enter` 里调用 `Deck.show(frame, step, animate)` | `--i` 让同级元素错开出现 | 章 01 |
| 标题页、结束页 | `.deck-title`、`.deck-subtitle`、`.deck-byline`，`Deck.section(null)` | 见 `talks/materials-demo/slides/title.js` | 章 01 |
| 说明与来源 | `.deck-caption`（一行，底部）、`.deck-detail`（来源、致谢，更淡） | 来源必须写 | 章 01 |
| 行内代码、按键 | `<code class="deck-code">`、`<kbd>F</kbd>` | | 章 01 |
| 重点高亮 | `<mark class="deck-mark">`、`.deck-accent` | | 章 01 |

### 2.3 现在不存在的东西

下面这些图在材料学 talk 里很常见，但仓库里**没有现成组件**。不要假装有 `Deck.xxx`。

| 需要的图 | 现状 | 替代做法 |
| --- | --- | --- |
| 数据驱动的折线图（如 zT–T、电阻率–温度、能量–成分曲线） | 无。`Deck.groupedBars` 只画柱状图 | 用 `Deck.manim` + `M.Axes` 手写坐标轴与数据点，参照 `manim_graph.js` 里的 `axes.plot(...)`；数据点从 `window.DATA` 读入。画法正确与否要靠 check_deck 的截图看（待确认 `M.Axes` 接受数组数据的写法） |
| 能带结构 | 无 | 自绘 SVG（`.deck-figure`，用 `data-from` 逐步显示能带）或 `Deck.manim` 画线段 |
| XRD 谱图 | 无 | 同上；峰用线段或细矩形（待确认 `M.Line` 等 manim-web 图元的签名） |
| 相图 | 无 | 自绘 SVG 或 `Deck.manim`；区域用多边形填充，颜色走 `palette` |
| LLM / agent 流程图、框图 | 无 | `.deck-figure` + SVG 方框与箭头（`figure_points.js` 的 `box()` 写法），每一步的框用 `data-from` 出现 |

如果同一类图要在多个 talk 里重复出现，就应当新建一个组件（见第 6 节的规则），而不是在某个 talk 里复制一份。

## 3. `tools/` 逐个说明

### 3.1 总览

| 脚本 | 作用 | 运行方式 | 依赖 |
| --- | --- | --- | --- |
| `check_deck.py` | 无头浏览器走完一个 talk 的每张幻灯片、每一步，截图，遇到控制台错误即失败 | `python tools/check_deck.py <talk>` | `playwright` + chromium |
| `export_pdf.py` | 把 talk 导出为 PDF（每页是一张截图） | `python tools/export_pdf.py <talk>` | `playwright` + chromium，`Pillow` |
| `prep_crystal.py` | CIF → 单胞数据 `data/<name>.js`/`.json` | `uv run tools/prep_crystal.py <cif> <out.js>` | `gemmi`（uv 从脚本头部安装） |
| `export_bond_rules.py` | pymatgen 的 JmolNN 规则 → `web/addons/bond_rules.js`（生成文件） | `uv run tools/export_bond_rules.py` | `pymatgen`、`pyyaml`（uv 安装） |
| `prep_protein.py` | 蛋白结构 → 卡通数据（可选 `--atoms`） | `python tools/prep_protein.py <pdb/cif> <out.json>` | `gemmi`、`numpy`；`mdtraj` 可选 |
| `prep_amino_acids.py` | 20 种氨基酸的 2D 结构式与 3D 片段（上游示例用） | `python tools/prep_amino_acids.py <out.json> ...` | `RDKit`、`gemmi`、`numpy` |
| `gen_components.py` | 从 `web/` 文件头注释生成 `docs/components.md` | `python tools/gen_components.py`（`--check` 只检查） | 标准库 |
| `check_docs.py` | 文档一致性检查（文件头、AGENTS.md 提及、组件索引、talk 结构） | `python tools/check_docs.py` | 标准库 |
| `build_site.sh` | 组装发布目录 `site/` | `bash tools/build_site.sh [out]` | bash、cp、find |
| `deploy_pages.sh` | 用 wrangler 手动上传到 Cloudflare Pages | `bash tools/deploy_pages.sh [project]` | `wrangler`（已登录） |
| `vendor_manim_web.sh` | 从 npm 重新打包 `vendor/manim-web/manim-web.iife.js` | `bash tools/vendor_manim_web.sh [version]`（默认 0.39.4） | npm（联网下载 manim-web 与 esbuild 0.24.2） |

`tools/samples/` 里有两份示例 CIF（SrTiO₃、Bi₂Te₃），用于 `materials-demo`。`README.md` 指出它们来源未记录，用于真实 talk 时要自己记下出处。

### 3.2 check_deck.py

用途：在无头 Chromium 里打开 `talks/<name>/index.html?theme=dark` 和 `?theme=light`，逐张幻灯片走完所有步骤，每张在最后一步截图。任何控制台 error/warning 或页面异常都会让它以退出码 1 结束。

```bash
python tools/check_deck.py talks/my_talk                              # 两个主题，每张幻灯片
python tools/check_deck.py talks/my_talk --theme dark                 # 只查深色
python tools/check_deck.py talks/my_talk --slide srtio3 --back        # 一张幻灯片，并且向后走
python tools/check_deck.py talks/my_talk --out /some/dir              # 截图放到别处
```

| 参数 | 含义 |
| --- | --- |
| `talk` | 位置参数，含 `index.html` 的目录 |
| `--theme {dark,light,both}` | 默认 `both` |
| `--slide SLIDE` | 只检查名字为 SLIDE 的幻灯片（名字即 `Deck.slide('name')` 的 name） |
| `--back` | 每张幻灯片走完后再逐步后退，并截一张 `_back.png` |
| `--out OUT` | 截图目录，默认 `<talk>/check/` |

输出：`<talk>/check/NN_<slide>_<theme>.png`（前进到最后一步的画面），`--back` 时另有 `NN_<slide>_<theme>_back.png`。`check/` 目录被 `.gitignore` 忽略。

注意：

- 它**不测试"跳转"**（`#/n`）是否等于逐步点击的结果。跳转要手动比较，见第 4 节。
- 它**不检查**画面质量。文字压住图、标题下面有东西、某个颜色在某一主题下看不见，都不会报错，必须看截图。
- `--slide` 名字写错时，脚本不报错、也不检查任何幻灯片，直接以 0 退出（代码里没有"找不到幻灯片"的检查）。核对输出里的 `N slides` 与逐行列表。
- 3D 幻灯片在 CPU 渲染（SwiftShader），会比较慢。

### 3.3 export_pdf.py

用途：导出 PDF，每页是一张幻灯片的截图（3D 也是截图，所以文字不可选）。

```bash
python tools/export_pdf.py talks/my_talk                              # talks/my_talk/my_talk.pdf，每张幻灯片一页
python tools/export_pdf.py talks/my_talk --steps all                  # 每一步一页
python tools/export_pdf.py talks/my_talk --theme dark --scale 2 --pngs previews/
python tools/export_pdf.py talks/my_talk --out /some/deck.pdf
```

| 参数 | 含义 |
| --- | --- |
| `talk` | 位置参数 |
| `--out OUT` | PDF 路径，默认 `<talk>/<talk 目录名>.pdf` |
| `--theme {light,dark}` | 默认 `light` |
| `--steps {last,all}` | `last`（默认）每张幻灯片一页；`all` 每一步一页 |
| `--scale SCALE` | 默认 1.5，每个 CSS 像素对应的像素数（1600×900 基准） |
| `--pngs PNGS` | 同时把每一页保存为 PNG 到该目录 |

输出的 PDF 位于 talk 目录下，`.gitignore` 忽略 `talks/*/*.pdf`，防止被发布。截图中激光笔与幻灯片编号被隐藏（脚本里只隐藏这两者，忙碌指示点不在隐藏之列）。

### 3.4 prep_crystal.py

用途：读 CIF，写出单胞数据（晶格矢量、分数坐标的原子，已展开对称性）。

```bash
uv run tools/prep_crystal.py tools/samples/SrTiO3.cif talks/materials-demo/data/srtio3.js --name "SrTiO₃"
uv run tools/prep_crystal.py my.cif talks/my_talk/data/my_crystal.js --name "Bi₂Te₃"
```

| 参数 | 含义 |
| --- | --- |
| `cif` | 输入 CIF |
| `out` | 输出 `.js`（同时写同名 `.json`） |
| `--name NAME` | 显示名（默认：约化化学式或 CIF 名） |

输出：`window.DATA["<out 文件名>"] = {name, spacegroup, lattice, atoms, source}`；脚本打印 `<out>: N atoms in the cell, <空间群>`。这一行是检查结果的第一手依据：原子数与空间群要和文献核对。

注意：脚本用 gemmi 按空间群名展开对称性。示例 CIF 不含对称操作列表（`_symmetry_equiv_pos` 或 `_space_group_symop` 缺失），靠的就是这一点。CIF 写了非标准的空间群名时，展开的原子数会不对，要看打印的数字。键和多面体**不**存在数据里，由浏览器按 `bond_rules.js` 算。

### 3.5 export_bond_rules.py

用途：把 pymatgen 的 JmolNN 规则（各元素的 Jmol 半径表、容差 tol = 0.45 Å、最小键长 0.4 Å）导出成 `web/addons/bond_rules.js`。

```bash
uv run tools/export_bond_rules.py        # 无参数，写入 web/addons/bond_rules.js
```

这个文件由脚本生成，文件头写明 pymatgen 版本。**不要手改**。升级 pymatgen 后重新运行一次。它需要 pymatgen，安装体积大，首次运行较慢。

### 3.6 prep_protein.py

用途：PDB 或 mmCIF → 卡通数据（每个残基的 Cα 位置、二级结构、骨架朝向），`--atoms` 时加上全部重原子与键，供侧链的球棍模型用。

```bash
python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json
python tools/prep_protein.py my.pdb talks/my_talk/data/my_protein.json --chain B
python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json --atoms
```

| 参数 | 含义 |
| --- | --- |
| `structure` | PDB 或 mmCIF |
| `out` | 输出 `.json`（同时写同名 `.js`，`window.DATA["<out 文件名>"]`） |
| `--chain CHAIN` | 链名，默认第一条蛋白链 |
| `--atoms` | 同时写出全部重原子与键 |

二级结构来自文件中的 helix/sheet 记录；没有时用 mdtraj 的 DSSP（可选依赖）；没有 mdtraj 时全部当作 coil，并在输出中说明。坐标以 Å 为单位，已居中并转到主惯性轴。

### 3.7 prep_amino_acids.py

用途：上游示例 `alphabet.js` 的数据：20 种氨基酸的 2D 结构式（RDKit 绘制），可选一段多肽的 2D 与 3D（`--structure` 取自 PDB/mmCIF 的一段）。材料学 talk 一般用不到，列在这里只为完整。

```bash
python tools/prep_amino_acids.py talks/example/data/amino_acids.json --structure talks/example/data/1ubq.cif --start 1
python tools/prep_amino_acids.py out.json --peptide MQIFVKT
```

| 参数 | 含义 |
| --- | --- |
| `out` | 输出 `.json`（同时写 `.js`） |
| `--peptide SEQ` | 一段序列，每个字母只能出现一次 |
| `--structure FILE` | 从该 PDB/mmCIF 取多肽的 3D 坐标 |
| `--start N` | 配合 `--structure`，起始残基号，默认 1 |
| `--length N` | 配合 `--structure`，残基数，默认 7 |

字体取自 `vendor/fonts/Lato-Semibold.ttf`。依赖 RDKit、gemmi、numpy，通过 pip 安装。

### 3.8 gen_components.py 与 check_docs.py

- `gen_components.py`：读取 `web/*.js` 与 `web/addons/*.js` 文件头的连续 `//` 行，生成 `docs/components.md`。无参数即写入；`--check` 仅检查，过时则退出码 1 并打印差异。输出确定、不含时间戳。
- `check_docs.py`：检查 (a) 每个 `web/` 组件文件头至少 3 行非空 `//` 注释；(b) 每个组件的文件名出现在 `AGENTS.md` 中；(c) `docs/components.md` 与文件头一致（调用 `gen_components.py --check`）；(d) 每个 `talks/<name>/` 有 `index.html`，每个 `slides/*.js` 第一行是 `//` 注释。`talks/example/` 的问题只作为警告，不影响退出码。

改了任何 `web/` 文件的文件头后，顺序是：改文件头 → `python tools/gen_components.py` → `python tools/check_docs.py`。新增组件时，还要在 `AGENTS.md` 的表格里提到它的文件名，否则 (b) 失败。

### 3.9 build_site.sh、deploy_pages.sh、vendor_manim_web.sh

- `build_site.sh [out]`：把 `index.html`、`web/`、`vendor/`、`talks/` 复制到 `out`（默认仓库下的 `site/`），删除所有 `talks/*/check/`。Cloudflare Pages 的构建命令就是它。
- `deploy_pages.sh [project]`：先调用 `build_site.sh` 到临时目录，再 `wrangler pages deploy ... --branch main --commit-dirty=true`。需要 `wrangler login`。**默认项目名是上游的 `protein-design-interactive-slides`**，自己的项目请显式传名。
- `vendor_manim_web.sh [version]`：在临时目录用 npm 安装 `manim-web@<version>` 与 `esbuild@0.24.2`，打包成单个 IIFE（`window.ManimWeb`），覆盖 `vendor/manim-web/`。它会联网下载，**这里不要运行**，除非用户要求升级。升级后对每个 talk 跑 `check_deck.py`。

## 4. 完成前的验证清单

只有下面全部通过，才能对用户说 talk "做好了"。每一项都要写进最终报告；没做的项要明说。

1. **两个主题**：`python tools/check_deck.py talks/<name>` 通过（退出码 0，无控制台 error 或 warning）。查看 `check/` 里每一张截图，`_dark` 与 `_light` 都要看。
2. **每一张、每一步，前进和后退**：`python tools/check_deck.py talks/<name> --back`。有 3D 或 `Deck.manim` 的幻灯片，单独再跑 `--slide <name> --back`。
3. **跳转等于点击**：本地起服务器（`python -m http.server 8000`，在仓库根目录），打开 `http://localhost:8000/talks/<name>/index.html?theme=dark#/4`（`#/n` 从 0 起算，这是第 5 张），与逐步点击到第 5 张的画面比较（同一张幻灯片的每一步都要比）。这一项 check_deck 不做。
4. **浏览器控制台无新错误**：手动打开一遍，控制台没有新的错误。已知的例外见第 7 节："Maximum call stack size exceeded"（reveal.js）在上游示例 talk 中已存在，不是本项目引入的。
5. **3D 幻灯片释放 WebGL 上下文**：每个 3D 幻灯片都实现了 `destroy`（调用 `view.dispose()` 或 `stage.dispose`）。连续翻过很多张 3D 幻灯片，控制台不出现 "context lost" 或 "Too many active WebGL contexts" 之类的警告。
6. **从 `file://` 打开**：直接双击 `talks/<name>/index.html`，能正常显示和翻页。**作者尚未验证这一项**，要在本机实际做一次。
7. **文档检查**：`python tools/check_docs.py` 通过。如果改了 `web/` 文件头，先跑 `python tools/gen_components.py`。
8. **规则自检**：在 talk 目录里不出现 `px` 字号（幻灯片文字只用 token）、不出现十六进制颜色（用 palette 或 CSS 变量）、不引用 CDN（`grep -rn "https://" talks/<name>/` 看一眼，来源链接除外）。这是人工检查，不是工具。
9. **数据来源**：每个 `data/` 文件的来源（数据库编号、论文、软件版本）在 notes 或 `.deck-detail` 里有记录。
10. **PDF（如需要）**：`python tools/export_pdf.py talks/<name>` 能跑完，抽查几页。

## 5. 发布

- 可以将 GitHub 的公开发布分支连接到 Cloudflare Pages，也可以用 `deploy_pages.sh` 手动上传，或使用其他静态托管。
- 发布前运行 `check_deck.py`（第 4 节）。
- 只在用户要求时推送或上传。
- 本地预览发布效果：`bash tools/build_site.sh`，然后在 `site/` 下起一个静态服务器检查。
- 新 talk 发布后位于 `/talks/<name>/`。要被首页找到，见第 1.5 节。
- 注意：`build_site.sh` 复制的是工作区的文件，不是 Git 里的文件。发布时应使用只包含公开讲稿的检出目录；Git 忽略的本地 PDF 也会被复制，所以不要在发布目录保留不应公开的 PDF。

## 6. 仓库规则（agent 必须遵守）

摘自 `AGENTS.md`，有出入以它为准。

- **不要 CDN，不要 npm 构建，不要框架**。deck 必须能离线、从磁盘打开。外部资源只放在 `vendor/`。
- **不要 px，不要临时字号**。文字用 `--t-display`、`--t-heading`、`--t-lead`、`--t-body`、`--t-small`、`--t-caption`、`--t-micro`。`deck.css` 里出现的 px 是边框、进度条等非文字尺寸。
- **不要硬编码颜色**。CSS 用 `var(--fg)` 等，canvas、SVG、manim-web 用 `palette`（`P.fg`、`P.muted`、`P.accent`、`P.series[i]`、`P.cpk` 等）。两个主题都要能看。
- **不要为了某一个 talk 修改 `web/deck.css` 或 `web/deck.js`**。talk 需要的版式用幻灯片自己的 `css()`（带短前缀，如 `fp-`、`cr-`、`ms-`）。确实是通用需求时，才改 `web/`，并同时更新两个主题。
- **`talks/example/` 保持上游原样**，只读。新 talk 从 `talks/materials-demo/` 复制。
- **模板保持通用**：talk 专属内容只放在 `talks/<name>/`，不放进 `web/`。
- **新的可复用组件**：放进 `web/`（或 `web/addons/`），文件头写用法（至少 3 行 `//`），样式放进 `deck.css`，在 `talks/example/` 里有示例，在 `AGENTS.md` 的表格里写出文件名，然后运行 `python tools/gen_components.py`，`python tools/check_docs.py` 必须通过。
- **幻灯片的状态**：`enter(step, animate)` 必须幂等、可跳转。写"第 k 步的完整状态"，不写"相对上一步的增量"。`build` 每次返回新对象，不在模块级变量里保存 mobject。
- **不要提交或写入凭据**。
- **改动要小而聚焦**，不做大范围重构。

## 7. 排障

| 现象 | 常见原因 | 处理 |
| --- | --- | --- |
| 3D 画面空白（只有背景） | WebGL 不可用，或上下文已丢失；幻灯片的 `enter` 没有调用到（步骤未显示）；数据键不对导致 `undefined` | 控制台看 WebGL 与 `TypeError`；确认 `enter` 调用了 `view.start()` 或 `stage.go`；核对 `data` 键与文件名 |
| "WebGL context lost"、"Too many active WebGL contexts" | 3D 幻灯片没有实现 `destroy`；或同时加载的 3D 视图太多 | 每个 3D 幻灯片都返回 `destroy`（`view.dispose` 或 `stage.dispose`）。deck 只保留当前页前后 2 张的上下文，其余会被拍成图片 |
| 标签压在标题上 | 3D 舞台的顶边在标题下方的假设被打破（`crystalSlide` 默认 `.cr-stage` 的 `top: 14%`） | 手写的 `CrystalView` 也要把舞台放在标题下方；减小 `fly` 的 `zoom`；标签行只在 `labels` 步骤打开 |
| 跳转（`#/n`）与逐步点击的画面不同 | `enter` 用了增量状态，或某一步的状态没有写全；`Deck.manim` 的 `build` 保存了模块级对象 | 每一步的 `enter` 从头设定所有状态；`build` 每次新建对象；用 `check_deck --back` 与手动跳转对比 |
| 主题切换不生效，或颜色看不见 | 颜色写死（`#fff`、`white`）；CSS 只改了一个主题；`?theme=` 参数丢失 | 改用 `palette` 或 CSS 变量；`document.documentElement.dataset.theme` 应为 `light` 或 `dark`；T 键会重新加载并保留 `?theme=` |
| `file://` 下数据读不到、`fetch` 失败 | 浏览器不允许从 `file://` 读 JSON，也不允许加载 ES module | 数据用 `.js` 通过 `<script>` 加载（`prep_*.py` 已写），不要在幻灯片里 `fetch`；manim-web 只用 `vendor/manim-web/manim-web.iife.js` |
| `window.DATA.xxx` 是 `undefined` | `prep_*.py` 的输出文件名与 `data: '...'` 的键不一致（键 = 输出文件名不含扩展名）；或者数据的 `<script src>` 漏写、写在了 `Deck.start` 之后 | 改名使其一致；把数据脚本放在幻灯片脚本之前、`Deck.start` 之前 |
| `uv run` 找不到或安装失败 | 未安装 uv；网络不通；pymatgen 体积大，首次很慢 | 安装 uv；`export_bond_rules.py` 只需偶尔运行，失败时保留现有的 `bond_rules.js` |
| `pip install gemmi numpy rdkit` 失败 | RDKit 需要与 Python 版本匹配的轮子 | 用 conda 或指定 Python 版本安装；`prep_protein.py` 只需 gemmi、numpy |
| CIF 展开出的原子数不对，或只有一个原子 | CIF 没有对称操作，且空间群名不是 gemmi 认识的标准写法 | 看 `prep_crystal.py` 打印的 `N atoms in the cell` 与 `spacegroup`，与文献核对；修正 CIF 中的 `_space_group_name_H-M_alt` |
| 晶体有键但键数异常少或多 | `bond_rules.js` 与当前 pymatgen 不一致，或元素不在 Jmol 半径表中 | 重新运行 `export_bond_rules.py`；缺失元素会使用默认半径 |
| 3D 很慢，或 check_deck 超时 | CPU 渲染（SwiftShader）；晶胞重复次数过大（超过约 3×3×3，配对搜索是平方复杂度） | 减小 `repeat`；`check_deck` 慢是正常的 |
| `check_deck` 报 console error 但画面正常 | 第三方库的警告，或本项目的 `console.warn`（如 `Deck.hide('x')` 找不到该幻灯片） | 逐条看报告；`Deck.hide` 的警告要修正名字 |
| `check_deck` 通过但画面有问题 | 脚本只查控制台，不查版式 | 看 `check/` 截图（两个主题都看） |
| `check_deck --slide x` 没有输出任何幻灯片检查 | 名字拼错，脚本不报错 | 去掉 `--slide` 看完整列表，核对名字 |
| `talks/example` 的 check_deck 失败，报 "Maximum call stack size exceeded" | 上游示例已有的 reveal.js 错误，不是本项目引入的 | 确认是这一条，其余无新增错误即可；不要为此修改 `talks/example` |
| `docs/components.md` 与代码不一致；`check_docs` 报 "is stale" | 改了文件头但没有重新生成 | 运行 `python tools/gen_components.py` |
| `check_docs` 报 "not mentioned by file name" | 新组件没有写进 `AGENTS.md` | 在 `AGENTS.md` 的表格中加入该文件名 |
| `check_docs` 报 header comment 行数不足 | 文件头少于 3 行 `//` 注释 | 补充用法说明 |
| 幻灯片第一行不是 `//` | `check_docs` 第 (d) 条 | 在第一行写步骤说明 |
| `export_pdf.py` 失败，提示找不到 `/tmp` | 未给 `--pngs` 时脚本临时写到 `/tmp`，Windows 上可能不存在 | 给 `--pngs` 一个目录（待确认，见第 8 节） |

## 8. 待确认

以下各项在编写本章时未在本机运行验证，或与其他说明有出入，需要用户或后续 agent 核实。

1. **playwright 安装状态**：作者说明机器上没有安装 playwright。但在本机运行 `python tools/check_deck.py --help` 能正常打印帮助，说明脚本顶部的 `from playwright.sync_api import sync_playwright` 能被导入。是否装了 chromium（`playwright install chromium`）未确认。若未装，本章第 4 节的截图与控制台检查需要改用内置浏览器（待用户决定）。
2. **`check_deck.py` 与 `talks/example`**：按上面所述，`talks/example` 的 "Maximum call stack size exceeded" 会使脚本以 1 退出；未实际运行确认。
3. **`check_deck.py --slide` 找不到名字时的行为**：代码中没有"找不到幻灯片"的检查，直接以 0 退出。是否要加一条检查，由用户决定（未修改代码）。
4. **`export_pdf.py` 的临时文件**：未给 `--pngs` 时，脚本把每页临时写到 `Path("/tmp")`，在 Windows 下会解析为当前盘符的 `\tmp`。未运行确认是否会失败。
5. **`build_site.sh` 与本地 PDF**：`.gitignore` 忽略 `talks/*/*.pdf`，但 `build_site.sh` 复制工作区的整个 `talks/`，只删除 `check/`。本地存在的 PDF 会进入 `site/`，手动上传时会被发布。是否在 `build_site.sh` 中排除 `*.pdf`，待用户决定（未修改）。
6. **`deploy_pages.sh` 的默认项目名**：默认值是上游的 `protein-design-interactive-slides`。本仓库使用哪个 Cloudflare Pages 项目名，待用户确认。
7. **发布方式**：GitHub 推送本身不会配置静态托管；自动发布取决于是否连接 Pages 以及所选生产分支。
8. **`file://` 打开**：本章第 4 节第 6 项为作者未验证，需在本机实际双击打开一遍。
9. **uv 与 pymatgen**：本机是否已安装 uv，`uv run tools/export_bond_rules.py` 是否能在本机成功（包括 pymatgen 的安装体积与时间），未验证。
10. **`M.Axes` 接受数据数组的方式**：第 2.3 节建议用 `M.Axes` + `axes.plot` 画数据驱动曲线，但 `manim_graph.js` 只演示了函数形式（`axes.plot(f, ...)`）。传入离散数据点的写法、以及 `M.Line` 等图元的签名，需要对照 `vendor/manim-web` 的类型或实际运行确认。
11. **根目录 `index.html`**：当前用 meta refresh 跳到 `materials-demo`，且只在一行里列出链接。是否改成列表页，由用户决定。
12. **`vendor_manim_web.sh`**：未运行（它会下载）。`esbuild@0.24.2` 与 manim-web 0.39.4 的打包结果未验证。
13. **`prep_protein.py` 与 `prep_amino_acids.py`** 没有 uv 头部，依赖需 pip 安装；它们的安装方式是否要写进 `README.md`，待用户决定。
