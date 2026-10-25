# /// script
# requires-python = ">=3.10"
# dependencies = ["gemmi"]
# ///
"""CIF → src/packs/materials 的 Crystal 数据（TypeScript 模块）。

用法（uv 会自动装 gemmi，不需要手动建环境）：
    uv run tools/cif_to_ts.py path/to/Bi2Te3.cif src/talk/data/bi2te3.ts [--name "Bi₂Te₃"] [--export Bi2Te3]

做的事：按 CIF 里的空间群展开对称操作，得到晶胞内全部原子的分数坐标，再连同晶格矢量（Å，笛卡尔）
写成 `Crystal` 对象。幻灯片里 import 它，交给 crystalSlide / build 使用。
数据来源请在输出文件头部的注释里保留（脚本会写入原 CIF 文件名）。
"""
import argparse
import re
from pathlib import Path

import gemmi


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cif")
    ap.add_argument("out")
    ap.add_argument("--name", help="显示名，默认取化学式")
    ap.add_argument("--export", help="导出的变量名，默认由文件名生成")
    a = ap.parse_args()

    small = gemmi.read_small_structure(a.cif)
    sites = small.get_all_unit_cell_sites()  # 已按空间群展开、去重
    m = small.cell.orth.mat.tolist()  # 列向量 = 晶格矢量 a, b, c 的笛卡尔分量
    lattice = [[round(m[r][c], 6) + 0.0 for r in range(3)] for c in range(3)]

    atoms = []
    for s in sites:
        el = s.element.name
        f = [round(x % 1.0, 6) for x in (s.fract.x, s.fract.y, s.fract.z)]
        f = [0.0 if abs(x - 1.0) < 1e-6 else x for x in f]
        atoms.append((el, f))

    stem = Path(a.cif).stem
    var = a.export or re.sub(r"\W", "_", stem)
    name = a.name or small.name or stem
    lines = [
        f"// 由 tools/cif_to_ts.py 生成，来源：{Path(a.cif).name}（空间群 {small.spacegroup_hm}，{len(atoms)} 个原子/晶胞）。不要手改。",
        "import type { Crystal } from '@/packs/materials/structure'",
        "",
        f"export const {var}: Crystal = {{",
        f"  name: '{name}',",
        f"  lattice: {lattice},",
        "  atoms: [",
    ]
    lines += [f"    {{ el: '{el}', frac: [{f[0]}, {f[1]}, {f[2]}] }}," for el, f in atoms]
    lines += ["  ],", "}", ""]
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text("\n".join(lines), encoding="utf-8")
    print(f"{a.out}: {len(atoms)} atoms, lattice a={small.cell.a:.3f} b={small.cell.b:.3f} c={small.cell.c:.3f}, {small.spacegroup_hm}")


if __name__ == "__main__":
    main()
