// Run with: node tools/test_spectra.cjs
// Checks the numerical conventions and all demo slide states without launching a browser.
// Browser rendering, navigation, and visual layout require separate acceptance checks.
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
global.window = global;
global.Deck = {};
require(path.join(root, 'web/spectra.js'));

const { findGap, dosFromBands, makeGrid, broaden, normalize } = Deck.spectraMath;
let result = findGap([[-1, -0.2, -0.3], [1, 0.8, 0.6]], [0, 0.5, 1]);
assert.equal(result.metal, false);
assert.equal(result.gap, 0.8);
assert.equal(result.direct, true); // The original convention permits one k-grid index of separation.
result = findGap([[-0.2, -1, -1], [1, 1, 0.6]], [0, 0.5, 1]);
assert.equal(result.direct, false);
assert.equal(findGap([[-1, 0.5, 1]], [0, 0.5, 1]).metal, true);
assert.equal(findGap([[-1, -0.5, -0.2]], [0, 0.5, 1]).gap, undefined);
assert.throws(() => findGap([[1, 2]], [0, 0]));
assert.throws(() => findGap([[1]], [0, 1]));

const dos = dosFromBands([[-1, -1], [1, 1]], 1000, 0.1, [-2, 2]);
const dosIntegral = dos.g.reduce((a, b) => a + b, 0) * 4 / 1000;
assert.ok(Math.abs(dosIntegral - 2) < 0.001, `DOS integral: ${dosIntegral}`);
assert.throws(() => dosFromBands([[0]], 100, 0));

const grid = makeGrid(-5, 5, 0.005);
const pattern = broaden([{ twoTheta: 0, intensity: 4 }], 1, grid);
const area = pattern.reduce((a, b) => a + b, 0) * 0.005;
assert.ok(Math.abs(area - 4) < 0.001, `XRD peak area: ${area}`);
assert.ok(Math.abs(pattern[1100] / pattern[1000] - 0.5) < 1e-9, 'half-maximum at FWHM / 2');
assert.equal(Math.max(...normalize(pattern)), 1);
assert.deepEqual(normalize([0, 0]), [0, 0]);
assert.throws(() => makeGrid(0, 1, 0));
assert.throws(() => broaden([], 0, []));

// Emulate the manim object and scene contracts. This checks construction and the layer
// state machine only; it does not claim to exercise real manim or browser rendering.
const registrations = [];
const builtSlides = [];
class ObjectStub {
  constructor(opts = {}) { this.opts = opts; }
  moveTo(p) { this.pos = p; return this; }
  setPointsAsCorners(p) { this.points = p; return this; }
  setColor(c) { this.color = c; return this; }
  setFill() { return this; }
  setStrokeOpacity() { return this; }
}
class AnimationStub { constructor(mob) { this.mobject = mob; } }
class Create extends AnimationStub {}
class FadeIn extends AnimationStub {}
class FadeOut extends AnimationStub {}
const M = { Text: ObjectStub, Line: ObjectStub, Dot: ObjectStub, VMobject: ObjectStub, Create, FadeIn, FadeOut };
const P = { fg: '#fff', muted: '#999', accent: '#456', series: ['#111', '#222', '#333', '#444', '#555'] };
Deck.slide = (name, def) => registrations.push({ name, def });
Deck.show = () => {};
Deck.manim = (_, options) => {
  builtSlides.push({ options, objects: options.build({ M, P }) });
  return { go() {}, freeze() {}, dispose() {} };
};
require(path.join(root, 'talks/spectra-gallery/slides/bands.js'));
require(path.join(root, 'talks/spectra-gallery/slides/xrd.js'));
assert.deepEqual(registrations.map(({ name }) => name), ['semiconductor', 'metal', 'xrd']);
for (const { def } of registrations) {
  const controller = def.mount({ querySelector() { return {}; } }, { esc: (s) => s });
  assert.equal(typeof controller.enter, 'function');
  assert.equal(typeof controller.freeze, 'function');
  assert.equal(typeof controller.destroy, 'function');
}
async function verifySlides() {
for (const { options, objects } of builtSlides) {
  assert.ok(objects.axes.length);
  assert.equal(objects.layers.length, options.steps.length);
  for (const layer of [objects.axes, ...objects.layers]) {
    assert.ok(layer.length);
    for (const obj of layer) {
      for (const point of obj.points || []) assert.ok(point.every(Number.isFinite));
      if (obj.pos) assert.ok(obj.pos.every(Number.isFinite));
      if (obj.opts.start) assert.ok(obj.opts.start.every(Number.isFinite));
      if (obj.opts.end) assert.ok(obj.opts.end.every(Number.isFinite));
    }
  }
  // Forward animation and instant reconstruction leave identical keyed target states.
  // Also check that unchanged objects are retained, and newly introduced curves are drawn.
  async function run(fast) {
    const o = options.build({ M, P });
    const active = new Set();
    const scene = { remove(...items) { items.forEach((item) => active.delete(item)); } };
    const add = (...items) => items.flat().forEach((item) => active.add(item));
    const animations = [];
    const play = async (...anims) => { animations.push(...anims); };
    const summaries = [];
    for (let i = 0; i < options.steps.length; i++) {
      const previous = new Map(o.current);
      await options.steps[i](o, { M, scene, add, play, fast });
      const target = new Map(o.layers[i].map((m) => [m.spectraKey, m.spectraVersion]));
      assert.equal(target.size, o.layers[i].length, 'keys within a state must be unique');
      assert.equal(o.current.size, target.size);
      for (const [key, version] of target) {
        const item = o.current.get(key);
        assert.equal(item.spectraVersion, version);
        assert.ok(active.has(item), `missing ${key} at step ${i + 1}`);
        if (previous.has(key) && previous.get(key).spectraVersion === version) assert.equal(item, previous.get(key));
      }
      assert.equal(active.size, target.size + o.axes.length);
      summaries.push([...o.current].map(([key, item]) => [key, item.spectraVersion, item.opacity]).sort());
    }
    if (!fast) assert.ok(animations.some((a) => a instanceof Create), 'curves should animate drawing');
    else assert.equal(animations.length, 0);
    return summaries;
  }
  assert.deepEqual(await run(false), await run(true));
}
console.log('Spectra calculations, forward animation and reconstructed step states: OK');
}
verifySlides().catch((error) => { console.error(error); process.exitCode = 1; });
