# Live slides for materials talks

Slide decks drawn live in the browser: HTML for text, [manim-web](https://github.com/maloyan/manim-web)
for manim-style animations that play **one step per click**, and 3D add-ons: a **crystal-structure view** (atoms,
bonds, coordination polyhedra, layers, lattice vectors, element labels) and a turntable stage for molecules.
No build step and no rendered video — edit a slide, refresh. Decks work offline, straight from disk, in a light
theme (the default) and a dark one.

Forked from [ramithuh/protein-design-interactive-slides](https://github.com/ramithuh/protein-design-interactive-slides)
(MIT). The upstream demo is kept unchanged.

The earlier TypeScript/Vite implementation is preserved on the [legacy-v0 branch](https://github.com/Caesarlo/manim-materials-slides/tree/legacy-v0).

## Try it

Open the [materials demo](talks/materials-demo/index.html) directly in a recent Chrome, Edge or Firefox.
No npm, build, or network connection is needed for playback. Drag a crystal to rotate it and use the
scroll wheel to zoom.

| Demo | What to look for |
| --- | --- |
| [Crystal gallery](talks/crystal-gallery/index.html) | Labels, supercells, layer highlights, and GNN message passing |
| [Plot gallery](talks/plot-gallery/index.html) | ECharts examples, line and scatter plots, funnels, convex hulls, and phonon dispersion |
| [Spectra gallery](talks/spectra-gallery/index.html) | Electronic bands, density of states, and X-ray diffraction |
| [LLM gallery](talks/llm-gallery/index.html) | Tokens, attention, sampling, and agent workflows; no live inference or retrieval |
| [Upstream example](talks/example/index.html) | Molecule and protein views from the original template |

For the speaker view and its shared laser pointer and 3D poses, serve the repo over HTTP:

```bash
python -m http.server 8000
```

Open [the materials demo on localhost](http://localhost:8000/talks/materials-demo/), then press **S**.

| Key | Action |
| --- | --- |
| → ← / left, right click | next / previous step |
| S | speaker view (notes, timer, next slide) |
| O | overview |
| F | fullscreen |
| T | dark / light theme (or `?theme=dark`) |
| L | laser pointer (also shown in the speaker view, both ways) |

## Crystal structures

```bash
# a CIF -> the unit cell the view draws (uv installs gemmi on the fly)
uv run tools/prep_crystal.py tools/samples/SrTiO3.cif talks/my_talk/data/my_crystal.js --name "SrTiO₃"
```

In a copy of the materials demo, load `data/my_crystal.js` before the slide script in `index.html`.
The output filename supplies the data key (`my_crystal` below).

```js
Deck.crystalSlide({
  name: 'srtio3', data: 'my_crystal', heading: 'Perovskite SrTiO₃', polyhedra: ['Ti'],
  steps: [
    { title: 'The unit cell', sub: 'Pm-3m, a = 3.905 Å', show: { cell: 1, atoms: 1 } },
    { title: 'Bonds', sub: "pymatgen's rule", show: { bonds: 1 } },
    { title: 'TiO₆ octahedron', sub: 'Sr fades', show: { polyhedra: 1 }, dim: ['Sr'], fly: { dir: [1, 0.6, 0.5], zoom: 1.5 } },
  ],
});
```

Bonds are **pymatgen's rule** (JmolNN): two atoms are bonded when their distance is above 0.4 Å and at most the sum
of their Jmol radii plus 0.45 Å. The rule is exported once to `web/addons/bond_rules.js` by
`uv run tools/export_bond_rules.py`, so the browser needs no Python. The view is lit from the viewer's side, so a
crystal turned to its back is not dark. More in [AGENTS.md](AGENTS.md) ("The crystal add-on").

## Make your own talk

Start with the [component handbook](docs/handbook/README.md) for layout recipes and a walkthrough.
Use `Deck.echart` with native Apache ECharts options for new standard charts (bar, line, scatter, heatmap).
Use `Deck.manim` for custom step-by-step animations, such as geometric constructions or moving formulas,
and `Deck.crystalSlide` for interactive crystal structures.

```bash
cp -r talks/materials-demo talks/my_talk
# edit talks/my_talk/index.html (slide order, sections) and talks/my_talk/slides/*.js

# One-time setup for the headless browser checker:
python -m pip install playwright
python -m playwright install chromium
python tools/check_deck.py talks/my_talk --back   # both themes, forward/back; screenshots in talks/my_talk/check/
```

A slide is one module:

```js
Deck.slide('hello', {
  steps: 2,
  notes: 'what to say',
  mount(frame, { palette: P, M }) {
    frame.innerHTML = `<h2 class="deck-heading reveal-in in">Hello</h2><div class="deck-stage"></div>`;
    const stage = Deck.manim(frame.querySelector('.deck-stage'), {
      build: () => ({ c: new M.Circle({ color: P.accent }), s: new M.Square({ color: P.fg }) }),
      steps: [({ c }) => [new M.Create(c)], ({ c, s }) => [new M.Transform(c, s)]],
    });
    return { enter: stage.go, freeze: stage.freeze, destroy: stage.dispose };
  },
});
```

[AGENTS.md](AGENTS.md) has the full conventions — the slide contract, the design language (type scale, layout
grid, colours, components), the manim-web stage, the 3D add-on, data files and checking. Point your coding
agent at it.

## Export to PDF

For a conference upload or a handout, install Pillow (`python -m pip install pillow`) in addition to
the Playwright setup above:

```bash
python tools/export_pdf.py talks/my_talk                  # talks/my_talk/my_talk.pdf, a page per slide
python tools/export_pdf.py talks/my_talk --steps all      # a page per click
python tools/export_pdf.py talks/my_talk --theme dark --scale 2 --pngs previews/   # sharper, plus PNG previews
```

Pages are pictures of the live slides (3D included), so the text is not selectable.

## Publish

The decks are a static site, so any static host works. To publish with Cloudflare Pages, connect a Pages
project to your GitHub repository and use these settings. Pushes to the configured production branch
will then rebuild and publish the site.

| Setting | Value |
| --- | --- |
| Build command | `bash tools/build_site.sh` |
| Build output directory | `site` |

`tools/build_site.sh` assembles `index.html` (the front page, which opens the materials demo), `talks/`, `web/`
and `vendor/`, and nothing else from the repo. To upload by hand instead (uncommitted work, or a project not
connected to Git), with `wrangler login` done once: `tools/deploy_pages.sh <project>`.
Both scripts include the working copy's entire `talks/` directory. Run them from a checkout containing
only talks you intend to publish.

## What's in the box

- `web/deck.js`, `web/deck.css` — runtime and design language: 16:9 frames that scale to any screen, a
  type scale, a section footer with per-topic progress, step reveals, a numbered points column, captions,
  light/dark themes, a laser pointer, and a WebGL budget so many 3D slides don't exhaust the browser.
- `web/manim.js` — `Deck.manim`: write what each click plays; going back rebuilds the scene at that step.
- `web/plots.js` — `Deck.groupedBars`: bar charts that grow a group or a series per click.
- `web/echarts.js` — `Deck.echart`: theme, slide steps, and lifecycle for locally bundled Apache ECharts.
  See the [plot gallery source](talks/plot-gallery/slides/echarts.js) for a working example.
- Optional data-driven plots: `web/line_chart.js`, `funnel_chart.js`, `hull_chart.js`, `phonon_chart.js` and `spectra.js`.
- Optional educational LLM slides and calculations: `web/llm_math.js`, `llm.js` and `llm_flow.js`.
- `web/addons/crystal_legend.js` — an optional legend for a hand-built crystal view.
- `tools/prep_csv.py` — convert CSV/TSV to a `window.DATA` script that works offline. Usage and component loading order are in [the migrated-components guide](docs/handbook/06-migrated-components.md).
- `web/addons/crystal.js`, `crystal_logic.js`, `bond_rules.js` — `Deck.CrystalView`, `Deck.crystalSlide`: crystal
  structures with pymatgen's bonding rule. `tools/prep_crystal.py` (CIF → unit cell), `tools/export_bond_rules.py`.
- `web/addons/` (the molecule add-on, from the upstream template) — `Deck.turntable` (drag/zoom 3D stage, with eased camera moves for close-ups and pans),
  `Deck.molstar` (outlines, ambient occlusion and lighting tuned against Mol*), `Deck.cartoon` (protein
  cartoons built like Mol*'s), `Deck.ballStick` and `Deck.cages` (atoms, and wireframe cages for targets).
- `talks/example/slides/design_check.js` (upstream demo, biology) — two slides checking a generated enzyme design against its request:
  target cages, a switch, zooms into the requested residues and out again, then into a clash elsewhere.
- `talks/example/slides/alphabet.js` — the 20 amino acids, flown out of a grid and joined into a chain
  (HTML, SVG and CSS transitions alone), then the chain lifted off the page into its real 3D shape and
  stripped to its backbone (the 3D add-on).
- `tools/prep_protein.py` — any PDB/mmCIF chain → cartoon data. `tools/prep_amino_acids.py` — the alphabet's
  drawings and the 3D stretch (needs RDKit). `tools/check_deck.py` — headless check.
- `docs/handbook/` — **the component handbook**: which component for which need, layout recipes, the crystal and
  animation chapters, tools and the verification checklist. Start at [docs/handbook/README.md](docs/handbook/README.md).
- `docs/components.md` — the component index, generated from each `web/` file's header comment: a new component's header
  comment is its documentation (`python tools/gen_components.py`; `python tools/check_docs.py` checks the docs).

## How the example talk's proteins are drawn

(Upstream's molecule slides, kept for reference; the crystal view does not use these.) No protein-viewer library runs in the browser. The 3D slides use three.js, which comes bundled inside
manim-web (`M.THREE`), and code in `web/addons/` written for this repo:

| Piece | What it is |
| --- | --- |
| `cartoon.js` | Protein cartoons (helices, strands with arrows, loops), reimplementing Mol*'s cartoon: the same spline, ribbon facing and sizes. Not Mol* itself. |
| `molstar.js` | A render pass for the Mol* look: outlines, ambient occlusion, matte lighting, depth fog, tuned side by side against Mol*. |
| `atoms.js` | Instanced ball-and-stick and wireframe cages (for requested positions). |
| manim-web `Molecule3D` | Ball-and-stick for small molecules (the caffeine and peptide slides). |

The data those slides read is prepared once, in Python, by the scripts in `tools/`:

| Package | Used for |
| --- | --- |
| [gemmi](https://gemmi.readthedocs.io) | reading PDB/mmCIF: residues, atoms, helix and sheet records |
| numpy | geometry: centring, principal axes, the ribbons' frames |
| [mdtraj](https://www.mdtraj.org) (optional) | secondary structure (DSSP) for files without helix/sheet records, e.g. generated designs |
| [RDKit](https://www.rdkit.org) | the amino-acid drawings and small-molecule conformers |

## Requirements

A recent Chrome, Edge or Firefox is enough for playback. Python is only needed for tools, including the
optional local HTTP server. The crystal tools use [uv](https://docs.astral.sh/uv/) to install their dependencies
(`gemmi` for `prep_crystal.py`, `pymatgen` for `export_bond_rules.py`). The upstream example's tools also use
`gemmi`, `numpy`, and `rdkit` (`mdtraj` is optional, for DSSP).

## License

[MIT](LICENSE): use it, change it, build your own talks on it (they can stay private); keep the notice in copies
of the template's code. The bundled libraries and font in `vendor/` keep their own licences, in each folder:
manim-web, three.js and Reveal.js are MIT, Apache ECharts is Apache-2.0, and Lato is SIL OFL.
The example structures 1UBQ and 1OS7 come from the PDB, which is public domain (CC0).

## Credits

**Bundled** in `vendor/`, each with its licence: [manim-web](https://github.com/maloyan/manim-web) 0.39.4 by
Narek Maloyan (MIT), which also brings [three.js](https://threejs.org) (MIT); [Reveal.js](https://revealjs.com)
6.0.1 (MIT); [Apache ECharts](vendor/echarts/README.md) 6.1.0 (Apache-2.0); the [Lato](https://www.latofonts.com)
font (SIL OFL).

**Crystals.** Bonds follow the JmolNN rule of [pymatgen](https://pymatgen.org) (MIT), and its table of Jmol radii
(`bonds_jmol_ob.yaml`, Jmol's values from OpenBabel), exported to `web/addons/bond_rules.js` by
`tools/export_bond_rules.py`; unit cells are read by gemmi. The crystal view is a port of the earlier
manim-materials-slides' `CrystalView`. If you use these slides in published work, cite:

- pymatgen: S. P. Ong et al., *Python Materials Genomics (pymatgen): A robust, open-source python library for materials
  analysis*, Comput. Mater. Sci. 68, 314–319 (2013). [doi:10.1016/j.commatsci.2012.10.028](https://doi.org/10.1016/j.commatsci.2012.10.028)

The sample CIFs in `tools/samples/` (SrTiO₃, Bi₂Te₃) came over from the earlier project without a recorded source:
record where your structures come from (database id, paper) when you use them in a real talk.

**Proteins and molecules** (the upstream example talk). The cartoons and the 3D look (`web/addons/cartoon.js`, `molstar.js`) reimplement
the approach of [Mol*](https://molstar.org) (MIT), tuned side by side against it; no Mol* code is bundled. Element
colours are Jmol's. If you use these slides in published work, cite the tools they stand on:

- Mol*: D. Sehnal et al., *Mol\* Viewer: modern web app for 3D visualization and analysis of large biomolecular
  structures*, Nucleic Acids Res. 49, W431–W437 (2021). [doi:10.1093/nar/gkab314](https://doi.org/10.1093/nar/gkab314)
- gemmi: M. Wojdyr, *GEMMI: A library for structural biology*, J. Open Source Softw. 7, 4200 (2022).
  [doi:10.21105/joss.04200](https://doi.org/10.21105/joss.04200)
- MDTraj: R. T. McGibbon et al., *MDTraj: a modern open library for the analysis of molecular dynamics
  trajectories*, Biophys. J. 109, 1528–1532 (2015). [doi:10.1016/j.bpj.2015.08.015](https://doi.org/10.1016/j.bpj.2015.08.015);
  its secondary structure is DSSP: W. Kabsch and C. Sander, Biopolymers 22, 2577–2637 (1983).
  [doi:10.1002/bip.360221211](https://doi.org/10.1002/bip.360221211)
- RDKit: open-source cheminformatics, [rdkit.org](https://www.rdkit.org)
- NumPy: C. R. Harris et al., *Array programming with NumPy*, Nature 585, 357–362 (2020).
  [doi:10.1038/s41586-020-2649-2](https://doi.org/10.1038/s41586-020-2649-2)

**Structures**, from the [Protein Data Bank](https://www.rcsb.org) (H. M. Berman et al., Nucleic Acids Res. 28,
235–242 (2000), [doi:10.1093/nar/28.1.235](https://doi.org/10.1093/nar/28.1.235)):

- [1UBQ](https://www.rcsb.org/structure/1UBQ), ubiquitin: S. Vijay-Kumar, C. E. Bugg and W. J. Cook, J. Mol. Biol.
  194, 531–544 (1987). [doi:10.1016/0022-2836(87)90679-6](https://doi.org/10.1016/0022-2836(87)90679-6)
- [1OS7](https://www.rcsb.org/structure/1OS7), TauD with iron, α-ketoglutarate and taurine (the enzyme design
  task): J. R. O'Brien et al., Biochemistry 42, 5547–5554 (2003). [doi:10.1021/bi0341096](https://doi.org/10.1021/bi0341096)

The caffeine coordinates are an RDKit conformer; the enzyme design on the design-check slides is a generated
structure, not a deposited one.
