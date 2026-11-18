#!/usr/bin/env python3
"""Check that the docs have not drifted from the code. Exit 1 with a list of problems; 0 if there are none.

    python tools/check_docs.py

Checks:
  a. every web/*.js and web/addons/*.js starts with a `//` header comment of at least 3 lines;
  b. every one of those files is named (by file name) somewhere in AGENTS.md;
  c. docs/components.md is up to date with the headers (tools/gen_components.py --check);
  d. every talks/<name>/ has an index.html, and every talks/<name>/slides/*.js starts with a `//` comment.
  e. docs/handbook/*.md exist and mention only components that exist (every Deck.<name> is defined in web/, every
     M.<Class> is in the manim-web bundle).

Problems in talks/example/ (upstream's demo, read-only here) are warnings: printed, exit code unaffected.
Standard library only.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import gen_components as gen  # noqa: E402

ROOT = gen.ROOT
UPSTREAM_TALKS = {"example"}


def _first_line(path: Path) -> str:
    text = path.read_text(encoding="utf-8-sig")
    return next((line.strip() for line in text.split("\n") if line.strip()), "")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    errors: list[str] = []
    warnings: list[str] = []
    sources = gen.source_files(ROOT)

    # a. header comments
    for path in sources:
        name = gen.rel(path)
        n = sum(1 for line in gen.header_lines(path) if line.strip())
        if n < 3:
            errors.append(f"{name}: header comment has {n} non-blank `//` line(s); need at least 3 at the top of the file")

    # b. every component is named in AGENTS.md
    agents_path = ROOT / "AGENTS.md"
    if agents_path.is_file():
        agents = agents_path.read_text(encoding="utf-8")
        for path in sources:
            if not re.search(r"(?<!\w)" + re.escape(path.name) + r"(?!\w)", agents):
                errors.append(f"{gen.rel(path)}: not mentioned by file name ({path.name}) in AGENTS.md")
    else:
        errors.append("AGENTS.md is missing")

    # c. generated component index is current
    ok, message = gen.check(ROOT)
    if not ok:
        errors.append(message)

    # e. the handbook (docs/handbook/*.md) only names components that exist: every Deck.<name> is found in web/,
    #    every M.<Class> in the manim-web bundle (placeholders such as Deck.xxx are ignored)
    handbook = ROOT / "docs" / "handbook"
    chapters = sorted(handbook.glob("*.md")) if handbook.is_dir() else []
    if not chapters:
        errors.append("docs/handbook/: no chapters found")
    web_text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in sources)
    bundle_path = ROOT / "vendor" / "manim-web" / "manim-web.iife.js"
    bundle = bundle_path.read_text(encoding="utf-8", errors="replace") if bundle_path.is_file() else ""
    placeholders = {"xxx", "name", "x"}
    for chapter in chapters:
        text = chapter.read_text(encoding="utf-8")
        for name in sorted(set(re.findall(r"\bDeck\.([A-Za-z_]\w*)", text)) - placeholders):
            if not re.search(r"\b" + re.escape(name) + r"\b", web_text):
                errors.append(f"{gen.rel(chapter)}: mentions Deck.{name}, which is not defined in web/")
        if bundle:
            for name in sorted(set(re.findall(r"\bM\.([A-Z]\w*)", text))):
                if not re.search(r"\b" + re.escape(name) + r"\b", bundle):
                    errors.append(f"{gen.rel(chapter)}: mentions M.{name}, which is not in the manim-web bundle")

    # d. talks
    talks = ROOT / "talks"
    if talks.is_dir():
        for talk in sorted(p for p in talks.iterdir() if p.is_dir() and not p.name.startswith(".")):
            sink = warnings if talk.name in UPSTREAM_TALKS else errors
            label = gen.rel(talk)
            if not (talk / "index.html").is_file():
                sink.append(f"{label}/: no index.html")
            for slide in sorted((talk / "slides").glob("*.js")):
                first = _first_line(slide)
                if not first.startswith("//"):
                    sink.append(f"{gen.rel(slide)}: first line must be a `//` comment listing the slide's steps")

    if errors:
        print(f"FAIL: {len(errors)} error(s), {len(warnings)} warning(s)")
        for e in errors:
            print(f"  error: {e}")
    else:
        print(f"OK: docs checks pass ({len(sources)} components, {len(list(talks.glob('*/'))) if talks.is_dir() else 0} talk folders)")
    for w in warnings:
        print(f"  warning: {w}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
