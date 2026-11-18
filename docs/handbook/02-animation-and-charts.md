# 02 动画与图表：Deck.manim、manim-web 常用对象、Deck.groupedBars

本章是给要新建材料科学讲稿的人（包括编码 agent）看的操作手册，讲三件事：什么时候用动画、什么时候用图表，怎么写一个 `Deck.manim` 场景，怎么排版。总体约定（不用 px、不硬编码颜色、每个 slide 是一个 `Deck.slide` 模块）见仓库根目录的 `AGENTS.md`，这里不重复。

核对方法：所有标识符、选项与默认值都对照了 `web/manim.js`、`web/plots.js`、`web/deck.js`、`web/deck.css` 和 `talks/example/slides/{manim_shapes,manim_graph,chart}.js`。manim-web 的类与方法来自 `vendor/manim-web/manim-web.iife.js`（版本见 `vendor/manim-web/VERSION`，为 0.39.4），通过其导出表（`zn(pqt, {...})`）和类的构造函数体核对。凡是没有在源码或 bundle 中看到的东西，放在「待确认」里，不要当成既有 API 使用。除第 3 节的方案 A（zT–T 曲线，已在浏览器里渲染验证）外，本章示例未在浏览器中渲染过；画面效果以截图为准（`python tools/check_deck.py` 或在浏览器里逐页逐步看）。

---

## 0. 先选工具

| 你要表达的东西 | 用什么 | 参考 |
| --- | --- | --- |
| 几何图形、公式、文字随讲解逐步出现、变形、被强调 | `Deck.manim`（manim-web 场景） | 第 1 节 |
| 函数曲线、坐标轴、Riemann 矩形、曲线下面积 | `Deck.manim` + `M.Axes` | 第 2、3 节，示例 `manim_graph.js` |
| 分组对比的数值（百分比、计数、ms 等），一组一组或一个系列一个系列长出来 | `Deck.groupedBars` | 第 4 节，示例 `chart.js` |
| 只是列表、图片、文字按步显示 | `Deck.show` + `data-from`，或 `Deck.points` | `web/deck.js`，`web/deck.css` 的 "Things revealed on a step" |
| 晶体结构、分子、三维模型 | 附加组件（crystal、turntable），不在本章 | `AGENTS.md` |

不要手画柱状图或坐标轴，也不要在 HTML 里用 SVG 画一条会动的曲线；那样排版会偏离 `deck.css` 的设计语言。

---

## 1. Deck.manim

### Deck.manim

**用途**：把一个 manim-web 场景变成「每点一下播一步」的动画舞台。

**何时用**：要点一下播一段动画（生长、变形、淡入淡出、写字、移动）；同一场景要从任意步直接跳到某步、并且画面与逐步点到那里完全一致。

**何时不用**：静态图、只有几句字的列表（用 HTML + `Deck.show`）；纯数值对比（用 `Deck.groupedBars`）；需要拖动、旋转的三维场景（用 turntable 或 crystal）。

#### 最小示例

放在 `talks/<talk>/slides/` 下的一个文件里，并在 `index.html` 里按顺序加 `<script>`：

```js
// A circle becomes a square, one click each. Steps: 1 Create the circle · 2 Transform it into a square.
Deck.slide('my-circle', {
  steps: 2,
  notes: 'Go back a step and the scene rebuilds at that step instantly.',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('A circle becomes a square')}</h2>`;

    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: ({ M, P }) => ({                                   // fresh objects on every (re)build
        circle: new M.Circle({ radius: 1.3, color: P.accent, strokeWidth: 6 }).moveTo([-3.2, -0.4, 0]),
        square: new M.Square({ sideLength: 2.4, color: P.series[1], strokeWidth: 6 }).moveTo([-3.2, -0.4, 0]),
      }),
      steps: [
        ({ circle }, { M }) => [new M.Create(circle, { duration: 1.2 })],     // step 1
        ({ circle, square }, { M }) => [new M.Transform(circle, square)],    // step 2
      ],
    });

    return {
      enter(step, animate) { return stage.go(step, animate); },
      freeze: stage.freeze,
      destroy: stage.dispose,
    };
  },
});
```

#### 构建与步骤模型

`Deck.manim(host, { build, steps, scene })` 返回一个对象：`{ scene, objects, step, go, freeze, dispose }`（`objects` 与 `step` 是 getter）。

- `build({ M, P, scene })` 必须每次返回**新建**的对象。它在每次重建时都会被调用。不要把 mobject 放在模块级变量里，也不要在 `build` 外面 `new` 完再闭包进来。
- `steps[k]` 把舞台从第 k 步推到第 k+1 步（`steps[0]` 是第 1 步，即幻灯片到达时播放的那一步）。`steps` 的长度要与 `Deck.slide` 的 `steps` 选项一致，`go()` 会把步数夹在 `[0, steps.length]` 内。
- 每个 `steps[k]` 的签名是 `(objects, ctx) => ...`，返回值两种用法二选一，也可以混用：
  - 返回一个动画数组：这些动画同时播放（`play(...out)`）。返回 `undefined` 或空数组则什么也不播。
  - 自己调用 `play()`、`wait()`、`add()`：可以多次调用，按顺序播放，中间可以 `await wait(0.3)`。

`ctx` 的字段（`steps` 的第二个参数，与 `build` 的参数相近）：

| 字段 | 含义 |
| --- | --- |
| `M` | `window.ManimWeb`（manim-web 命名空间） |
| `P` | `Deck.palette`（当前主题的颜色表，见下文「颜色」） |
| `scene` | 底层 `M.Scene`，一般不需要直接用 |
| `play(...anims)` | 播放动画；返回 Promise。在快速路径（跳转）里立即把动画置于终点 |
| `wait(s = 1)` | 等待 s 秒；在快速路径里是空操作 |
| `add(...mobjects)` | 直接把对象加进场景，不播放动画 |
| `fast` | 布尔值，`true` 表示正在快速重建（跳转），可据此跳过额外的停顿 |

#### 跳转与后退：快速路径

`stage.go(step, animate)` 的行为（来自 `web/manim.js`）：

- **向前一步，且 `animate` 为真**：如果还没有对象就先 `build`；然后用正常路径（`scene.play`、`scene.wait`）播放 `steps[at]`。
- **其他情况**（跳到任意步、后退、`animate` 为 `false` 或 `'back'`）：`scene.clear` 后重新 `build`，把 `steps[0..step-1]` 全部用快速路径应用一次，然后渲染。`'back'` 不会倒放动画，只是瞬间重建。
- 快速路径里 `play` 把每个动画 `begin`、`interpolate(1)`、`finish`，并清理场景（FadeOut 移除对象，ReplacementTransform 换上终点对象）。所以同一段 `steps` 代码既服务于正常播放，也服务于跳转，你不必写「撤销」。
- 请求是排队的：播放中再点几次，会按顺序把后面的步播完；如果中途请求的是后退或跳转，则立即重建。

因此 `enter(step, false)` 紧接 `mount` 之后，画面必须与逐步点到 `step` 完全一致。写 `steps` 时只写「这一步发生什么」，不要依赖上一步的状态之外的东西（比如全局变量的计数器）。

#### 为什么 Deck.manim 的 enter 要和 Deck.show 一起调

很多 slide 把 HTML 列表或标题也做成按步显示。`Deck.show(frame, step, animate)` 处理 `data-from` / `data-show`，`stage.go(step, animate)` 处理舞台。两者都要用同一对 `(step, animate)`，示例都是这样写：

```js
enter(step, animate) { Deck.show(frame, step, animate); return stage.go(step, animate); },
```

#### 返回动画 vs 调用 play()

- 步骤里只需要「同时播放几个动画」时，返回数组最简单（`manim_graph.js` 第 1 步：`Create(axes)` 与 `FadeIn(labels)` 同时开始）。
- 需要顺序、停顿、或中间改对象时，用 `play()`。示例 `manim_shapes.js` 第 3 步先 `Shift` 再 `LaggedStart`：

```js
async ({ circle, copies }, { M, play }) => {
  await play(new M.Shift(circle, { direction: [0, 0.6, 0], duration: 0.5 }));
  await play(new M.LaggedStart(copies.map((c) => new M.GrowFromCenter(c)), { lagRatio: 0.35 }));
},
```

- 同一步里既返回数组又调用 `play()`：返回的数组会在 `steps` 函数结束之后播放（`run()` 的最后一行），所以先后顺序是「函数体里的 play」→「返回的数组」。不要这样混用，除非你明确需要。

#### stage.go / freeze / dispose

| 成员 | 何时调用 | 说明 |
| --- | --- | --- |
| `stage.go(step, animate)` | `enter` 里 | 返回一个 Promise（播放结束时 resolve）；幻灯片的忙碌点会等它 |
| `stage.freeze()` | 幻灯片被冻结成图片（概览、PDF 导出） | 调用 `scene.render()` 把当前帧画出来 |
| `stage.dispose()` | `destroy` 里 | 标记为 dead（之后的 `play` 立即返回），并 `scene.dispose()` 释放 WebGL 上下文 |

Deck 最多保留距当前幻灯片 2 张以内的幻灯片活着，其余的会被 `destroy`。所以 `destroy: stage.dispose` 是必须的。

#### 坐标系与安全区

- 场景宽高是 **16 × 9 世界单位**（`frameWidth: 16, frameHeight: 9`，manim.js 的默认值，也可通过 `scene` 选项覆盖）。原点在中心，x 向右，y 向上，`.deck-stage` 铺满整个幻灯片框。
- 换算（只为了排版，不是 API）：幻灯片框顶部起算的百分比 `p%`，对应世界 `y = 4.5 - 9 * p / 100`；左边起算的 `q%`，对应 `x = 16 * q / 100 - 8`。
- 安全区（来自 `deck.css`）：
  - 标题 `.deck-heading` 在顶部 5% 处，字号 3.4u（1u = 1/100 框宽 = 0.16 世界单位），占到约 y = 3.4。**内容的 y 要低于约 3.3**。
  - 内容区约在 15%–85% 高度，即 y ∈ [-3.15, 3.15]。
  - 说明行 `.deck-caption` 在 87% 处（y ≈ -3.33 起），占到约 y = -3.6。有 caption 时，场景物体的 y 应高于约 -3.1。
  - 左右边距 4.2%，即 x ∈ [-7.33, 7.33]。
  - 页脚 `.deck-footer` 在框底下方，不要放东西。
- 如果右侧有 HTML 列（`.deck-col`，默认从 59% 开始），舞台左半部分的内容要在 x < 16 * col_left / 100 - 8 的范围内。例如 `--col-left: 60%` 对应 x = 1.6；示例 `manim_shapes.js` 的图形在 x = -3.2 附近，留出了右侧。

#### 文字

- `new M.Text({ text, fontSize, fontFamily: 'Lato', color, ... })`。**必须传 `fontFamily: 'Lato'`**：`M.Text` 的默认值是 `CMU Serif, Georgia, ...`。`M.Text` 在 `manim.js` 的 `pump()` 里会等待 `document.fonts.load('600 32px Lato')`，所以 Lato 已经加载完才会画。
- `fontSize` 的默认值是 48（bundle 中 `fontSize: r = 48`）；示例用 44。`fontSize` 换算到世界单位的具体比例**待确认**，改字号后请在截图里检查。
- `M.MathTex({ latex, color, fontSize })` 用 KaTeX（bundle 内置，离线可用），`fontSize` 默认 48。bundle 里 MathTex 的 `color` 默认值是硬编码的颜色（以 `#ff` 开头），所以**一律传 `color: P.fg` 或 `P.muted`**，否则深色主题会看不清。
- 长段文字放 HTML（`.deck-lead`、`Deck.points`）；manim 文字只放会动的标签和公式。

#### Transform 的坑

- `M.Transform(a, b)` 尽量做点对点变形。示例 `Circle → Square` 能做，因为两者都是闭合的 VMobject，manim-web 能对齐点数。
- 点数对不上时，manim-web 的对齐会失败并抛出 `alignVmobjectPair: alignPoints fallback produced mismatched point counts`（这是 bundle 中的错误文本）。**不同形状之间（矩形组 → 面积、图形 → 公式）改用淡出加淡入**：`new M.FadeOut(a)` 与 `new M.FadeIn(b)` 同时返回，就是 `manim_graph.js` 第 5 步的做法。
- `M.ReplacementTransform(a, b)` 变形结束后把 `b` 放进场景、移除 `a`，比 `Transform` 更适合「换一个对象」。
- `manim_graph.js` 第 4 步 `Transform(coarse, fine)` 是把 8 个矩形的组变成 40 个矩形的组。它是示例的做法，但**它能否平滑变形没有在浏览器中验证（待确认）**；若截图有问题，改成 FadeOut + FadeIn。

#### 颜色

- 全部颜色来自 `P`（= `Deck.palette`）：`P.fg`、`P.muted`、`P.accent`、`P.detail`、`P.done`、`P.series[0..4]`（对应 CSS 的 `--plot-1..5`）、`P.neutral`、`P.ss`、`P.cpk`。深色/浅色主题由 `deck.js` 的 `PALETTES` 切换。
- 不要写 `'#fff'`、`'white'` 或任何十六进制值。需要的颜色不在 `P` 里，就在 `web/deck.css` 和 `PALETTES` 里一起加，而不是在幻灯片里写死。
- manim-web 的类内部默认颜色（例如 `Axes` 的 `color: '#ffffff'`）会覆盖主题，所以**每个对象都要显式传 `color`**。

---

## 2. manim-web 对象与方法目录

下面只列出本仓库示例实际用到的，以及在 bundle 导出表中核对过的。除非注明，选项都是构造函数的第一个参数里的字段，动画类的第二个参数是选项对象。

### M.Circle / M.Square / M.Dot / M.Line / M.VMobject

**用途**：基本几何形状。
**何时用**：示例图形、标注点、XRD 峰位线、数据点。
**何时不用**：需要填充文字的场景（用 HTML）。

```js
new M.Circle({ radius: 1.3, color: P.accent, strokeWidth: 6, fillOpacity: 0.25 }).moveTo([-3.2, -0.4, 0]);
new M.Square({ sideLength: 2.4, color: P.series[1], fillOpacity: 0.25 });
new M.Dot({ point: [0, 0, 0], radius: 0.07, color: P.accent });
new M.Line({ start: [-1, 0, 0], end: [1, 0, 0], color: P.muted, strokeWidth: 3 });
const poly = new M.VMobject();          // constructor takes no arguments
poly.color = P.accent; poly.strokeWidth = 4;
poly.setPointsAsCorners([[-2, 0, 0], [0, 1, 0], [2, -0.5, 0]]);
```

| 类 | 选项（默认值，来自 bundle） |
| --- | --- |
| `M.Circle` | `radius` 1, `color`（硬编码默认）, `fillOpacity` 0, `strokeWidth` 4, `numPoints` 64, `center` [0,0,0] |
| `M.Square` | `sideLength` 2（其余选项传给 `Rectangle`） |
| `M.Dot` | `point` [0,0,0] （也接受 `[[x,y,z]]`）, `radius` 0.08, `color`, `fillOpacity` 1, `strokeWidth` 0 |
| `M.Line` | `start` [0,0,0], `end` [1,0,0], `color`, `strokeWidth` 3 |
| `M.VMobject` | 构造函数无参数；颜色和线宽用属性设置；`setPointsAsCorners(points)` 按折线连接点 |

`moveTo([x, y, z])` 把对象的中心放到给定世界坐标；`nextTo(target, dir, buff)` 用于相对定位（`nextTo` 的默认 buff 为 0.25，源码可见）。

### M.Text / M.MathTex

见第 1 节「文字」。要点：`M.Text` 必须传 `fontFamily: 'Lato'`；`M.MathTex` 必须传 `color`。

### M.Create / M.FadeIn / M.FadeOut / M.Write / M.GrowFromCenter

| 动画 | 构造 | 说明 |
| --- | --- | --- |
| `M.Create` | `new M.Create(mobject, { duration, lagRatio })` | 默认 `duration` 2、`lagRatio` 1。用于描边出现。示例的 `Create(axes)` 用 `duration: 1.2` |
| `M.FadeIn` | `new M.FadeIn(mobject, { shift })` | 淡入；`shift` 可选，是位移向量 |
| `M.FadeOut` | `new M.FadeOut(mobject, { shift })` | 淡出，结束时移出场景（`remover` 为真） |
| `M.Write` | `new M.Write(mobject, { duration, ... })` | 逐笔写出，适合文字和公式（示例 `Write(text, { duration: 1.2 })`） |
| `M.GrowFromCenter` | `new M.GrowFromCenter(mobject)` | 从中心缩放长出来。示例把它放进 `LaggedStart` |

### M.Transform / M.ReplacementTransform

`new M.Transform(source, target, opts)`：把 `source` 变成 `target`；**`target` 是一个单独的 mobject，不是动画**。它会在 `source` 上做变形，`target` 不会被加入场景。

`new M.ReplacementTransform(source, target)`：变形后把 `target` 放入场景、移除 `source`（bundle 中它继承 `Transform`，并在 `cleanUpFromScene` 中做替换）。

### M.Shift / M.Indicate / M.LaggedStart

| 动画 | 构造 | 说明 |
| --- | --- | --- |
| `M.Shift` | `new M.Shift(mobject, { direction, duration })` | `direction` 是必填的位移向量（bundle：`this.direction = t.direction`）。示例 `direction: [0, 0.6, 0]` |
| `M.Indicate` | `new M.Indicate(mobject, { scaleFactor, color, duration })` | 默认 `scaleFactor` 1.2、`color` `#FFFF00`（硬编码，注意主题）、`duration` 1。用于强调 |
| `M.LaggedStart` | `new M.LaggedStart([anim1, anim2, ...], { lagRatio })` | 第一个参数是动画数组；`lagRatio` 默认 0.2（bundle：`lagRatio: t.lagRatio ?? .2`）。示例用 0.35 |

### M.Axes

```js
const axes = new M.Axes({
  xRange: [0, 6, 1], yRange: [0, 4, 1],      // [min, max, step]
  xLength: 8, yLength: 5,                    // in world units
  color: P.muted,
}).moveTo([-2.4, -0.7, 0]);
```

| 选项 | 默认值（bundle） |
| --- | --- |
| `xRange` / `yRange` | `[-5, 5, 1]` / `[-3, 3, 1]` |
| `xLength` / `yLength` | 10 / 6 |
| `color` | `'#ffffff'`（硬编码，传 `P.muted`） |
| `tips` | 默认显示轴箭头（`tips: false` 关闭） |
| `tipLength` | 0.25 |
| `axisConfig` / `xAxisConfig` / `yAxisConfig` | 传给两根轴的选项（如 `tickSize`、`numbersToExclude`） |

Axes 的方法（均已在 bundle 中核对）：

| 方法 | 作用 |
| --- | --- |
| `axes.plot(fn, opts)` | 返回一个函数图像对象（FunctionGraph）。`opts`：`xRange`（默认取轴的 x 范围）、`color`（默认 `#58c4dd`）、`strokeWidth`（默认 2）、`discontinuities`（断点数组）、`numSamples`（默认 100） |
| `axes.coordsToPoint(x, y)` / `axes.c2p(x, y)` | 数据坐标 → 世界坐标 `[x, y, z]` |
| `axes.pointToCoords(p)` / `axes.p2c(p)` | 世界坐标 → 数据坐标 `[x, y]` |
| `axes.getAxisLabels({ xLabel, yLabel })` | 返回一组轴标签（可传 `M.MathTex` 对象，也可传字符串，字符串会被当成 latex 放进 `Co`） |
| `axes.getRiemannRectangles(graph, opts)` | 见下 |
| `axes.getArea(graph, [a, b], opts)` | 见下 |
| `axes.addCoordinates(xNums?, yNums?)` | 添加刻度数字，不传参数时用默认刻度 |
| `axes.getXAxis()` / `getYAxis()` / `getXRange()` / `getYRange()` / `getOrigin()` | 访问器 |

**getRiemannRectangles(graph, opts)**：`opts` 为 `xRange`（默认轴的 x 范围）、`dx`（默认 0.1）、`color`（矩形填充色，默认 `#58c4dd`）、`fillOpacity`（默认 0.5）、`strokeWidth`（默认 1）、`strokeColor`（默认同 `color`）。它要求 `graph` 有 `getFunction()`，即必须是 `axes.plot` 的结果。

**getArea(graph, [a, b], opts)**：`opts` 为 `color`（默认 `#888888`）、`opacity`（注意不是 `fillOpacity`；默认 0.5）、`strokeWidth`（默认 0）、`boundedGraph`（另一条曲线，给出上界）。

示例 `manim_graph.js` 完整使用了这些：`axes.plot(f, {...})`、`getRiemannRectangles(graph, {xRange, dx, ...})`、`getArea(graph, [1, 5], {color, opacity})`、`getAxisLabels({ xLabel, yLabel })`。

### M.Scene（由 Deck.manim 创建，一般不直接用）

`new M.Scene(host, options)`。`Deck.manim` 传入的选项是 `{ backgroundOpacity: 0, frameWidth: 16, frameHeight: 9, ...options }`。注意 manim-web 自己的默认值是 `frameWidth: 14`、`frameHeight: 8`、`backgroundOpacity: 1`；本仓库在 `manim.js` 里改成了 16 × 9 和透明。

场景方法（`stage.scene` 上）：`play(...anims)`（返回 Promise）、`wait(s)`、`add(...mobjects)`、`remove(...mobjects)`、`clear({ render })`、`render()`、`dispose()`。

### 待确认（manim-web 对象）

- `M.Text` 的 `fontSize` 到世界单位的换算比例。
- `M.Write` 的默认 `duration`。
- `GrowFromCenter`、`FadeIn` 等基类 `Animation` 的默认 `duration`（bundle 中在基类里定义，未逐一核对）。
- `Axes` 默认是否显示刻度数字（bundle 中 `addCoordinates` 是显式调用的；示例没有调用它，但数字可能来自轴的默认配置）。
- `M.Transform` 对「矩形组 → 矩形组（点数不同）」的变形效果。

---

## 3. 在坐标轴上画数据（zT-T 曲线、XRD 峰）

下面的方案 A 已在浏览器里实际跑过（浅色主题，两步都正常，曲线、数据点、刻度数字对得上）。方案 B、C 只核对了 API 存在，**未渲染验证**。

> **先记住 manim-web 坐标轴的一条规则**：`M.Axes` 的两条轴固定在坐标 `0` 处相交。如果 `xRange` 不含 0（例如温度 300–600 K），y 轴会被画到画面外，看起来像"缺了 y 轴"。另外 `Axes` 默认**不画刻度数字**，要用 `axes.addCoordinates(xNums, yNums)` 加（数字就是坐标值本身，0 不标）。所以温度这类不从 0 开始的 x 轴，要先平移成从 0 开始，再用 `M.Text` 手标真实刻度。

### 方案 A：折线交给 axes.plot，x 平移到从 0 开始（已验证）

适合：一条由离散测量点给出的曲线，例如 zT 随温度变化。数据放在 `talks/<talk>/data/zt.js`，写成 `window.DATA.zt = { T: [...], zT: [...] }`，在 `mount` 里通过 `data` 读取（`mount` 的参数里有 `data`，它是 `window.DATA`；`build` 的参数里没有）。

```js
// talks/<talk>/data/zt.js
window.DATA = window.DATA || {};
window.DATA.zt = { T: [300, 400, 500, 600], zT: [0.45, 0.80, 1.00, 1.10] };   // illustrative numbers

// talks/<talk>/slides/zt.js
Deck.slide('zt-vs-t', {
  steps: 2,
  notes: 'zT versus temperature (illustrative data).',
  mount(frame, { esc, data }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('zT rises with temperature')}</h2>`;
    const { T, zT } = data.zt;
    const T0 = T[0], span = T[T.length - 1] - T0;          // x is drawn as T - T0, so it starts at 0
    const f = (x) => {                                      // piecewise linear through the measured points
      for (let i = 0; i < T.length - 1; i++) {
        if (x + T0 <= T[i + 1]) return zT[i] + ((x + T0 - T[i]) / (T[i + 1] - T[i])) * (zT[i + 1] - zT[i]);
      }
      return zT[zT.length - 1];
    };
    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: ({ M, P }) => {
        const axes = new M.Axes({ xRange: [0, span, 100], yRange: [0, 1.2, 0.2], xLength: 8, yLength: 5,
          color: P.muted }).moveTo([-2.4, -0.7, 0]);        // moveTo first, then c2p
        axes.addCoordinates([], [0.2, 0.4, 0.6, 0.8, 1.0, 1.2]);   // y numbers; x numbers are placed by hand below
        const ticks = T.map((t) => new M.Text({ text: String(t), fontSize: 36, fontFamily: 'Lato', color: P.muted })
          .moveTo(axes.c2p(t - T0, 0).map((v, i) => (i === 1 ? v - 0.5 : v))));   // 0.5 units below the axis
        const curve = axes.plot(f, { xRange: [0, span], color: P.accent, strokeWidth: 5, numSamples: 200 });
        const dots = T.map((t, i) => new M.Dot({ point: axes.c2p(t - T0, zT[i]), radius: 0.07, color: P.accent }));
        const labels = axes.getAxisLabels({
          xLabel: new M.MathTex({ latex: 'T\,(\mathrm{K})', color: P.muted, fontSize: 40 }),
          yLabel: new M.MathTex({ latex: 'zT', color: P.muted, fontSize: 40 }),
        });
        return { axes, ticks, curve, dots, labels };
      },
      steps: [
        ({ axes, ticks, labels }, { M }) => [new M.Create(axes, { duration: 1.2 }), new M.FadeIn(labels), ...ticks.map((t) => new M.FadeIn(t))],
        ({ curve, dots }, { M }) => [new M.Create(curve, { duration: 1.4 }), ...dots.map((d) => new M.FadeIn(d))],
      ],
    });
    return { enter(step, animate) { return stage.go(step, animate); }, freeze: stage.freeze, destroy: stage.dispose };
  },
});
```

要点（均已在浏览器里确认）：
- `axes.plot` 对 `f` 采样 `numSamples` 次，分段线性函数能画出折线的外观；曲线与数据点用同一个 `c2p`，位置对得上，`c2p` 在 `moveTo` 之后调用即得到移动后的位置。
- `addCoordinates` 的 y 数字显示格式不统一（`1` 与 `0.80`、`1.20` 并存），是 manim-web 的默认格式；对精度有要求时 y 轴也像 x 轴一样用 `M.Text` 手标。
- `getAxisLabels` 把 x 标签放在画面偏右处、y 标签放在上方，不贴着轴端，这是库的默认位置（与 `talks/example` 的 manim_graph 页一致）；需要贴轴时自己 `moveTo`。
- 画面里 manim 文字的字号：`fontSize: 36` 的刻度数字与 `fontSize: 40` 的 `MathTex` 标签大小接近，可直接照用。

### 方案 B：用 VMobject 与 setPointsAsCorners 直接连点

适合：点数少、要做成折线、或要在曲线上按步画出每一段。

注意：同样适用上面的「坐标轴在 0 处相交」规则；x 范围不含 0 时要像方案 A 那样先平移。

```js
const pts = T.map((t, i) => axes.c2p(t, zT[i]));    // world coordinates
const line = new M.VMobject();
line.color = P.accent; line.strokeWidth = 5;
line.setPointsAsCorners(pts);                         // straight segments between the points
```

`setPointsAsCorners` 在 bundle 的 VMobject 类中存在（`setPointsAsCorners(t) { if (t.length < 2) ... }`）。它只连直线，不做平滑。`VMobject` 构造函数不接受参数，颜色与线宽用属性设置。

### 方案 C：XRD 峰（竖线）

每个峰画一条从基线到峰高的线。用 `M.Line`，起点和终点都用 `c2p`：（2θ 一般不从 0 开始，同样要先把 x 平移成 `2θ - 起点` 再手标刻度，见方案 A。）

```js
const peaks = [[28.4, 100], [47.3, 55], [56.1, 30]];    // [2θ, relative intensity], illustrative
// yRange in this sketch is [0, 1.2, 0.2]: intensity 0..100 is scaled to 0..1 here
const sticks = peaks.map(([x, I]) => new M.Line({
  start: axes.c2p(x, 0), end: axes.c2p(x, I / 100),
  color: P.accent, strokeWidth: 3,
}));
// steps[k]: new M.Create(sticks[i]) in sequence via play(), or LaggedStart(sticks.map(s => new M.Create(s)), { lagRatio: 0.2 })
```

如果要把 XRD 曲线做成连续谱线，用方案 A 的思路，把强度做成叠加的高斯峰；这一点**待确认**（本章没有现成示例）。

### 数据来源

按 `AGENTS.md` 的约定，数据由 `tools/` 下的脚本生成 `.json` 与 `.js`，并在脚本的 docstring 与幻灯片的 notes 或 `.deck-detail` 中注明来源。不要在幻灯片里手打大段数据。

---

## 4. Deck.groupedBars（web/plots.js）

**用途**：一个分组柱状图；一个系列时就是普通柱状图。它的布局在 `web/deck.css` 的 "Plots" 段统一定义，所有图表看起来一样。

**何时用**：离散类别的数值对比（一组方法 × 几个条件；百分比；计数；毫秒数）；每点一下出现一组（或一个系列）的数据；需要统一排版的图。
**何时不用**：连续自变量的函数或曲线（用 `Deck.manim` + `M.Axes`）；需要自由的坐标轴或注释（用 manim）；超过 5 个系列（没有第 6 种颜色，见「限制与坑」）。

### 最小示例

```js
Deck.slide('my-bars', {
  steps: 2,
  notes: 'Illustrative numbers.',
  mount(frame, { esc }) {
    frame.innerHTML = `<h2 class="deck-heading reveal-in in">${esc('Two methods, two conditions')}</h2>`;
    const plot = Deck.groupedBars(frame, {
      series: [
        { key: 'base', label: 'Baseline' },
        { key: 'ours', label: 'New method' },
      ],
      groups: [
        { key: 'easy', label: ['Easy', 'cases'], step: 1, values: { base: [61, 100], ours: [72, 100] } },
        { key: 'hard', label: ['Hard', 'cases'], step: 2, highlight: true, values: { base: [9, 100], ours: [31, 100] } },
      ],
      strong: 'ours',
      footnote: ['Illustrative numbers · 100 cases per group'],
    });
    return { enter: (step, animate) => plot.show(step, animate) };
  },
});
```

注意 `enter` 必须调用 `plot.show`。组在 `show` 之前是透明的（`.deck-plot-group` 的 `opacity: 0`）。

### 参数

| 选项 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `series` | 数组 | 必填 | `[{ key, label, step? }]`。`key` 用于在 `values` 中取值；`label` 显示在图例中（只有多于一个系列时才显示图例）；`step` 见下文「系列逐步」 |
| `groups` | 数组 | 必填 | `[{ key, label, step?, highlight?, values }]`。`label` 可以是字符串或数组（数组的每一项各占一行）；`highlight: true` 给该组加浅色底纹，标签变为强调色；`values` 是 `{ [seriesKey]: value }` |
| `strong` | 字符串 | `null` | 哪个系列的数值标签加粗（`series` 的 `key`） |
| `footnote` | 字符串数组 | `[]` | 页脚小字（`.deck-detail`），每项一行 |
| `captioned` | 布尔 | `false` | 页面下方有 `.deck-caption` 时设为 `true`，图表会上移 |
| `max` | 数字 | `null` | 设置后，`values` 是普通数字，坐标轴是 0..max |
| `ticks` | 数字 | `4` | 网格的分段数（刻度为 `ticks + 1` 条） |
| `format` | 函数 | `null` | 只在设置了 `max` 时生效：`(v) => string`，用于数值标签与刻度标签 |

**两种数值模式**：

- `values` 为 `[count, of]`（默认，`max` 为 `null`）：画成百分比，`k / n`。标签显示为 `pct`：`k=0` 或 `k=n` 时取整（`0%`、`100%`），其他保留一位小数（如 `72.0%`、`41.0%`）。刻度为 0%、25%、50%、75%、100%（`ticks` 默认 4）。
- `values` 为数字 + `max`：画成 `v / max`，超过 `max` 的柱子会被截断到满高，但标签仍显示原数值。`format` 决定标签与刻度文字，例如 `format: (v) => \`${v} ms\``。注意 `format` 在百分比模式下被忽略。

```js
Deck.groupedBars(frame, {
  max: 40, ticks: 4, format: (v) => `${v} ms`,
  series: [{ key: 'a', label: 'Method A' }, { key: 'b', label: 'Method B' }],
  groups: [{ key: 'g1', label: 'Run 1', values: { a: 12, b: 27 } }],
});
```

**返回值**：`{ root, show(step, animate = true) }`。`root` 是挂在 `frame` 下的 `div.deck-plot`；`show` 根据 `step` 决定哪些组或柱子已经「在」：
- 组模式（默认）：`group.step`（缺省为 1）≤ `step` 的组变为可见，并生长。`animate === false` 时关闭过渡（跳转用）。
- 系列模式（见下）：组在第一个系列的 step 时出现，柱子按各自的 step 长出来。

`animate` 的取值与 `Deck.slide` 的 `enter(step, animate)` 相同；`'back'` 对柱状图也是真，它会播放过渡（不倒放）。

### 系列逐步（series-wise build-up）

如果某个 `series` 带 `step`，图表进入「系列模式」（`bySeries`）：所有组从第一个系列的步数开始就在场，每点一下，每组多出一根某颜色的柱子。

```js
series: [
  { key: 'base', label: 'Baseline', step: 1 },
  { key: 'ours', label: 'New method', step: 2 },
],
groups: [ /* no step on groups */ ],
```

规则：
- 「组的 step」和「系列的 step」二选一，不要两者都设（源码注释明确说明）。
- 系列模式下，**每个系列都要写 step**。没写的系列默认 step 为 1，会在第一步就出现。
- 系列模式下，柱子的数值标签随柱子出现，组标签一直可见。

示例 `chart.js` 用的是组模式（三组，每组一步，第三组 `highlight`）。

### 排版（来自 deck.css 的 Plots 段）

所有百分比都是相对于幻灯片框。`--plot-dy` 默认 5%，`captioned` 时为 0%。

| 元素 | 位置 / 尺寸 |
| --- | --- |
| 图例 `.deck-plot-key` | 左右边距 4.2%，顶部 `19% + dy/3`，居中，字号 `--t-caption` |
| 绘图区 `.deck-plot-chart` | 左 14%、右 9%，顶部 `33% + dy`，高 33%，底边一条细线 |
| 网格线与刻度 `.deck-plot-grid` / 数字 | 绘图区内，数字在左侧 |
| 柱宽 `.deck-plot-bar` | 3.5u（约 0.56 世界单位） |
| 数值标签 `.deck-plot-val` | 柱顶之上，字号 1.3u；`.strong` 加粗 |
| 组标签 `.deck-plot-label` | 柱底之下 1.2u，居中于该组的柱子，字号 `--t-caption` |
| 高亮 `.deck-plot-group.highlight` | 组底纹（强调色 9% 透明度），标签变强调色加粗 |
| 页脚 `.deck-plot-foot` | 左 4.2%，顶部 `79.5% + dy`，宽 92%，字号 1.15u，颜色为 `--detail` |

所以无 caption 时，柱底约在 71%，页脚在约 84.5%；有 caption（`captioned: true`）时，柱底在 66%，页脚在 79.5%，`.deck-caption` 在 87%。

颜色：第 i 个系列的柱子用 `var(--plot-i+1)`。`--plot-1..5` 在 `deck.css` 中定义，深色主题有单独的值。`P.series` 与之对应，给 manim 用。

### 何时用 groupedBars，何时用 manim 坐标轴

- 类别、分组、百分比、计数 → `groupedBars`。它的读数（数值标签）清楚，动画也统一。
- 连续 x、函数、曲线、面积、Riemann 和 → manim 的 `M.Axes`。
- 不要在 manim 里用一堆矩形手画柱状图。不要用 `groupedBars` 画曲线。

---

## 5. 版式配方

所有配方都假设幻灯片在 `Deck.slide` 中，框内有 `.deck-heading`（左上角，5%）。

### 5.1 全宽舞台加说明行

```
+---------------------------------------------------------+ 0%
| Heading (.deck-heading, top 5%)                         |
|                                                         |
|      [ .deck-stage, inset 0 : manim scene ]             | 15% .. 85%
|      x in [-7.3, 7.3], y in [-3.1, 3.2]                |
|                                                         |
| caption (.deck-caption, top 87%)                        |
+---------------------------------------------------------+ footer (2.9u)
```

```js
Deck.slide('full-stage', {
  steps: 3,
  mount(frame, { esc }) {
    frame.innerHTML = `
      <div class="deck-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('Full-width stage')}</h2>
      <p class="deck-caption reveal-in" data-from="3">${esc('The caption appears on step 3.')}</p>`;
    const stage = Deck.manim(frame.querySelector('.deck-stage'), { build: /* ... */, steps: [/* 3 steps */] });
    return {
      enter(step, animate) { Deck.show(frame, step, animate); return stage.go(step, animate); },
      freeze: stage.freeze, destroy: stage.dispose,
    };
  },
});
```

### 5.2 舞台在左，要点在右

```
+---------------------------------------------------------+
| Heading                                                 |
| [ stage: x < 1.6 ]              |  1  Point title       |  col-top 22%
|                                 |     sub-line          |
|   shapes here                   |  2  Point title       |
|                                 |     sub-line          |
|                                 |  3  ...               |
+---------------------------------------------------------+
```

`.deck-col` 默认从 59% 开始（`--col-left`），顶部 19%（`--col-top`）。示例 `manim_shapes.js` 的做法是在幻灯片里用 `Deck.css` 给一个自定义类设置变量：

```js
Deck.css(`.ms-col { --col-left: 60%; --col-top: 22%; --col-gap: calc(2.1 * var(--u)); }`);
// ...
frame.innerHTML = `
  <div class="deck-stage"></div>
  <h2 class="deck-heading reveal-in in">${esc('One click, one animation')}</h2>
  ${Deck.points([
    { title: 'Create', sub: '<code class="deck-code">new M.Create(circle)</code>' },
    { title: 'Transform', sub: '<code class="deck-code">new M.Transform(circle, sq)</code>' },
  ].map((p) => ({ ...p, html: true })), { className: 'ms-col' })}`;
```

注意：
- `Deck.points` 的每一项默认在第 `i+1` 步出现（`from`），也可以写 `from: k` 指定。它的 HTML 带有 `reveal-in` 与 `data-from`，所以 `Deck.show(frame, step, animate)` 必须被调用。
- 舞台里的形状要让开右边：x < `16 * col_left / 100 - 8`。`col_left` 为 60% 时 x < 1.6。
- `html: true` 时标题和副行按 HTML 输出；否则会被转义。

### 5.3 柱状图幻灯片

```
+---------------------------------------------------------+
| Heading                                                 |
|            [ key: series legend ]                       | 19%
|                                                         |
|   100% -|                                               |
|    75% -|  ▇▇   ▇▇        ▇▇                            | 33%..66%
|    50% -|  ▇▇ ▇▇ ▇▇      ▇▇ ▇▇                           |
|     0% -+----------------------------------------       |
|           Easy  Medium    Hard     (group labels)       |
|                                                         |
| footnote (.deck-plot-foot, 79.5%)  .. caption (87%)     |
+---------------------------------------------------------+
```

```js
Deck.slide('bars-with-caption', {
  steps: 2,
  mount(frame, { esc }) {
    frame.innerHTML = `
      <h2 class="deck-heading reveal-in in">${esc('Bars, one group per click')}</h2>
      <p class="deck-caption reveal-in" data-from="2">${esc('The hard cases are where the gain is largest.')}</p>`;
    const plot = Deck.groupedBars(frame, {
      captioned: true,                               // the chart sits higher, clear of the caption line
      series: [{ key: 'base', label: 'Baseline' }, { key: 'ours', label: 'New method' }],
      groups: [
        { key: 'easy', label: ['Easy', 'cases'], step: 1, values: { base: [61, 100], ours: [72, 100] } },
        { key: 'hard', label: ['Hard', 'cases'], step: 2, highlight: true, values: { base: [9, 100], ours: [31, 100] } },
      ],
      strong: 'ours',
      footnote: ['Illustrative numbers'],
    });
    return { enter(step, animate) { Deck.show(frame, step, animate); return plot.show(step, animate); } };
  },
});
```

注意 `Deck.show` 与 `plot.show` 要同时调用，caption 的 `data-from` 才会生效。

---

## 6. 限制与坑

1. **build 必须新建对象。** 在 `build` 外面 `new` 对象，或把 mobject 存到模块变量，跳转和后退时会出现残影或重复。
2. **steps 长度要与 `Deck.slide({ steps })` 一致。** `go()` 会把步数夹在 `steps.length` 内，多出来的点击什么也不做，而 deck 仍然会计数。
3. **`enter` 必须对跳转安全。** 不要写「上一步的状态 + 增量」。每一步只描述它结束时应有的画面，用 `steps` 中的快速路径保证跳转一致。
4. **`'back'` 在 Deck.manim 里是跳转，不是倒放。** 它不会播放反向动画；如果想倒放，需要自己实现（本章不建议）。
5. **不要在 `steps` 里直接改 `build` 之外的状态。** 快速路径会反复运行 `steps`，状态会累积。
6. **Transform 点数不一致会抛错。** 不同形状之间用 FadeOut + FadeIn 或 `ReplacementTransform`。
7. **`M.Text` 不带 `fontFamily: 'Lato'` 会用衬线字体。** 每个文字都要传。
8. **`M.MathTex` 与 `M.Axes` 的默认颜色不跟随主题。** 每个对象显式传 `color`。
9. **`Deck.groupedBars` 的 `values` 要给每个系列一个值。** 缺一个 key 就会在 `fraction(undefined)` 处报错。
10. **`Deck.groupedBars` 的颜色只有 5 个。** `--plot-1..5` 只定义到 5；6 个以上系列没有颜色，需要先在 `deck.css` 中添加 `--plot-6`（同时在两个主题中），这是设计决策，不要临时在幻灯片里写颜色。
11. **系列模式下每个系列都要写 step。** 漏写的系列会在第一步就出现。
12. **组模式下，`groupedBars` 需要 `show()`。** 没有调用 `plot.show` 时图表全部透明。
13. **`format` 只在 `max` 模式下生效。** 百分比模式的标签由 `pct()` 决定。
14. **`captioned` 只改位置。** 你仍然要自己放 `.deck-caption` 元素，并调整文字。
15. **`c2p` 与 `moveTo` 的顺序。** 先 `moveTo` 轴，再计算点的位置。
16. **舞台里的物体不要越过安全区。** y 超过约 3.3 会压到标题；x 超过约 ±7.3 会贴边；有 caption 时 y 低于约 -3.1 会压到说明行。
17. **不要在幻灯片里写 `px`、字号或颜色。** 用 `--t-*` 与 `P`。
18. **不要用 CDN 或外部脚本。** manim-web 与 KaTeX 都已经在 `vendor/` 中。
19. **Deck.points 的标题与副行默认会被转义。** 要写 `<code>` 之类的标记，必须加 `html: true`。
20. **改字号后要看截图。** `M.Text` 的 `fontSize` 到世界单位的换算未在本章确认。

---

## 7. 示例位置

| 示例 | 文件 | 演示 |
| --- | --- | --- |
| 形状与 LaggedStart、Write、Shift、Transform | `talks/example/slides/manim_shapes.js` | `Deck.manim` 的 build/steps、`play()` 连续播放、`Deck.points` 的 `ms-col`、`Deck.css` 覆盖列位置 |
| 坐标轴、函数、Riemann 矩形、面积、公式 | `talks/example/slides/manim_graph.js` | `M.Axes`、`axes.plot`、`getRiemannRectangles`、`getArea`、`getAxisLabels`、`MathTex`、Transform 与 FadeOut/FadeIn 的选择 |
| 分组柱状图（组模式） | `talks/example/slides/chart.js` | `Deck.groupedBars` 的基本用法、`highlight`、`strong`、`footnote`、`plot.show` |
| 运行时的基础 | `web/manim.js`、`web/plots.js`、`web/deck.css` | 本章所有行为的源码 |

---

## 待确认

1. `M.Text` 的 `fontSize` 与世界单位之间的换算比例（示例用 44，看到的大小是否合适）。
2. `M.MathTex` 的 `color` 默认值的确切十六进制（bundle 中为硬编码，本章只确认它不跟随主题）。
3. `M.Transform` 在「矩形组 → 更多矩形组」（`manim_graph.js` 第 4 步）时能否平滑变形。
4. `M.Write`、`GrowFromCenter`、`FadeIn`、`FadeOut` 等基类 `Animation` 的默认 `duration`。
5. （已解决）`axes.c2p` 在 `moveTo` 之后立即调用会取到新位置：方案 A 的数据点和曲线在浏览器里对得上。
6. （已解决）`Axes` 默认**不**显示刻度数字；用 `axes.addCoordinates(xNums, yNums)` 加，0 不标，数字就是坐标值；`Axes` 的两条轴固定在坐标 0 处相交，x 范围不含 0 时 y 轴会画到画面外（见第 3 节）。
7. XRD 的连续谱（叠加高斯峰）的实现方式；本章只给了竖线峰位。
8. `setPointsAsCorners` 在 VMobject 上的确切所属（bundle 中该方法存在，本章按 VMobject 使用）。
9. `Deck.manim` 下 `'back'` 的重建在长场景中的时长（快速路径会对所有之前的步骤逐一执行，步数很多时是否卡顿未测）。
10. 6 个以上系列的 `groupedBars` 颜色方案（需要 `deck.css` 中的 `--plot-6` 等，本章不建议临时添加）。
