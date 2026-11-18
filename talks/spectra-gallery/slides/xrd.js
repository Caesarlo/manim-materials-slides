// XRD: 1 diffraction sticks; 2 Gaussian broadening; 3 index the strongest peaks; 4 compare two patterns.
// Peak positions and intensities are synthetic and do not correspond to a real material.
{
  const peaks = [
    { twoTheta: 28.4, intensity: 100, hkl: '111' }, { twoTheta: 32.9, intensity: 28, hkl: '200' },
    { twoTheta: 47.3, intensity: 62, hkl: '220' }, { twoTheta: 56.1, intensity: 45, hkl: '311' },
    { twoTheta: 58.8, intensity: 9, hkl: '222' }, { twoTheta: 69.2, intensity: 14, hkl: '400' },
    { twoTheta: 76.4, intensity: 22, hkl: '331' }, { twoTheta: 78.7, intensity: 12, hkl: '420' },
  ];
  const shift = [0.3, 0.2, 0.35, 0.25, 0.3, 0.4, 0.3, 0.35], gain = [0.9, 1.2, 0.8, 1.1, 1.3, 0.9, 1, 1.1];
  Deck.xrdChart({
    name: 'xrd', heading: 'X-ray diffraction',
    patterns: [
      { name: 'Calculated', peaks, fwhm: 0.5 },
      { name: 'Comparison', peaks: peaks.map((p, i) => ({ twoTheta: p.twoTheta + shift[i], intensity: p.intensity * gain[i] })), fwhm: 1.1 },
    ],
    notes: 'Synthetic peaks. Broadening uses normalized Gaussians: each peak area is proportional to its supplied intensity. The two displayed curves are separately normalized.',
    steps: [
      { caption: 'Diffraction peak positions and intensities', state: { sticks: true } },
      { caption: 'Finite peak width produces a continuous pattern', state: { curve: true } },
      { caption: 'Index the strongest peaks', state: { hkl: true } },
      { caption: 'Compare a shifted and broadened pattern', state: { compare: true, hkl: false } },
    ],
  });
}
