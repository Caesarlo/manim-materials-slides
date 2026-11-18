// SrTiO3: 1 labels and legend; 2 lattice vectors; 3 highlight Ti; 4 fade Sr; 5 restore Sr.
// Data: tools/samples/SrTiO3.cif via talks/materials-demo/data/srtio3.js; the sample CIF source is unrecorded.
{
  const steps = [
    { title: 'Elements', sub: 'A label and legend for each element', show: { cell: 1, atoms: 1 }, labels: 1 },
    { title: 'Lattice vectors', sub: 'a, b and c start at the cell corner', axes: 1 },
    { title: 'Highlight Ti', sub: 'The Ti at the centre is outlined', bonds: 1, highlight: { els: ['Ti'] } },
    { title: 'Fade Sr', sub: 'The matching legend row fades as well', dim: ['Sr'] },
    { title: 'Restore', sub: 'Restore all element colours', dim: [], highlight: null },
  ];
  Deck.slide('crystal-legend', {
    steps: steps.length, interactive: true, smoothBack: true,
    notes: 'An element legend follows dimming. The explicit Ti–O cutoff matches the earlier example.',
    mount(frame, { data, palette, css, esc }) {
      css(`.deck-frame .crg-stage { right: 40%; top: 14%; bottom: 6%; }
        .crg-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
        .crg-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
        .crg-stage .label3d { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-caption); font-weight: 600; white-space: nowrap; pointer-events: none; }`);
      frame.innerHTML = `<div class="deck-stage crg-stage"></div><h2 class="deck-heading reveal-in in">${esc('SrTiO₃: labels and legend')}</h2>${Deck.points(steps.map((s, i) => ({ title: s.title, sub: s.sub, from: i + 1 })), { className: 'crg-col' })}`;
      const built = Deck.crystalLogic.build(data.srtio3, { polyhedra: ['Ti'], polyhedronLigands: ['O'], bondCutoffs: { 'O-Ti': 2.2 } });
      const view = new Deck.CrystalView(frame.querySelector('.crg-stage'), built, { palette });
      const legend = Deck.crystalLegend(frame, view);
      view.show({ cell: 0, atoms: 0, bonds: 0, polyhedra: 0 });
      view.snap();
      return {
        enter(step, animate) {
          const state = { cell: 0, atoms: 0, bonds: 0, polyhedra: 0, labels: 0, axes: 0, highlight: null, dim: [] };
          for (const s of steps.slice(0, step)) {
            if (s.show) Object.assign(state, s.show);
            for (const key of ['bonds', 'labels', 'axes', 'highlight', 'dim']) if (s[key] !== undefined) state[key] = s[key];
          }
          view.show({ cell: state.cell, atoms: state.atoms, bonds: state.bonds, polyhedra: state.polyhedra });
          view.dim(state.dim, 0.08); view.setLabels(state.labels); view.setAxes(state.axes); view.highlight(state.highlight);
          legend.dim(state.dim, !!animate); Deck.show(frame, step, animate);
          if (!animate) { view.snap(); return view.flyTo({}, 0); }
          return view.flyTo({}, animate === 'back' ? 700 : 1400);
        },
        freeze: () => view.render(),
        destroy() { legend.destroy(); view.dispose(); },
      };
    },
  });
}
