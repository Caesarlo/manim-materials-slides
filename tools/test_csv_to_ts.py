# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""csv_to_ts.py 的测试：uv run tools/test_csv_to_ts.py"""
import importlib.util
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location("csv_to_ts", HERE / "csv_to_ts.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SCRIPT = str(HERE / "csv_to_ts.py")


def conv(text, **kw):
    return m.convert(text, kw.pop("name", "d"), **kw)


def raises(text, frag, **kw):
    try:
        conv(text, **kw)
    except m.CsvError as e:
        assert frag in str(e), str(e)
        return
    raise AssertionError("应当报错")


def run(*args):
    return subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def test_basic_shape():
    ts, w = conv("T,A,B\n300,0.31,1\n350,0.45,2\n", source="s.csv")
    exp = (
        "// 由 tools/csv_to_ts.py 生成，来源：s.csv。不要手改。\n"
        "export const d = {\n  xName: 'T',\n  x: [300, 350],\n  series: [\n"
        "    { name: 'A', y: [0.31, 0.45] },\n    { name: 'B', y: [1, 2] },\n  ],\n}\n"
    )
    assert ts == exp, ts
    assert w == []


def test_nulls():
    ts, _ = conv("T,A\n1,\n2,NA\n3,nan\n4,-\n5,7\n")
    assert "y: [null, null, null, null, 7]" in ts


def test_comments_preserved():
    ts, _ = conv("# 单位：K\n# 示意数据\nT,A\n1,2\n# 中间注释\n2,3\n")
    lines = ts.splitlines()
    assert lines[1] == "// 单位：K" and lines[2] == "// 示意数据", lines
    assert lines[3] == "// 中间注释", lines
    assert "x: [1, 2]" in ts


def test_bom_and_file():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "a.csv"
        p.write_bytes("\ufeffT,A\n1,2\n".encode("utf-8"))
        o = Path(d) / "sub" / "o.ts"
        r = run(str(p), str(o), "--name", "z")
        assert r.returncode == 0, r.stderr
        t = o.read_text(encoding="utf-8")
        assert "xName: 'T'" in t and "来源：a.csv" in t and "\ufeff" not in t


def test_tab():
    ts, _ = conv("T\tA\tB\n1\t2\t3\n")
    assert "name: 'B', y: [3]" in ts


def test_column_selection():
    ts, _ = conv("A,T,B,C\n9,1,2,3\n8,2,4,6\n", x="T", y="C,B")
    assert "xName: 'T'" in ts and "x: [1, 2]" in ts
    assert ts.index("name: 'C'") < ts.index("name: 'B'") and "name: 'A'" not in ts


def test_skip_non_numeric_warns():
    ts, w = conv("T,A,tag\n1,2,foo\n2,3,bar\n")
    assert "'tag'" not in ts and any("tag" in s for s in w)


def test_escape():
    ts, _ = conv('T,"it\'s ""q"" \\x"\n1,2\n')
    assert "name: 'it\\'s \"q\" \\\\x'" in ts, ts


def test_float_exact():
    ts, _ = conv("T,A\n0.1,0.30000000000000004\n1e3,0.10\n.5,-0.0\n")
    assert "x: [0.1, 1000, 0.5]" in ts, ts
    assert "y: [0.30000000000000004, 0.1, 0]" in ts, ts
    ts, _ = conv("T,A\n1,0.1\n2,0.2\n")
    assert "y: [0.1, 0.2]" in ts and "0.30000000000000004" not in ts


def test_errors():
    raises("T,A\nabc,1\n", "不是数字")
    raises("T,A\n,1\n", "不是数字")
    raises("T,A\n1,x\n", "不是数字", y="A")
    raises("T,A\n1,1\n", "不在表头", x="Q")
    raises("T,A\n1,1\n", "不在表头", y="Q")
    raises("T,A\n1,1,2\n", "列")
    raises("T,T\n1,1\n", "重复")
    raises("# only\n", "表头")
    raises("T,A\n", "没有数据")
    raises("T,A\n1,1\n", "标识符", name="1bad")
    raises("T,tag\n1,a\n", "没有可用")


def test_exit_code():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "bad.csv"
        p.write_text("T,A\nx,1\n", encoding="utf-8")
        o = Path(d) / "o.ts"
        r = run(str(p), str(o), "--name", "z")
        assert r.returncode != 0 and "错误" in r.stderr and not o.exists()
        r = run(str(Path(d) / "none.csv"), str(o), "--name", "z")
        assert r.returncode != 0 and "找不到" in r.stderr


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    fails = 0
    tests = [(k, v) for k, v in globals().items() if k.startswith("test_") and callable(v)]
    for k, v in tests:
        try:
            v()
        except Exception as e:  # noqa: BLE001
            fails += 1
            print(f"失败 {k}: {e!r}")
    if fails:
        print(f"{fails}/{len(tests)} 个测试失败")
        return 1
    print(f"全部通过（{len(tests)} 项）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
