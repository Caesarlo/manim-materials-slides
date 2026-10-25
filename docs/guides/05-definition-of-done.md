# 05 收尾：什么叫“做完了”，以及怎么记录

一个 feature 只有同时满足下面全部条件才算完成。**缺任何一条都不要把它标成完成**，改成“记录阻塞原因”。

## A. 代码与检查清单

- [ ] `npx tsc --noEmit` 零错误
- [ ] `npm run verify` 通过（类型检查 + 全部单测 + 构建）
- [ ] 新增的纯逻辑有单测，断言是**手算得出的具体数值**，覆盖边界
- [ ] 新组件在画廊里有一页示范，**加在画廊末尾**（不改动已有页号）
- [ ] 示例数据不是真实数据的页面有 `note: '示意数据'`
- [ ] `npm run check -- --talk <演讲> [--slide N]` 全部 0.00%、无控制台错误；改了共用代码（`CrystalView`、`chartFrame` 等）要检查所有受影响的演讲/页
- [ ] **亲眼看过**所有新增/受影响页面的每一步截图（`check/<演讲>/live-页-步.png`）：无压字、无遮挡、无重叠、对比度够、过渡已收敛
- [ ] 文档更新：`AGENTS.md` 的组件表格；需要时 README 截图（`tools/screenshots.mjs` → `npm run shots` → README 表格）；需求有变化改 `docs/product/requirements.md`
- [ ] 遇到的新坑写进 `docs/guides/06-troubleshooting.md`
- [ ] 重大设计决策写成新的 ADR（`docs/adr/NNNN-标题.md`，并在 `docs/adr/README.md` 加一行）；**已接受的 ADR 不改，要改就新写一个并标记 supersedes**

## B. 提交

```bash
git status                  # 确认只有你这次任务的文件，没有 check/、node_modules/、dist/
git add -A
git commit                  # 提交信息：一句话概括 + 空行 + 要点（做了什么、为什么）
```
**不要 `git push`**（等使用者说推送）。

## C. 用 sdlc-harness 记录证据并完成 feature

> **顺序很重要：证据绑定的是“当前提交”。先完成 B（提交），再做下面的 verify → evidence manual → review record → feature complete。** 如果先 verify 后又提交了新内容，`feature complete` 会报 `missing passing evidence for current commit`，这时在当前提交上把 verify / evidence manual / review record 再各跑一遍即可。

`<ID>` 是 `feature_list.json` 里的 feature id，例如 `M2-PHONON-001`。

```bash
npx @caesarlo/sdlc-harness feature start <ID>          # 开始做之前执行一次（不要手改 status）
# ……做完 A、B（已提交）之后：
npx @caesarlo/sdlc-harness verify <ID>                 # 自动运行该 feature 声明的 automated 验证命令并记录证据
npx @caesarlo/sdlc-harness evidence manual <ID> --verification <第几条，从1数> --result passed --notes "怎么验证的、看到了什么"   # 每条 manual 验证各记一次
npx @caesarlo/sdlc-harness review record <ID> --reviewer <你的名字> --summary "审查了什么、结论" --result passed
npx @caesarlo/sdlc-harness feature complete <ID>       # 只有证据齐全才会成功
npx @caesarlo/sdlc-harness validate                    # 必须通过
```
- `verify` 失败 → 先修代码，不要改验证命令去迁就。
- 做不下去：`npx @caesarlo/sdlc-harness feature block <ID> --reason "具体原因"`。
- `evidence approval ...` 是“使用者批准某份文档”的记录，**只能在使用者明确同意后记录**，不要代记。

## D. 会话收尾

```bash
npx @caesarlo/sdlc-harness session close     # 报告：validate + 环境命令 + git 状态 + 下一步建议
```
然后在 `progress.md` 末尾追加一条检查点（不要改历史条目）：

```
### 2026-MM-DD <一句话标题>
- 做了：…（改了哪些文件/组件）
- 验证：…（跑了哪些命令，结果）
- 证据：feature <ID> 已 passing / 仍 in_progress / blocked（原因）
- 下一步：…（建议下一个 feature id）
- 遗留/风险：…
```
