// Three-dimensional crystal view (three.js): ball and stick, the cell's edges, coordination polyhedra, element
// labels with leader lines, the a/b/c lattice vectors, and the camera moves. Ported from CrystalView.ts of the
// earlier manim-materials-slides, which looked better than the stock molecule stage: its own renderer, matte
// ball-and-stick with soft lights, muted element colours, labels in a row above the structure. Differences from
// the original: plain JS on the bundled three.js (window.ManimWeb.THREE, no OrbitControls or ConvexGeometry, so
// a small orbit control and hullFaces from crystal_logic.js stand in), colours from the deck's palette, and
// bonds by pymatgen's rule (bond_rules.js). Load bond_rules.js and crystal_logic.js before this file.
//
//   const built = Deck.crystalLogic.build(data.srtio3, { repeat: [1, 1, 1], polyhedra: ['Ti'] });
//   const view = new Deck.CrystalView(host, built, { orientation: [0, Math.PI / 2, 0] });  // host: an empty div
//   view.show({ cell: 1, atoms: 1, bonds: 0, polyhedra: 0 })   // target visibility 0..1 per part, eased
//   view.dim(['Sr'], 0.1)                                        // fade elements, so others stand out
//   await view.flyTo({ dir: [1, 0.6, 0.5], target: [1.9, 1.9, 1.9], zoom: 1.4 }, 1400)   // camera move, c up
//   view.setLabels(1, ['Sr', 'Ti']); view.setAxes(1)             // element labels / a, b, c arrows
//   view.highlight({ els: ['Ti'], indices: [3] })                // 1.25x and an outline; null clears
//   view.focusLayer({ axis: 'z', from: 0.2, to: 0.47 })          // fractions of the drawn cell; others fade to 10 %
//   view.setNodes(1)                                             // ball and stick -> a graph: small nodes, thin edges
//   view.setCutoff(3.0)                                          // Å: neighbour graph within a cutoff (dashed grey)
//   view.setGnn({ center: 'Ti', hops: 1 })                       // message passing: colour by hop, fade beyond
//   view.snap()                                                  // jump to the targets, no easing
//   view.dispose()                                               // from the slide's destroy
//
// Or a whole slide, one click per step (later steps inherit earlier ones, so jumping and going back are safe):
//
//   Deck.crystalSlide({ name: 'srtio3', data: 'srtio3', heading: 'Perovskite SrTiO₃', polyhedra: ['Ti'],
//     steps: [{ title: 'Unit cell', sub: 'Pm-3m', show: { cell: 1, atoms: 1 } },
//             { title: 'Bonds', sub: '…', show: { bonds: 1 } },
//             { title: 'Octahedra', sub: '…', show: { polyhedra: 1 }, dim: ['Sr'], fly: { dir: [1, 0.5, 1], zoom: 1.5 } }] })
//
// Units are Å, origin at the drawn cell's centre, c up. Drag turns, the wheel zooms; a plain click still steps the deck.
(function () {
  'use strict';

  const THREE = window.ManimWeb.THREE;
  const L = window.Deck.crystalLogic;

  // Element colours of the earlier palette: muted, one hue per element, readable on both themes. Elements it does
  // not list fall back to palette.cpk, then palette.muted.
  const ELEMENT_COLOURS = {
    O: '#c8553d', Ti: '#3b6fb6', Sr: '#3f8f7b', Ba: '#3f8f7b', Ca: '#6fae9c',
    Bi: '#7a62a8', Te: '#d98e04', Se: '#e0b04a', Sb: '#a58bc9', Pb: '#6b7280',
    Sn: '#8c9aa8', Si: '#9aa1ad', Ge: '#7d8896', Li: '#c98ca8', Na: '#8aa3d4',
    Cu: '#c9743d', Fe: '#9a5a3c', Mg: '#6aa27a', Zn: '#7a8fa6', S: '#d6b73a',
  };
  const RADIUS = { O: 0.42, Ti: 0.5, Sr: 0.7, Ba: 0.75, Bi: 0.68, Te: 0.62, Se: 0.55, Pb: 0.7, Sn: 0.6, Si: 0.5 };
  const HL_SCALE = 0.25;       // highlight enlarges by 1.25
  const LAYER_DIM = 0.1;
  const NODE_R = 0.3;          // atom radius at nodes = 1 (Å)
  const NODE_BOND = 0.55;      // bond thickness at nodes = 1
  const GNN_DIM = 0.12;        // atoms and bonds beyond `hops`
  const GNN_TINT = 0.55;       // furthest hops drift this far toward white
  const GNN_CENTER_SCALE = 0.6;
  const GNN_BOND_SCALE = 1.2;
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // A stand-in for three's OrbitControls (not in the bundled build): drag turns about `target` with c up, the wheel
  // zooms, both eased. update() reads the camera's position, so a camera move that lerps it is picked up.
  class Orbit {
    constructor(camera, dom, { minDistance, maxDistance }) {
      this.camera = camera; this.dom = dom; this.target = new THREE.Vector3();
      this.minDistance = minDistance; this.maxDistance = maxDistance;
      this.dTheta = 0; this.dPhi = 0; this.dLog = 0; this.damping = 0.08; this.drag = null;
      this.onDown = (e) => {
        if (e.button !== 0) return;
        this.drag = { x: e.clientX, y: e.clientY };
        dom.setPointerCapture(e.pointerId);
      };
      this.onMove = (e) => {
        if (!this.drag) return;
        const k = (2 * Math.PI) / dom.clientHeight;
        this.dTheta -= (e.clientX - this.drag.x) * k;
        this.dPhi -= (e.clientY - this.drag.y) * k;
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      };
      this.onUp = () => { this.drag = null; };
      this.onWheel = (e) => { e.preventDefault(); this.dLog += e.deltaY * 0.0012; };
      dom.addEventListener('pointerdown', this.onDown);
      dom.addEventListener('pointermove', this.onMove);
      dom.addEventListener('pointerup', this.onUp);
      dom.addEventListener('pointercancel', this.onUp);
      dom.addEventListener('wheel', this.onWheel, { passive: false });
      dom.style.touchAction = 'none';
    }
    update() {
      const off = this.camera.position.clone().sub(this.target);
      let r = off.length();
      let phi = Math.acos(Math.min(1, Math.max(-1, off.z / r)));
      let theta = Math.atan2(off.y, off.x);
      const d = this.damping;
      theta += this.dTheta * d;
      phi = Math.min(Math.PI - 0.05, Math.max(0.05, phi + this.dPhi * d));
      r = Math.min(this.maxDistance, Math.max(this.minDistance, r * Math.exp(this.dLog * d)));
      this.dTheta *= 1 - d; this.dPhi *= 1 - d; this.dLog *= 1 - d;
      off.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
      this.camera.position.copy(this.target).add(off);
      this.camera.lookAt(this.target);
    }
    dispose() {
      const dom = this.dom;
      dom.removeEventListener('pointerdown', this.onDown);
      dom.removeEventListener('pointermove', this.onMove);
      dom.removeEventListener('pointerup', this.onUp);
      dom.removeEventListener('pointercancel', this.onUp);
      dom.removeEventListener('wheel', this.onWheel);
    }
  }

  class CrystalView {
    constructor(host, built, { orientation = [0, 0, 0], palette = window.Deck.palette } = {}) {
      this.host = host;
      this.built = built;
      this.P = palette;
      this.onRender = null;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 500);
      this.raf = 0;
      this.last = performance.now();
      this.fly = null;
      this.orient = new THREE.Euler(...orientation);
      this.vis = { cell: { cur: 1, to: 1 }, atoms: { cur: 1, to: 1 }, bonds: { cur: 0, to: 0 }, polyhedra: { cur: 0, to: 0 } };
      this.elOp = new Map();
      this.atomMats = []; this.bondMats = []; this.polyMats = [];
      this.hl = []; this.lay = []; this.layerMaskNow = []; this.atomO = []; this.atomR = [];
      this.cutoff = null;
      this.extraGroup = new THREE.Group();
      this.extraEdges = new Map();
      this.gnnSpec = null;
      this.nodesV = { cur: 0, to: 0 };
      this.gnnOn = { cur: 0, to: 0 };
      this.gnnLv = []; this.gnnCt = []; this.gnnBd = built.bonds.map(() => ({ cur: 0, to: 0 }));
      this.baseCol = [];
      const P = this.P;
      this.accentCol = new THREE.Color(P.accent);
      this.whiteCol = new THREE.Color(0xffffff);
      this.shells = [];
      this.labelVis = { cur: 0, to: 0 };
      this.labelEls = new Map();
      this.leaders = new Map();
      this.axesVis = { cur: 0, to: 0 };
      this.axesGroup = new THREE.Group();
      this.axesMats = [];
      this.axisLabels = [];
      this.axisColours = [P.accent, P.series[1], P.series[3]];
      this.cellMat = new THREE.LineBasicMaterial({ color: P.muted, transparent: true });
      this.owned = [];
      this.graph = L.atomGraph(built);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.renderer.setClearColor(0xffffff, 0);
      host.append(this.renderer.domElement);

      // The lights ride on the camera, so they always shine from the viewer's side, slanted from above left: turn the
      // crystal to its back and it is lit the same way, with the shading that gives each atom its depth. (Lights fixed
      // in the scene left the far side dark.) The camera must be in the scene for its children to be lit and moved.
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0xcfd3da, 1.2));
      this.scene.add(this.camera);
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(-5, 8, 9);          // camera space: x right, y up, z toward the viewer
      key.target.position.set(0, 0, -10);   // ahead of the camera: the light travels forward, down and to the right
      const fill = new THREE.DirectionalLight(0xffffff, 0.6);
      fill.position.set(7, -4, 6);
      fill.target.position.set(0, 0, -10);
      this.camera.add(key, key.target, fill, fill.target);

      const outer = new THREE.Group();   // turns the whole model about the cell's centre
      outer.rotation.copy(this.orient);
      this.scene.add(outer);
      const group = new THREE.Group();
      group.position.set(...built.center).multiplyScalar(-1);   // origin at the drawn cell's centre
      outer.add(group);
      this.buildCell(group);
      this.buildAtoms(group);
      this.buildBonds(group);
      group.add(this.extraGroup);
      this.buildPolyhedra(group);
      this.layerMaskNow = built.atoms.map(() => true);
      this.buildAxes(group);
      this.buildLabels();

      this.camera.up.set(0, 0, 1);   // crystallographic convention: c up
      this.controls = new Orbit(this.camera, this.renderer.domElement, { minDistance: built.radius * 1.2, maxDistance: built.radius * 8 });
      this.camera.position.set(1, 0.75, 0.55).normalize().multiplyScalar(this.fitDistance(1));
      // the pose shared with the other window of the deck (speaker view): the camera's offset from its target in units of the
      // fitting distance (so windows of any size agree), and the target
      this.share = window.Deck.shareView ? window.Deck.shareView(host, {
        get: () => { const f = this.fitDistance(1), t = this.controls.target, o = this.camera.position; return [(o.x - t.x) / f, (o.y - t.y) / f, (o.z - t.z) / f, t.x, t.y, t.z]; },
        set: (s) => {
          const f = this.fitDistance(1), c = this.controls;
          if (this.fly) return;
          c.target.set(s[3], s[4], s[5]);
          this.camera.position.set(s[3] + s[0] * f, s[4] + s[1] * f, s[5] + s[2] * f);
          c.dTheta = c.dPhi = c.dLog = 0;
        },
      }) : null;
      this.controls.target.set(0, 0, 0);
      this.controls.update();

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
      this.resize();
      this.loop = this.loop.bind(this);
      this.loop();
    }

    colour(el) { return ELEMENT_COLOURS[el] ?? (this.P.cpk[el] && el !== 'other' ? this.P.cpk[el] : this.P.muted); }
    radiusOf(el) { return RADIUS[el] ?? 0.15 + 0.3 * (window.Deck.bondRules.radii[el] ?? 1.2); }
    own(x) { this.owned.push(x); return x; }

    // ---- build ---------------------------------------------------------
    buildCell(g) {
      // corner indices are three binary digits ijk: two corners differing in one digit share an edge
      const k = this.built.corners.map((p) => new THREE.Vector3(...p));
      const pts = [];
      for (let a = 0; a < 8; a++) for (const bit of [1, 2, 4]) if (!(a & bit)) pts.push(k[a], k[a | bit]);
      const lines = new THREE.LineSegments(this.own(new THREE.BufferGeometry().setFromPoints(pts)), this.cellMat);
      g.add(lines);
      this.cell = lines;
    }

    buildAtoms(g) {
      const geo = this.own(new THREE.SphereGeometry(1, 40, 28));
      for (const a of this.built.atoms) {
        const mat = this.own(new THREE.MeshStandardMaterial({ color: this.colour(a.el), roughness: 0.45, metalness: 0.05, transparent: true }));
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(...a.pos);
        mesh.scale.setScalar(this.radiusOf(a.el));
        g.add(mesh);
        this.atomMats.push({ mesh, mat, el: a.el });
        this.hl.push({ cur: 0, to: 0 });
        this.gnnLv.push({ cur: 0, to: 0 });
        this.gnnCt.push({ cur: 0, to: 0 });
        this.baseCol.push(new THREE.Color(this.colour(a.el)));
        this.lay.push({ cur: 1, to: 1 });
        // highlight outline: a slightly larger back-face shell, so only a ring shows
        const sm = this.own(new THREE.MeshBasicMaterial({ color: this.P.fg, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }));
        const shell = new THREE.Mesh(geo, sm);
        shell.position.set(...a.pos);
        shell.visible = false;
        g.add(shell);
        this.shells.push({ mesh: shell, mat: sm });
        if (!this.elOp.has(a.el)) this.elOp.set(a.el, { cur: 1, to: 1 });
      }
    }

    buildBonds(g) {
      // each bond splits at its midpoint, each half in its own atom's colour (VESTA style) and dimmed with that atom
      const geo = this.own(new THREE.CylinderGeometry(0.09, 0.09, 1, 16));
      const up = new THREE.Vector3(0, 1, 0);
      this.built.bonds.forEach(([p, q], bi) => {
        const A = new THREE.Vector3(...this.built.atoms[p].pos), B = new THREE.Vector3(...this.built.atoms[q].pos);
        const M = A.clone().add(B).multiplyScalar(0.5);
        for (const [from, to, el, atom] of [[A, M, this.built.atoms[p].el, p], [B, M, this.built.atoms[q].el, q]]) {
          const mat = this.own(new THREE.MeshStandardMaterial({ color: this.colour(el), roughness: 0.5, transparent: true, opacity: 0 }));
          const m = new THREE.Mesh(geo, mat);
          m.position.copy(from).add(to).multiplyScalar(0.5);
          m.scale.set(1, from.distanceTo(to), 1);
          m.quaternion.setFromUnitVectors(up, to.clone().sub(from).normalize());
          g.add(m);
          this.bondMats.push({ mat, mesh: m, base: new THREE.Color(mat.color), el, atom, bond: bi });
        }
      });
    }

    buildPolyhedra(g) {
      for (const poly of this.built.polyhedra) {
        const center = this.built.atoms[poly.center].el;
        const color = this.colour(center);
        const pts = poly.ligands.map((i) => this.built.atoms[i].pos);
        const pos = [];
        for (const f of L.hullFaces(pts)) {
          for (let t = 1; t < f.length - 1; t++) [f[0], f[t], f[t + 1]].forEach((i) => pos.push(...pts[i]));
        }
        const geo = this.own(new THREE.BufferGeometry());
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.computeVertexNormals();
        const face = this.own(new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0, roughness: 0.7, side: THREE.DoubleSide, depthWrite: false }));
        const edge = this.own(new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 }));
        const faceMesh = new THREE.Mesh(geo, face);
        const edgeLines = new THREE.LineSegments(this.own(new THREE.EdgesGeometry(geo, 20)), edge);
        g.add(faceMesh, edgeLines);
        this.polyMats.push({ mat: face, mesh: faceMesh, base: 0.22, center, atom: poly.center }, { mat: edge, mesh: edgeLines, base: 0.9, center, atom: poly.center });
      }
    }

    buildAxes(g) {
      // the a, b, c lattice vectors from the drawn cell's origin corner (one cell long): cylinder and cone
      const up = new THREE.Vector3(0, 1, 0);
      const O = new THREE.Vector3(...this.built.corners[0]);
      this.built.lattice.forEach((v, i) => {
        const vec = new THREE.Vector3(...v), len = vec.length(), dir = vec.clone().normalize();
        const headLen = Math.min(0.9, len * 0.3), shaftLen = len - headLen;
        const mat = this.own(new THREE.MeshStandardMaterial({ color: this.axisColours[i], roughness: 0.5, transparent: true, opacity: 0 }));
        const shaft = new THREE.Mesh(this.own(new THREE.CylinderGeometry(0.13, 0.13, 1, 16)), mat);
        shaft.scale.set(1, shaftLen, 1);
        shaft.position.copy(O).addScaledVector(dir, shaftLen / 2);
        shaft.quaternion.setFromUnitVectors(up, dir);
        const head = new THREE.Mesh(this.own(new THREE.ConeGeometry(0.36, headLen, 20)), mat);
        head.position.copy(O).addScaledVector(dir, shaftLen + headLen / 2);
        head.quaternion.setFromUnitVectors(up, dir);
        this.axesGroup.add(shaft, head);
        this.axesMats.push(mat);
        const div = this.makeLabel('abc'[i], this.axisColours[i]);
        div.style.fontStyle = 'italic';
        this.axisLabels.push({ div, tip: O.clone().addScaledVector(dir, len + 0.9) });
      });
      this.axesGroup.visible = false;
      g.add(this.axesGroup);
    }

    makeLabel(text, color) {
      const div = document.createElement('div');
      div.className = 'label3d';
      div.textContent = text;
      div.style.cssText = `color:${color};opacity:0;transition:none;-webkit-text-stroke:calc(var(--u) * 0.7) ${this.P.bg};paint-order:stroke fill;`;
      this.host.append(div);
      return div;
    }

    buildLabels() {
      // leader lines sit under the labels: one SVG layer, a line and an end dot per element
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
      this.host.append(svg);
      this.leaderSvg = svg;
      for (const el of L.elementsOf(this.built)) {
        const color = this.colour(el);
        const g = document.createElementNS(NS, 'g');
        g.setAttribute('opacity', '0');
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('stroke', color); line.setAttribute('stroke-width', '3');
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', '7'); dot.setAttribute('fill', color); dot.setAttribute('stroke', this.P.bg); dot.setAttribute('stroke-width', '2.5');
        g.append(line, dot);
        svg.append(g);
        this.leaders.set(el, g);
        this.labelEls.set(el, { div: this.makeLabel(el, color), cur: 0, to: 0 });
      }
    }

    // ---- control -------------------------------------------------------
    show(parts) { for (const [k, v] of Object.entries(parts)) this.vis[k].to = v; }
    dim(elements, opacity = 0.1) { for (const [el, s] of this.elOp) s.to = elements.includes(el) ? opacity : 1; }
    setLabels(vis, els) {
      this.labelVis.to = vis;
      for (const [el, l] of this.labelEls) l.to = !els || els.includes(el) ? 1 : 0;
    }
    setAxes(vis) { this.axesVis.to = vis; }
    highlight(spec) { L.resolveHighlight(this.built, spec).forEach((on, i) => { this.hl[i].to = on ? 1 : 0; }); }
    focusLayer(layer) {
      this.layerMaskNow = L.layerMask(this.built, layer);
      this.layerMaskNow.forEach((on, i) => { this.lay[i].to = on ? 1 : LAYER_DIM; });
    }
    setNodes(v) { this.nodesV.to = v; }

    // the shown atoms' neighbours within a cutoff (not a chemical bond criterion); null restores the bond graph
    setCutoff(cutoff) {
      if (cutoff === this.cutoff) return;
      this.cutoff = cutoff;
      this.graph = cutoff === null ? L.atomGraph(this.built) : L.atomGraph(this.built, { cutoff });
      for (const edge of this.extraEdges.values()) edge.to = 0;
      const key = (p, q) => `${Math.min(p, q)}:${Math.max(p, q)}`;
      const bonds = new Set(this.built.bonds.map(([p, q]) => key(p, q)));
      if (cutoff !== null) {
        for (const [p, q] of this.graph.edges) {
          const id = key(p, q);
          if (bonds.has(id)) continue;
          let edge = this.extraEdges.get(id);
          if (!edge) {
            const geo = this.own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...this.built.atoms[p].pos), new THREE.Vector3(...this.built.atoms[q].pos)]));
            const mat = this.own(new THREE.LineDashedMaterial({ color: this.P.muted, dashSize: 0.14, gapSize: 0.12, transparent: true, opacity: 0, depthWrite: false }));
            const line = new THREE.Line(geo, mat);
            line.renderOrder = -1;   // helper edges first, then atoms and bonds
            line.computeLineDistances();
            line.visible = false;
            this.extraGroup.add(line);
            edge = { line, mat, p, q, cur: 0, to: 0 };
            this.extraEdges.set(id, edge);
          }
          edge.to = 1;
        }
      }
      this.setGnn(this.gnnSpec);
    }

    // message passing: colour by hop from `center`, fade beyond `hops`; null fades out (keeps the last levels to ease)
    setGnn(spec) {
      this.gnnSpec = spec;
      if (!spec || L.resolveCenter(this.built, spec.center) < 0) { this.gnnOn.to = 0; return; }
      const c = L.resolveCenter(this.built, spec.center);
      this.gnnOn.to = 1;
      L.gnnLevels(this.built, this.graph, spec).forEach((v, i) => { this.gnnLv[i].to = v; this.gnnCt[i].to = i === c ? 1 : 0; });
      const d = L.hopDistances(this.graph, c);
      this.built.bonds.forEach(([p, q], bi) => { this.gnnBd[bi].to = d[p] <= spec.hops && d[q] <= spec.hops ? 1 : 0; });
    }

    smooths() {
      return [this.nodesV, this.gnnOn, ...this.gnnLv, ...this.gnnCt, ...this.gnnBd, ...this.extraEdges.values(), ...this.hl, ...this.lay, this.labelVis, this.axesVis, ...this.labelEls.values()];
    }

    // jump to the targets (for jumps and going back: no easing)
    snap() {
      for (const v of Object.values(this.vis)) v.cur = v.to;
      for (const s of this.elOp.values()) s.cur = s.to;
      for (const s of this.smooths()) s.cur = s.to;
      this.applyOpacity();
      this.updateOverlays();
    }

    fitDistance(zoom) {
      const half = (this.camera.fov * Math.PI) / 360;
      const fitV = this.built.radius / Math.sin(half);
      const fitH = this.built.radius / Math.sin(Math.atan(Math.tan(half) * this.camera.aspect));
      return (Math.max(fitV, fitH) * 1.3) / zoom;
    }

    // the camera looks from direction `dir` at `target` (Å from the cell's centre), zoom > 1 closer; ms 0: at once
    flyTo({ dir = [1, 0.75, 0.55], target = [0, 0, 0], zoom = 1 } = {}, ms = 1400) {
      if (this.fly) { this.fly.done(); this.fly = null; }
      const c1 = new THREE.Vector3(...target);
      const p1 = new THREE.Vector3(...dir).normalize().multiplyScalar(this.fitDistance(zoom)).add(c1);
      if (!ms) {
        this.camera.position.copy(p1);
        this.controls.target.copy(c1);
        this.controls.update();
        this.updateOverlays();
        return Promise.resolve();
      }
      return new Promise((done) => {
        this.fly = { t0: performance.now(), ms, p0: this.camera.position.clone(), p1, c0: this.controls.target.clone(), c1, done };
      });
    }

    // a point in Cartesian Å (the CIF's frame; the view subtracts the cell centre itself) -> pixels in the host
    project(p) { return this.toScreen(new THREE.Vector3(...p)); }
    toScreen(p) {
      const v = p.clone().sub(new THREE.Vector3(...this.built.center)).applyEuler(this.orient).project(this.camera);
      return { x: ((v.x + 1) / 2) * this.host.clientWidth, y: ((1 - v.y) / 2) * this.host.clientHeight, visible: v.z < 1 };
    }
    localPos(i) {
      const a = this.built.atoms[i].pos, c = this.built.center;
      return [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    }

    // place the HTML labels (elements, a/b/c) where the camera sees their atoms
    updateOverlays() {
      this.camera.updateMatrixWorld();
      const h = this.host.clientHeight;
      const tanHalf = Math.tan((this.camera.fov * Math.PI) / 360);
      const hide = () => {
        for (const l of this.labelEls.values()) l.div.style.opacity = '0';
        for (const g of this.leaders.values()) g.setAttribute('opacity', '0');
      };
      if (this.labelVis.cur <= 0.01) hide();
      else {
        // every atom's screen position, radius and depth (to keep labels off atoms that are hidden behind others)
        const scr = this.built.atoms.map((a, i) => {
          const s = this.toScreen(new THREE.Vector3(...a.pos));
          const w = new THREE.Vector3(...a.pos).sub(new THREE.Vector3(...this.built.center)).applyEuler(this.orient).applyMatrix4(this.camera.matrixWorldInverse);
          const depth = Math.max(-w.z, 1e-3);
          const r = this.atomR[i] ?? this.radiusOf(a.el);
          return { x: s.x, y: s.y, r: (r * (h / 2)) / (depth * tanHalf), depth, shown: this.atomO[i] > 0.4 };
        });
        // labels in a row above the structure, a thin leader in the element's colour down to its atom
        const shownAtoms = scr.filter((a) => a.shown);
        const top = shownAtoms.length ? Math.min(...shownAtoms.map((a) => a.y - a.r)) : h * 0.1;
        const tips = this.axesVis.cur > 0.01 ? this.axisLabels.map((al) => this.toScreen(al.tip)) : [];
        const items = [];
        for (const [el, l] of this.labelEls) {
          const pool = this.built.atoms.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0);
          const inLayer = pool.filter((i) => this.layerMaskNow[i]);
          const base = inLayer.length ? inLayer : pool;
          // avoid atoms right under an a/b/c tip, or the vertical leader would cross that label
          const clear = base.filter((k) => !tips.some((t) => Math.abs(scr[k].x - t.x) < h * 0.035 && scr[k].y > t.y));
          const i = L.pickLabelAtom(clear.length ? clear : base, scr);
          if (i === undefined || (l.to === 0 && l.cur < 0.01)) {
            l.div.style.opacity = '0';
            const g = this.leaders.get(el);
            if (g) g.setAttribute('opacity', '0');
            continue;
          }
          const dimmed = this.elOp.get(el)?.cur ?? 1;
          items.push({ el, i, o: l.cur * this.labelVis.cur * this.vis.atoms.cur * (0.15 + 0.85 * dimmed) * (0.15 + 0.85 * this.lay[i].cur) });
        }
        const W = this.host.clientWidth;
        const sizes = items.map((it) => { const d = this.labelEls.get(it.el).div; return { w: d.offsetWidth, h: d.offsetHeight }; });
        const rowH = sizes.reduce((m, z) => Math.max(m, z.h), 0);
        const rowY = Math.max(top - h * 0.045 - rowH / 2, rowH / 2 + 4);
        const blocked = this.axesVis.cur > 0.01
          ? this.axisLabels.map((al) => ({ s: this.toScreen(al.tip), w: al.div.offsetWidth, h: al.div.offsetHeight }))
              .filter((b) => Math.abs(b.s.y - rowY) < (b.h + rowH) / 2).map((b) => ({ x0: b.s.x - b.w / 2, x1: b.s.x + b.w / 2 }))
          : [];
        const xs = L.layoutRow(items.map((it, k) => ({ x: scr[it.i].x, w: sizes[k].w })), h * 0.015, W, blocked);
        items.forEach((it, k) => {
          const d = this.labelEls.get(it.el).div;
          d.style.left = `${xs[k]}px`;
          d.style.top = `${rowY}px`;
          d.style.opacity = String(it.o);
          const ln = this.leaders.get(it.el);
          if (ln) {
            const a = scr[it.i];
            ln.setAttribute('opacity', String(it.o));
            const line = ln.querySelector('line'), dot = ln.querySelector('circle');
            line.setAttribute('x1', String(xs[k])); line.setAttribute('y1', String(rowY + sizes[k].h / 2 - 2));
            line.setAttribute('x2', String(a.x)); line.setAttribute('y2', String(a.y));
            dot.setAttribute('cx', String(a.x)); dot.setAttribute('cy', String(a.y));
          }
        });
      }
      for (const al of this.axisLabels) {
        const s = this.toScreen(al.tip);
        al.div.style.left = `${s.x}px`;
        al.div.style.top = `${s.y}px`;
        al.div.style.opacity = s.visible ? String(this.axesVis.cur) : '0';
      }
    }

    // ---- loop ----------------------------------------------------------
    applyOpacity() {
      const N = this.nodesV.cur, G = this.gnnOn.cur;
      this.cellMat.opacity = this.vis.cell.cur * 0.8 * (1 - N);
      this.cell.visible = this.cellMat.opacity > 0.01;
      const A = this.vis.atoms.cur;
      this.atomMats.forEach((a, i) => {
        const lv = this.gnnLv[i].cur, ct = this.gnnCt[i].cur * G;
        const og = mix(1, GNN_DIM + (1 - GNN_DIM) * Math.pow(lv, 0.2), G);   // centre 1, fainter per hop, beyond hops 0.12
        const o = (this.elOp.get(a.el)?.cur ?? 1) * this.lay[i].cur * A * og;
        a.mat.opacity = o;
        // further hops lighter (toward white); the centre atom in the accent colour
        a.mat.color.copy(this.baseCol[i]);
        if (G > 0.001) a.mat.color.lerp(this.whiteCol, G * (1 - lv) * GNN_TINT);
        if (ct > 0.001) a.mat.color.lerp(this.accentCol, ct);
        this.atomO[i] = o;
        a.mesh.visible = o > 0.01;
        a.mat.depthWrite = o > 0.95;
        const k = this.hl[i].cur;
        const sc = mix(this.radiusOf(a.el), NODE_R, N) * (1 + HL_SCALE * k) * (1 + GNN_CENTER_SCALE * ct);
        this.atomR[i] = sc;
        a.mesh.scale.setScalar(sc);
        const sh = this.shells[i];
        sh.mesh.scale.setScalar(sc * 1.16);
        sh.mat.opacity = k * 0.75 * Math.min(1, o * 1.5);
        sh.mesh.visible = sh.mat.opacity > 0.01;
      });
      for (const b of this.bondMats) {
        const reach = this.gnnBd[b.bond].cur * G;
        b.mat.opacity = this.vis.bonds.cur * (this.elOp.get(b.el)?.cur ?? 1) * this.lay[b.atom].cur * A * mix(1, mix(GNN_DIM, 1, this.gnnBd[b.bond].cur), G);
        b.mesh.visible = b.mat.opacity > 0.01;
        const th = mix(1, NODE_BOND, N) * (1 + GNN_BOND_SCALE * reach);
        b.mesh.scale.x = th;
        b.mesh.scale.z = th;
        b.mat.color.copy(b.base);
        if (reach > 0.001) b.mat.color.lerp(this.accentCol, reach);
      }
      for (const edge of this.extraEdges.values()) {
        const { p, q } = edge;
        // end on the spheres' surfaces so the thin dashes do not run through translucent atoms
        const from = this.built.atoms[p].pos, to = this.built.atoms[q].pos;
        const length = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
        const start = Math.min(0.49, (this.atomR[p] + 0.025) / length);
        const end = 1 - Math.min(0.49, (this.atomR[q] + 0.025) / length);
        const positions = edge.line.geometry.getAttribute('position');
        positions.setXYZ(0, ...from.map((v, i) => mix(v, to[i], start)));
        positions.setXYZ(1, ...from.map((v, i) => mix(v, to[i], end)));
        positions.needsUpdate = true;
        const distances = edge.line.geometry.getAttribute('lineDistance');
        distances.setX(0, 0);
        distances.setX(1, length * (end - start));
        distances.needsUpdate = true;
        const reach = Math.min(this.gnnLv[p].cur, this.gnnLv[q].cur) > 0.001 ? 1 : 0;
        const dim = Math.min(this.elOp.get(this.built.atoms[p].el)?.cur ?? 1, this.elOp.get(this.built.atoms[q].el)?.cur ?? 1);
        edge.mat.opacity = edge.cur * this.vis.bonds.cur * A * dim * Math.min(this.lay[p].cur, this.lay[q].cur) * mix(1, mix(GNN_DIM, 1, reach), G);
        edge.line.visible = edge.mat.opacity > 0.01;
      }
      for (const p of this.polyMats) {
        p.mat.opacity = this.vis.polyhedra.cur * (1 - N) * p.base * (this.elOp.get(p.center)?.cur ?? 1) * this.lay[p.atom].cur;
        p.mesh.visible = p.mat.opacity > 0.01;
      }
      for (const m of this.axesMats) m.opacity = this.axesVis.cur;
      this.axesGroup.visible = this.axesVis.cur > 0.01;
    }

    // one frame: ease the values, move the camera, draw
    frame(now) {
      const dt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      const k = 1 - Math.exp(-dt * 5);
      for (const v of Object.values(this.vis)) v.cur += (v.to - v.cur) * k;
      for (const s of this.elOp.values()) s.cur += (s.to - s.cur) * k;
      for (const s of this.smooths()) s.cur += (s.to - s.cur) * k;
      this.applyOpacity();
      if (this.fly) {
        const f = this.fly, t = Math.min((now - f.t0) / f.ms, 1), e = ease(t);
        this.camera.position.lerpVectors(f.p0, f.p1, e);
        this.controls.target.lerpVectors(f.c0, f.c1, e);
        if (t >= 1) { this.fly = null; f.done(); }
      }
      this.controls.update();
      if (this.share) { if (this.fly) this.share.settle(); else this.share.changed(); }
      this.renderer.render(this.scene, this.camera);
      this.updateOverlays();
      if (this.onRender) this.onRender();
    }
    loop() {
      this.raf = requestAnimationFrame(this.loop);
      this.frame(performance.now());
    }
    // draw right now (the deck pictures off-screen slides from the canvas)
    render() {
      this.renderer.render(this.scene, this.camera);
      this.updateOverlays();
    }

    resize() {
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    dispose() {
      cancelAnimationFrame(this.raf);
      if (this.fly) { this.fly.done(); this.fly = null; }
      this.ro.disconnect();
      this.controls.dispose();
      if (this.share) this.share.dispose();
      this.owned.forEach((x) => x.dispose());
      this.renderer.dispose();
      this.renderer.forceContextLoss();   // hand the WebGL context back at once, or the next slide's getContext can stall
      this.renderer.domElement.remove();
      for (const l of this.labelEls.values()) l.div.remove();
      if (this.leaderSvg) this.leaderSvg.remove();
      for (const al of this.axisLabels) al.div.remove();
    }
  }

  // A slide that walks through a crystal, one click per step (see the top of the file). Each step may set
  // show, dim, fly, labels, labelFor, axes, highlight, layer, nodes, cutoff and gnn (as the CrystalView methods
  // above); a later step inherits what an earlier one set, so jumping to step k equals clicking through 1..k.
  function crystalSlide(def) {
    const steps = def.steps;
    window.Deck.slide(def.name, {
      steps: steps.length,
      interactive: true,
      smoothBack: true,   // one click back plays the step in reverse (fades and the camera move); the deck decides with Deck.start({ smoothBack })
      notes: def.notes,
      mount(frame, { palette: P, data, css, esc }) {
        css(`.cr-col { --col-left: 58%; --col-top: 24%; --col-gap: calc(2.2 * var(--u)); }
          .deck-frame .cr-stage { right: 40%; top: 14%; bottom: 6%; }   /* below the heading: the labels sit above the model */
          .cr-stage canvas { display: block; width: 100%; height: 100%; cursor: grab; }
          .cr-stage canvas:active { cursor: grabbing; }
          .label3d { position: absolute; transform: translate(-50%, -50%); font-size: var(--t-caption); font-weight: 600;
            white-space: nowrap; pointer-events: none; transition: opacity .4s ease; }`);
        frame.innerHTML = `
          <div class="deck-stage cr-stage"></div>
          ${def.heading ? `<h2 class="deck-heading reveal-in in">${esc(def.heading)}</h2>` : ''}
          ${Deck.points(steps.map((s, i) => ({ title: s.title, sub: s.sub, from: i + 1 })), { className: 'cr-col' })}`;
        const built = L.build(data[def.data], { repeat: def.repeat, polyhedra: def.polyhedra, polyhedronLigands: def.polyhedronLigands, bondCutoffs: def.bondCutoffs });
        const view = new CrystalView(frame.querySelector('.cr-stage'), built, { orientation: def.orientation, palette: P });
        view.show({ cell: 0, atoms: 0, bonds: 0, polyhedra: 0 });
        view.snap();
        return {
          enter(step, animate) {
            // every part starts at 0: show() leaves unlisted parts as they were, so going back would keep a later step's parts
            const parts = { cell: 0, atoms: 0, bonds: 0, polyhedra: 0 };
            let dim = [], fly = {}, labels = 0, axes = 0, labelFor, highlight = null, layer = null, nodes = 0, cutoff = null, gnn = null;
            for (const s of steps.slice(0, step)) {
              Object.assign(parts, s.show);
              if (s.dim) dim = s.dim;
              if (s.fly) fly = s.fly;
              if (s.labels !== undefined) labels = s.labels;
              if (s.labelFor !== undefined) labelFor = s.labelFor;
              if (s.axes !== undefined) axes = s.axes;
              if (s.highlight !== undefined) highlight = s.highlight;
              if (s.layer !== undefined) layer = s.layer;
              if (s.nodes !== undefined) nodes = s.nodes;
              if (s.cutoff !== undefined) cutoff = s.cutoff;
              if (s.gnn !== undefined) gnn = s.gnn;
            }
            view.show(parts);
            view.dim(dim, 0.08);
            view.setLabels(labels, labelFor);
            view.setAxes(axes);
            view.highlight(highlight);
            view.focusLayer(layer);
            view.setNodes(nodes);
            view.setCutoff(cutoff);
            view.setGnn(gnn);
            Deck.show(frame, step, animate);
            if (!animate) { view.snap(); return view.flyTo(fly, 0); }
            return view.flyTo(fly, animate === 'back' ? 700 : 1400);
          },
          freeze: () => view.render(),
          destroy: () => view.dispose(),
        };
      },
    });
  }

  Object.assign(window.Deck, { CrystalView, crystalSlide });
})();
