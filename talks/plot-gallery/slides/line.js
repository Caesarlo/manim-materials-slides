// An illustrative dataset, to exercise clipping, focus, reference lines and peak labels.
{
  const bump = (center, height) => Array.from({length: 21}, (_, i) => {
    const t=300+i*25; return [t, height*Math.exp(-(((t-center)/180)**2))];
  });
  Deck.lineChart({
    name:'line-zt', heading:'Illustrative zT vs temperature',
    x:{domain:[300,800],label:'T (K)',ticks:[300,400,500,600,700,800]},
    y:{domain:[0,1.6],label:'zT',ticks:[0,0.4,0.8,1.2,1.6]},
    series:[{name:'A',points:bump(650,0.8)},{name:'B',points:bump(700,1.4)},{name:'C',points:bump(440,1.0)}],
    steps:[{caption:'Material A',state:{shown:1}},{caption:'Material B',state:{shown:2}},{caption:'Material C',state:{shown:3}},{caption:'Peaks',state:{peaks:true}},{caption:'Focus B at 700 K',state:{focus:1,refX:700}}],
    notes:'Illustrative curves, not measurements.',
  });
  Deck.lineChart({
    name:'line-log', heading:'Log axis and missing data',
    x:{domain:[1,1000],type:'log',label:'Concentration'},y:{domain:[0,4],label:'Response'},
    series:Deck.lineFromColumns({x:[1,10,100,1000],series:[{name:'D',y:[1,null,2,3]}]}),
    steps:[{caption:'Missing data breaks the curve',state:{shown:1}},{caption:'A reference at 100',state:{refX:100}}],
    notes:'Illustrative data. The missing value breaks the line.',
  });
}

