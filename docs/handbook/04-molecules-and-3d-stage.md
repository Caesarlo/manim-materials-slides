# 04 · 分子与 3D 舞台（turntable 舞台与分子外观）

本章写给要在本仓库新建材料讲稿的编码代理与作者。内容覆盖：转台舞台 `Deck.turntable`，分子外观 `Deck.molstar`，原子与团簇的小工具 `Deck.ballStick` / `Deck.cages` / `Deck.elementColours`，生物卡通 `Deck.cartoon`，manim-web 的 `M.Molecule3D`，几种版式配方，以及两个数据准备脚本。周期性晶体请用晶体附加组件（`Deck.crystalSlide` / `Deck.CrystalView`，另有章节）。

## 0. 先选哪一个

| 要画的东西 | 用什么 | 为什么 |
| --- | --- | --- |
| 周期性晶体（CIF；要键、配位多面体、层、晶格矢量） | 晶体附加组件（另有章节） | 自带渲染器，键由 pymatgen 规则算出，标签带引线 |
| 非周期分子、团簇、吸附物、缺陷周围的一小块结构、任意 three.js 模型 | `Deck.turntable` 加 `M.Molecule3D`，或加 `Deck.ballStick` | 可拖动、滚轮缩放、空闲摇摆；`focus` 能推近某个原子 |
| 蛋白质的卡通（PDB / mmCIF，生物用途） | `Deck.cartoon` 加 turntable | 螺旋与折叠带的 Mol* 风格，仅在生物讲稿中有意义 |
| 一张静态分子结构图 | HTML / SVG，或 manim-web 的 2D 对象 | 不需要 WebGL，也不需要外观 |

材料讲稿的小分子与团簇走 turntable 这一路；周期性固体不要用它，要用晶体附加组件。

加载方式（照抄 `talks/example/index.html` 第 25-29 行，顺序即模板的顺序）：

```html
<script src="../../vendor/manim-web/manim-web.iife.js"></script>
<script src="../../web/deck.js"></script>
<!-- the 3D add-on: only talks that show molecules need these -->
<script src="../../web/addons/molstar.js"></script>
<script src="../../web/addons/cartoon.js"></script>
<script src="../../web/addons/turntable.js"></script>
<script src="../../web/addons/atoms.js"></script>
```

`M.Molecule3D` 不在附加组件里，它是 `vendor/manim-web/manim-web.iife.js` 的一部分，通过 `mount` 的 `M` 参数取得（`M` 即 `window.ManimWeb`）。

### 本章所涉文件一览

| 文件 | 提供 | 见第 |
| --- | --- | --- |
| `web/addons/turntable.js` | `Deck.turntable` | 2 |
| `web/addons/molstar.js` | `Deck.molstar`、`Deck.molstar.look`、`Deck.molstar.configure` | 3 |
| `web/addons/atoms.js` | `Deck.ballStick`、`Deck.cages`、`Deck.elementColours` | 4 |
| `web/addons/cartoon.js` | `Deck.cartoon` | 5 |
| `vendor/manim-web/manim-web.iife.js` | `M.Molecule3D`、`M.ThreeDScene`、`M.THREE` | 6 |
| `talks/example/slides/molecule.js`、`protein.js`、`alphabet.js`、`design_check.js` | 示例幻灯片 | 9 |
| `tools/prep_protein.py`、`tools/prep_amino_acids.py` | 数据准备 | 8 |

## 1. 共同约定

**坐标。** 场景的 z 轴朝上，镜头起始在 -y 一侧朝 +y 看，x 轴向右（`turntable.js` 头注释；`theta = -π/2`，`phi = π/2 - tilt`）。镜头绕原点转动。

**单位。** `scale` 是「场景单位 / Å」。要分清三种放置方式的单位：

| 放在哪里 | 单位 | 怎么写 |
| --- | --- | --- |
| `view.model`（一个 THREE.Group，自动乘 `scale`） | Å | 直接写 Å 坐标与 Å 半径，例如 `Deck.ballStick` |
| `view.add(...)` 加入的对象（场景根） | 场景单位 | 位置与半径都要自己乘 `scale`，如 `molecule.js` |
| `Deck.cartoon` 返回的 mesh | 构建时为 Å | `mesh.scale.setScalar(scale)`；不要去缩放 Cα 坐标（见第 5 节） |

**数据约定。** `molecule.js` 的做法：数据里 x 向右、y 向上、z 朝向观众，转成场景时用 `toScene = ([x, y, z]) => [x, -z, y]`。这只是约定，代码不强制。数据先减去质心再用，`focus` 以模型原点为转动中心，质心在原点时推近最自然。

**视觉。** 颜色只用 `palette`（`P.fg`、`P.muted`、`P.accent`、`P.metal`、`P.cpk`、`P.ss`），不要写死黑白或十六进制；两套主题都要看。

---

## 2. Deck.turntable

### Deck.turntable

**用途。** 在一块透明的 manim-web `ThreeDScene` 上放一个三维模型，允许拖动转动、滚轮缩放，空闲时轻轻摇摆；还能把镜头推近模型上某一点，并把 HTML 标签钉在原子上。

**何时用。** 讲者要让听众从不同角度看一个分子、团簇或任意 three.js 模型时。只要一幅静态图，不要用它。

**最小示例。** 下面的幻灯片可以直接放进 `talks/<talk>/slides/`（再在 `index.html` 里加一个 `<script>` 标签）。它画一个 CO 示意（坐标为示意值，非实测）：

```js
{
Deck.slide('mini-turn', {
  steps: 1,
  interactive: true,                       // 幻灯片接收拖动与滚轮
  mount(frame, { palette: P, M, esc }) {
    frame.innerHTML = `<div class="deck-stage turnable mt-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('Turn me')}</h2>`;
    const view = Deck.turntable(frame.querySelector('.mt-stage'), { radius: 1, scale: 0.3, rock: 0.4 });
    const T = M.THREE;
    // Å 坐标放进 view.model，组会乘上 scale（0.3）
    const bond = Deck.ballStick([[0, 0, 0], [1.2, 0, 0]], [new T.Color(P.cpk.C), new T.Color(P.cpk.O)],
      [[0, 1]], { atom: 0.4, bond: 0.12 });
    view.model.add(bond.group);
    return {
      enter(step, animate) { view.start(); Deck.show(frame, step, animate); },
      leave: view.stop,                    // 离开时停止摇摆
      freeze: view.render,                 // 被截图前先重绘
      destroy() { bond.dispose(); view.dispose(); },
    };
  },
});
}
```

**参数**（`turntable.js` 第 27-28 行的默认值）。

| 参数 | 默认 | 含义 |
| --- | --- | --- |
| `radius` | `3` | 场景单位，约等于模型的半尺寸。决定相机距离 `distance = radius / tan(fov/2) × 1.15` 和雾的范围 |
| `scale` | `0.16` | 场景单位每 Å。乘在 `view.model` 上，并作为 Å 换算传给 `Deck.molstar`（描边阈值、遮蔽半径） |
| `rock` | `0.4` | 空闲摇摆的幅度，弧度，左右各一次；`0` 为不摇 |
| `speed` | `0.55` | 摇摆速度，弧度每秒（约 11 秒一个周期） |
| `tilt` | `0.25` | 起始时镜头在赤道上方的角度，弧度 |
| `fov` | `30` | 视场角，度 |
| `zoom` | `[0.45, 2.5]` | 滚轮缩放的上下限（用户缩放 `view.user` 被夹在此区间） |
| `look` | `{}` | 传给 `Deck.molstar` 的外观选项，与 `{ scale }` 合并；传 `null` 关闭外观（见第 3 节） |

**方法与属性**（`api` 对象，`turntable.js` 第 102-180 行）。

| 成员 | 说明 |
| --- | --- |
| `view.scene` | 底层 `M.ThreeDScene` |
| `view.look` | `Deck.molstar` 返回的 `{ fog, scale }`；关闭外观时为 `null` |
| `view.add(...things)` | 对象若 `isObject3D` 为真则进 `threeScene`，否则 `scene.add`；场景单位；会置脏 |
| `view.remove(...things)` | `add` 的反向操作 |
| `view.model` | THREE.Group，Å 单位，`scale` 已设好。`focus` 移动的就是它 |
| `view.dirty()` | 下一帧重绘。改了对象后调用 |
| `view.render()` | 立即重绘，并调用 `onRender`。`freeze` 用它 |
| `view.focus(point, z = 1, ms = 0, { from = null } = {})` | 见下文。返回 Promise |
| `view.from` | getter：镜头所在方向，在 `model` 的 Å 坐标系里，三元数组。可用来把视角交给下一张幻灯片 |
| `view.project(point)` | `[x, y]`，像素，相对宿主左上角。用于 HTML 标签 |
| `view.start()` / `view.stop()` | 开启 / 关闭空闲摇摆。拖动与滚轮始终可用 |
| `view.reset()` | 把视角、缩放、`model` 位置复位（不取消正在进行的 `focus`，见第 9 节） |
| `view.onRender` | 函数或 `null`，每次重绘后调用 |
| `view.dispose()` | 停止循环，断开 ResizeObserver，释放场景 |

**坐标与交互。** 拖动：横向拖动改变 `theta`，一整个宽度约 6 弧度；纵向改变 `phi`，夹在 0.15 到 π-0.15 之间。松手后 1.5 秒，摇摆从当前角度继续。滚轮每一格乘 `exp(-deltaY × 0.0015)`，并调用 `preventDefault`，所以鼠标停在舞台上时页面不会滚动。宿主元素设了 `touch-action: none`。点击而不移动（超过 6 像素才算移动）仍然会翻页，这是 `deck.js` 的逻辑。

**focus 与 from。** `focus(p, z, ms, { from })` 做两件事：

- 把模型上的点 `p`（Å，模型坐标）平移到转动中心，即原点；实现是把 `view.model.position` 设为 `-p × scale`（已考虑 `model.quaternion`）。
- 把 `view.zoom` 从当前值按对数插值到 `z`，缓动为三次 in-out。`ms = 0` 时立即完成。

`{ from: [x, y, z] }` 额外让镜头绕到从该方向看（同样是模型的 Å 坐标系），取最短的水平旋转路径，俯仰夹在同一范围内；此时摇摆相位归零。后一次调用会取代前一次正在进行的 `focus`。

```js
view.focus([0.8, 0, 0.5], 2.4, 1200);                      // 推近到这个原子，1.2 秒
view.focus([0.8, 0, 0.5], 2.4, 1200, { from: [1, 0, 0] });  // 同时绕到 x 方向看
view.focus([0, 0, 0], 1, 900);                              // 复位到整体
```

`z` 是 `focus` 的目标缩放；`zoom` 选项是滚轮的上下限。实际距离是 `distance / (view.zoom × view.user)`。

**标签（project 与 onRender）。** 标签放在宿主里，每次重绘后把它摆到原子的屏幕位置：

```js
const atoms = D.xyz.map(toScene);                          // Å，模型坐标
const tags = D.elements.map((el, k) => {
  const t = Object.assign(document.createElement('div'), { className: 'mt-tag reveal-in', textContent: `${el}${k + 1}` });
  t.dataset.from = '2';                                    // 由 Deck.show 控制显示
  host.append(t);
  return t;
});
view.onRender = () => tags.forEach((t, k) => {
  const [x, y] = view.project(atoms[k]);
  Object.assign(t.style, { left: `${x - t.offsetWidth / 2}px`, top: `${y - t.offsetHeight - 6}px` });
});
```

`.mt-tag` 只设 `position: absolute; font-size: var(--t-caption); color: var(--fg); pointer-events: none; white-space: nowrap;`。不要给它设 `transform`：`.reveal-in.in` 会把 `transform` 设为 `none`，覆盖掉你的值。

**幻灯片接线。** 必须做的四件事：

1. 幻灯片 `interactive: true`（否则左右滑动会翻页，抢走拖动）。
2. `enter` 里 `view.start()`；`leave: view.stop`。
3. `freeze: view.render`（截图前重绘，否则缩略图是空的）。
4. `destroy: view.dispose`。`deck.js` 在幻灯片离开当前位置超过 `KEEP` 张时调用 `freeze`，依次执行 `leave`、`destroy`，并释放 WebGL 上下文。

`enter` 必须对跳转安全：`enter(2, false)` 直接跳到的画面，要与逐步点过去的一致。因此 `focus` 在 `animate` 为假时传 `ms = 0`。

**WebGL 预算。** 每个 `Deck.turntable` 占一个 WebGL 上下文，浏览器一般只保留约 16 个（`deck.js` 注释）。`deck.js` 里 `KEEP = 3`：当前幻灯片前后各 3 张以内保持存活，更远的冻结成图片。所以每张转台幻灯片都要实现 `destroy`，别在模块顶层创建场景。

**排版建议。** 模型放在 `.deck-stage`（`inset: 0`），用 `right: 40%` 让它只占左侧（见第 7 节）。转台的宿主必须同时带 `deck-stage turnable` 两个类，它们给出抓手光标。把标题和要点写在舞台之后（DOM 顺序靠后），否则文字可能被全幅舞台盖住。

**限制与坑。**

- `view.add` 进来的 `M.Molecule3D` 位于场景根，`focus` 不会移动它（见第 9 节，据源码推断，待确认）。需要推近、平移的模型，放进 `view.model`，并用 THREE 对象（`Deck.ballStick`、`Deck.cages`、`Deck.cartoon` 的 mesh）。
- `radius` 是场景单位，不是 Å；不要直接写原子坐标的最大值。
- `view.onRender` 中调用 `project` 是安全的（渲染之后矩阵已更新）；在 `focus` 之后、渲染之前立刻调用可能读到旧位置。

**示例位置。** `talks/example/slides/molecule.js`（`view.add` 加 `M.Molecule3D`，`rock: 0.5`，`radius: half + 0.6`）；`protein.js`（`Deck.cartoon` 的 mesh 缩放与 `view.dirty()`）。

---

## 3. Deck.molstar（外观）

### Deck.molstar

**用途。** 给一个 manim-web 的 `ThreeDScene` 加上类 Mol* 的外观：原子轮廓线（深度跳变处画黑线）、环境光遮蔽（缝隙处变暗）、哑光表面配一盏主光、以及随深度的雾。它接管该场景渲染器的 `render`，在离屏缓冲里先画、再遮蔽、再合成。

**何时用。** 所有分子与卡通的 3D 场景都建议用它，除非你要的是平的 manim 风格。`Deck.turntable` 默认会调用它（由 `look` 选项控制）。

**最小示例。**

```js
const scene = new M.ThreeDScene(host, { backgroundOpacity: 0, enableOrbitControls: false });
const look = Deck.molstar(scene, { scale: 0.2, fog: [8, 14] });   // scale: 场景单位/Å；fog: 场景单位，从镜头量起
// ... 加入对象，然后 scene.render() ...
look.fog(9, 15);      // 镜头推拉时更新雾
look.scale(0.25);     // 若缩放改变，同步 Å 换算
```

注意 `ThreeDScene` 的构造选项（`M.ThreeDScene`，见 `vendor/manim-web/manim-web.iife.js`）：`fov` 默认 45，`phi` 默认 π/4，`theta` 默认 -π/4，`distance` 默认 15，`enableOrbitControls` 默认真，`setupLighting` 默认真。模板里的幻灯片传了 `enableOrbitControls: false`，免得它与自己的拖动冲突。

**参数**（`molstar.js` 第 26-41 行的 `LOOK`；选项与之深度合并）。

| 键 | 默认 | 含义 |
| --- | --- | --- |
| `outline.width` | `1.5` | 轮廓线宽，CSS 像素（乘上设备像素比） |
| `outline.threshold` | `1.25` | Å。深度相差超过它才画线，所以卡通带自身的 0.4 Å 起伏不被描黑 |
| `outline.color` | `'#000000'` | 轮廓颜色 |
| `outline.strength` | `1` | 小于 1 则线更淡 |
| `occlusion.radius` | `9.4` | Å，缝隙遮蔽的采样半径 |
| `occlusion.bias` | `0.06` | Å，遮蔽判定的偏置 |
| `occlusion.strength` | `1.5` | 缝隙遮蔽的强度 |
| `occlusion.wide.radius` | `31` | Å，整体遮挡的半径；`0` 关闭 |
| `occlusion.wide.strength` | `1.4` | 整体遮挡的强度 |
| `light.ambient` | `0.2` | 环境光强度 |
| `light.key` | `2.7` | 主光强度 |
| `light.from` | `[-0.45, 0.55, 1]` | 主光方向，相机空间。主光每帧跟着镜头走 |
| `roughness` | `1` | 表面粗糙度，哑光 |
| `fogStrength` | `0.4` | 雾的强度，向背景色渐变 |
| `scale` | `0.16` | 场景单位每 Å（仅在幻灯片未给出时使用） |
| `fog` | 无 | `[near, far]`，场景单位；不给则无雾 |

**configure（全讲稿的外观）。** `Deck.molstar.configure(changes)` 深度合并进 `Deck.molstar.look` 并返回它。它只影响之后创建的场景，所以要在幻灯片挂载前调用，比如写在讲稿页面的 `<script>` 里：

```html
<script>Deck.molstar.configure({ occlusion: { strength: 1.2 } })</script>
```

单张幻灯片的外观，把同样的键传给 `Deck.molstar(scene, {...})`，或放进 `Deck.turntable` 的 `look` 选项。

**方法。** 返回对象只有两个：`fog(near, far)` 和 `scale(s)`。`scale(s)` 会按 `s` 重算所有以 Å 计的量（遮蔽半径、描边阈值）。

**排版建议。** 外观是为「一个分子占舞台一半」调的。远小于或远大于这个尺寸时，雾和遮蔽的距离可能需要改，用 `fog` 与 `scale` 调。

**限制与坑。**

- 构造时会调用 `scene.lighting.removeAll()`，之后再给场景加的灯不会被删。
- 对 `MeshStandardMaterial` 的网格，它每帧把 `roughness` 强制为 `roughness` 选项的值。`Deck.cages` 用的是 `MeshBasicMaterial`，不受影响。
- 填充背景色 `window.Deck.palette.bg` 在构造时读取，所以颜色随主题在页面加载时确定，不会在切换主题时改变（对已存在的场景）。
- 每次渲染多跑三趟（主渲染、遮蔽、合成），遮蔽是 16 个采样的双半径计算。低端机器上会慢，适合少量大对象。
- 半透明对象（`Deck.ballStick` 的 `opacity` 小于 0.99）不写深度，所以不会被描边或遮蔽计入。

**示例位置。** `talks/example/slides/alphabet.js`（直接用于自有的 `ThreeDScene`，并用 `look.scale(s)` 适配视图）；`design_check.js`（`scale: 1`，并设 `fog`）。`turntable.js` 本身也通过它工作。

---

## 4. Deck.ballStick、Deck.cages、Deck.elementColours（atoms.js）

这三个函数写在 `web/addons/atoms.js`，用实例化网格（InstancedMesh）绘制，成百个原子也可以一起淡入淡出。

**注意：仓库里的示例幻灯片目前没有直接调用它们。** `design_check.js` 里有同名的局部函数 `ballStick`、`cages`，`alphabet.js` 则用 `M.Molecule3D`。下面的用法按源码写，尚未在浏览器里逐一跑过。

### Deck.ballStick

**用途。** 画一组球与棍（ball-and-stick），每根键是两根半棍，各带一端原子的颜色。

**何时用。** 需要快速画一个小团簇、一个模型的原子骨架，或者要在某个位置画“候选原子”时。需要更像 Mol* 的成品原子，用 `M.Molecule3D`。

**签名。** `Deck.ballStick(points, colours, bonds, { atom = 0.25, bond = 0.1, detail = 16 } = {})`

**最小示例。**

```js
const sc = Deck.ballStick([[0, 0, 0], [1.2, 0, 0]], [new T.Color(P.cpk.C), new T.Color(P.cpk.O)],
  [[0, 1]], { atom: 0.4, bond: 0.12 });
view.model.add(sc.group);     // Å，view.model 会缩放
sc.opacity(0.5);
sc.put(newPoints);            // 移动原子，键保持不变
sc.dispose();
```

**参数与返回值。**

| 名称 | 说明 |
| --- | --- |
| `points` | `[[x, y, z], ...]`，单位任意（放进 `view.model` 时为 Å） |
| `colours` | THREE.Color 数组，长度与 `points` 相同 |
| `bonds` | `[[i, j], ...]`，原子下标 |
| `atom` | 球半径，与 `points` 同单位，默认 `0.25` |
| `bond` | 棍半径，默认 `0.1` |
| `detail` | 球的细分（经线数），默认 `16` |
| 返回 `group` | THREE.Group，球与棍 |
| 返回 `put(points)` | 按新坐标移动原子与键；键的数目不变 |
| 返回 `opacity(a)` | 透明度。`a < 0.99` 时不写深度；`a ≤ 0.001` 时整组隐藏 |
| 返回 `dispose()` | 释放材质与几何 |

**排版建议。** 用 `view.model` 放置（Å），原子半径取 0.3–0.5 Å 更接近 `M.Molecule3D` 默认的视觉。`opacity` 用于“留个幽灵”，不要用来表示物理量。

**限制与坑。**

- 颜色应是 THREE.Color（`Deck.elementColours` 的返回值，或 `new T.Color(hex)`），不是 CSS 字符串数组。
- 键的数目在创建时定死，`put` 只能移动，不能增减键。
- 没有双键、三键的画法，所有键都是单根棍。需要多重键，用 `M.Molecule3D`（见第 6 节）。

### Deck.cages

**用途。** 在每个点上画一个线框二十面体，表示“这里应该有原子”（如设计的目标位置、请求的原子位置）。它与真正的原子视觉上分开。

**何时用。** 要让听众看出“已建的原子是否落在目标里”时。`design_check.js` 的讲法正是这样：目标位置只画空笼，绝不画原子，免得屏幕上暗示有键。

**签名。** `Deck.cages(points, { radius = 0.45, color = '#000000', opacity = 0.6 } = {})`

**最小示例。**

```js
const cg = Deck.cages([[1.4, 0.8, 1.6]], { radius: 0.6, color: P.fg });   // Å 单位，在 view.model 中
view.model.add(cg.mesh);
cg.opacity(1);   // 显示；0 为隐藏
cg.dispose();
```

**参数与返回值。**

| 名称 | 说明 |
| --- | --- |
| `points` | `[[x, y, z], ...]` |
| `radius` | 笼的半径，与 `points` 同单位，默认 `0.45` |
| `color` | 线框颜色，默认 `'#000000'`。**请传 `P.fg`**，别留黑色默认值 |
| `opacity` | 最大不透明度，默认 `0.6` |
| 返回 `mesh` | THREE.InstancedMesh，`renderOrder` 为 3，画在原子之上 |
| 返回 `opacity(a)` | 乘以 `opacity` 的不透明度；`a ≤ 0.004` 时隐藏 |
| 返回 `dispose()` | 释放几何与材质 |

**限制与坑。** 笼是 `IcosahedronGeometry(radius, 1)` 的线框，半径很小时更像网。`cages` 不是原子，不参与键的计算。

### Deck.elementColours

**用途。** 给一个元素列表返回 THREE.Color 数组，颜色取自 `palette.cpk`（即 Mol* 的元素色，Jmol 的 CPK 集）。

**签名。** `Deck.elementColours(elements, P, carbon = null)`

**最小示例。**

```js
const cols = Deck.elementColours(['C', 'N', 'O', 'H'], P);             // 碳用 CPK 灰
const cols2 = Deck.elementColours(['C', 'N', 'O'], P, P.fg);          // 碳改用前景色
```

**参数。** `elements` 是元素符号数组；`P` 是幻灯片的 `palette`；`carbon` 若为真值，则碳原子用它，否则用 `P.cpk.C`。

**限制与坑。** `palette.cpk` 只有 `C`、`N`、`O`、`S`、`P` 和 `other` 六个键，所以：

- 氢（H）、卤素、金属等都落到 `other`，即 `#ff1493` 粉色。这是源码行为（`P.cpk[el] || P.cpk.other`）。需要它们的颜色时，自己写映射，如 `new T.Color(el === 'Pt' ? P.metal : P.cpk[el] || P.cpk.other)`。
- `M.Molecule3D` 的 `colors` 选项没有这个问题：它对缺失的元素回退到 manim-web 内置的 Jmol 表（见第 6 节）。

---

## 5. Deck.cartoon（生物专用）

### Deck.cartoon

**用途。** 把蛋白质的 Cα 轨迹画成卡通：螺旋是扁椭圆带，折叠股是扁平箭头，其余是细管。它是对 Mol* 的 polymer-trace 的重新实现，不是 Mol* 的代码（头注释写明）。

**何时用。** 只有讲蛋白质结构时。材料讲稿通常不用它。

**签名。** `Deck.cartoon(data, options = {})`，其中 `data` 来自 `tools/prep_protein.py` 的输出（`ca`、`ss`、`dir`、`radius`，见第 8 节）。

**最小示例。**

```js
const toon = Deck.cartoon(data.ubiquitin, { color: P.accent });   // 单色
const bySS = Deck.cartoon(data.ubiquitin, { ss: P.ss });          // 按 H / E / C 上色
for (const t of [toon, bySS]) t.mesh.scale.setScalar(0.13);       // 构建在 Å，mesh 缩放到场景
view.add(toon.mesh, bySS.mesh);                                    // 放进 turntable
// toon.update(caPositions);  // 可选：新的 Cα 坐标，网格结构不变
// toon.dispose();
```

**参数与返回值。**

| 名称 | 说明 |
| --- | --- |
| `color` | 单色，默认 `'#9aa0a6'` |
| `ss` | `{ H, E, C }` 三种颜色，按二级结构上色（用 `P.ss`） |
| `material` | 自定义材质；给了它，`dispose` 就不会释放它 |
| `segments` | 每个残基的样条细分，默认 `8` |
| `radial` | 截面的边数，默认 `16` |
| 返回 `mesh` | THREE.Mesh，构建在 Å |
| 返回 `update(ca)` | 用新的 Cα 位置（`[[x,y,z],...]`）更新，网格结构不变 |
| 返回 `dispose()` | 释放几何（和未外部给出的材质） |

**限制与坑。**

- **缩放 mesh，不要缩放 Cα 坐标。** 带的宽度以 Å 计（0.2 Å，带宽 5 倍，箭头 1.5 倍），缩放坐标会让带变粗。`protein.js` 就是这样做的。
- 链断裂（`data.breaks`）目前不画（头注释）。
- 颜色用 `P.ss` 时，顶点颜色已经上好，材质的 `color` 被设为白色；别再套另一层颜色。

**示例位置。** `talks/example/slides/protein.js`（两个 mesh：单色与按二级结构；切换 `visible`）；`design_check.js`（传入 `material`）。

---

## 6. M.Molecule3D（manim-web，molecule.js 所用）

### M.Molecule3D

**用途。** manim-web 的分子对象：原子是球，键是棍（或双键的平行棍）。它是一个 manim `Mobject`，不是 THREE.Object3D。

**何时用。** 要 Mol* 风格的球棍，且原子与键由数据直接给出（元素、坐标、键），并且模型不需要 `focus` 推近。`molecule.js` 就是这样用的。

**最小示例（来自 `molecule.js`，并已适配材料数据）。**

```js
const SCALE = 0.3;                                     // 场景单位每 Å
const mol = new M.Molecule3D({
  atoms: D.elements.map((element, k) => ({ element, position: toScene(D.xyz[k]).map((v) => v * SCALE) })),
  bonds: D.bonds.map(([from, to]) => ({ from, to, order: 1 })),
  colors: { ...P.cpk, Pt: P.metal },                   // 元素 -> 颜色，缺的元素回退到 manim-web 的 Jmol 表
  radiusScheme: 'covalent',
  radiusScale: 0.42 * SCALE,                           // 半径 = 共价半径(Å) × radiusScale
  bondRadius: 0.11 * SCALE,
  sphereResolution: 20,
});
view.add(mol);                                         // 场景根：位置与半径都已乘 SCALE
```

**选项**（`vendor/manim-web/manim-web.iife.js` 中 `Molecule3D` 的构造函数，默认值由源码读出）。

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `atoms` | 必填 | `[{ element, position: [x, y, z] }]`，`position` 已乘 `scale` |
| `bonds` | `[]` | `[{ from, to, order }]`，下标指向 `atoms`，`order` 默认 1 |
| `style` | `'ball-and-stick'` | 也可 `'space-filling'`、`'wireframe'` |
| `radiusScheme` | ball-and-stick 为 `'covalent'`，space-filling 为 `'vdw'` | `'covalent'`、`'vdw'` 或 `'uniform'` |
| `radiusScale` | ball-and-stick `0.25`，space-filling `1`，wireframe `0.18` | 乘在 covalent / vdw 半径上 |
| `atomRadius` | `0.3` | 仅 `'uniform'` 时使用，**不乘 `scale`** |
| `bondRadius` | ball-and-stick `0.08`，wireframe `0.02` | 键的半径，**不乘 `scale`** |
| `bondColor` | 未设 | 键的颜色；未设时两端各取原子颜色 |
| `colors` | `{}` | 元素 -> 颜色字符串。按原样、首字母大写规范化、再按元素符号查找，最后回退到内置 Jmol 表（如 H 为白色），再不行为 `#DDDDDD` |
| `sphereResolution` | `24` | 球的细分 |
| `scale` | `1` | **只乘原子位置**，不乘半径和键的半径 |

**方法与属性（源码可见的）。** `getAtoms()`（返回 `{ element, position, color, radius, sphere }` 的数组，`position` 为缩放后的坐标）、`getBonds()`、`getAtom(i)`、`getBond(i)`、`numAtoms`、`numBonds`，以及 `atomsGroup`、`bondsGroup`。

**排版建议。** `molecule.js` 的半径：`radiusScale = 0.42 × SCALE`，`bondRadius = 0.11 × SCALE`。这两个数字与 `SCALE` 相乘，是因为 `scale` 选项不缩放半径。

**限制与坑。**

- 因为 `scale` 只缩放位置，半径必须在外面乘 `SCALE`（见上）。这是最容易写错的地方。
- `Molecule3D` 不是 THREE.Object3D，`view.model.add(mol)` 不合适，要用 `view.add`。因此它不随 `focus` 平移。需要推近时，改用 `Deck.ballStick`（见第 4 节）。
- 未知元素的共价半径取 manim-web 内置的默认值（具体数值待确认，见待确认清单）。
- `alphabet.js` 中有 `mol.opacity` 的用法，以及 `scene.add(mol)` / `scene.remove(mol)` 的显隐，见 `alphabet.js` 约第 445-470 行。

**示例位置。** `talks/example/slides/molecule.js`（`toScene`、`SCALE = 0.42`、`radiusScale: 0.42 * SCALE`、`bondRadius: 0.11 * SCALE`）；`alphabet.js`（直接放在自有的 `ThreeDScene` 里，并用 `look.scale(s)` 适配）。

---

## 7. 布局配方

三种配方都用同一套网格：标题在顶部，内容在约 15% 到 85% 的高度，说明文字在 87% 处（`.deck-caption`），再下面是页脚。所有 CSS 变量都在 `web/deck.css`。

每个配方的完整幻灯片都假定数据文件 `talks/<talk>/data/pt3.js` 存在（代码见 7.4）。配方之间的 CSS 类前缀互不相同（`ma-`、`mb-`、`mc-`），因为 `Deck.css` 是全局的，同名类会互相覆盖。

### 7.1 配方 A：模型居左，要点居右

```
+------------------------------------------------------------+
|  The heading                                               |
|                                                            |
|  +-------------------------+   1  Pt3 triangle             |
|  |                         |      3 atoms · 3 bonds         |
|  |     turntable stage     |                                |
|  |     right: 40%          |   2  Drag to turn, scroll      |
|  |                         |      a click still steps       |
|  +-------------------------+                                |
|  detail caption                                            |
+------------------------------------------------------------+
```

与 `molecule.js` 相同：舞台 `right: 40%`，要点列 `--col-left: 58%`、`--col-top: 24%`，`--col-gap` 为 `2.2u`。

```js
// talks/<talk>/slides/ma_model_left.js
{
const SCALE = 0.3;                                       // 场景单位每 Å
const toScene = ([x, y, z]) => [x, -z, y];               // 数据 x 右、y 上、z 朝观众 -> 场景 z 朝上

Deck.slide('ma-model-left', {
  steps: 2,
  interactive: true,
  notes: 'Illustrative Pt3 triangle (data/pt3.js is a placeholder, not a measured structure). Drag to turn.',
  mount(frame, { palette: P, data, M, esc }) {
    const D = data.pt3;
    frame.innerHTML = `
      <div class="deck-stage turnable ma-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('A cluster in 3D')}</h2>
      ${Deck.points([
        { title: D.name, sub: `${D.elements.length} atoms · ${D.bonds.length} bonds`, from: 1 },
        { title: 'Drag to turn, scroll to zoom', sub: 'a click without moving still steps the deck', from: 2 },
      ], { className: 'ma-col' })}`;
    Deck.css(`.ma-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
      .deck-frame .ma-stage { right: 40%; }`);

    const centre = [0, 1, 2].map((k) => D.xyz.reduce((s, p) => s + p[k], 0) / D.xyz.length);
    const pos = D.xyz.map((p) => toScene(p.map((v, k) => v - centre[k])));   // Å，居中
    const half = Math.max(...pos.flat().map(Math.abs)) * SCALE;
    const view = Deck.turntable(frame.querySelector('.ma-stage'), { radius: half + 0.6, scale: SCALE, rock: 0.5 });
    view.add(new M.Molecule3D({
      atoms: D.elements.map((element, k) => ({ element, position: pos[k].map((v) => v * SCALE) })),
      bonds: D.bonds.map(([from, to]) => ({ from, to, order: 1 })),
      colors: { ...P.cpk, Pt: P.metal },
      radiusScheme: 'covalent', radiusScale: 0.42 * SCALE, bondRadius: 0.11 * SCALE, sphereResolution: 20,
    }));

    return {
      enter(step, animate) { view.start(); Deck.show(frame, step, animate); },
      leave: view.stop,
      freeze: view.render,
      destroy: view.dispose,
    };
  },
});
}
```

### 7.2 配方 B：整幅模型，字幕与浮动标签

```
+------------------------------------------------------------+
|  The heading                                               |
|                                                            |
|                 Pt1                                        |
|              (drag, zoom)     Pt2             Pt3          |
|                                                            |
|  Step 2: the view swings edge-on, and the triangle is flat.|
+------------------------------------------------------------+
```

舞台占满整个框；标签随原子移动（`view.project`，在 `onRender` 中）；第 2 步推近到 Pt1 并绕到侧面看。因为原子在 `view.model` 里（Å），`focus` 会移动它们。

```js
// talks/<talk>/slides/mb_labels.js
{
const SCALE = 0.3;
const toScene = ([x, y, z]) => [x, -z, y];

Deck.slide('mb-labels', {
  steps: 2,
  interactive: true,
  notes: 'Step 2 pushes in on Pt1 and swings the view edge-on: the triangle lies flat.',
  mount(frame, { palette: P, data, M, esc }) {
    const T = M.THREE;
    const D = data.pt3;
    const centre = [0, 1, 2].map((k) => D.xyz.reduce((s, p) => s + p[k], 0) / D.xyz.length);
    const at = D.xyz.map((p) => toScene(p.map((v, k) => v - centre[k])));   // Å，居中，模型坐标
    frame.innerHTML = `
      <div class="deck-stage turnable mb-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('Labels follow the atoms')}</h2>
      <p class="deck-caption reveal-in" data-from="2">${esc('Step 2: the view swings edge-on, and the triangle is flat.')}</p>`;
    Deck.css(`.mb-tag { position: absolute; font-size: var(--t-caption); color: var(--fg);
      pointer-events: none; white-space: nowrap; }`);

    const host = frame.querySelector('.mb-stage');
    const view = Deck.turntable(host, { radius: 1.6, scale: SCALE, rock: 0.3 });
    const colours = D.elements.map((el) => new T.Color(el === 'Pt' ? P.metal : P.cpk[el] || P.cpk.other));
    const sc = Deck.ballStick(at, colours, D.bonds, { atom: 0.4, bond: 0.12 });
    view.model.add(sc.group);

    const tags = D.elements.map((el, k) => {
      const t = Object.assign(document.createElement('div'), { className: 'mb-tag reveal-in', textContent: `${el}${k + 1}` });
      t.dataset.from = '2';
      host.append(t);
      return t;
    });
    view.onRender = () => tags.forEach((t, k) => {
      const [x, y] = view.project(at[k]);
      Object.assign(t.style, { left: `${x - t.offsetWidth / 2}px`, top: `${y - t.offsetHeight - 6}px` });
    });

    return {
      enter(step, animate) {
        view.start();
        Deck.show(frame, step, animate);
        // 第 2 步：推近 Pt1 并绕到 x 方向看（三角形平放在 y = 0 的平面内，因此成一条线）
        const on = step >= 2;
        view.focus(on ? at[0] : [0, 0, 0], on ? 2.4 : 1, animate ? 1200 : 0,
          { from: on ? [1, 0, 0] : [0, -1, 0.25] });   // 第 1 步回到起始视角（略高于赤道）
      },
      leave: view.stop,
      freeze: view.render,
      destroy() { sc.dispose(); view.dispose(); },
    };
  },
});
}
```

### 7.3 配方 C：模型居左，带开关与标签

```
+------------------------------------------------------------+
|  The heading                                               |
|                                                            |
|  +-------------------------+   1  Atoms as built           |
|  |   labelled atoms        |                                |
|  |   right: 40%            |   2  Cages: requested sites    |
|  |                         |                                |
|  +-------------------------+                                |
|  ( ) Target sites  <- .deck-switch, under the model        |
+------------------------------------------------------------+
```

开关只在第 2 步之后出现，按下后显示目标位置的笼（`Deck.cages`）。按钮不会触发翻页（`deck.js` 忽略按钮上的点击），按完要 `blur()`，让方向键回到幻灯片。

```js
// talks/<talk>/slides/mc_switch.js
{
const SCALE = 0.3;
const toScene = ([x, y, z]) => [x, -z, y];

Deck.slide('mc-switch', {
  steps: 2,
  interactive: true,
  notes: 'The switch shows the requested sites (open cages) from step 2 on. A plain button: it never steps the deck.',
  mount(frame, { palette: P, data, M, esc }) {
    const T = M.THREE;
    const D = data.pt3;
    const centre = [0, 1, 2].map((k) => D.xyz.reduce((s, p) => s + p[k], 0) / D.xyz.length);
    const at = D.xyz.map((p) => toScene(p.map((v, k) => v - centre[k])));
    const target = D.target.map((p) => toScene(p.map((v, k) => v - centre[k])));
    frame.innerHTML = `
      <div class="deck-stage turnable mc-stage"></div>
      <h2 class="deck-heading reveal-in in">${esc('Requested sites and the atoms')}</h2>
      ${Deck.points([
        { title: 'Atoms as built', sub: 'solid balls, labelled', from: 1 },
        { title: 'Cages: the requested sites', sub: 'switch them on below the model', from: 2 },
      ], { className: 'mc-col' })}
      <button class="deck-switch mc-switch off-stage" aria-pressed="false"><i></i>${esc('Target sites')}</button>`;
    Deck.css(`.mc-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
      .deck-frame .mc-stage { right: 40%; }
      .deck-frame .mc-switch { left: 4.2%; top: 80%; }
      .mc-tag { position: absolute; font-size: var(--t-caption); color: var(--fg); pointer-events: none; white-space: nowrap; }`);

    const host = frame.querySelector('.mc-stage');
    const view = Deck.turntable(host, { radius: 1.6, scale: SCALE, rock: 0.4 });
    const colours = D.elements.map((el) => new T.Color(el === 'Pt' ? P.metal : P.cpk[el] || P.cpk.other));
    const sc = Deck.ballStick(at, colours, D.bonds, { atom: 0.4, bond: 0.12 });
    const cages = Deck.cages(target, { radius: 0.6, color: P.fg });
    view.model.add(sc.group, cages.mesh);
    cages.opacity(0);

    const tags = D.elements.map((el, k) => {
      const t = Object.assign(document.createElement('div'), { className: 'mc-tag reveal-in', textContent: `${el}${k + 1}` });
      t.dataset.from = '1';
      host.append(t);
      return t;
    });
    view.onRender = () => tags.forEach((t, k) => {
      const [x, y] = view.project(at[k]);
      Object.assign(t.style, { left: `${x - t.offsetWidth / 2}px`, top: `${y - t.offsetHeight - 6}px` });
    });

    const sw = frame.querySelector('.mc-switch');
    let step = 1, on = false;
    const apply = () => { cages.opacity(on && step >= 2 ? 1 : 0); view.dirty(); };
    sw.addEventListener('click', () => {
      on = !on;
      sw.setAttribute('aria-pressed', String(on));
      sw.blur();                                  // 让方向键回到幻灯片
      apply();
    });

    return {
      enter(s, animate) {
        step = s;
        view.start();
        Deck.show(frame, s, animate);
        sw.classList.toggle('off-stage', s < 2);  // 第 2 步之前不出现
        apply();
      },
      leave: view.stop,
      freeze: view.render,
      destroy() { sc.dispose(); cages.dispose(); view.dispose(); },
    };
  },
});
}
```

### 7.4 数据文件（三个配方共用）

这是示意数据，不是实测结构，三角形的边长 2.77 Å 只为几何上合理（Pt 的最近邻距离约 2.77 Å）。`target` 是为演示而设的。

```js
// talks/<talk>/data/pt3.js —— 在 index.html 里用 <script> 加载
window.DATA = window.DATA || {};
window.DATA.pt3 = {
  name: 'Pt3 (illustrative)',
  elements: ['Pt', 'Pt', 'Pt'],
  xyz: [[0, 0, 0], [2.77, 0, 0], [1.385, 2.4, 0]],   // Å
  bonds: [[0, 1], [1, 2], [2, 0]],
  target: [[1.385, 0.8, 1.6]],                        // Å，目标位置（示意）
};
```

每张幻灯片还要在 `index.html` 里加 `<script src="slides/....js"></script>`，并放在它的 `Deck.section(n)` 之后。

### 7.5 版式要点

- 要点列 `.deck-col` 的位置只通过 `--col-left`、`--col-top`、`--col-title`、`--col-gap` 调整（`deck.css`）。`molecule.js` 用 58%、24%，`protein.js` 用 60%、26%。
- 舞台 `right: 40%` 之后，舞台占左侧 60%。要点列从 58% 开始，与舞台的右边缘略有重叠，但舞台是透明的，不影响。
- 配方 C 的开关放在模型的左下角（`left: 4.2%; top: 80%`）。`design_check.js` 的 `.mo-switch` 位置是 `top: 84%`，与它类似。
- 字幕（`.deck-caption`）只用一行。

---

## 8. 数据准备工具

两个脚本都是上游蛋白质模板的，面向生物。下面说清输入输出，并说明材料用户能借用到什么程度。

### tools/prep_protein.py

**用途。** 把 PDB 或 mmCIF 的蛋白质链转成 `web/addons/cartoon.js` 能画的数据：每个残基的 Cα 位置、二级结构、带的朝向；加 `--atoms` 时还有全部重原子与键。

**用法。**

```bash
python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json
python tools/prep_protein.py my.pdb talks/<talk>/data/my_protein.json --chain B
python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json --atoms
```

**输入 / 输出。** 输入是 PDB 或 mmCIF。输出 `<out>.json` 和 `<out>.js`，后者写入 `window.DATA["<out 文件名>"]`，可以用 `<script>` 加载（`file://` 下 `fetch` JSON 不可用）。主要键：`source`、`chain`、`sequence`、`radius`、`ca`、`ss`、`dir`、`breaks`、`residues`；`--atoms` 时还有 `atoms`（`names`、`elements`、`residue`、`xyz`、`bonds`）。坐标为 Å，以 Cα 质心为中心，并沿主轴转动（最长轴为 x，次长轴为 z）。

**依赖。** `gemmi`、`numpy`；`mdtraj` 可选（用于 DSSP 二级结构，没有则全部记为 coil 并提示）。

**材料用户能借用什么。** 脚本读取的是残基与二级结构，只适用于蛋白质链，不能直接用于团簇或小分子。它的 `atoms` 块（元素、坐标、键）与 `M.Molecule3D` 的输入同构，所以一个读取 XYZ 或 CIF 团簇的脚本可以写出同样形状的 JSON / JS，供 `ballStick` 或 `Molecule3D` 使用。这个脚本本身不做这件事。

### tools/prep_amino_acids.py

**用途。** 为字母表幻灯片（`alphabet.js`）准备 20 种氨基酸的 2D 结构图（RDKit 绘制，占位颜色，由幻灯片换成主题色），并可选地从结构文件取一段肽链的 3D 坐标（`segment`）。

**用法。**

```bash
python tools/prep_amino_acids.py talks/example/data/amino_acids.json --structure talks/example/data/1ubq.cif --start 1
python tools/prep_amino_acids.py out.json --peptide MQIFVKT        # 只画 2D，不要 3D
```

参数：`out`（必填）、`--peptide`（不重复字母的序列）、`--structure`（PDB / mmCIF）、`--start`（默认 1）、`--length`（默认 7）。输出 `<out>.json` 与 `<out>.js`，写入 `window.DATA["<out 文件名>"]`。字体用 `vendor/fonts/Lato-Semibold.ttf`。

**依赖。** RDKit、`gemmi`、`numpy`。

**材料用户能借用什么。** 脚本里只有 20 种氨基酸（`AMINO` 表）。能借用的是做法：用 RDKit 从 SMILES 画 2D 图，用占位颜色标记各部分，再由幻灯片替换成主题色，从而两套主题都能用。对其他有机分子，需要自己写 SMILES 列表。

**没有的东西。** 仓库里没有面向 XYZ 或团簇的数据准备脚本。需要时，仿照 `prep_protein.py` 的输出形状自己写一个，并记录数据来源（AGENTS.md 的约定）。

---

## 9. 示例幻灯片速览

| 文件 | 演示什么 | 要点 |
| --- | --- | --- |
| `talks/example/slides/molecule.js` | 咖啡因（RDKit 构象）的球棍，转台 | 配方 A 的原型；`view.add` 加 `M.Molecule3D`；`toScene`；`radiusScale`、`bondRadius` 与 `SCALE` 相乘 |
| `talks/example/slides/protein.js` | 泛素（PDB 1UBQ）的卡通，两个 mesh 切换 | `Deck.cartoon` 的 `color` 与 `ss`；mesh 缩放；`view.dirty()` |
| `talks/example/slides/alphabet.js` | 氨基酸字母表，以及一段肽链的 3D 提升 | 自有 `ThreeDScene`，`Deck.molstar` 直接使用；`look.scale(s)`；`mol.opacity`；自带 `.bb-switch` 开关 |
| `talks/example/slides/design_check.js` | 设计检查：请求的原子位置用笼表示，镜头推近 | 自有 `ThreeDScene` 与局部的 `ballStick`、`cages`（未用 `atoms.js`）；`.mo-switch`；`cartoon` 的 `material` 选项 |

`talks/materials-demo/` 是材料讲稿的起点，它的 3D 部分用的是晶体附加组件，不是本章的转台。

---

## 10. Pitfalls

1. **`view.add` 与 `view.model` 混用。** `focus` 只移动 `view.model`。放在 `view.add` 里的 `M.Molecule3D` 不会被推近，也不会跟着平移。要推近，把模型做成 `Deck.ballStick` / `Deck.cages` / `Deck.cartoon` 的 THREE 对象，放进 `view.model`。
2. **`Molecule3D.scale` 只缩放位置。** 半径（`radiusScale`、`atomRadius`）和键半径（`bondRadius`）要手动乘 `SCALE`。`molecule.js` 就是这样做的。
3. **`palette.cpk` 缺 H、卤素与金属。** 它们落到粉色 `other`。用 `Deck.elementColours` 时，要自己覆盖这些元素；用 `Molecule3D` 的 `colors` 时，缺的元素回退到 Jmol 表。
4. **`Deck.cages` 的默认颜色是 `#000000`。** 一律传 `color: P.fg`。
5. **`reset()` 不取消正在进行的 `focus`。** `reset` 改了 `model.position`，但 `focus` 的动画循环还在，下一帧会把它改回去。要复位，先等 `focus` 的 Promise 结束，或者直接调 `focus([0, 0, 0], 1, 0)`。
6. **`project` 在渲染之前读的是旧矩阵。** `localToWorld` 用的是 `matrixWorld`，它在渲染时更新。在 `onRender` 里调用，或在 `focus` 之后等一帧（据源码推断，待实测）。
7. **`look` 选项。** `{ scale }` 与 `look` 合并，`look: { scale: x }` 只改外观的 Å 换算，不改 `model` 的缩放。`look: null` 关闭外观（雾、遮蔽与描边都没有）。
8. **`zoom` 与 `focus` 的 `z` 不是一回事。** `zoom` 是滚轮的上下限，`z` 是程序设置的缩放；实际距离是两者与 `view.user` 的乘积。
9. **`Deck.molstar` 会移除场景已有的灯。** 之后再加的灯会保留。
10. **滚轮会被舞台吃掉。** 鼠标停在舞台上滚动时，页面不会滚，这是预期行为。
11. **`enter` 必须对跳转安全。** `focus` 在 `animate` 为假时传 `ms = 0`；`Deck.show(frame, step, animate)` 也要传同一个 `animate`。
12. **忘了 `destroy`。** 每个转台占一个 WebGL 上下文。`deck.js` 冻结幻灯片时会调用 `destroy`，漏写会让浏览器丢掉屏幕上的上下文。
13. **`interactive` 漏写。** 没有它，触摸屏上的拖动会被当作翻页。
14. **`ballStick` 的颜色必须是 THREE.Color。** 数组与原子数相同。
15. **`ballStick.put` 不改键。** 键数在创建时定死。
16. **标签的 `transform`。** `.reveal-in.in` 会把 `transform` 设为 `none`。标签的位置用 `left` 与 `top`，偏移量在 JS 里算。
17. **每个幻灯片的 CSS 类前缀要不同。** `Deck.css` 是全局的，两张幻灯片用同名类会互相覆盖。
18. **`.deck-switch` 的 `aria-pressed`。** 切换后要 `blur()`，否则方向键会被按钮吃掉。

---

## 待确认

1. `M.Molecule3D` 是否可以放进 `view.model`。据源码，它是 manim `Mobject`（`Pn` 派生），不是 THREE.Object3D，所以 `view.model.add(mol)` 不合适，只能 `view.add`，因而不随 `focus` 平移。尚未在浏览器中实测。
2. `alphabet.js` 中对 `Molecule3D` 使用的 `mol.opacity`：`Molecule3D` 自身没有该 setter，应是继承自基类，基类行为未核实。
3. 共价半径表中有哪些元素（`Glt`），未知元素的默认值（`Vlt`）是多少；Pt 等过渡金属是否在表中。未核实。
4. `Deck.ballStick`、`Deck.cages`、`Deck.elementColours` 在仓库中没有任何直接调用（`design_check.js` 与 `alphabet.js` 各自有局部实现）。本章的示例按源码写，未在浏览器中跑过。
5. `deck.js` 中 `KEEP = 3`，而 AGENTS.md 写的是「离当前幻灯片超过 2 张就卸载」。本章以代码为准。是否修正 AGENTS.md，待作者确认。
6. `deck.css` 中有通用的 `.deck-switch`，但示例幻灯片各自复制了 `.bb-switch`（`alphabet.js`）与 `.mo-switch`（`design_check.js`）。是否统一到 `.deck-switch`，待定。
7. `project` 在 `focus` 之后、渲染之前是否读到旧位置，据源码推断，未实测。
8. `Molecule3D` 的 `order` 为 2 或 3 时的画法（平行棍的数目与间距），未核实。
9. `Molecule3D` 的 `colors` 回退到 Jmol 表的行为（`UD` 函数：精确匹配、规范化匹配、内置表、`#DDDDDD`）依据源码，未在浏览器中确认。
10. 配方 A、B、C 的完整幻灯片与 `data/pt3.js` 尚未加入任何 `talks/` 目录，也未经 `tools/check_deck.py` 检查。
