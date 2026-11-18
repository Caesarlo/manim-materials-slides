// The title slide of the materials demo: title and subtitle on arrival, the byline on the second click.
Deck.slide('title', {
  steps: 2,
  notes: 'Demo of the crystal-structure component (web/addons/crystal.js). Bonds follow pymatgen\'s JmolNN rule.',
  mount(frame, { esc }) {
    frame.innerHTML = `
      <h1 class="deck-title reveal-in" data-from="1">Crystal structures, live</h1>
      <p class="deck-subtitle reveal-in" data-from="1" style="--i:1">Bonds, coordination polyhedra and layers, a click at a time</p>
      <div class="deck-byline reveal-in" data-from="2">${esc('Your Name')}<span>${esc('Your group · Your institution · Date')}</span></div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
