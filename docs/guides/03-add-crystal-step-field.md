# 03 给 3D 晶体视图新增一种“步骤里可声明的效果”

**适用**：要在 `crystalSlide` 的步骤里新增一个字段（例如已有的 `labels`、`highlight`、`layer`、`nodes`、`gnn`）。
**参考**：`gnn` 与 `nodes` 是最近加的，照着它们的做法（`git log -p -S"setGnn" -- src/packs/materials` 可以看当时的完整改动）。

## 先理解两件事

1. **步骤继承**：`crystalSlide` 在 `enter(step)` 时把第 1..step 步的字段按顺序“后覆盖前”合并，得到**完整状态**，再一次性交给 `CrystalView`。所以你的新字段也必须遵守：省略 = 沿用上一步；`null` = 取消。
2. **目标值 + 阻尼**：`CrystalView` 里有个内部渲染循环，每帧让“当前值”朝“目标值”逼近（见 `private loop`、`smooths()`、`applyOpacity()`）。**新效果必须做成“设置目标值”，而不是“播放一段随时间的动画”**，这样 `snap()`（跳转时瞬间到位）才能和“点过来”得到同一画面。

## 步骤

### 1. 纯逻辑（放 `structure.ts` 或 `graph.ts`，有单测）
把“哪些原子/键受影响”这种判断写成纯函数，并在 `structure.test.ts` / `graph.test.ts` 里用**手算的数**测试（例：SrTiO₃ 的 Ti 有 6 个 O 邻居；Bi₂Te₃ 的 Bi 有 6 个 Te 邻居）。

### 2. `CrystalView.ts`：加方法 + 目标值
- 加一个公共方法，例如 `setXxx(spec | null)`：**只写目标值**（比如每个原子一个 `targetXxx[i]`），不要在这里做动画。
- 在 `smooths()` 里把新的“当前值/目标值”加进去，让它参与阻尼；在 `snap()` 里让当前值 = 目标值。
- 在 `applyOpacity()`（或相应的应用函数）里把“当前值”变成画面（透明度、缩放、颜色…）。
- 颜色用 `palette`，不要写十六进制。

### 3. `crystalSlide.ts`：加字段 + 合并 + 调用
- 在 `CrystalStep` 接口里加字段，写清注释（省略沿用上一步、`null` 取消）。
- 在 `enter()` 的合并循环里加：`if (s.xxx !== undefined) xxx = s.xxx`（`null` 也要生效，所以用 `!== undefined` 判断）。
- 调用 `view.setXxx(xxx)`，并确保 `!animate` 的分支里也走到（它会调用 `view.snap()`）。
- 更新文件头部的示例注释。

### 4. 示范页
在 `src/talks/gallery/slides/` 加一页（或在已有晶体页上加几步），数据用 `@/talks/example/data/srtio3` 或 `bi2te3`。旁白写明这一步在讲什么。

### 5. 回归检查（必须）
你改的是共用的 `CrystalView.ts`，所以**所有晶体页都要重新检查**：
```bash
npx tsc --noEmit
npx vitest run src/packs/materials
npm run check -- --talk example --slide 4
npm run check -- --talk example --slide 5
npm run check -- --talk gallery --slide 10
npm run check -- --talk gallery --slide 11
npm run check -- --talk gallery --slide 12
npm run check -- --talk gallery --slide 13
```
全部要 0.00%。然后亲眼看截图：被影响/被压暗的原子是否和你手算的集合一致？

## 常见坑

- 忘了在 `snap()` 里同步当前值 → 跳转时画面和点过来不一致（检查会报差异）。
- 在 `loop` 里用时间做动画（`performance.now()`）→ 不可复现。只允许“朝目标值阻尼”。
- 标签/引线要跟随相机，更新位置放在 `updateOverlays()`（`onRender`），不要另起定时器。
- 晶体坐标 **z 轴朝上**（c 轴竖直）。细长晶胞用 `orientation` 旋转（见 `gallery/slides/bi2te3.ts`），旋转后 `fly.dir` 是旋转后的场景坐标。
- 俯视用 `dir: [0.001, 0.001, 1]`，不要写恰好 `[0, 0, 1]`（退化）。
- 元素颜色表里没有的元素，在 `src/runtime/palette.ts` 的 `cpk` 里补一个（不要在晶体代码里写颜色）。
