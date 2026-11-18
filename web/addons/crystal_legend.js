// An optional element legend for a hand-built Deck.CrystalView. Load after crystal.js.
//
//   const legend = Deck.crystalLegend(frame, view);
//   legend.dim(['Sr'], true);  // faded elements; [] restores them
//   legend.destroy();         // remove when the slide is unmounted
//
// The view supplies the element colours, so the legend matches the atoms in both themes.
(function () {
  'use strict';

  function crystalLegend(frame, view) {
    const box = document.createElement('div');
    box.className = 'crystal-extra-legend';
    box.style.cssText = 'position:absolute;left:calc(var(--u) * 4.2);bottom:calc(var(--u) * 8);display:grid;gap:calc(var(--u) * .55);font-size:var(--t-caption);font-weight:600;pointer-events:none;';
    const rows = new Map();
    for (const el of [...new Set(view.built.atoms.map((a) => a.el))]) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:calc(var(--u) * .6);';
      const dot = document.createElement('span');
      dot.style.cssText = 'width:calc(var(--u) * 1.1);height:calc(var(--u) * 1.1);border-radius:50%;';
      dot.style.background = view.colour(el);
      const label = document.createElement('span');
      label.textContent = el;
      row.append(dot, label);
      box.append(row);
      rows.set(el, row);
    }
    frame.append(box);
    return {
      dim(elements = [], animate = false) {
        rows.forEach((row, el) => {
          row.style.transition = animate ? 'opacity .4s ease' : 'none';
          row.style.opacity = elements.includes(el) ? '0.2' : '1';
        });
      },
      destroy() { box.remove(); },
    };
  }

  window.Deck.crystalLegend = crystalLegend;
})();
