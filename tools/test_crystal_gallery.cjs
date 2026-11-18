// Run with: node tools/test_crystal_gallery.cjs
// Exercises the real crystal-building and graph logic with the sample gallery data.
// A minimal DOM and view stub tests the legend slide's state and cleanup contract;
// it does not replace visual and interaction checks in a browser.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.window = global;
global.Deck = {};
require(path.join(root, 'web/addons/bond_rules.js'));
require(path.join(root, 'web/addons/crystal_logic.js'));
require(path.join(root, 'talks/materials-demo/data/srtio3.js'));
require(path.join(root, 'talks/materials-demo/data/bi2te3.js'));
const L = Deck.crystalLogic;
const tiO = { polyhedra: ['Ti'], polyhedronLigands: ['O'], bondCutoffs: { 'O-Ti': 2.2 } };
const biTe = { polyhedra: ['Bi'], polyhedronLigands: ['Te'], bondCutoffs: { 'Bi-Te': 3.45 } };

const cell = L.build(DATA.srtio3, tiO);
assert.equal(cell.atoms.length, 15);
assert.equal(cell.bonds.length, 6);
assert.equal(cell.polyhedra.length, 1);
assert.equal(cell.polyhedra[0].ligands.length, 6);
assert.ok(cell.bonds.every(([a, b]) => [cell.atoms[a].el, cell.atoms[b].el].sort().join('-') === 'O-Ti'));
const supercell = L.build(DATA.srtio3, { ...tiO, repeat: [2, 2, 1] });
assert.equal(supercell.atoms.length, 42);
assert.equal(supercell.bonds.length, 24);
assert.equal(supercell.polyhedra.length, 4);
assert.ok(supercell.polyhedra.every((p) => p.ligands.length === 6));
const layered = L.build(DATA.bi2te3, biTe);
assert.equal(layered.atoms.length, 66);
assert.equal(layered.bonds.length, 72);
assert.equal(layered.polyhedra.length, 12);
assert.ok(layered.polyhedra.every((p) => p.ligands.length === 6));
assert.ok(layered.bonds.every(([a, b]) => [layered.atoms[a].el, layered.atoms[b].el].sort().join('-') === 'Bi-Te'));

const bondGraph = L.atomGraph(cell);
const ti = L.resolveCenter(cell, 'Ti');
const hops = L.hopDistances(bondGraph, ti);
assert.equal(bondGraph.edges.length, 6);
assert.equal(hops.filter((v, i) => v === 1 && cell.atoms[i].el === 'O').length, 6);
assert.equal(hops.filter((v, i) => Number.isFinite(v) && cell.atoms[i].el === 'Sr').length, 0);
const cutoffGraph = L.atomGraph(cell, { cutoff: 3.0 });
const cutoffHops = L.hopDistances(cutoffGraph, ti);
assert.equal(cutoffGraph.edges.length, 42);
assert.equal(cutoffHops.filter((v, i) => v === 2 && cell.atoms[i].el === 'Sr').length, 8);
const levels = L.gnnLevels(cell, bondGraph, { center: 'Ti', hops: 1 });
assert.equal(levels[ti], 1);
assert.equal(levels.filter((v) => v === 0.6).length, 6);

// Verify these sample checks do not replace or mutate the existing default JmolNN rule.
const defaultCell = L.build(DATA.srtio3, { polyhedra: ['Ti'] });
assert.equal(defaultCell.bonds.length, 6);
assert.equal(Deck.bondRules.tol, 0.45);

// The real legend uses CrystalView.colour; invoke that implementation on a lightweight
// view so the test exercises its actual element palette without a WebGL context.
global.ManimWeb = { THREE: {} };
require(path.join(root, 'web/addons/crystal.js'));
const actualColour = Deck.CrystalView.prototype.colour;
function element() {
  return { style: {}, children: [], append(...items) { this.children.push(...items); }, remove() { this.removed = true; } };
}
global.document = { createElement: element };
let view;
class ViewStub {
  constructor(host, built, { palette }) { this.built = built; this.P = palette; this.parts = {}; view = this; }
  colour(el) { return actualColour.call(this, el); }
  show(parts) { Object.assign(this.parts, parts); }
  dim(elements) { this.dimmed = elements; }
  setLabels(value) { this.labels = value; }
  setAxes(value) { this.axes = value; }
  highlight(value) { this.highlighted = value; }
  snap() {}
  flyTo() { return Promise.resolve(); }
  render() { this.rendered = true; }
  dispose() { this.disposed = true; }
}
Deck.CrystalView = ViewStub;
require(path.join(root, 'web/addons/crystal_legend.js'));
let slide;
Deck.slide = (name, def) => { assert.equal(name, 'crystal-legend'); slide = def; };
Deck.points = () => '';
Deck.show = () => {};
require(path.join(root, 'talks/crystal-gallery/slides/legend.js'));
const palette = { cpk: {}, muted: '#888' };
function mount() {
  const frame = element();
  frame.querySelector = () => element();
  const controller = slide.mount(frame, { data: DATA, palette, css() {}, esc: (s) => s });
  return { frame, controller, view };
}
function snapshot(v) { return JSON.stringify([v.parts, v.dimmed, v.labels, v.axes, v.highlighted]); }
for (let target = 1; target <= 5; target++) {
  const jump = mount();
  jump.controller.enter(target, false);
  const expected = snapshot(jump.view);
  const linear = mount();
  for (let step = 1; step <= target; step++) linear.controller.enter(step, false);
  assert.equal(snapshot(linear.view), expected, `direct versus sequential step ${target}`);
  const legend = linear.frame.children[0];
  assert.deepEqual(legend.children.map((row) => row.children[1].textContent), ['Sr', 'Ti', 'O']);
  assert.equal(legend.children[0].children[0].style.background, actualColour.call(linear.view, 'Sr'));
  assert.equal(legend.children[0].style.opacity, target === 4 ? '0.2' : '1');
  linear.controller.freeze();
  assert.equal(linear.view.rendered, true);
  linear.controller.destroy();
  assert.equal(linear.view.disposed, true);
  assert.equal(legend.removed, true);
  jump.controller.destroy();
}
const reverse = mount();
reverse.controller.enter(4, false);
assert.equal(reverse.frame.children[0].children[0].style.opacity, '0.2');
reverse.controller.enter(2, false);
assert.equal(reverse.frame.children[0].children[0].style.opacity, '1');
reverse.controller.destroy();
console.log('Crystal sample geometry, graph, legend and step-state contracts: OK');
