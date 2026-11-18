// SrTiO3: 1 ball and stick; 2 graph; 3–6 message passing; 7 distance neighbours; 8 restore bonds.
// Data: tools/samples/SrTiO3.cif via talks/materials-demo/data/srtio3.js; sample CIF source is unrecorded.
Deck.crystalSlide({
  name: 'crystal-graph', data: 'srtio3', heading: 'SrTiO₃: crystal graph', polyhedra: ['Ti'],
  polyhedronLigands: ['O'], bondCutoffs: { 'O-Ti': 2.2 },
  notes: 'The original example uses only Ti–O bonds; Sr is isolated in that graph. A 3 Å cutoff adds geometric neighbours, not chemical bonds. This finite graph includes only displayed atoms and does not add periodic images.',
  steps: [
    { title: 'Ball and stick', sub: 'Atoms and Ti–O bonds', show: { cell: 1, atoms: 1, bonds: 1 }, fly: { dir: [1, 0.6, 0.35], zoom: 1 } },
    { title: 'A graph', sub: 'Atoms become nodes and bonds edges', nodes: 1 },
    { title: 'Zero hops', sub: 'Ti begins at the centre', gnn: { center: 'Ti', hops: 0 } },
    { title: 'One hop', sub: 'Ti receives from its six O neighbours', gnn: { center: 'Ti', hops: 1 } },
    { title: 'Change the centre', sub: 'O reaches Ti at one hop', gnn: { center: 'O', hops: 1 } },
    { title: 'Two hops', sub: 'O reaches the other O atoms through Ti', gnn: { center: 'O', hops: 2 } },
    { title: 'Distance neighbours', sub: '3 Å adds geometric edges in grey', cutoff: 3.0, gnn: { center: 'Ti', hops: 2 } },
    { title: 'Restore bonds', sub: 'Return to the Ti–O graph', cutoff: null },
  ],
});
