# 组件手册（给写汇报的人和编码 agent）

这份手册回答三件事：**仓库里有哪些组件可用**、**想做某种页面该用哪个**、**版面怎么排才好看**。
它不是源码注释的复制品（那个是自动生成的 [../components.md](../components.md)，只是 API 速查），而是带场景、排版建议和可直接复制的示例的手册。

- 材料领域汇报：晶体结构用第 3 章，曲线和公式用第 2 章，版面规则用第 1 章。
- 第 4 章的分子组件继承自上游的蛋白模板，材料汇报里只在非周期体系（小分子、团簇、吸附物）时才用。
- 想动手新建一个讲稿，直接读第 5 章的流程。

## 章节

| 章 | 文件 | 内容 |
| --- | --- | --- |
| 1 | [01-runtime-and-layout.md](01-runtime-and-layout.md) | 幻灯片契约、版面网格和字号、图加要点、标题页、章节栏、颜色、5 种可抄的版式 |
| 2 | [02-animation-and-charts.md](02-animation-and-charts.md) | `Deck.manim`、manim-web 对象、数据曲线（zT–T、XRD）、`Deck.groupedBars` |
| 3 | [03-crystal-structures.md](03-crystal-structures.md) | 从 CIF 到幻灯片、`Deck.crystalSlide`、`CrystalView`、十个常用步骤 |
| 4 | [04-molecules-and-3d-stage.md](04-molecules-and-3d-stage.md) | `Deck.turntable`、`Deck.molstar`、`ballStick`、`cages`、`M.Molecule3D` |
| 5 | [05-workflow-and-tools.md](05-workflow-and-tools.md) | 新建讲稿的步骤、每个工具的用法、验收清单、发布、故障排查 |
| 6 | [06-migrated-components.md](06-migrated-components.md) | 数据图表、光谱和大模型组件的加载、示例与已知差异 |

## 想做什么 → 用哪个

| 我想… | 用这个 | 看哪章 |
| --- | --- | --- |
| 展示一个晶体结构：晶胞、键、配位多面体、层、晶格矢量、元素标签 | `Deck.crystalSlide`（整页）或 `Deck.CrystalView`（手工搭） | 3 |
| 从 CIF 文件得到数据 | `uv run tools/prep_crystal.py` | 3、5 |
| 把晶体看成图（节点、边、消息传递） | `crystalSlide` 步骤里的 `nodes`、`cutoff`、`gnn` | 3 |
| 小分子、团簇、吸附物等非周期的 3D 模型，可拖拽 | `Deck.turntable` 加 `M.Molecule3D` | 4 |
| 画曲线、函数、公式，并按点击逐步出现 | `Deck.manim`（manim-web 的坐标轴、`axes.plot`、`MathTex`） | 2 |
| 把实测数据画成折线（zT–T）或谱线（XRD 峰） | `Deck.manim` 加 `Axes`，配方见第 2 章第 3 节（已验证） | 2 |
| 几组数字做柱状图对比 | `Deck.groupedBars` | 2 |
| 一张图加几条解释，随点击逐条出现 | `.deck-figure` 加 `Deck.points` | 1 |
| 标题页、大纲页、章节进度栏 | `.deck-title` 等、`Deck.sections` / `Deck.topics` | 1 |
| 一行说明文字压在图下面 | `.deck-caption` | 1 |

数据驱动折线、散点、漏斗、二元凸包、声子、能带/DOS、XRD 与大模型示意组件见第 6 章。它们按当前运行时重建，部分动画、公式和布局选项尚未与归档版完全一致。

## 版面速查

幻灯片是 16:9 的画面，所有尺寸用 `--u`（画面宽度的 1%），**不要写 px 和临时字号**，用 `--t-display / --t-heading / --t-lead / --t-body / --t-small / --t-caption / --t-micro`。

```
+------------------------------------------------------------+
|  标题 (.deck-heading, 左上，强调色)                         |  约 15% 以上
|                                                            |
|  图 (.deck-figure / .deck-stage)     1 要点标题            |  内容区
|  左侧约 52%~60%                         要点的小字         |  约 15%~85%
|                                      2 …                   |  Deck.points 右列
|                                                            |
|  说明一行 (.deck-caption)                                  |  约 87%
|  1 章节   2 章节  ●○○                                      |  章节栏
+------------------------------------------------------------+
```

- 左边放图（晶体、曲线、示意），右边放 `Deck.points`；每次点击出现一个要点，和图的一步对应。`Deck.crystalSlide` 已经按这个版式排好（舞台在标题下方、左侧约 60%，要点列在 `--col-left: 58%`）。
- 一页只讲一件事，用动作（出现、淡出其余）代替文字。**不要段落，不要项目符号**，细节放 `notes`（按 S 看）。
- 颜色用 `var(--accent)`、`palette` 等，**不写死十六进制**；每页最多一个主色加一个辅色；颜色要有对应关系（同一元素、同一曲线同色）。
- 不用发光、渐变、毛玻璃；强调靠运动和透明度。
- 浅色是默认主题，深色用 `?theme=dark` 或按 T；两种主题下都要检查。

更完整的版式配方（标题页、大纲页、图加要点、全宽舞台加说明行、结论页）和排版的数值依据在第 1 章；动画页和柱状图页的版式在第 2 章；晶体页的版式在第 3 章。

## 写新页面的三条硬规矩

1. 每一步的状态要**写成"第 k 步应有的完整画面"**，不要写增量：`enter(k, false)` 紧跟在挂载后必须和一路点到第 k 步的画面完全一致，后退也一样。
2. 用到 WebGL 的页（晶体、3D 模型）一定要在 `destroy` 里释放；浏览器只允许约 16 个 WebGL 上下文。
3. 不改 `web/deck.css` 和 `web/deck.js` 来迁就某一场汇报；某一场的内容放在 `talks/<名称>/`，通用的新组件放 `web/`，在文件头写好用法注释，运行 `python tools/gen_components.py`，并且 `python tools/check_docs.py` 要通过。

## 验证

做完一个讲稿，必须在浅色和深色两种主题下把每一页每一步**前进再后退**走一遍，确认直接跳转和逐步点击的画面一致，控制台没有新的报错（`reveal.js` 的 "Maximum call stack size exceeded" 在上游 example 里就有，不是新代码引起的）。`python tools/check_docs.py` 还会检查本手册提到的每个 `Deck.*` 和 `M.*` 名字是否真实存在。
