// Bi2Te3: 1 element labels; 2 lattice vectors; 3 highlight Bi; 4 focus one quintuple layer.
// Data: tools/samples/Bi2Te3.cif via talks/materials-demo/data/bi2te3.js; sample CIF source is unrecorded.
Deck.crystalSlide({
  name: 'crystal-layers', data: 'bi2te3', heading: 'Bi₂Te₃: layers', polyhedra: ['Bi'],
  polyhedronLigands: ['Te'], bondCutoffs: { 'Bi-Te': 3.45 }, orientation: [0, Math.PI / 2, 0],
  notes: 'Explicit Bi–Te cutoff of 3.45 Å matches the earlier example. The highlighted slab is selected by fractional coordinate along c.',
  steps: [
    { title: 'Elements', sub: 'Bi and Te in a hexagonal cell', show: { cell: 1, atoms: 1 }, labels: 1, fly: { dir: [0.5, -1, 0.45], zoom: 1.5 } },
    { title: 'Lattice vectors', sub: 'The c axis is about 30 Å', axes: 1 },
    { title: 'Highlight Bi', sub: 'Each Bi atom is outlined', highlight: { els: ['Bi'] } },
    { title: 'One quintuple layer', sub: 'Te–Bi–Te–Bi–Te', show: { bonds: 1, polyhedra: 1 }, highlight: null, axes: 0, layer: { axis: 'z', from: 0.2, to: 0.47 }, fly: { dir: [0, -1, 0.05], zoom: 1.5 } },
  ],
});
