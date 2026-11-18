// Perovskite SrTiO3 with the crystal component: the cubic cell, pymatgen's bonds, the TiO6 octahedron, and the
// a/b/c vectors with element labels. Data: data/srtio3.js (tools/prep_crystal.py from tools/samples/SrTiO3.cif).
//
// Steps: 1 the unit cell · 2 bonds · 3 TiO6 octahedron, Sr faded, camera in · 4 labels and lattice vectors.
Deck.crystalSlide({
  name: 'srtio3',
  data: 'srtio3',
  heading: 'Perovskite SrTiO₃',
  polyhedra: ['Ti'],
  notes: 'Cubic Pm-3m, a = 3.905 Å. Bonds come from pymatgen\'s JmolNN rule (web/addons/bond_rules.js): '
    + 'two atoms are bonded when the distance is at most the sum of their radii plus 0.45 Å. Drag to turn, scroll to zoom.',
  steps: [
    { title: 'The unit cell', sub: 'Pm‑3m, a = 3.905 Å, five atoms', show: { cell: 1, atoms: 1 } },
    { title: 'Bonds', sub: 'pymatgen\'s rule: d ≤ r(a) + r(b) + 0.45 Å', show: { bonds: 1 } },
    { title: 'TiO₆ octahedron', sub: 'Ti sits in the middle of six O; Sr fades', show: { polyhedra: 1 },
      dim: ['Sr'], fly: { dir: [1, 0.6, 0.5], zoom: 1.5 } },
    { title: 'Elements and lattice vectors', sub: 'a, b, c from the cell\'s origin corner', labels: 1, axes: 1,
      dim: [], fly: {} },
  ],
});
