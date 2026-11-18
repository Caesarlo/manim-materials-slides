# 06 数据图表与大模型组件

这些组件使用当前的 `Deck.slide` 契约和本地脚本，无需 npm 或联网。每个文件开头有参数示例；画廊的脚本可直接作为完整用例。画廊里的数值和模型流程均为示意，不执行真实训练、推理或检索。

## 数据图表

在 `deck.js`、`manim.js` 后按需加载以下脚本：

| 文件 | 能力 |
| --- | --- |
| `line_chart.js` | 折线、散点；线性/对数坐标、缺失值断线、裁剪和目标区域 |
| `funnel_chart.js` | 筛选漏斗与通过率 |
| `hull_chart.js` | 二元形成能凸包和离凸包距离；先加载 `line_chart.js` |
| `phonon_chart.js` | 声子色散、虚频和完整频率带隙；先加载 `line_chart.js` |
| `spectra.js` | 能带/态密度、采样点带隙分析和 XRD 高斯展宽 |

直接打开 [图表画廊](../../talks/plot-gallery/index.html) 与 [光谱画廊](../../talks/spectra-gallery/index.html) 查看演示。数据、坐标轴和每一步的 `state` 均由调用者提供，后一步继承前一步的状态。

CSV 或 TSV 可转换成离线脚本，再通过 `<script>` 加载：

```bash
python tools/prep_csv.py data.csv talks/my-talk/data/curves.js --name curves --x T --y "A,B" --source "数据来源"
```

输出写入 `window.DATA.curves`，包含 `x`、`xName` 和 `series`；在页面里用 `Deck.lineFromColumns(DATA.curves)` 转为折线序列。空值、`NA`、`nan` 和 `-` 会保留为断点；未显式选取时非数字列会跳过并提示。数值按十进制文本输出。示例数据请注明来源。

## 大模型示意

在 `deck.js` 之后依次加载 `llm_math.js`、`llm.js`、`llm_flow.js`，然后注册所需页面。`llm_math.js` 提供教学用分词、注意力、采样、PCA/近邻和消息适配逻辑；其余两个文件提供词元、注意力、候选词、块图、训练流程、Agent 回放和嵌入空间页面。可直接打开 [大模型画廊](../../talks/llm-gallery/index.html)，其中也有基于块图的 RAG 示例。

PCA 只用于二维显示，近邻计算使用原始向量；教学用词表并非真实模型词表。前进一步时，曲线、点、词元、概率柱、流程节点和连线按内容逐步展示；直接跳转和回退立即恢复目标状态。当前效果并非旧项目所有复杂动画、行内公式与布局选项的逐项复刻。标签较密集时需逐页检查；不要把画廊演示当成真实实验或模型结果。

## 晶体图例

现有晶体组件已经支持标签、晶格轴、层、超胞、图和 GNN。手工创建的晶体视图可在 `crystal.js` 后加载 `crystal_legend.js`，再调用 `Deck.crystalLegend(frame, view)`；调用其 `dim(elements)` 同步淡化，卸载时调用 `destroy()`。[晶体画廊](../../talks/crystal-gallery/index.html)使用显式键长重现旧示例；项目默认仍使用 JmolNN 规则，二者不一定产生相同的键。

## 验证

可运行 `node tools/test-plots.mjs`、`node tools/test_spectra.cjs`、`node tools/test_llm.cjs`、`node tools/test_llm_motion.cjs`、`node tools/test_crystal_gallery.cjs` 和 `python tools/test_prep_csv.py` 检查计算、动画与状态逻辑。实际讲稿仍应使用 `python tools/check_deck.py talks/<name> --back`，检查每一步、两种主题、截图和浏览器控制台。
