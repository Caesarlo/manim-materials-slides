// The crystal component's pure logic (no three.js): a unit cell -> atoms, bonds, coordination polyhedra and the
// cell's corners; layers; the atom graph and message-passing levels; label placement. Ported from the
// materials pack of the earlier manim-materials-slides (structure.ts, graph.ts, labels.ts), with one change:
// bonds are found by pymatgen's rule (JmolNN), exported to web/addons/bond_rules.js by tools/export_bond_rules.py,
// instead of hand-written rules per structure. Load bond_rules.js first; web/addons/crystal.js draws the result.
//
//   const built = Deck.crystalLogic.build(data.srtio3, { repeat: [1, 1, 1], polyhedra: ['Ti'] });
//   built.atoms [{ el, pos: [x, y, z] Å }], built.bonds [[i, j]], built.polyhedra [{ center, ligands }],
//   built.corners (8, ijk binary order), built.center, built.radius, built.lattice, built.supercell
(function () {
  'use strict';

  const EPS = 1e-4;
  const LAYER_EPS = 1e-3;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

  // pymatgen's JmolNN: bonded when min < d <= r_a + r_b + tol, one radius per element
  function bondedFn() {
    const R = window.Deck && window.Deck.bondRules;
    if (!R) throw new Error('crystal needs web/addons/bond_rules.js (made by tools/export_bond_rules.py)');
    return (a, b, d) => d > R.min && d <= (R.radii[a] ?? 1.5) + (R.radii[b] ?? 1.5) + R.tol + 1e-6;
  }

  const cart = (lat, f) => [0, 1, 2].map((d) => f[0] * lat[0][d] + f[1] * lat[1][d] + f[2] * lat[2][d]);

  // The picture VESTA draws: every atom image inside the repeated cell (boundary atoms repeated on the far faces),
  // plus the ligands each polyhedron centre needs, so the cell edge does not cut a polyhedron.
  function build(data, { repeat = [1, 1, 1], polyhedra = [], polyhedronLigands = null, bondCutoffs = null } = {}) {
    const defaultBonded = bondedFn();
    const bonded = bondCutoffs ? (a, b, d) => {
      const cutoff = bondCutoffs[[a, b].sort().join('-')];
      return cutoff !== undefined && d > 1e-6 && d <= cutoff;
    } : defaultBonded;
    const [nx, ny, nz] = repeat;
    const lat = data.lattice;
    const cands = [];
    for (let i = -1; i <= nx; i++) for (let j = -1; j <= ny; j++) for (let k = -1; k <= nz; k++) {
      for (const at of data.atoms) {
        const f = [at.frac[0] + i, at.frac[1] + j, at.frac[2] + k];
        const inside = f[0] >= -EPS && f[0] <= nx + EPS && f[1] >= -EPS && f[1] <= ny + EPS && f[2] >= -EPS && f[2] <= nz + EPS;
        cands.push({ el: at.el, pos: cart(lat, f), inside });
      }
    }
    const ligandsOf = (a) => {
      const out = [];
      cands.forEach((b, j) => { if (b !== a && (!polyhedronLigands || polyhedronLigands.includes(b.el)) && bonded(a.el, b.el, dist(a.pos, b.pos))) out.push(j); });
      return out;
    };
    const keep = new Set();
    cands.forEach((a, i) => { if (a.inside) keep.add(i); });
    cands.forEach((a) => { if (a.inside && polyhedra.includes(a.el)) ligandsOf(a).forEach((j) => keep.add(j)); });
    const idx = [...keep];
    const remap = new Map(idx.map((old, n) => [old, n]));
    const atoms = idx.map((i) => ({ el: cands[i].el, pos: cands[i].pos }));

    const bonds = [];
    for (let p = 0; p < atoms.length; p++) for (let q = p + 1; q < atoms.length; q++) {
      if (bonded(atoms[p].el, atoms[q].el, dist(atoms[p].pos, atoms[q].pos))) bonds.push([p, q]);
    }
    const cells = [];
    cands.forEach((a, i) => {
      if (!a.inside || !polyhedra.includes(a.el)) return;
      const ligands = ligandsOf(a).map((j) => remap.get(j));
      if (ligands.length >= 4) cells.push({ center: remap.get(i), ligands });
    });

    const corners = [];
    for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) for (let k = 0; k <= 1; k++) corners.push(cart(lat, [i * nx, j * ny, k * nz]));
    const center = [0, 1, 2].map((d) => corners.reduce((s, p) => s + p[d], 0) / 8);
    const radius = Math.max(...corners.map((p) => dist(p, center)), ...atoms.map((a) => dist(a.pos, center)));
    const supercell = lat.map((v, d) => v.map((x) => x * repeat[d]));
    return { atoms, bonds, polyhedra: cells, corners, center, radius, lattice: lat, supercell, repeat };
  }

  // Cartesian -> fractions of the vectors (Cramer's rule)
  function toFrac(vectors, p) {
    const [a, b, c] = vectors;
    const det = (u, v, w) => dot(u, cross(v, w));
    const D = det(a, b, c);
    return [det(p, b, c) / D, det(a, p, c) / D, det(a, b, p) / D];
  }

  // inside a layer's fraction interval (closed, tolerance 1e-3); no layer = everything
  function inLayer(frac, layer) {
    if (!layer) return true;
    const lo = Math.min(layer.from, layer.to), hi = Math.max(layer.from, layer.to);
    return frac >= lo - LAYER_EPS && frac <= hi + LAYER_EPS;
  }
  const fracAlong = (built, atom, axis) => toFrac(built.supercell, built.atoms[atom].pos)['xyz'.indexOf(axis)];
  const layerMask = (built, layer) => built.atoms.map((_, i) => !layer || inLayer(fracAlong(built, i, layer.axis), layer));

  // Faces of the convex hull of a few points (a polyhedron's ligands) in place of three.js's ConvexGeometry, which
  // the bundled build lacks: every plane through three points with all the others on one side; coplanar points
  // merge into one polygon, ordered round its centre. Returns polygons as index lists.
  function hullFaces(pts) {
    const faces = [], seen = new Set();
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) for (let k = j + 1; k < pts.length; k++) {
      let n = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
      const len = Math.hypot(...n);
      if (len < 1e-9) continue;
      n = n.map((x) => x / len);
      let pos = false, neg = false;
      const on = [];
      for (let m = 0; m < pts.length; m++) {
        const d = dot(n, sub(pts[m], pts[i]));
        if (d > 1e-3) pos = true; else if (d < -1e-3) neg = true; else on.push(m);
        if (pos && neg) break;
      }
      if (pos && neg) continue;
      // Match ConvexGeometry: every face must wind outwards.
      if (pos) n = n.map((x) => -x);
      const key = on.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const c = [0, 1, 2].map((d) => on.reduce((s, m) => s + pts[m][d], 0) / on.length);
      const u = sub(pts[on[0]], c), ul = Math.hypot(...u), ux = u.map((x) => x / ul), v = cross(n, ux);
      on.sort((a, b) => {
        const pa = sub(pts[a], c), pb = sub(pts[b], c);
        return Math.atan2(dot(pa, v), dot(pa, ux)) - Math.atan2(dot(pb, v), dot(pb, ux));
      });
      faces.push(on);
    }
    return faces;
  }

  // ---- graph: atoms are nodes, bonds (or pairs within a cutoff) are edges; the shown atoms only, no periodic images
  function atomGraph(built, { cutoff } = {}) {
    const n = built.atoms.length;
    let edges;
    if (cutoff === undefined) edges = built.bonds.map(([p, q]) => [p, q]);
    else {
      edges = [];
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (dist(built.atoms[p].pos, built.atoms[q].pos) <= cutoff + 1e-9) edges.push([p, q]);
      }
    }
    const adj = Array.from({ length: n }, () => []);
    for (const [p, q] of edges) { adj[p].push(q); adj[q].push(p); }
    return { n, edges, adj };
  }
  function hopDistances(g, center) {
    const d = Array(g.n).fill(Infinity);
    if (!Number.isInteger(center) || center < 0 || center >= g.n) return d;
    d[center] = 0;
    const queue = [center];
    for (let h = 0; h < queue.length; h++) {
      for (const v of g.adj[queue[h]]) if (d[v] === Infinity) { d[v] = d[queue[h]] + 1; queue.push(v); }
    }
    return d;
  }
  // center: an atom index, or an element symbol (that element's first atom); -1 when not found
  function resolveCenter(built, center) {
    if (typeof center === 'number') return Number.isInteger(center) && center >= 0 && center < built.atoms.length ? center : -1;
    return built.atoms.findIndex((a) => a.el === center);
  }
  // message-passing strength per atom: centre 1, one hop 0.6, two 0.35, further 0.2, beyond `hops` or unreachable 0
  function gnnLevels(built, g, spec) {
    const c = resolveCenter(built, spec.center);
    return hopDistances(g, c).map((d) => (d > spec.hops ? 0 : d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.35 : 0.2));
  }

  // ---- labels
  function elementsOf(built) {
    const out = [];
    for (const a of built.atoms) if (!out.includes(a.el)) out.push(a.el);
    return out;
  }
  // spec { els, indices } -> which atoms are highlighted
  function resolveHighlight(built, hl) {
    const on = built.atoms.map(() => false);
    if (!hl) return on;
    built.atoms.forEach((a, i) => { if (hl.els && hl.els.includes(a.el)) on[i] = true; });
    for (const i of hl.indices || []) if (Number.isInteger(i) && i >= 0 && i < on.length) on[i] = true;
    return on;
  }
  // screen atoms: { x, y, r (px), depth, shown }
  function isOccluded(i, atoms) {
    const a = atoms[i];
    return atoms.some((b, j) => j !== i && b.shown && b.depth < a.depth - 1e-6 && Math.hypot(a.x - b.x, a.y - b.y) < b.r);
  }
  // which candidate carries the label: the topmost not hidden behind another atom (shortest leader), else the topmost
  function pickLabelAtom(cands, atoms) {
    if (!cands.length) return undefined;
    const free = cands.filter((i) => !isOccluded(i, atoms));
    const pool = free.length ? free : cands;
    const top = (i) => atoms[i].y - atoms[i].r;
    return pool.reduce((best, i) => (top(i) < top(best) - 1e-9 ? i : best), pool[0]);
  }
  // labels in one row above the structure: left to right by wanted x, gap apart, round `blocked` spans, inside [0, width]
  function layoutRow(items, gap, width, blocked = []) {
    const order = items.map((_, k) => k).sort((a, b) => items[a].x - items[b].x);
    const out = items.map((it) => it.x);
    let edge = -Infinity;
    for (const k of order) {
      let x = Math.max(items[k].x, edge + gap + items[k].w / 2, items[k].w / 2);
      for (let again = true; again;) {
        again = false;
        for (const b of blocked) {
          // the tolerance matters: after the push, x - w/2 - gap can land one rounding step below b.x1, which would
          // test as overlapping again and push to the same x for ever (a frozen page at some window sizes)
          if (x + items[k].w / 2 + gap > b.x0 + 1e-6 && x - items[k].w / 2 - gap < b.x1 - 1e-6) { x = b.x1 + gap + items[k].w / 2; again = true; }
        }
      }
      out[k] = x;
      edge = x + items[k].w / 2;
    }
    let limit = width;
    for (const k of [...order].reverse()) {
      out[k] = Math.min(out[k], limit - items[k].w / 2);
      limit = out[k] - items[k].w / 2 - gap;
    }
    return out;
  }

  window.Deck = window.Deck || {};
  window.Deck.crystalLogic = {
    build, toFrac, inLayer, fracAlong, layerMask, hullFaces, atomGraph, hopDistances, resolveCenter, gnnLevels,
    elementsOf, resolveHighlight, isOccluded, pickLabelAtom, layoutRow,
  };
})();
