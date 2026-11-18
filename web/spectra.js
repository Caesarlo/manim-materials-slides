// Band structures with density of states, and XRD patterns, using the local manim-web stage.
// Load deck.js and manim.js first. Each call registers a slide; states inherit from earlier steps.
//   Deck.bandChart({name, heading, data: {k, kpath:[{k,label}], bands:[[...]], dos?:{E,g}},
//     steps:[{caption:'Bands',state:{bands:true}}, {caption:'Gap',state:{fermi:true,gap:true,dos:true}}]});
// Energy is eV relative to the Fermi level. Bands have one value per k point; DOS is generated with
// Gaussian broadening when omitted. focusBand selects a band index or null. Metal/gap detection is sampled.
//   Deck.xrdChart({name, heading, patterns:[{name,peaks:[{twoTheta,intensity,hkl?}],fwhm?}, ...],
//     steps:[{caption:'Peaks',state:{sticks:true}}, {caption:'Broaden',state:{curve:true,hkl:true}},
//            {caption:'Compare',state:{compare:true,hkl:false}}]});
// XRD intensities specify Gaussian peak areas, FWHM is in degrees, and plotted curves are individually
// normalized. Deck.spectraMath exposes findGap, dosFromBands, makeGrid, broaden and normalize.
// Forward clicks draw newly revealed curves and fade changing annotations; jumps and reverse navigation
// rebuild the exact target state instantly. Existing elements remain in place across successive steps.
(function () {
  'use strict';
  const D = window.Deck;
  const finite = Number.isFinite;
  const SQRT2PI = Math.sqrt(2 * Math.PI);

  function validateBands(bands, k) {
    if (!Array.isArray(k) || k.length < 2 || !k.every(finite) || k.some((v, i) => i && v <= k[i - 1])) throw new Error('bandChart: k must be a strictly increasing finite array');
    if (!Array.isArray(bands) || !bands.length || bands.some((b) => !Array.isArray(b) || b.length !== k.length || !b.every(finite))) throw new Error('bandChart: every band must have one finite energy per k point');
  }
  function findGap(bands, k) {
    validateBands(bands, k);
    let vbm, cbm;
    for (let b = 0; b < bands.length; b++) {
      let below = false, above = false;
      for (let i = 0; i < k.length; i++) {
        const E = bands[b][i];
        if (E <= 0) { below = true; if (!vbm || E > vbm.E) vbm = { k: k[i], E, band: b, ik: i }; }
        else { above = true; if (!cbm || E < cbm.E) cbm = { k: k[i], E, band: b, ik: i }; }
      }
      if (below && above) return { metal: true };
    }
    return vbm && cbm ? { metal: false, vbm, cbm, gap: cbm.E - vbm.E, direct: Math.abs(vbm.ik - cbm.ik) <= 1 } : { metal: false };
  }
  function dosFromBands(bands, bins = 200, sigma = 0.08, range) {
    if (!Array.isArray(bands) || !bands.length || bands.some((b) => !Array.isArray(b) || !b.length || !b.every(finite)) || !Number.isInteger(bins) || bins < 2 || !(sigma > 0) || !finite(sigma)) throw new Error('dosFromBands: invalid bands, bins or sigma');
    const all = bands.flat();
    const lo = range ? range[0] : Math.min(...all) - 4 * sigma, hi = range ? range[1] : Math.max(...all) + 4 * sigma;
    if (!finite(lo) || !finite(hi) || lo >= hi) throw new Error('dosFromBands: invalid energy range');
    const dE = (hi - lo) / bins, E = Array.from({ length: bins }, (_, i) => lo + (i + 0.5) * dE), g = new Array(bins).fill(0);
    for (const band of bands) for (const e of band) {
      const a = Math.max(0, Math.floor((e - 5 * sigma - lo) / dE)), b = Math.min(bins - 1, Math.ceil((e + 5 * sigma - lo) / dE));
      for (let i = a; i <= b; i++) g[i] += Math.exp(-0.5 * ((E[i] - e) / sigma) ** 2) / (band.length * sigma * SQRT2PI);
    }
    return { E, g };
  }
  function makeGrid(min, max, step) {
    if (!finite(min) || !finite(max) || !finite(step) || !(step > 0) || max < min) throw new Error('makeGrid: step must be positive and max >= min');
    const n = Math.floor((max - min) / step + 1e-9);
    return Array.from({ length: n + 1 }, (_, i) => min + i * step);
  }
  function broaden(peaks, fwhm, grid) {
    if (!(fwhm > 0) || !finite(fwhm) || !Array.isArray(grid) || !grid.every(finite) || !Array.isArray(peaks) || peaks.some((p) => !finite(p.twoTheta) || !finite(p.intensity) || p.intensity < 0)) throw new Error('broaden: invalid peaks, width or grid');
    const sigma = fwhm / (2 * Math.sqrt(2 * Math.LN2));
    return grid.map((x) => peaks.reduce((s, p) => s + p.intensity * Math.exp(-0.5 * ((x - p.twoTheta) / sigma) ** 2) / (sigma * SQRT2PI), 0));
  }
  function normalize(values, max = 1) {
    if (!Array.isArray(values) || !values.every(finite) || !finite(max) || max < 0) throw new Error('normalize: invalid values or maximum');
    const m = Math.max(0, ...values); return m ? values.map((v) => v * max / m) : values.slice();
  }

  const pt = (x, y) => [x, y, 0];
  const map = (v, a, b, c, d) => c + (v - a) / (b - a) * (d - c);
  // Each step owns fresh objects. Semantic keys let the stage retain unchanged objects, so a new
  // annotation does not make the existing curves blink. A changed key cross-fades to its new state.
  function item(mob, key, version = '', draw = false) {
    mob.spectraKey = key; mob.spectraVersion = version; mob.spectraDraw = draw;
    return mob;
  }
  function states(steps, initial) { let s = initial; return steps.map((step) => { s = { ...s, ...step.state }; return s; }); }
  function slide(def, initial, build) {
    if (!def.name || !Array.isArray(def.steps) || !def.steps.length) throw new Error('spectra: name and steps required');
    const ss = states(def.steps, initial);
    D.slide(def.name, { steps: ss.length, notes: def.notes || '', mount(frame, { esc }) {
      frame.innerHTML = `<div class="deck-stage"></div>${def.heading ? `<h2 class="deck-heading">${esc(def.heading)}</h2>` : ''}` + def.steps.map((s, i) => `<div class="deck-caption reveal-in" data-show="${i + 1}">${esc(s.caption || '')}</div>`).join('');
      const stage = D.manim(frame.querySelector('.deck-stage'), { build: ({ M, P }) => ({ ...build(M, P, ss), current: new Map() }),
        steps: ss.map((_, i) => async (o, { M, scene, add, play, fast }) => {
          const incoming = new Map(o.layers[i].map((mob) => [mob.spectraKey, mob]));
          const removed = [], added = [], retained = new Map();
          for (const [key, old] of o.current) {
            const next = incoming.get(key);
            if (next && next.spectraVersion === old.spectraVersion) retained.set(key, old);
            else removed.push(old);
          }
          for (const [key, next] of incoming) if (!retained.has(key)) added.push(next);
          const targetOpacity = new Map(added.map((m) => [m, m.opacity]));
          if (fast) {
            if (!i) await add(o.axes);
            scene.remove(...removed);
            await add(added);
          } else {
            // Create is used for genuinely new curves; changed geometry/colour cross-fades instead.
            const anims = [];
            if (!i) anims.push(...o.axes.map((m) => new M.FadeIn(m, { duration: 0.55 })));
            anims.push(...removed.map((m) => new M.FadeOut(m, { duration: 0.55 })));
            anims.push(...added.map((m) => m.spectraDraw && !o.current.has(m.spectraKey)
              ? new M.Create(m, { duration: 0.9 }) : new M.FadeIn(m, { duration: 0.55 })));
            if (anims.length) await play(...anims);
            // Scene.play cleans up animations; explicit removal/addition keeps its final state identical
            // to the instant path, including on runtimes with different animation cleanup behavior.
            if (!i) await add(o.axes);
            scene.remove(...removed);
            await add(added);
          }
          // FadeIn/Create may set opacity to 1; preserve dimmed bands' intended final opacity.
          for (const mob of added) if (targetOpacity.get(mob) !== undefined) mob.opacity = targetOpacity.get(mob);
          for (const mob of added) retained.set(mob.spectraKey, mob);
          o.current = retained;
        }) });
      return { enter(step, animate) { D.show(frame, step, animate); return stage.go(step, animate); }, freeze: stage.freeze, destroy: stage.dispose };
    } });
  }
  function graphics(M, P) {
    const text = (s, x, y, color = P.fg, size = 25) => new M.Text({ text: String(s), fontFamily: 'Lato', fontSize: size, color }).moveTo(pt(x, y));
    const line = (x1, y1, x2, y2, color = P.fg, width = 2) => new M.Line({ start: pt(x1, y1), end: pt(x2, y2), color, strokeWidth: width });
    const path = (points, color, width = 4) => { const p = new M.VMobject().setPointsAsCorners(points.map(([x, y]) => pt(x, y))); p.setColor(color); p.setFill(color, 0); p.setStrokeOpacity(1); p.strokeWidth = width; return p; };
    return { text, line, path };
  }

  function bandChart(def) {
    const data = def.data || {}, { bands, k } = data;
    validateBands(bands, k);
    if (!Array.isArray(data.kpath) || data.kpath.some((p) => !finite(p.k) || p.k < k[0] || p.k > k[k.length - 1] || typeof p.label !== 'string')) throw new Error('bandChart: invalid kpath');
    const all = bands.flat(), span = Math.max(0.5, Math.max(...all) - Math.min(...all));
    const energy = def.energyRange || [Math.min(0, ...all) - span * 0.06, Math.max(0, ...all) + span * 0.06];
    if (!Array.isArray(energy) || energy.length !== 2 || !energy.every(finite) || energy[0] >= energy[1] || all.some((e) => e < energy[0] || e > energy[1]) || energy[0] > 0 || energy[1] < 0) throw new Error('bandChart: energyRange must include zero and all band energies');
    const dos = data.dos || dosFromBands(bands, 200, def.sigma ?? 0.08, energy);
    if (!Array.isArray(dos.E) || !Array.isArray(dos.g) || dos.E.length < 2 || dos.E.length !== dos.g.length || !dos.E.every(finite) || !dos.g.every((v) => finite(v) && v >= 0) || dos.E.some((v, i) => i && v <= dos.E[i - 1])) throw new Error('bandChart: invalid DOS');
    const visibleDos = dos.E.map((e, i) => [e, dos.g[i]]).filter(([e]) => e >= energy[0] && e <= energy[1]);
    const gap = findGap(bands, k), gmax = Math.max(1e-9, ...visibleDos.map((p) => p[1]));
    slide(def, { bands: false, fermi: false, gap: false, dos: false, focusBand: null }, (M, P, ss) => {
      const { text, line, path } = graphics(M, P), L = -5.8, R = 3.5, B = -2.2, T = 2.5, DL = 4.25, DR = 6.3;
      const x = (v) => map(v, k[0], k[k.length - 1], L, R), y = (v) => map(v, energy[0], energy[1], B, T);
      const axes = [line(L, B, R, B), line(L, B, L, T), text('E − Eᶠ (eV)', L + 0.65, T + 0.37, P.fg, 23)];
      for (let i = 0; i <= 4; i++) { const e = energy[0] + i * (energy[1] - energy[0]) / 4, yy = y(e); axes.push(line(L - 0.1, yy, L, yy), text(Number(e.toFixed(1)), L - 0.5, yy, P.muted, 22)); }
      for (const p of data.kpath) axes.push(line(x(p.k), B, x(p.k), T, P.muted, 1), text(p.label, x(p.k), B - 0.35, P.fg, 23));
      const layers = ss.map((s) => {
        const o = [];
        if (s.bands) bands.forEach((b, i) => { const color = b.every((e) => e <= 0) ? P.series[0] : b.every((e) => e > 0) ? P.series[1] : P.series[3], p = path(b.map((e, j) => [x(k[j]), y(e)]), color, s.focusBand === i ? 6 : 4); p.opacity = s.focusBand == null || s.focusBand === i ? 1 : 0.25; o.push(item(p, `band-${i}`, String(s.focusBand), true)); });
        if (s.fermi) o.push(item(line(L, y(0), R, y(0), P.muted, 2), 'fermi-line', '', true), item(text('Eᶠ', R + 0.25, y(0), P.muted, 22), 'fermi-label'));
        if (s.gap && gap.vbm && gap.cbm) {
          const xv = x(gap.vbm.k), xc = x(gap.cbm.k), yv = y(gap.vbm.E), yc = y(gap.cbm.E);
          o.push(item(new M.Dot({ point: pt(xv, yv), radius: 0.08, color: P.accent }), 'gap-vbm'), item(new M.Dot({ point: pt(xc, yc), radius: 0.08, color: P.accent }), 'gap-cbm'), item(line(xv, yv, xc, yv, P.muted, 2), 'gap-horizontal', '', true), item(line(xc, yv, xc, yc, P.accent, 3), 'gap-vertical', '', true), item(text(`Eᵍ ${gap.gap.toFixed(2)} eV (${gap.direct ? 'direct' : 'indirect'})`, (L + R) / 2, B - 0.8, P.fg, 22), 'gap-label'));
        } else if (s.gap && gap.metal) o.push(item(text('Metal: band crosses Eᶠ', (L + R) / 2, B - 0.8, P.fg, 22), 'gap-label'));
        if (s.dos) { o.push(item(line(DL, B, DL, T), 'dos-axis-y'), item(line(DL, B, DR, B), 'dos-axis-x'), item(text('DOS', (DL + DR) / 2, B - 0.35, P.fg, 23), 'dos-label')); if (visibleDos.length >= 2) o.push(item(path(visibleDos.map(([e, g]) => [map(g, 0, gmax, DL, DR), y(e)]), P.series[1], 4), 'dos-curve', '', true)); if (s.fermi) o.push(item(line(DL, y(0), DR, y(0), P.muted, 2), 'dos-fermi', '', true)); }
        return o;
      });
      return { axes, layers };
    });
  }

  function xrdChart(def) {
    if (!Array.isArray(def.patterns) || def.patterns.length < 1 || def.patterns.length > 2 || def.patterns.some((p) => !p || typeof p.name !== 'string' || !Array.isArray(p.peaks) || !p.peaks.length || p.peaks.some((v) => !finite(v.twoTheta) || !finite(v.intensity) || v.intensity < 0) || (p.fwhm !== undefined && (!finite(p.fwhm) || p.fwhm <= 0)))) throw new Error('xrdChart: one or two valid nonempty patterns required');
    const all = def.patterns.flatMap((p) => p.peaks.map((v) => v.twoTheta));
    const lo = Math.floor((Math.min(...all) - 6) / 10) * 10, hi = Math.ceil((Math.max(...all) + 4) / 10) * 10;
    const grid = makeGrid(lo, hi, (hi - lo) / 1200), curves = def.patterns.map((p) => normalize(broaden(p.peaks, p.fwhm ?? 0.4, grid)));
    slide(def, { sticks: false, curve: false, hkl: false, compare: false }, (M, P, ss) => {
      const { text, line, path } = graphics(M, P), L = -5.8, R = 6, B = -2.2, T = 2.5;
      const x = (v) => map(v, lo, hi, L, R), y = (v) => B + v * (T - B);
      const axes = [line(L, B, R, B), line(L, B, L, T), text('2θ (degrees)', 0, B - 0.8, P.fg, 24), text('Intensity (a.u.)', L + 0.9, T + 0.35, P.fg, 23)];
      for (let i = 0; i <= 5; i++) { const t = lo + i * (hi - lo) / 5; axes.push(line(x(t), B, x(t), B - 0.1), text(Number(t.toFixed(1)), x(t), B - 0.35, P.muted, 22)); }
      const layers = ss.map((s) => {
        const o = [], compare = !!s.compare && def.patterns.length > 1, base = compare ? 0.5 : 0, scale = compare ? 0.47 : 1, a = def.patterns[0], max = Math.max(1e-9, ...a.peaks.map((p) => p.intensity));
        const yy = (v) => y(base + 0.88 * scale * v);
        const layout = compare ? 'split' : 'full';
        o.push(item(text(a.name, R - 0.8, y(base + 0.42 * scale), P.series[0], 22), 'pattern-a-name', layout));
        if (s.sticks) a.peaks.forEach((p, i) => o.push(item(line(x(p.twoTheta), y(base), x(p.twoTheta), yy(p.intensity / max), P.muted, 2), `stick-${i}`, layout, true)));
        if (s.curve) o.push(item(path(grid.map((t, i) => [x(t), yy(curves[0][i])]), P.series[0], 4), 'pattern-a', layout, true));
        if (s.hkl) a.peaks.filter((p) => p.hkl).sort((a, b) => b.intensity - a.intensity).slice(0, 5).forEach((p, i) => o.push(item(text(`(${p.hkl})`, x(p.twoTheta), Math.min(T + 0.1, yy(p.intensity / max) + 0.22), P.fg, 19), `hkl-${i}`, layout)));
        if (compare) { const b = def.patterns[1]; o.push(item(line(L, y(0.5), R, y(0.5), P.muted, 1), 'divider'), item(text(b.name, R - 0.8, y(0.18), P.series[1], 22), 'pattern-b-name')); if (s.curve) o.push(item(path(grid.map((t, i) => [x(t), y(0.88 * 0.47 * curves[1][i])]), P.series[1], 4), 'pattern-b', '', true)); }
        return o;
      });
      return { axes, layers };
    });
  }

  Object.assign(D, { bandChart, xrdChart, spectraMath: { findGap, dosFromBands, makeGrid, broaden, normalize } });
})();
