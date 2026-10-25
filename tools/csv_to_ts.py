# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""CSV → TypeScript 数据模块（给折线图 fromColumnTable 等使用）。

用法（无第三方依赖）：
    uv run tools/csv_to_ts.py in.csv out.ts --name zTData [--x T] [--y "A,B,C"] [--source "来源说明"]

输出形状固定为（不 import、不写类型标注）：
    export const zTData = {
      xName: 'T',
      x: [300, 350],
      series: [
        { name: 'A', y: [0.31, null] },
      ],
    }

规则：第一行是表头；以 # 开头的行是注释，原样写进输出文件头部；空单元格 / NA / nan / - → null；
数值以十进制字符串解析后输出，不经过 float，保持原精度；支持 UTF-8（可带 BOM）、逗号或制表符分隔。
"""
import argparse
import csv
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

NULL_TOKENS = {"", "na", "nan", "-"}
NUM_RE = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")
IDENT_RE = re.compile(r"^[A-Za-z_$][A-Za-z0-9_$]*$")


class CsvError(Exception):
    """用户可读的中文错误。"""


def normalize_number(s: str) -> str | None:
    """把数字字符串规范化为 JS 可用的十进制字面量；不是数字返回 None。"""
    s = s.strip()
    if not NUM_RE.match(s):
        return None
    try:
        d = Decimal(s)
    except InvalidOperation:
        return None
    if d != 0 and abs(d.adjusted()) > 30:  # 极大/极小数保留指数形式，避免输出几百位
        return f"{d.normalize():e}".replace("E", "e")
    if d == 0:
        return "0"
    out = format(d, "f")
    if "." in out:
        out = out.rstrip("0").rstrip(".")
    return out or "0"


def is_null(cell: str) -> bool:
    return cell.strip().lower() in NULL_TOKENS


def ts_str(s: str) -> str:
    """转成 TS 单引号字符串字面量。"""
    s = (
        s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
        .replace("\r", "\\r").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    )
    return f"'{s}'"


def convert(text: str, name: str, x: str | None = None, y: str | None = None,
            source: str = "") -> tuple[str, list[str]]:
    """返回 (TS 源码, 警告列表)。出错抛 CsvError。"""
    if not IDENT_RE.match(name):
        raise CsvError(f"--name 不是合法的 TS 标识符：{name!r}")
    comments: list[str] = []
    body: list[str] = []
    for line in text.splitlines():
        if line.startswith("#"):
            comments.append(line[1:].rstrip())
        elif line.strip():
            body.append(line)
    if not body:
        raise CsvError("CSV 里没有表头行（除注释和空行外没有内容）。")
    delim = "\t" if body[0].count("\t") > body[0].count(",") else ","
    rows = list(csv.reader(body, delimiter=delim))
    header = [h.strip() for h in rows[0]]
    data = rows[1:]
    if not data:
        raise CsvError("CSV 只有表头，没有数据行。")
    if len(set(header)) != len(header):
        dup = sorted({h for h in header if header.count(h) > 1})
        raise CsvError(f"表头有重复列名：{', '.join(dup)}")
    for i, r in enumerate(data, start=1):
        if len(r) != len(header):
            raise CsvError(f"第 {i} 个数据行有 {len(r)} 列，表头是 {len(header)} 列。")

    def col_index(col: str, what: str) -> int:
        if col not in header:
            raise CsvError(f"{what} 指定的列 {col!r} 不在表头中。可用列：{', '.join(header)}")
        return header.index(col)

    xi = col_index(x, "--x") if x is not None else 0
    xs: list[str] = []
    for n, r in enumerate(data, start=1):
        v = normalize_number(r[xi])
        if v is None:
            raise CsvError(f"x 列 {header[xi]!r} 第 {n} 个数据行 {r[xi]!r} 不是数字。")
        xs.append(v)

    warnings: list[str] = []
    if y is not None:
        names = [c.strip() for c in y.split(",") if c.strip()]
        if not names:
            raise CsvError("--y 为空。")
        yis = [col_index(c, "--y") for c in names]
        if xi in yis:
            raise CsvError(f"--y 不能包含 x 列 {header[xi]!r}。")
    else:
        yis = [i for i in range(len(header)) if i != xi]
    series: list[tuple[str, list[str]]] = []
    for i in yis:
        vals: list[str] = []
        bad = None
        for n, r in enumerate(data, start=1):
            c = r[i]
            if is_null(c):
                vals.append("null")
                continue
            v = normalize_number(c)
            if v is None:
                bad = (n, c)
                break
            vals.append(v)
        if bad is None and all(v == "null" for v in vals):
            bad = (0, "")  # 全空列
        if bad is not None:
            if y is not None:
                if bad[0] == 0:
                    raise CsvError(f"y 列 {header[i]!r} 全是空值。")
                raise CsvError(f"y 列 {header[i]!r} 第 {bad[0]} 个数据行 {bad[1]!r} 不是数字。")
            warnings.append(f"已跳过非数值列 {header[i]!r}。")
            continue
        series.append((header[i], vals))
    if not series:
        raise CsvError("没有可用的数值 y 列。")

    lines = [f"// 由 tools/csv_to_ts.py 生成，来源：{' '.join(source.split())}。不要手改。"]
    lines += [f"//{c}" for c in comments]
    lines += [
        f"export const {name} = {{",
        f"  xName: {ts_str(header[xi])},",
        f"  x: [{', '.join(xs)}],",
        "  series: [",
    ]
    lines += [f"    {{ name: {ts_str(n)}, y: [{', '.join(v)}] }}," for n, v in series]
    lines += ["  ],", "}", ""]
    return "\n".join(lines), warnings


def main() -> int:
    ap = argparse.ArgumentParser(description="CSV → TypeScript 数据模块")
    ap.add_argument("csv")
    ap.add_argument("out")
    ap.add_argument("--name", required=True, help="导出的变量名，如 zTData")
    ap.add_argument("--x", help="x 列名，默认第一列")
    ap.add_argument("--y", help="y 列名，逗号分隔；默认其余全部数值列")
    ap.add_argument("--source", help="来源说明，默认 CSV 文件名")
    a = ap.parse_args()
    for stream in (sys.stdout, sys.stderr):  # Windows 控制台默认 GBK，统一输出 UTF-8
        stream.reconfigure(encoding="utf-8")
    try:
        try:
            text = Path(a.csv).read_bytes().decode("utf-8-sig")
        except FileNotFoundError:
            raise CsvError(f"找不到文件：{a.csv}")
        except UnicodeDecodeError:
            raise CsvError(f"{a.csv} 不是 UTF-8 编码。")
        ts, warnings = convert(text, a.name, a.x, a.y, a.source or Path(a.csv).name)
    except CsvError as e:
        print(f"错误：{e}", file=sys.stderr)
        return 1
    for w in warnings:
        print(f"提示：{w}", file=sys.stderr)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(ts, encoding="utf-8", newline="\n")
    print(f"{a.out}: {a.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
