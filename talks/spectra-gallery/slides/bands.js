// Toy semiconductor: 1 bands; 2 Fermi level; 3 indirect gap; 4 broadened DOS.
// Toy metal: 1 bands and Fermi level; 2 focus crossing band; 3 broadened DOS.
// The cosine curves are synthetic and do not describe a real material.
{
  const n = 60, k = Array.from({ length: 3 * n + 1 }, (_, i) => i / (3 * n));
  const sAt = (i) => {
    const seg = Math.min(2, Math.floor(i / n)), t = (i - seg * n) / n;
    const [kx, ky] = seg === 0 ? [Math.PI * t, 0] : seg === 1 ? [Math.PI, Math.PI * t] : [Math.PI * (1 - t), Math.PI * (1 - t)];
    return (Math.cos(kx) + Math.cos(ky)) / 2;
  };
  function data(fn) {
    const columns = k.map((_, i) => fn(sAt(i)));
    return { k, kpath: ['Γ', 'X', 'M', 'Γ'].map((label, i) => ({ label, k: i / 3 })), bands: columns[0].map((_, b) => columns.map((c) => c[b])) };
  }
  Deck.bandChart({
    name: 'semiconductor', heading: 'Band structure: semiconductor',
    data: data((s) => [-2.4 - 0.5 * (1 - s), -0.2 - 0.9 * (1 - s), 0.6 + 0.9 * s * s, 2.2 + 0.6 * s]),
    notes: 'Synthetic cosine bands: VBM at Γ and CBM at X, with an indirect gap of 0.80 eV. DOS is sampled with Gaussian broadening.',
    steps: [
      { caption: 'Toy bands along Γ–X–M–Γ', state: { bands: true } },
      { caption: 'Fermi level between valence and conduction bands', state: { fermi: true } },
      { caption: 'The band extrema are at different k points', state: { gap: true } },
      { caption: 'Density of states with Gaussian broadening', state: { dos: true } },
    ],
  });
  Deck.bandChart({
    name: 'metal', heading: 'Band structure: metal',
    data: data((s) => [-2.6 - 0.6 * (1 - s), -0.5 + 1.2 * s, 1.4 - 0.9 * s]),
    notes: 'Synthetic bands: one sampled band crosses the Fermi level. DOS is broadened from the sampled band energies.',
    steps: [
      { caption: 'Another set of toy bands', state: { bands: true, fermi: true } },
      { caption: 'A band crosses the Fermi level', state: { focusBand: 1, gap: true } },
      { caption: 'The density of states is nonzero near the Fermi level', state: { focusBand: null, dos: true } },
    ],
  });
}
