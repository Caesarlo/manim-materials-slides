# 架构概览

```
浏览器
 └─ src/main.ts            按 ?talk=名称 加载 src/talks/<名称>/talk.ts
     └─ runtime/deck.ts    注册页面、步进/回退、URL 哈希、备注(S)/总览(O)/全屏(F)；window.__deck 供检查脚本读取
         └─ 一页 = SlideDef { name, steps, notes, mount(frame, ctx) → { enter(step, animate), destroy() } }

页面的三种写法（都满足 enter 幂等，见 ADR 0002）
 ├─ manim 舞台   runtime/manimStage.ts  build + steps；向前一步播放，其余重建并瞬间应用；morphTex 做公式变形
 ├─ 声明式图表   packs/plot/chartSlide.ts  state 浅合并 → ChartInstance.apply(state)；动画全靠 CSS 过渡
 └─ 声明式晶体   packs/materials/crystalSlide.ts  步骤字段继承 → CrystalView（three.js，目标值 + 阻尼）

组件包
 ├─ packs/plot       scale、chartFrame（SVG 坐标轴）、lineChart、barChart、bandChart、scatterChart、hullChart、funnel、xrdChart
 ├─ packs/llm        tokenize、attentionMath、sampling、blockLayout、agentTrace + 对应图表
 └─ packs/materials  structure（晶体→原子/键/多面体）、graph（晶体图）、labels、CrystalView

数据
 ├─ tools/cif_to_ts.py   CIF → 晶体数据（gemmi 展开对称操作）
 ├─ tools/csv_to_ts.py   CSV → 折线图数据
 └─ LangChain 消息数组 → agentTrace.fromMessages → 回放

验证
 ├─ npm run verify   tsc + vitest + vite build（CI 跑这个）
 └─ npm run check    无头 Chrome 逐页逐步检查：控制台错误 + “点过来 vs 直接跳”截图一致（本地合并前跑）
```

设计依据见 [docs/adr/](../adr/README.md)；怎么新增组件/演讲见 [docs/guides/](../guides/README.md)。
