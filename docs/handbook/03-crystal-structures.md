# 03 晶体结构：从 CIF 到幻灯片

本章是 crystal add-on 的操作手册，面向要做晶体结构幻灯片的人和代理。读完之后应能：把一个 CIF 变成 `data/*.js`，用 `Deck.crystalSlide` 写一页多步的晶体讲解，需要时用 `Deck.CrystalView` 手写页面，并知道每个参数的默认值、继承规则和已知限制。

涉及的文件：

| 文件 | 作用 |
| --- | --- |
| `tools/prep_crystal.py` | CIF → `data/<name>.js`（晶胞、分数坐标、元素） |
| `tools/export_bond_rules.py` | pymatgen JmolNN 的成键半径 → `web/addons/bond_rules.js`（生成文件，不要手改） |
| `web/addons/crystal_logic.js` | 纯逻辑（无 three.js）：扩胞、键、配位多面体、层、图、标签排布 |
| `web/addons/crystal.js` | 三维视图 `Deck.CrystalView`，多步幻灯片 `Deck.crystalSlide` |
| `tools/samples/SrTiO3.cif`, `Bi2Te3.cif` | 两个示例 CIF（来源未记录，见第 7 节） |
| `talks/materials-demo/` | 演示讲稿：`index.html`、`slides/srtio3.js`、`slides/bi2te3.js`、`slides/outline.js`、`data/*.js` |

所有长度单位为 Å，角度为弧度。下文的“源码行号”指向写作时的文件，改动后可能偏移。

---

## 1. 流水线

```
CIF ──prep_crystal.py──▶ talks/<talk>/data/<name>.js   (window.DATA["<name>"] = {...})
                                 │
bond_rules.js (JmolNN radii) ────┤
                                 ▼
crystal_logic.build(data, {repeat, polyhedra})  →  built {atoms, bonds, polyhedra, corners, center, radius, lattice, supercell}
                                 │
                                 ▼
Deck.CrystalView(host, built, {orientation})   或   Deck.crystalSlide({ data: '<name>', ... })
```

### 1.1 CIF → `data/<name>.js`

用途：把 CIF 的晶胞和原子位置写成浏览器可读的数据。

何时用：每换一个晶体结构时运行一次。数据文件进仓库，演示时不需要 Python。

最小示例（与 `talks/materials-demo/data/` 的生成方式一致）：

```bash
uv run tools/prep_crystal.py tools/samples/SrTiO3.cif talks/materials-demo/data/srtio3.js --name "SrTiO₃"
uv run tools/prep_crystal.py tools/samples/Bi2Te3.cif talks/materials-demo/data/bi2te3.js --name "Bi₂Te₃"
```

参数（`prep_crystal.py` 的命令行）：

| 参数 | 必需 | 含义 |
| --- | --- | --- |
| `cif` | 是 | 输入 CIF 路径 |
| `out` | 是 | 输出 `.js` 路径；同时写同名 `.json`（页面不读它） |
| `--name` | 否 | 显示名（默认取 CIF 的 `small.name`，再取文件名主干） |

输出格式。`out` 的文件主干就是数据键：`data/srtio3.js` 写入 `window.DATA["srtio3"]`，所以 `Deck.crystalSlide({ data: 'srtio3' })` 读的就是它。文件内容是一行脚本，可以用 `<script>` 直接加载（`file://` 下不能 `fetch` JSON）：

```js
(window.DATA = window.DATA || {})["srtio3"] = {"name": "SrTiO₃", "spacegroup": "P m -3 m",
  "lattice": [[3.905, 0.0, 0.0], [0.0, 3.905, 0.0], [0.0, 0.0, 3.905]],
  "atoms": [{"el": "Sr", "frac": [0.0, 0.0, 0.0]}, {"el": "Ti", "frac": [0.5, 0.5, 0.5]}, ...],
  "source": "SrTiO3.cif"};
```

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `name` | 字符串 | 显示名 |
| `spacegroup` | 字符串 | gemmi 给出的 H-M 名（如 `P m -3 m`、`R -3 m :H`），仅作记录，页面不用 |
| `lattice` | 3×3 数组 | 三个晶格矢量 a、b、c 的笛卡尔分量（Å），第 i 行是第 i 个矢量 |
| `atoms` | 数组 | 每个原子 `{ el, frac }`，`el` 为元素符号，`frac` 为分数坐标（对称操作已展开，取值 [0, 1)） |
| `source` | 字符串 | CIF 文件名 |

`frac` 的处理：`round(x % 1.0, 6)`，并把 1.0 改成 0.0。

对称展开。`prep_crystal.py` 用 gemmi 的 `get_all_unit_cell_sites()` 展开对称（源码注释说明：有些 CIF 不列出对称操作，此时 pymatgen 会退回 P1，只保留不对称单元）。可以直接核对：`tools/samples/SrTiO3.cif` 只列 3 个位点（Sr1、Ti1、O1），生成的数据有 5 个原子（O 展开成 3 个）；`Bi2Te3.cif` 列 3 个位点，数据里有 15 个原子。

排版建议：`--name` 用带下标的显示名（`Bi₂Te₃`），它会出现在数据里，但幻灯片标题由 `heading` 决定，二者可以不同。

限制与坑：
- 占据率、无序不处理。`prep_crystal.py` 不读 `_atom_site_occupancy`，部分占据的位点会被当作满占据画出来（见第 7 节）。
- 需要 gemmi（`uv` 会按脚本头部的依赖安装）。本章写作时的沙箱里没有装 gemmi，也没有运行过此脚本；上面的输出格式来自源码和已生成的 `data/*.js` 文件。
- 输出文件名决定数据键。改名后要同步改 `crystalSlide` 的 `data`。

示例位置：`tools/prep_crystal.py`（全文 64 行）；`talks/materials-demo/data/srtio3.js`、`bi2te3.js`。

### 1.2 成键规则：`bond_rules.js` 与 `export_bond_rules.py`

用途：浏览器里找键和配位多面体用的规则，与 pymatgen 的 `JmolNN` 相同。

规则（`crystal_logic.js` 第 21–25 行，与 `export_bond_rules.py` 的注释一致）：两个原子成键，当且仅当

```
0.4 Å < d ≤ r(a) + r(b) + 0.45 Å
```

- `min = 0.4`、`tol = 0.45`，来自 pymatgen `JmolNN` 的默认参数（脚本从 `inspect.signature` 读取，不是手写的）。
- `r(El)` 是每个元素一个半径，来自 pymatgen 的 `bonds_jmol_ob.yaml`（Jmol 的表，取自 OpenBabel）。
- 生成文件头部记录了 pymatgen 版本：`pymatgen 2026.10.24`。

几个半径（Å）：`O 0.68`、`Ti 1.47`、`Sr 1.12`、`Bi 1.54`、`Te 1.47`、`Si 1.2`、`Li 0.68`。例如 Ti–O 的上限是 1.47 + 0.68 + 0.45 = 2.60 Å；Sr–O 的上限是 1.12 + 0.68 + 0.45 = 2.25 Å，SrTiO₃ 中 Sr–O 距离约 2.76 Å，所以 Sr 与 O 不成键。

重新生成（升级 pymatgen 后要做）：

```bash
uv run tools/export_bond_rules.py
```

输出文件 `web/addons/bond_rules.js` 是生成物，文件头写着“do not edit by hand”。

加载顺序：必须在 `crystal_logic.js` 之前加载，因为 `bondedFn()` 在调用 `build` 时读取 `window.Deck.bondRules`，缺它会抛出 `crystal needs web/addons/bond_rules.js`。

限制与坑：
- 规则只看元素和距离，不看化学环境。配位多面体的“配体”是所有满足规则的原子，不限阴离子。如果阳离子之间距离足够近（如 Bi–Bi 上限是 1.54 × 2 + 0.45 = 3.53 Å），也会被当作配体，需要在画之前检查。
- 半径是 Jmol 表，不是离子半径，也不随价态变化。
- 没有部分占据、没有周期性键的单独处理：键在扩胞后的原子集合里找（见 1.3）。

示例位置：`web/addons/bond_rules.js`（第 7 行是数据）；`tools/export_bond_rules.py`。

### 1.3 浏览器里的建模：`Deck.crystalLogic.build`

用途：把 `data` 变成画面用的 `built` 对象：扩胞后的原子、键、配位多面体、晶胞角点。

何时用：通常由 `crystalSlide` 自动调用；手写页面时直接调用（见第 3 节）。

最小示例：

```js
const built = Deck.crystalLogic.build(data.srtio3, { repeat: [1, 1, 1], polyhedra: ['Ti'] });
built.atoms.length;        // 原子数（含边界上的重复像）
built.bonds;               // [[p, q], ...]，p、q 是 built.atoms 的下标
built.polyhedra;           // [{ center, ligands: [下标, ...] }]
```

参数（`build(data, { repeat, polyhedra })`，源码第 31 行）：

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `data` | 必需 | 第 1.1 节的数据对象，即 `window.DATA.<name>` |
| `repeat` | `[1, 1, 1]` | 沿 a、b、c 的超胞倍数 `[nx, ny, nz]` |
| `polyhedra` | `[]` | 要画配位多面体的元素符号列表，如 `['Ti']` |

算法（源码第 31–72 行）：
1. 对每个原子，取平移 `(i, j, k)` ∈ [-1, nx] × [-1, ny] × [-1, nz]（三个方向各取整数值，共 (nx+2)(ny+2)(nz+2) 组）的像；像的分数坐标落在 `[0, n]`（容差 1e-4）内的算作“在图里”。这样边界上的原子（分数坐标为 0 或 n）会在对面再画一次，这就是 VESTA 式的边界重复。
2. 对每个在图里的、元素属于 `polyhedra` 的原子，把它的所有成键邻居（来自整个候选集，包括图外的像）加入保留集合，这样多面体不会被晶胞边切掉。
3. 键：在保留的原子之间用 1.2 节的规则找，不含图外的原子。
4. 配位多面体：只取中心在图里的、配体数 ≥ 4 的。
5. 返回 `corners`（8 个角点，二进制 ijk 顺序）、`center`（角点的平均）、`radius`（中心到所有原子和角点的最大距离，用于相机取景）、`lattice`、`supercell`（每个矢量乘以对应的 `repeat`）。

我用同一算法做了一次等价模拟（读取两个数据文件，未在浏览器中运行，以下计数应在浏览器里核对）：
- SrTiO₃，`repeat [1,1,1]`，`polyhedra ['Ti']`：15 个原子（5 个晶胞原子加上边界像和 Ti 的配体），6 条键，1 个 TiO₆ 多面体（6 个 O）。
- Bi₂Te₃，`repeat [1,1,1]`，`polyhedra ['Bi']`：66 个原子，72 条键（全部是 Bi–Te，没有 Te–Te 键），12 个 BiTe₆ 多面体。

返回值字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `atoms` | `[{ el, pos: [x,y,z] }]` | 笛卡尔坐标（Å），未平移 |
| `bonds` | `[[p, q]]` | 下标对，p < q |
| `polyhedra` | `[{ center, ligands }]` | 中心和配体下标 |
| `corners` | 8 × 3 | 晶胞角点，ijk 二进制顺序（下标 `i*4 + j*2 + k`） |
| `center` | 3 | 绘图框的中心（画面原点在这里） |
| `radius` | 数 | 外接半径（Å） |
| `lattice` | 3 × 3 | 原始晶格矢量（未乘 repeat） |
| `supercell` | 3 × 3 | `lattice` 乘 `repeat` 后的矢量，层选择用它 |
| `repeat` | 3 | 原样返回 |

限制与坑：
- 成键和配体的查找是两两比较，复杂度约为图内原子数的平方；候选集合的大小是 (nx+2)(ny+2)(nz+2) × 原子数。`repeat` 大了就慢（第 7 节）。
- `polyhedra` 里的元素如果不在结构中，静默跳过，不报错。
- 配体数不足 4 的中心不画多面体，也不报错。

示例位置：`web/addons/crystal_logic.js:31`（`build`）；`talks/materials-demo/slides/srtio3.js`（`polyhedra: ['Ti']`）。

### 1.4 脚本加载顺序（`index.html`）

用途：三维视图依赖 manim-web 打包的 three.js，且依赖 `Deck` 的全局对象，所以顺序固定。

最小示例（`talks/materials-demo/index.html` 的相关部分）：

```html
<script src="../../vendor/reveal/reveal.js"></script>
<script src="../../vendor/reveal/notes.js"></script>
<script src="../../vendor/manim-web/manim-web.iife.js"></script>   <!-- window.ManimWeb.THREE -->
<script src="../../web/deck.js"></script>                           <!-- window.Deck -->
<script src="../../web/manim.js"></script>
<script src="../../web/plots.js"></script>
<script src="../../web/addons/bond_rules.js"></script>              <!-- window.Deck.bondRules -->
<script src="../../web/addons/crystal_logic.js"></script>           <!-- window.Deck.crystalLogic -->
<script src="../../web/addons/crystal.js"></script>                 <!-- Deck.CrystalView, Deck.crystalSlide -->
<script src="data/srtio3.js"></script>                              <!-- window.DATA.srtio3 -->
<script src="data/bi2te3.js"></script>
<script>Deck.section(null)</script>
<script src="slides/title.js"></script>
<script src="slides/outline.js"></script>
<script>Deck.section(1)</script>
<script src="slides/srtio3.js"></script>
<script>Deck.section(2)</script>
<script src="slides/bi2te3.js"></script>
<script>Deck.start({ title: 'Crystal structures, live', smoothBack: '3d' });</script>
```

要点：
- `crystal.js` 在文件顶部取 `window.ManimWeb.THREE` 和 `window.Deck.crystalLogic`，所以 `manim-web.iife.js` 和 `crystal_logic.js` 必须先加载。
- `data/*.js` 要在幻灯片脚本之前加载，因为 `crystalSlide` 的 `mount` 在运行时读取 `window.DATA`。
- 幻灯片的顺序就是 `<script>` 标签的顺序。
- 只有用晶体组件的讲稿才需要 `bond_rules.js`、`crystal_logic.js`、`crystal.js` 三个标签。

示例位置：`talks/materials-demo/index.html`。

---

## 2. `Deck.crystalSlide`：整页多步晶体幻灯片

### 2.1 用途 · 何时用 · 最小示例

用途：一页幻灯片，左边是晶体（约 60% 宽），右边是编号的要点列，每点击一次前进一步。每一步可以显示晶胞、原子、键、多面体，移动相机，改变标签、层选择、图视图和消息传递。

何时用：讲解一个结构的一个主题（晶胞、键、配位、某一层）时，且不需要自定义布局。要自定义布局（整幅、并排两个视图、动画），用 `Deck.CrystalView`（第 3 节）。

最小示例：

```js
// talks/<talk>/slides/srtio3.js
Deck.crystalSlide({
  name: 'srtio3',
  data: 'srtio3',
  heading: 'Perovskite SrTiO₃',
  polyhedra: ['Ti'],
  notes: 'Cubic Pm-3m, a = 3.905 Å.',
  steps: [
    { title: 'The unit cell', sub: 'Pm‑3m, a = 3.905 Å, five atoms', show: { cell: 1, atoms: 1 } },
    { title: 'Bonds', sub: 'd ≤ r(a) + r(b) + 0.45 Å', show: { bonds: 1 } },
    { title: 'TiO₆ octahedron', sub: 'Ti in the middle of six O', show: { polyhedra: 1 },
      dim: ['Sr'], fly: { dir: [1, 0.6, 0.5], zoom: 1.5 } },
    { title: 'Elements and lattice vectors', sub: 'a, b, c from the cell’s origin corner', labels: 1, axes: 1 },
  ],
});
```

这一段与 `talks/materials-demo/slides/srtio3.js` 的结构相同（文字略有不同；那里第 4 步还有 `dim: []`、`fly: {}` 两行，见 2.3）。

### 2.2 参数（`def`）

源码：`web/addons/crystal.js` 第 622 行起。

| 参数 | 必需 | 默认 | 含义 |
| --- | --- | --- | --- |
| `name` | 是 | — | 幻灯片的注册名（传给 `Deck.slide`），同一讲稿内不要重复 |
| `data` | 是 | — | `window.DATA` 的键，如 `'srtio3'` |
| `heading` | 否 | 无标题 | 左上角的 `deck-heading`，始终可见 |
| `polyhedra` | 否 | `undefined`（不画） | 中心元素列表，传给 `build` |
| `repeat` | 否 | `[1,1,1]` | 超胞倍数，传给 `build`（`undefined` 时使用默认值） |
| `orientation` | 否 | `[0, 0, 0]` | 整个模型绕晶胞中心的欧拉角（XYZ 顺序，弧度），见第 5 节 |
| `notes` | 否 | — | 演讲者备注（按 S 查看） |
| `steps` | 是 | — | 步骤数组，长度即幻灯片的点击数；每步见 2.3 |

没有的选项（不要用）：`rock`（源码里没有，转台式摇摆在 `turntable.js`，属于分子组件）、`smoothBack` 和 `interactive`（`crystalSlide` 内部固定为 `true`）、`title`。

固定的版面：`crystal.js` 第 629–634 行的 CSS 固定了 `.cr-col` 的位置和舞台的位置（第 6 节）。

### 2.3 每一步的字段

每一步是一个对象。字段可以全部省略，省略的字段沿用前面步骤的值（见“继承”）。

| 字段 | 取值 | 作用 | 未设时 | 继承（“后面的步覆盖前面的”） |
| --- | --- | --- | --- | --- |
| `title` | 字符串 | 右侧列的标题（转义，不解析 HTML） | — | 每步各自，不继承 |
| `sub` | 字符串 | 标题下一行，小字 | — | 每步各自，不继承 |
| `show` | `{ cell, atoms, bonds, polyhedra }`，各 0..1 | 各部分的可见程度（缓动） | 每次进入时全部为 0 | 按键合并：未列出的键沿用更早步骤的值 |
| `dim` | 元素符号数组 | 列出的元素淡到 0.08，其他为 1 | `[]`（无淡化） | 有定义就覆盖；`[]` 是有效值，可清除 |
| `fly` | `{ dir, target, zoom }` | 相机移动（见下） | `{}`，即默认视角 | 有定义就覆盖；`{}` 回到默认视角 |
| `labels` | 0..1 | 元素标签的整体可见程度 | 0 | 有定义就覆盖 |
| `labelFor` | 元素数组，或 `null` | 只给列出的元素加标签；`null` 为全部 | 不设时全部元素 | `undefined` 不改变；`null` 恢复为全部 |
| `axes` | 0..1 | a、b、c 矢量箭头 | 0 | 有定义就覆盖 |
| `highlight` | `{ els, indices }` 或 `null` | 高亮原子（1.25 倍，描边） | `null` | `null` 清除（“有定义”判断是 `!== undefined`） |
| `layer` | `{ axis, from, to }` 或 `null` | 只保留某个分数区间内的原子，其余淡到 0.1 | `null`（全部） | `null` 恢复全部 |
| `nodes` | 0..1 | 球棍 → 图（小球、细键、隐藏晶胞线和多面体） | 0 | 有定义就覆盖 |
| `cutoff` | Å 数值，或 `null` | 按距离截断的邻接图（虚线灰边）；`null` 关闭 | `null` | `null` 关闭 |
| `gnn` | `{ center, hops }` 或 `null` | 以 `center` 为中心的消息传递着色 | `null` | `null` 关闭 |

字段的细节：

- `show` 的四个键：
  - `cell`：晶胞线框（角点之间的 12 条边），透明度 0.8 × `cell`，`nodes` 为 1 时消失。
  - `atoms`：原子球，透明度 × `atoms`。
  - `bonds`：键，每根键从中点分两半，各半用端点原子的颜色，透明度跟随端点原子的淡化。
  - `polyhedra`：配位多面体的面和棱，只有在 `polyhedra` 参数列出的元素才会有。
- `dim` 按元素淡化，不能按单个原子。要突出单个原子，用 `highlight`（`indices` 是 `built.atoms` 的下标，不是 CIF 里的序号）。
- `fly.dir`：相机方向（从目标看向相机的方向），在画面坐标系里（世界坐标，即模型已经应用过 `orientation` 之后）。默认是 `[1, 0.75, 0.55]`。`fly.target`：相机注视点，单位 Å，相对绘图框中心，也在画面坐标系里，默认 `[0, 0, 0]`。`fly.zoom`：大于 1 更近，默认 1。
- `layer.axis`：`'x' | 'y' | 'z'`，分数坐标按超胞矢量算（`fracAlong` 用 `built.supercell`），`from`/`to` 是 0..1 之间的分数（两端含）。判断用原子中心，容差 1e-3。
- `gnn.center`：元素符号（取该元素的第一个原子）或原子下标。`gnn.hops`：整数。
- `labelFor` 只决定哪些元素显示标签，标签的位置由第 5 节的规则决定。

继承的实现（源码第 644–672 行）：

1. 进入步骤 `step` 时，`parts` 先重置为 `{cell:0, atoms:0, bonds:0, polyhedra:0}`。
2. 依次遍历 `steps.slice(0, step)`：`show` 用 `Object.assign` 合并；其他字段用“有定义才覆盖”的规则。
3. 把结果一次性应用到视图。
4. `animate` 为假（直接跳转，例如从后面的幻灯片跳回来，或 URL `#/n`）时调用 `view.snap()` 并以 0 毫秒飞行；否则以 1400 毫秒飞行（`animate === 'back'` 时 700 毫秒）。

因此跳到第 k 步与逐步点击到第 k 步的画面相同。

示例（`talks/materials-demo/slides/bi2te3.js`，第 14–20 行，节选）：

```js
steps: [
  { title: 'The hexagonal cell', sub: 'R‑3m, c = 30.5 Å, laid on its side',
    show: { cell: 1, atoms: 1 }, fly: { dir: [0.25, -1, 0.3], zoom: 1.25 } },
  { title: 'Bonds', sub: 'Bi–Te inside a layer; none across the gap', show: { bonds: 1 } },
  { title: 'BiTe₆ octahedra', sub: 'each Bi has six Te neighbours', show: { polyhedra: 1 } },
  { title: 'One quintuple layer', sub: 'five atomic planes; the others fade', labels: 1,
    layer: { axis: 'z', from: 0.2, to: 0.47 } },
],
```

第 2、3 步没写 `fly`，所以沿用第 1 步的相机。

`srtio3.js` 第 4 步写的是 `dim: []`、`fly: {}`，目的是在这一步清除前面步骤设置的淡化和相机位置。

点的列：`Deck.points(steps.map((s, i) => ({ title, sub, from: i + 1 })), { className: 'cr-col' })`。第 k 个点在第 k 步出现（`data-from = k`），标题和副标题都是纯文本（被转义）。点的编号是 1..n，与步骤号相同。

限制与坑：
- 每一步都会重新调用 `setCutoff`、`setGnn` 等，但它们对未变化的值是空操作（`setCutoff` 有早退出）。
- 第 1 步如果不设 `show.cell`，进入时晶胞不可见。
- `interactive: true` 让幻灯片接收拖拽和滚轮，所以在它上面左右滑动不会翻页。点击仍然翻页（拖拽距离超过 6 像素才算拖拽）。
- `crystalSlide` 内部固定设了 `smoothBack: true`：在 `Deck.start({ smoothBack: '3d' })` 下，点一次后退会收到 `'back'`，淡入淡出和相机运动倒着播放（相机 700 ms；前进是 1400 ms），并且结束时的状态与直接跳转完全一致；快速连点第二次后退（0.7 秒内）则直接跳转。deck 的 `smoothBack` 设为 `'none'`（默认）时后退一律直接跳。已用脚本记录确认：前进 `flyTo 1400`，后退 `flyTo 700`，后退不调用 `snap`。

示例位置：`talks/materials-demo/slides/srtio3.js`、`bi2te3.js`；源码 `web/addons/crystal.js:622`。

---

## 3. `Deck.CrystalView`：手写的三维视图

### 3.1 用途 · 何时用 · 最小示例

用途：在任意 `host`（一个定位过的 `div`）里画晶体，由你控制每一步的状态和版面。

何时用：版面不是“左图右列”（整幅、并排、嵌在一段文字旁）；或者一页里要两个晶体；或者要在一步里做多件事。

最小示例：

```js
Deck.slide('my-crystal', {
  steps: 2,
  interactive: true,
  mount(frame, { data, palette: P, css, esc }) {
    css(`.mc-stage { position: absolute; left: 4.2%; right: 4.2%; top: 16%; bottom: 8%; }
      .mc-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
      .label3d { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-caption);
        font-weight: 600; white-space: nowrap; pointer-events: none; transition: opacity .4s ease; }`);
    frame.innerHTML = `<div class="mc-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('SrTiO₃')}</h2>`;
    const built = Deck.crystalLogic.build(data.srtio3, { repeat: [1, 1, 1], polyhedra: ['Ti'] });
    const view = new Deck.CrystalView(frame.querySelector('.mc-stage'), built, { palette: P });
    const state = (step) => ({ parts: { cell: 1, atoms: 1, bonds: step >= 2 ? 1 : 0, polyhedra: 0 },
      labels: step >= 2 ? 1 : 0 });
    const apply = (step) => {
      const s = state(step);
      view.show(s.parts); view.setLabels(s.labels); view.setAxes(0);
    };
    apply(1); view.snap();
    return {
      enter(step, animate) {
        apply(step);
        Deck.show(frame, step, animate);
        if (!animate) { view.snap(); return view.flyTo({}, 0); }
        return view.flyTo({ dir: [1, 0.6, 0.5], zoom: 1.2 }, 1200);
      },
      freeze: () => view.render(),
      destroy: () => view.dispose(),
    };
  },
});
```

要点：`enter` 必须是幂等的：每次进入都根据 `step` 重新算出全部状态，而不是在上一步的状态上增量修改。

### 3.2 构造函数

`new Deck.CrystalView(host, built, { orientation = [0,0,0], palette = Deck.palette } = {})`

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `host` | 必需 | 容器元素；必须是定位元素（`position: absolute` 或 `relative`），并且有宽高。视图会在里面追加 canvas、标签 `div` 和 SVG 引线层 |
| `built` | 必需 | `Deck.crystalLogic.build` 的返回值 |
| `orientation` | `[0,0,0]` | 整个模型的欧拉角（XYZ，弧度） |
| `palette` | `Deck.palette` | 颜色来源，`P.accent`、`P.muted`、`P.bg`、`P.fg`、`P.series[1]`、`P.series[3]`、`P.cpk` 使用 |

构造时的默认状态（源码第 121 行）：晶胞可见（1）、原子可见（1）、键 0、多面体 0、标签 0、坐标轴 0。相机位于 `(1, 0.75, 0.55)` 方向，距离由 `fitDistance(1)` 决定，c 轴向上。渲染循环（`requestAnimationFrame`）在构造时就开始。

构造会创建一个 WebGL 上下文（`WebGLRenderer`）。`destroy` 中必须调用 `dispose()`。

### 3.3 方法

| 方法 | 签名 | 作用 |
| --- | --- | --- |
| `show` | `show(parts)` | 设置 `cell`、`atoms`、`bonds`、`polyhedra` 的目标值（0..1），缓动到达 |
| `dim` | `dim(elements, opacity = 0.1)` | 列出的元素淡到 `opacity`，其他为 1 |
| `setLabels` | `setLabels(vis, els)` | 标签目标可见度；`els` 为元素数组，缺省为全部 |
| `setAxes` | `setAxes(vis)` | a、b、c 箭头的目标可见度 |
| `highlight` | `highlight(spec)` | `spec = { els, indices }` 或 `null`（清除） |
| `focusLayer` | `focusLayer(layer)` | `layer = { axis, from, to }` 或 `null`；层外原子淡到 0.1 |
| `setNodes` | `setNodes(v)` | 0..1，球棍 → 图 |
| `setCutoff` | `setCutoff(cutoff)` | 数值（Å）建立截断图；`null` 恢复成键图 |
| `setGnn` | `setGnn(spec)` | `spec = { center, hops }` 或 `null` |
| `snap` | `snap()` | 所有目标值立即生效，不缓动（用于跳转、后退、首次显示） |
| `flyTo` | `flyTo({ dir, target, zoom } = {}, ms = 1400)` → Promise | 相机移动；`ms = 0` 立即完成并返回已解决的 Promise |
| `project` | `project(p)` → `{ x, y, visible }` | 把一个点映射到 host 的像素坐标（见下面的警告） |
| `localPos` | `localPos(i)` → `[x,y,z]` | 第 i 个原子相对绘图中心的坐标（见下面的警告） |
| `render` | `render()` | 立即画一帧（用于冻结幻灯片的截图） |
| `dispose` | `dispose()` | 停止循环，释放 WebGL 上下文，移除追加的 DOM |

属性：`onRender`（可选回调，每帧在标签位置更新之后调用；`render()` 不会调用它）。

缓动：`show`、`setNodes`、`setGnn`、`highlight`、`focusLayer` 等的目标值每帧按 `1 − exp(−5·dt)` 的速率趋近，所以不调用 `snap()` 时会有过渡。`flyTo` 用 `easeInOutCubic` 在 `ms` 内插值。

示例：

```js
view.show({ bonds: 1, polyhedra: 1 });   // 两部分同时淡入
view.dim(['Sr'], 0.08);                  // Sr 淡化
view.highlight({ els: ['Ti'] });         // Ti 放大并描边
view.setCutoff(3.0);                     // 3 Å 内的邻居连成虚线
view.setGnn({ center: 'Ti', hops: 1 }); // 以 Ti 为中心，一跳内着色
await view.flyTo({ dir: [0, -1, 0.2], zoom: 1.5 }, 1200);
```

坐标系的警告（请注意，源码与注释不一致）：
- `project(p)` 的注释写的是“cell-centred frame”，但实现（第 423–426 行）是先减去 `built.center` 再应用 `orient`。也就是说 `project` 接收的是笛卡尔坐标（与 `built.atoms[i].pos` 一样，未平移的 Å 坐标）。`updateOverlays` 内部正是这样用的。
- `localPos(i)` 返回的是已经减去 `built.center` 的坐标。把它直接交给 `project` 会偏移一个晶胞中心。
- 因此：要取原子在屏幕上的位置，用 `view.project(built.atoms[i].pos)`，不要用 `view.project(view.localPos(i))`。`localPos` 目前在仓库里没有调用方（待确认，见列表）。
- `flyTo` 的 `target` 是以绘图中心为原点的画面坐标（已应用 `orientation`）。

限制与坑：
- 手写页面需要自己写 `.label3d` 和 canvas 的 CSS（见下）。`crystalSlide` 把它们写在 `mount` 的 `css()` 里，手写时漏掉会导致标签不定位、canvas 尺寸错误。
- `snap()` 只在“不动画”的进入时调用；动画进入时，目标值会在后续帧里自己收敛。
- `dispose()` 之后不要再调用任何方法。

示例位置：`web/addons/crystal.js:109`（类）；`:407`（`flyTo`）；`:423`（`project`）；`:605`（`dispose`）。

### 3.4 手写页面必须有的 CSS

```css
.mc-stage canvas { display: block; width: 100%; height: 100%; }   /* three 不设 CSS 尺寸 */
.label3d { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-caption);
  font-weight: 600; white-space: nowrap; pointer-events: none; transition: opacity .4s ease; }
```

`makeLabel` 给标签设置了颜色、透明度和文字描边，但位置（`left`/`top`）是由 `updateOverlays` 每帧写入的，所以 `.label3d` 必须是绝对定位。`SVG` 引线层用内联样式 `position:absolute; inset:0`，不需要额外的 CSS，但 `host` 必须是定位元素。

---

## 4. 十个讲稿步骤的做法（cookbook）

每一条给出一个可直接放进 `steps` 的对象或页面片段。假设 `def` 已经包含 `data: 'srtio3'`、`polyhedra: ['Ti']`。

### 4.1 晶胞（unit cell）

用途：先让听众看见“盒子”和原子。

何时用：每个结构的第一步。

最小示例：`{ title: '晶胞', sub: 'Pm‑3m，a = 3.905 Å', show: { cell: 1, atoms: 1 } }`

排版建议：一步里同时显示 `cell` 和 `atoms`；原子默认大小对 Sr、Ti、O 都能看清。

限制与坑：`cell` 只画 12 条边，角点是 `built.corners`，即 `repeat` 之后的整个超胞框。

示例位置：`talks/materials-demo/slides/srtio3.js` 第 13 行。

### 4.2 键（bonds）

用途：说明哪些原子相连，且依据是 pymatgen 的规则。

何时用：在晶胞之后，多面体之前。

最小示例：`{ title: '键', sub: 'd ≤ r(a) + r(b) + 0.45 Å', show: { bonds: 1 } }`

排版建议：副标题写出规则，因为规则本身就是要讲的内容。

限制与坑：键只在图内的原子之间（包括边界像）。SrTiO₃ 中只有 Ti–O 键（6 条）；Bi₂Te₃ 中有 Bi–Te 键，层间没有 Te–Te 键（上限 3.39 Å，范德华间隙更长）。

示例位置：`talks/materials-demo/slides/bi2te3.js` 第 16 行。

### 4.3 配位多面体（coordination polyhedra）

用途：画出 TiO₆ 八面体、BiTe₆ 八面体这类配位环境。

何时用：键讲完之后。

最小示例（需要在 `def` 里写 `polyhedra: ['Ti']`）：

```js
{ title: 'TiO₆ 八面体', sub: 'Ti 在六个 O 的中心', show: { polyhedra: 1 }, dim: ['Sr'] }
```

排版建议：配合 `dim: ['Sr']` 让 Sr 退后，八面体才突出；`fly` 拉近到 `zoom: 1.5` 左右。

限制与坑：多面体的面由 `hullFaces` 算出（三点平面法），计算量随配体数增长较快（三点组合加逐点判断，约 O(n⁴)），只适合配体数较少的情况。配体只要满足键规则就算，不分阴阳离子。

示例位置：`talks/materials-demo/slides/srtio3.js` 第 15–16 行。

### 4.4 淡化一个子晶格或突出一个原子（dim and highlight）

用途：让一种元素退后，或者让一个具体位点发亮。

何时用：讲某个位点时。

最小示例：

```js
{ title: 'Sr 退后', sub: 'Ti 与 O 构成框架', dim: ['Sr'] }
{ title: '高亮一个位点', sub: '被高亮的原子', highlight: { indices: [3] } }   // 3 只是示例，下标要自己查
```

`indices` 是 `built.atoms` 的下标（不是 CIF 的序号）。想找某个原子的下标，用 `built.atoms.findIndex(a => a.el === 'Ti')`，或直接在浏览器里打印 `built.atoms`。

排版建议：`dim` 的淡化值固定 0.08（在 `crystalSlide` 中），手写时可在 `dim(elements, opacity)` 中指定。

限制与坑：`dim` 只按元素，不按单个原子。`highlight` 放大 1.25 倍并描边，同一步只能有一组高亮。

示例位置：`talks/materials-demo/slides/srtio3.js` 第 16 行（`dim: ['Sr']`）。

### 4.5 只显示一个原子层（one atomic layer）

用途：讲层状结构（如 Bi₂Te₃ 的 quintuple layer）时，只保留一层，其余淡化。

何时用：层状、插层、界面结构。

最小示例：

```js
{ title: '一个层', sub: '其余层淡化', labels: 1,
  layer: { axis: 'z', from: 0.2, to: 0.47 } }
```

怎样从 CIF 找到分数区间：

1. 每个原子的 z 分数坐标就是它在晶胞中的高度（0 在底面，1 在顶面）。
2. 按 z 排序，看哪些原子聚成一层（相邻原子的 z 差小，层间的 z 差大）。
3. 层的区间取为两个相邻层之间的中点，`from` 取下层的中点，`to` 取上层的中点。
4. 如果 `repeat` 沿该轴大于 1，`layer` 用的是超胞分数：第 k 个晶胞里的 z 分数 `z_c` 对应的超胞分数是 `(k + z_c) / n`（`n` 是该轴的 `repeat`）。
5. 边界的原子用中心判断；若一层正好跨过 0 或 1，要在两端各给一个区间，或者改用超胞的第二个视角。

读取 z 的只读脚本（读取 `data/*.js`，不写文件）：

```python
import json
s = open('talks/materials-demo/data/bi2te3.js', encoding='utf-8').read()
d = json.loads(s.split('] = ', 1)[1].rstrip().rstrip(';'))
for a in sorted(d['atoms'], key=lambda a: a['frac'][2]):
    print(f"{a['frac'][2]:.4f}  {a['el']:2s}  x,y = {a['frac'][0]:.3f}, {a['frac'][1]:.3f}")
```

Bi₂Te₃ 的演示用 `from: 0.2, to: 0.47`，正好圈住一个五重层的 5 个原子面（z = 0.2097 Te、0.2659 Bi、0.3333 Te、0.4008 Bi、0.4570 Te；已用 `Deck.crystalLogic.layerMask` 核对，共 25 个原子，5 个不同的面）。**反面例子**：曾经写成 `from: 0.1, to: 0.56`，会把相邻五重层的外侧 Te（0.1236、0.5430）也圈进来，变成 7 个面——区间要落在相邻两层最外原子 z 值之间的空隙里（这里是 0.1236~0.2097 之间和 0.4570~0.5430 之间）。

排版建议：层外原子淡到 0.1，层内原子保持原色；配合 `labels: 1` 时，标签只用层内的原子定位（`updateOverlays` 的回退规则：某元素在层内没有原子就用全部原子）。

限制与坑：`layer` 只改透明度，层外原子仍然参与成键和配位计算，也仍然是画面的一部分。

示例位置：`talks/materials-demo/slides/bi2te3.js` 第 18–19 行。

### 4.6 晶格矢量与元素标签（lattice vectors and element labels）

用途：说明 a、b、c 的方向，并标出每种元素。

何时用：最后一步，或者讲完结构之后做一次总结。

最小示例：

```js
{ title: '元素与晶格矢量', sub: 'a, b, c 从原点角点出发', labels: 1, axes: 1 }
{ title: 'Ti 的标签', sub: '只标钛', labels: 1, labelFor: ['Ti'], axes: 0 }
```

排版建议：标签按 `labelFor` 的元素数组筛选；`axes` 与 `labels` 可以同时开，此时标签行会避开 a/b/c 箭头的位置。

限制与坑：`labelFor: null` 才能恢复为全部元素；`labelFor: undefined`（即不写）保持前一步的设置。箭头是从 `corners[0]` 出发、各长一个晶胞矢量（用的是未乘 `repeat` 的 `built.lattice`）的圆柱加圆锥，所以 `repeat > 1` 时箭头长度不变，仍是一个晶胞。

示例位置：`talks/materials-demo/slides/srtio3.js` 第 17–18 行（`labels: 1, axes: 1`）。

### 4.7 超胞（supercell with `repeat`）

用途：显示周期性，或让一层、一个八面体在几个晶胞中都看得见。

何时用：需要看到晶胞之外的排列时。

最小示例：`def` 中写 `repeat: [2, 2, 2]`。

排版建议：`repeat` 是 `def` 级别的参数，不能按步骤切换。要先看单胞、再看超胞，可以做两张幻灯片（两个 `crystalSlide`，各自一个 `repeat`），或用 `CrystalView` 手写，并在需要时重新 `build` 再建一个视图。

限制与坑：
- 候选原子数是 `(n_x + 2)(n_y + 2)(n_z + 2) × 原子数`，键和配体的两两查找是平方复杂度。`repeat` 大于约 3×3×3 时会明显变慢（AGENTS 的经验值）。
- `layer` 的分数是超胞分数（见 4.5）。
- 绘图中心移到超胞的中心，`fly` 的 `target` 相对它。

示例位置：源码 `web/addons/crystal.js:639`（`repeat: def.repeat`）。

### 4.8 特写（close-up with `fly`）

用途：拉近一个八面体或一个界面，看清细节。

何时用：讲完整体之后。

最小示例：

```js
{ title: '近看八面体', sub: 'Ti 在中心', show: { polyhedra: 1 },
  fly: { dir: [1, 0.4, 0.3], target: [0, 0, 0], zoom: 2.2 } }
```

`target` 是相对绘图中心的 Å 坐标，`zoom` 大于 1 更近；`dir` 是相机的方向，只决定角度，距离由 `zoom` 决定。

排版建议：特写时把 `cell` 设为 0 或保留，取决于是否需要框架；多面体的面在近距离时可能遮住原子，此时用 `dim` 淡化外层元素。

限制与坑：
- 相机的极角（与 c 轴的夹角）被 `Orbit.update` 限制在 0.05 到 π − 0.05 弧度之间，所以 `dir` 不能精确指向 c 轴（俯视会被钳制到约 3°）。
- 镜头移动只改变相机，不改变“哪些原子可见”，那要靠 `show`、`dim`、`layer`。

示例位置：`talks/materials-demo/slides/srtio3.js` 第 16 行（`fly: { dir: [1, 0.6, 0.5], zoom: 1.5 }`）。

### 4.9 晶体作为图（crystal as graph: `nodes` and `cutoff`）

用途：把球棍模型变成“节点和边”，强调连接关系，而不是原子大小。

何时用：讲图神经网络、邻接矩阵、截断半径时。

最小示例：

```js
{ title: '作为图', sub: '原子是节点，3 Å 以内连边', nodes: 1, cutoff: 3.0 }
```

`nodes: 1` 把球缩到 0.3 Å，键变细，晶胞线和多面体淡出。`cutoff: 3.0` 用截断距离（Å）建立邻接关系，超出成键规则的边以虚线灰色画出。

数值参考：SrTiO₃ 中 Sr–O 距离约 2.76 Å，所以 `cutoff: 3.0` 会把每个 Sr 与 12 个 O 连起来；O–O 最近距离同样约 2.76 Å，也会连边；Ti–O（1.95 Å）在内；Sr–Ti（3.38 Å）不在内。

排版建议：`nodes` 和 `cutoff` 常在同一步出现；如果只想要图而不要虚线，设 `cutoff: null` 并保留 `nodes: 1`。

限制与坑：
- 邻接图只在画面里的原子之间建立（包括边界像），不跨出绘图范围，所以绘图之外的邻居不会出现。
- `cutoff` 不是化学键规则，是纯距离，且只用于显示。

示例位置：`web/addons/crystal.js:346`（`setCutoff`）；`crystal_logic.js:124`（`atomGraph`）。

### 4.10 消息传递（message passing: `gnn`）

用途：演示一个原子在几跳之内会“收到”哪些信息，颜色表示跳数。

何时用：讲图神经网络的邻域聚合时；这是一个可视化的比喻，不是模型推断。

最小示例：

```js
{ title: '消息传递', sub: 'Ti 的一跳邻居', nodes: 1, gnn: { center: 'Ti', hops: 1 } }
{ title: '两跳', sub: '颜色越淡跳数越多', gnn: { center: 'Ti', hops: 2 } }
```

行为（`crystal_logic.js` 第 154–157 行和 `crystal.js` 第 376–384 行）：
- 中心原子用强调色（accent）并放大 1.6 倍。
- 第 1 跳的强度为 0.6，第 2 跳 0.35，更远为 0.2；超过 `hops` 的原子和键淡到 0.12。
- 跳数按成键图（或 `cutoff` 图，如果设了）计算，中心选择元素时取该元素的第一个原子。
- 所有原子和键的颜色随跳数略向白色偏移（最远约 55%）。

限制与坑：`center` 写的元素如果不在结构中，视图自动关闭 gnn，不报错。跳数只在绘图里的原子之间计算。

示例位置：`web/addons/crystal.js:376`（`setGnn`）。

---

## 5. 取向、相机、标签、光照、颜色和半径

### 5.1 `orientation`：怎样为细长或扁平的晶胞取向

规则：默认 c 轴朝上（相机的 `up` 是世界坐标的 z）。`orientation` 是整个模型绕晶胞中心的旋转（欧拉角 XYZ 顺序，弧度）。

Bi₂Te₃ 的例子：`c = 30.5 Å`、`a = 4.39 Å`。如果 c 朝上，模型是一根细长的柱子，塞进左侧约 60% 宽的舞台里会很小（取景按外接球的半径，见下）。`orientation: [0, Math.PI / 2, 0]` 绕 y 轴转 90°，把 c 放在画面水平方向，层就横向排开。`fly.dir: [0.25, -1, 0.3]` 从 −y 一侧看，正好是侧视。

扁平晶胞（a、b 很长、c 很短）通常保持默认朝向即可，俯视用一个带小倾角的 `dir`（不要正好是 `[0,0,1]`）。

取景的依据：`fitDistance(zoom)` 用 `built.radius`（外接球半径）和视场角，所以 `zoom: 1` 时整个超胞都能装下，与朝向无关。

限制与坑：
- `orientation` 只能在构造时设置（`CrystalView` 的选项），`crystalSlide` 的 `orientation` 也是构造时用的，同一页中不能按步骤切换。要切换只能用 `flyTo` 改变相机方向，或做两页。
- 这些结论来自读源码（取景与旋转），不是在浏览器里看到的，请在页面上核对（见列表）。

### 5.2 `fly.dir` 的坐标系

`fly.dir` 是相机方向，在世界坐标系中（即模型已经应用过 `orientation` 之后的画面坐标）。`orientation` 改变模型的样子，但不改变相机的方向定义。因此，要从某个晶向看，需要把晶向变换到画面坐标系（对 `orientation: [0, π/2, 0]`，绕 y 轴转 90° 后模型的 c 轴（z）落在画面的水平方向，即世界坐标的 x 轴）。

### 5.3 标签的位置

规则（`updateOverlays`，`crystal.js` 第 434–504 行）：
1. 对每种元素，候选原子是这个元素的所有原子；优先取“在层内”的，没有则取全部。
2. 避开 a/b/c 箭头末端正下方的原子，否则竖直引线会穿过箭头标签。
3. 在候选中取最上方、没有被其他原子遮挡的原子（`pickLabelAtom`），引线就是最短的。
4. 所有标签排成一行，位于最上方原子之上（略高于原子顶部），按原子的 x 从左到右排列，相邻标签之间留出画面高度 1.5% 的间距，并绕开箭头标签。
5. 标签的不透明度是 `label 可见度 × 原子可见度 × 淡化 × 层`。

为什么舞台在标题之下：标签行画在模型的上方，如果舞台顶到标题的位置，标签会与标题重叠。`crystalSlide` 把舞台设成 `top: 14%`（标题在 5%），把标签行留在舞台里。

### 5.4 光照

光源跟着相机（`this.camera.add(key, fill, ...)`），所以不论模型怎么转，光都从观看者的一侧、左上方来。模型转到背面时仍然是亮的，各原子的阴影来自这个光。

- 半球光：白色天空、`#cfd3da` 地面，强度 1.2。
- 主光（key）：相机空间位置 `(-5, 8, 9)`，强度 2.4，指向前方 `(0, 0, -10)`。
- 补光（fill）：位置 `(7, -4, 6)`，强度 0.6。

不要在场景里固定光源，手写的光源也应加在相机上。

### 5.5 颜色

顺序（`crystal.js` 第 195 行）：`ELEMENT_COLOURS[el]`，然后 `palette.cpk[el]`（只有 `C N O S P other`，而 `P.cpk` 是 Jmol 的 CPK 色），最后 `palette.muted`。

`ELEMENT_COLOURS`（第 39–44 行）已有：O、Ti、Sr、Ba、Ca、Bi、Te、Se、Sb、Pb、Sn、Si、Ge、Li、Na、Cu、Fe、Mg、Zn、S。Sr 和 Ba 用同一色。

添加一个元素：在 `web/addons/crystal.js` 的 `ELEMENT_COLOURS` 中加一行；如果它的球半径不合适，也在同一文件的 `RADIUS` 中加一项。这两张表是组件的一部分，不是讲稿的一部分；讲稿里没有覆盖颜色的入口（见列表）。

颜色的深浅规则：元素颜色是“柔和”的（饱和度低，两种主题下都可读）。不要在幻灯片里硬编码十六进制颜色；如确需不同颜色，应在 `web/` 里的表中加入，同时检查亮暗两种主题。

### 5.6 原子半径

- `RADIUS`（第 45 行）：`O 0.42、Ti 0.5、Sr 0.7、Ba 0.75、Bi 0.68、Te 0.62、Se 0.55、Pb 0.7、Sn 0.6、Si 0.5`（Å）。
- 没有列出的元素：`0.15 + 0.3 × r_Jmol`，其中 `r_Jmol` 来自 `bond_rules.js`。例如 Ca 的 Jmol 半径是 0.99，得到 0.447 Å。
- `nodes` 时球半径变为 0.3 Å；高亮时放大 1.25 倍；中心原子（gnn）放大 1.6 倍。

---

## 6. 版面

### 6.1 `crystalSlide` 的标准版面

`crystal.js` 第 629–634 行写入的 CSS：

```css
.cr-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
.deck-frame .cr-stage { right: 40%; top: 14%; bottom: 6%; }   /* below the heading: the labels sit above the model */
.cr-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
```

计算后的位置（相对画面框）：
- 标题：左上角，`top: 5%`，`left: 4.2%`。
- 舞台：左边 0，右边 40%，即宽 60%；上边 14%，下边 6%。
- 点列：`left: 58%`，宽 `95.8% − 58% = 37.8%`，`top: 24%`。
- 点与点之间的距离是 `--col-gap`（2.2 个单位）。

因此左侧是晶体，右侧是要点；标题在最上方，不被晶体遮挡。

### 6.2 整幅晶体页（手写）

不用 `crystalSlide`，自己定位舞台（参考 3.1 节的代码）：

```css
.mc-stage { position: absolute; left: 4.2%; right: 4.2%; top: 16%; bottom: 8%; }
```

- 舞台宽度是整个内容区，晶体可以占满。
- 标题、图注用 `.deck-heading`、`.deck-caption`（下方 87%）。
- 不要放 `.deck-col`，要点用 `Deck.points` 也可以，只是版面由你定。

### 6.3 版面的注意事项

- 幻灯片的文字用 `--t-*` 令牌，不要用 px。
- 一页的要点数与步骤数相同。副标题保持一行（参考 `srtio3.js` 的写法）。
- 在亮色和暗色主题下各看一次（`?theme=dark` 或按 T），标签的描边用 `P.bg`，应当可读。

---

## 7. 限制与坑

1. 占据率与无序：不处理。`prep_crystal.py` 不读占据率；`crystal_logic.build` 对每个位点只放一个原子。含部分占据或无序的 CIF（如固溶体）会被画成满占据，结果是错误的。
2. 大超胞慢：候选集合是 `(n+2)³ × 原子数`（三个方向都是 n 时），键和配体的查找是两两比较（平方复杂度）。`repeat` 超过约 3×3×3 时会感觉卡顿；需要更大的超胞时，换成较少的原子（只保留要讲的部分），或接受慢速。
3. WebGL 上下文：每个 `CrystalView` 占一个上下文，浏览器只保留约 16 个。必须在 `destroy` 中调用 `dispose()`（`crystalSlide` 已经做了）。`dispose()` 中的 `forceContextLoss()` 会立即释放上下文，否则下一页的 `getContext` 可能卡住。
4. 幻灯片的保留距离：`deck.js` 第 69 行 `KEEP = 3`，即距离当前幻灯片 3 页以外的会被冻结（`freeze`，用截图代替）。`AGENTS.md` 写的是“within 2”。两处不一致（见列表）；以代码为准。
5. 没有 OrbitControls、没有 ConvexGeometry：打包的 three.js 不含这两个。替代品是 `crystal.js` 中的 `Orbit` 类（拖拽旋转、滚轮缩放，阻尼 0.08，极角被限制）和 `crystal_logic.js` 的 `hullFaces`（三点平面法，找凸包的面）。不要在幻灯片里 `import` 它们。
6. 跳转与后退要与点击一致：每一步的状态要完整写出（`crystalSlide` 的继承规则保证这一点）。手写页面中，`enter(step, animate)` 必须从 `step` 算出全部状态，`animate` 为假时调用 `snap()`。
7. 后退的动画：`crystalSlide` 内部已设 `smoothBack: true`，所以在 `Deck.start({ smoothBack: '3d' })` 或 `'all'` 下，点一次后退会倒放（相机 700 ms）；deck 为 `'none'` 时才直接跳。
8. `project` 与 `localPos` 的坐标不一致（见 3.3）。
9. 配体不分种类：`polyhedra` 的配体是所有满足规则的原子。阳离子之间如果距离足够近，会被当成配体。
10. 对称展开与 pymatgen 的关系：`prep_crystal.py` 用 gemmi 展开对称，因为有些 CIF 不列出对称操作，此时 pymatgen 会退回 P1 只保留不对称单元。成键规则仍然是 pymatgen 的（`export_bond_rules.py`），两者的分工是“位置用 gemmi，规则用 pymatgen”。写作时没有运行过 gemmi；数据文件的原子数说明展开确实发生了（SrTiO₃ 的 CIF 列 3 个位点、数据有 5 个原子；Bi₂Te₃ 列 3 个、数据有 15 个），但展开是否与 pymatgen 逐一一致未核对。
11. 样品 CIF 的来源没有记录：`tools/samples/SrTiO3.cif` 和 `Bi2Te3.cif` 的出处（数据库、论文、版本）未在仓库中注明。用于正式讲稿前，需要补上来源并写进 `notes` 或一个 `.deck-detail` 的致谢里（`AGENTS.md` 的数据规则）。
12. 标签只标元素，不标位点（如 Ti1、Ti2）。两个不等价的同种位点无法区分。
13. `dim` 只改透明度（按元素），`highlight` 只改尺寸和描边（按原子），两者同时生效、互不覆盖。
14. `labelFor` 与 `labels` 的组合要注意：`labels: 1` 而 `labelFor` 为空数组，则没有标签显示。

---

## 待确认

1. （已解决）Bi₂Te₃ 的层窗口原来是 `0.1~0.56`，会圈到 7 个面；已改为 `0.2~0.47`，核对为恰好 5 个面。
2. （已解决）`project` 的注释已改为“笛卡尔坐标 Å（CIF 的坐标系；视图自己减去晶胞中心）”。`localPos` 返回中心化坐标，仓库里没有调用方，保留。
3. （已解决）以代码为准：`deck.js` 的 `KEEP = 3`，`AGENTS.md` 已改。
4. （已解决）`crystalSlide` 已内部设 `smoothBack: true`，后退会倒放；是否要做成可配置的选项仍可再议。
5. 元素颜色与半径只能通过修改 `web/addons/crystal.js` 来添加，没有每个讲稿的覆盖入口。是否需要一个 `colours` 选项？
6. gemmi 的展开逻辑（“从空间群名展开对称”）我只根据源码注释和数据文件的原子数判断，未在本机运行（沙箱中没有 gemmi）。需要在装有 gemmi 的环境里重新运行 `prep_crystal.py`，比较输出是否与 `talks/materials-demo/data/*.js` 一致。
7. 第 3 节和第 4 节中的 `build` 计数（SrTiO₃ 15 个原子 / 6 条键 / 1 个多面体；Bi₂Te₃ 66 个原子 / 72 条键 / 12 个多面体）来自对源码算法的等价重写，未在浏览器中运行。需要在页面上核对。
8. `orientation` 与 `fly.dir` 的坐标关系（5.1、5.2）：Bi₂Te₃ 用 `orientation: [0, Math.PI / 2, 0]` 加 `fly: { dir: [0.25, -1, 0.3], zoom: 1.25 }` 得到晶胞横躺的侧视图，已在浏览器里（浅色、深色）看过；其他取向仍来自源码推断。
9. `repeat` 慢的阈值（约 3×3×3）来自 `AGENTS.md` 的经验，没有实测。
10. 样品 CIF 的出处未记录（见第 7 节第 11 条）。
11. `setCutoff` 的截断图只包含绘图里的原子（包括边界像）。这是否可接受（超出绘图框的邻居不会出现），还是需要在图的构建中包含周期性像？
