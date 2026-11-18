// Relative-frequency example from an analytic nearest-neighbour diatomic chain.
{
  const data=Deck.phononMath.diatomicChain(1,2,1,51); data.kpath=[{label:'Γ',k:0},{label:'X',k:1}];
  Deck.phononChart({name:'phonon',heading:'Diatomic chain dispersion',data,nAcoustic:1,frequencyUnit:'relative',
    steps:[{caption:'Dispersion branches',state:{branches:true}},{caption:'Acoustic and optical branches',state:{kinds:true}},{caption:'Complete frequency gap',state:{gap:true}}],
    notes:'Analytic nearest-neighbour model in relative units, not THz.'});
}
// A signed negative branch is an illustrative imaginary-frequency example.
Deck.phononChart({name:'phonon-soft',heading:'Imaginary phonon modes',nAcoustic:1,frequencyUnit:'relative',
  data:{kpath:[{label:'Γ',k:0},{label:'X',k:1}],k:[0,0.25,0.5,0.75,1],freqs:[[0,-0.25,-0.4,-0.2,0.1],[1,1.1,1.2,1.3,1.4]]},
  steps:[{caption:'The calculated branches',state:{branches:true}},{caption:'Negative values show imaginary frequencies',state:{soft:true}}],
  notes:'Illustrative data; negative values denote imaginary modes in the signed-frequency convention.'});
