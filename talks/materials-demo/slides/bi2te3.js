// Layered Bi2Te3 (R-3m, hexagonal setting): the c axis is 30 Å, so the model is laid on its side. The bonds
// are pymatgen's rule; the van der Waals gap between quintuple layers has no Te–Te bond, which is why the
// layers read as slabs. Data: data/bi2te3.js (tools/prep_crystal.py from tools/samples/Bi2Te3.cif).
//
// Steps: 1 the hexagonal cell · 2 bonds · 3 BiTe6 octahedra · 4 one quintuple layer, the rest faded.
Deck.crystalSlide({
  name: 'bi2te3',
  data: 'bi2te3',
  heading: 'Layered Bi₂Te₃',
  polyhedra: ['Bi'],
  orientation: [0, Math.PI / 2, 0],   // c along the screen's horizontal
  notes: 'Bi2Te3: five atomic layers (Te-Bi-Te-Bi-Te) form a quintuple layer; the layers stack along c with a '
    + 'van der Waals gap between them. The slab in step 4 is selected by fractional coordinate along c.',
  steps: [
    { title: 'The hexagonal cell', sub: 'R‑3m, c = 30.5 Å, laid on its side', show: { cell: 1, atoms: 1 }, fly: { dir: [0.25, -1, 0.3], zoom: 1.25 } },
    { title: 'Bonds', sub: 'Bi–Te inside a layer; none across the gap', show: { bonds: 1 } },
    { title: 'BiTe₆ octahedra', sub: 'each Bi has six Te neighbours', show: { polyhedra: 1 } },
    { title: 'One quintuple layer', sub: 'five atomic planes; the others fade', labels: 1,
      layer: { axis: 'z', from: 0.2, to: 0.47 } },
  ],
});
