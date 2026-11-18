# /// script
# requires-python = ">=3.10"
# dependencies = ["gemmi"]
# ///
"""Turn a crystal structure (CIF) into the unit cell web/addons/crystal.js draws.

    uv run tools/prep_crystal.py tools/samples/SrTiO3.cif talks/materials-demo/data/srtio3.js --name "SrTiO₃"
    uv run tools/prep_crystal.py tools/samples/Bi2Te3.cif talks/materials-demo/data/bi2te3.js --name "Bi₂Te₃"

Writes <out>.js (and <out>.json); the .js sets window.DATA["<out stem>"], so a deck page that loads it with a
<script> tag works straight from disk (browsers will not fetch JSON from file://).

- The cell's own atoms only, with the space group's symmetry already applied: `lattice` (three vectors, Å,
  Cartesian) and `atoms` (element, fractional coordinates in [0, 1)).
- Bonds and polyhedra are not stored: crystal.js finds them in the browser with pymatgen's bonding rule,
  exported by tools/export_bond_rules.py (web/addons/bond_rules.js).

Needs gemmi (uv installs it from the header above). The bonding rule is pymatgen's, exported separately.
"""

import argparse
import json
from pathlib import Path

import gemmi

EPS = 1e-6


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cif")
    ap.add_argument("out", help="output .js (a .json is written next to it)")
    ap.add_argument("--name", help="display name (default: the reduced formula)")
    a = ap.parse_args()

    # gemmi expands the symmetry from the space-group name when a CIF lists no operations (pymatgen would fall
    # back to P1 and keep only the asymmetric unit)
    small = gemmi.read_small_structure(a.cif)
    m = small.cell.orth.mat.tolist()  # columns = the lattice vectors a, b, c
    atoms = []
    for site in small.get_all_unit_cell_sites():
        frac = [round(x % 1.0, 6) for x in (site.fract.x, site.fract.y, site.fract.z)]
        frac = [0.0 if abs(x - 1.0) < EPS else x + 0.0 for x in frac]
        atoms.append({"el": site.element.name, "frac": frac})
    data = {
        "name": a.name or small.name or Path(a.cif).stem,
        "spacegroup": small.spacegroup_hm,
        "lattice": [[round(m[r][c], 6) + 0.0 for r in range(3)] for c in range(3)],
        "atoms": atoms,
        "source": Path(a.cif).name,
    }
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix(".json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    out.write_text(
        f'(window.DATA = window.DATA || {{}})["{out.stem}"] = {json.dumps(data, ensure_ascii=False)};\n',
        encoding="utf-8",
    )
    print(f"{out}: {len(atoms)} atoms in the cell, {data['spacegroup']}")


if __name__ == "__main__":
    main()
