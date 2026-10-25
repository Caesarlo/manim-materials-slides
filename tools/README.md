# tools：数据转换脚本

都是 uv 的 PEP 723 内联依赖脚本，直接 `uv run` 即可，不需要手动建环境。

## cif_to_ts.py：CIF → 晶体结构

```bash
uv run tools/cif_to_ts.py Bi2Te3.cif src/talks/example/data/bi2te3.ts --name "Bi₂Te₃" --export Bi2Te3
```

按 CIF 的空间群展开对称操作，输出 `Crystal` 对象（晶格矢量 Å + 晶胞内全部原子的分数坐标），
`import type { Crystal } from '@/packs/materials/structure'`。依赖 gemmi（uv 自动安装）。

## csv_to_ts.py：CSV → 折线图数据

```bash
uv run tools/csv_to_ts.py in.csv out.ts --name zTData [--x T] [--y "A,B,C"] [--source "来源说明"]
```

无第三方依赖。输出形状固定，不 import、不写类型标注：

```ts
// 由 tools/csv_to_ts.py 生成，来源：<--source 或 CSV 文件名>。不要手改。
export const zTData = {
  xName: 'T',
  x: [300, 350],
  series: [
    { name: 'A', y: [0.31, null] },
  ],
}
```

规则：

- 第一行是表头；`--x` 指定 x 列（默认第一列，必须全是数字，保持出现顺序）；`--y` 指定 y 列（默认其余全部数值列，非数值列会跳过并在 stderr 提示）。
- 空单元格、`NA`、`nan`、`-` 输出为 `null`。
- 以 `#` 开头的行是注释，会原样写进输出文件头部（用来保留单位和来源）。
- 数值按十进制字符串解析，保持原精度（`0.1`、`0.30000000000000004` 原样输出，不经过浮点重新格式化）。
- 支持 UTF-8 / 带 BOM 的 UTF-8，逗号或制表符分隔自动识别。
- 出错时给中文错误信息并以非零码退出。

示例（示意数据，非实测）：

```bash
uv run tools/csv_to_ts.py tools/samples/zT_vs_T.csv src/talks/dev-tools/data/zt.ts --name zTData
uv run tools/test_csv_to_ts.py     # 运行测试，通过打印“全部通过”
```
