// The talk's sections, the footer bar along the bottom of every slide ("1 Perovskites  2 Layered structures",
// with a dot per topic of the section you are in), and the outline slide. This is the template's own footer
// (Deck.sections / Deck.topics in web/deck.js, styled by web/deck.css), set up for the demo; replace the lists
// with your talk's sections. Slides join a section with Deck.section(n) in index.html, before their script tags.
//
// Steps: 1 the heading · 2, 3 one section per click.
const OUTLINE = [
  ['1', 'Perovskites: cell, bonds, octahedra'],
  ['2', 'Layered structures: quintuple layers'],
];

const FOOTER = { 1: 'Perovskites', 2: 'Layered structures' };
Deck.sections(OUTLINE.map(([num, heading]) => [num, FOOTER[num] || heading]));

// [title, the slides that cover it, one line on what it is]
Deck.topics({
  1: [['SrTiO₃', ['srtio3'], 'cubic cell, Ti–O bonds, the TiO₆ octahedron']],
  2: [['Bi₂Te₃', ['bi2te3'], 'hexagonal cell, Bi–Te bonds, one quintuple layer']],
});

Deck.slide('outline', {
  steps: 1 + OUTLINE.length,
  notes: 'The outline: one section per click. The bar along the bottom of the following slides is the same list.',
  mount(frame, { css, esc }) {
    css(`.o-list { position: absolute; left: 6.5%; top: 20%; }
      .o-row { display: flex; align-items: baseline; font-size: var(--t-lead); margin-bottom: 1.25em; }
      .o-num { width: 1.45em; font-weight: 700; color: var(--accent); }`);
    frame.innerHTML = `<h2 class="deck-heading reveal-in" data-from="1">Outline</h2>
      <div class="o-list">${OUTLINE.map(([num, heading], i) => `
        <div class="o-row reveal-in" data-from="${i + 2}"><span class="o-num">${esc(num)}</span>${esc(heading)}</div>`).join('')}</div>`;
    return { enter: (step, animate) => Deck.show(frame, step, animate) };
  },
});
