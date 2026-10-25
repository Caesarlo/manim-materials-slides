# 01 开工前必读

## 这个项目是什么（一句话）

做汇报用的“点击逐步推进”演示模板：TypeScript + Vite，动画用 manim-web，3D 晶体用 three.js，图表是自己写的 SVG 组件。一场汇报 = `src/talks/<名称>/` 下的一个目录。

## 项目地图（只记这些就够）

```
src/
  main.ts                 入口：按网址 ?talk=名称 加载 src/talks/<名称>/talk.ts（默认 example）
  runtime/                运行时（翻页、步进、备注、总览、调色板、公式）——一般不要改
  packs/
    plot/                 图表底座 + 各图表（chartFrame、chartSlide、lineChart、barChart、funnel…）
    llm/                  大模型组件（词元、注意力、采样、块图、Agent 回放）
    materials/            晶体：structure.ts（数据）、CrystalView.ts（three.js）、crystalSlide.ts（声明式页面）
  talks/
    example/              示例演讲（5 页）
    gallery/              图表 + 晶体画廊（每个组件一页）——也是回归检查
    gallery-llm/          大模型组件画廊
tools/
  check-deck.mjs          无头浏览器检查（npm run check）
  screenshots.mjs         生成 README 截图（npm run shots）
  cif_to_ts.py            CIF → 晶体数据（uv run）
  csv_to_ts.py            CSV → 折线图数据（uv run）
docs/                     需求、ADR、本手册
feature_list.json         待办（sdlc-harness 管理，不要手改状态）
progress.md               每次会话的记录
```

## 每次会话的固定动作

开工：
```bash
cd D:\work\project_code\https-group\v1\manim-materials-slides
npx @caesarlo/sdlc-harness validate      # 必须通过
npx @caesarlo/sdlc-harness status        # 看当前该做哪个 feature
```
然后读 `progress.md` 最后一条记录，再读你要做的 feature 在 `feature_list.json` 里的 `behavior`、`notes`、`verification`。

收尾：见 [05-definition-of-done.md](05-definition-of-done.md)。

## 日常命令

| 命令 | 作用 | 耗时 |
|---|---|---|
| `npm run dev` | 开发服务器 http://localhost:4100 ；`?talk=gallery#/3/2` 直达第 3 页第 2 步 | — |
| `npm run verify` | 类型检查 + 全部单测 + 生产构建 | 约 20 秒 |
| `npx vitest run src/packs/plot/xxx.test.ts` | 只跑某个测试文件 | 几秒 |
| `npm run check -- --talk gallery --slide 14` | 无头浏览器检查**某一页**（逐步跳转 + 对比“点过来 vs 直接跳”） | 约 30 秒 |
| `npm run check -- --talk gallery` | 检查整个演讲 | 约 8 分钟 |
| `npm run shots` | 重新生成 README 截图（docs/images/） | 约 3 分钟 |

检查产生的截图在 `check/<演讲名>/live-页-步.png`，**一定要用图片查看工具亲眼看**：文字压图、颜色看不清、标签重叠都不会报错。

## 绝对不要做的事

1. **不要手改** `feature_list.json` 里的 `status` 和 `evidence`；用 `sdlc-harness` 命令（见 05）。
2. **不要**用 `requestAnimationFrame` / `setTimeout` 驱动页面状态（会破坏“跳转 == 点过来”，见 ADR 0002）。动画用 CSS 过渡（给元素加 class `tr`）。
3. **不要**在幻灯片里写死颜色十六进制或 px 字号；颜色用 `palette`（`@/runtime/palette`），文字 ≥ 28 个 viewBox 单位。
4. **不要**编造数据：不是真实测量/计算的数据，页面必须有“示意数据”小注（`note: '示意数据'`），材料用 A/B/C 泛称。
5. **不要**直接用 `new M.TransformMatchingTex(...)`，用 `morphTex`（见 ADR 0001）。
6. **不要**改 `src/runtime/**`、`src/packs/plot/{scale,chartFrame,chartSlide}.ts`，除非 feature 明确要求；觉得底座有 bug 就停下来记录，不要绕着改。
7. **不要** `git push`、不要选许可证、不要代使用者批准任何文档——这些需要使用者本人决定。
8. **不要**复制没有 LICENSE 的第三方仓库的代码。
9. Windows 上用 shell heredoc 写含反斜杠（LaTeX）的文件会被吞掉反斜杠：**用编辑器工具写文件**，TS 里写 LaTeX 用 `String.raw`。
10. 一次只做一个 feature；做完走 05 的收尾流程再开始下一个。
