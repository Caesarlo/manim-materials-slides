// SrTiO3: 1 the 2×2×1 cell; 2 four TiO6 octahedra; 3 lattice vectors.
// Data: tools/samples/SrTiO3.cif via talks/materials-demo/data/srtio3.js; sample CIF source is unrecorded.
Deck.crystalSlide({
  name: 'crystal-supercell', data: 'srtio3', heading: 'SrTiO₃: 2 × 2 × 1',
  repeat: [2, 2, 1], polyhedra: ['Ti'], polyhedronLigands: ['O'], bondCutoffs: { 'O-Ti': 2.2 },
  notes: 'Explicit Ti–O cutoff of 2.2 Å matches the earlier example; the lattice arrows show the single-cell vectors.',
  steps: [
    { title: 'Supercell', sub: 'Two cells along a and b', show: { cell: 1, atoms: 1 }, labels: 1 },
    { title: 'Four octahedra', sub: 'The TiO₆ units share corners', show: { bonds: 1, polyhedra: 1 }, dim: ['Sr'] },
    { title: 'Lattice vectors', sub: 'The arrows show one cell', axes: 1, dim: [] },
  ],
});
