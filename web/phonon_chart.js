// Phonon dispersion from caller-supplied wave-vector path and branch frequencies.
// Load after line_chart.js. Deck.phononChart({name, data:{kpath:[{label:'Γ',k:0},
// {label:'X',k:1}], k:[0,0.5,1], freqs:[[0,0.5,1],[1.8,1.5,1.4]]}, nAcoustic:1,
// frequencyUnit:'relative', steps:[{caption:'Branches',state:{branches:true}},
// {caption:'Kinds',state:{kinds:true}},{caption:'Gap',state:{gap:true}},
// {caption:'Imaginary modes',state:{soft:true}}]});
// Negative frequencies are the signed-frequency convention for imaginary modes, not negative energy.
// Gap detection merges every branch's frequency interval; crossing/overlapping branches do not create
// a false gap. Deck.phononMath exposes findGaps, negativeRuns, hasImaginary and diatomicChain.
// Branches and imaginary segments reveal progressively; gap and classification changes fade in.
(function(){
  'use strict'; const D=window.Deck;
  const mark=(o,key,signature,reveal,progress=0)=>{o._plotKey=key;o._plotSignature=JSON.stringify(signature);o._plotRevealState=reveal;o._plotProgress=progress;return o;};
  function findGaps(freqs,minSize=0){
    const ranges=freqs.map((f,index)=>({f:f.filter(Number.isFinite),index})).filter(({f})=>f.length).map(({f,index})=>({index,from:Math.min(...f),to:Math.max(...f)})).sort((a,b)=>a.from-b.from || a.index-b.index);
    const gaps=[]; if(!ranges.length)return gaps; let edge=ranges[0].to,lower=ranges[0].index;
    ranges.slice(1).forEach((r)=>{const size=r.from-edge;if(size>0 && size>minSize)gaps.push({lower,upper:r.index,from:edge,to:r.from,size});if(r.to>edge){edge=r.to;lower=r.index;}});return gaps;
  }
  function negativeRuns(k,freq){
    const runs=[];let run=[];const flush=()=>{if(run.length>=2)runs.push(run);run=[];};
    for(let i=1;i<k.length;i++){const a=freq[i-1],b=freq[i],ka=k[i-1],kb=k[i];
      if(![a,b,ka,kb].every(Number.isFinite)){flush();continue;}
      if(a<0 && b<0){if(!run.length)run.push([ka,a]);run.push([kb,b]);}
      else if(a<0){const cross=ka+(kb-ka)*(-a/(b-a));if(!run.length)run.push([ka,a]);run.push([cross,0]);flush();}
      else if(b<0){const cross=ka+(kb-ka)*(a/(a-b));flush();run.push([cross,0],[kb,b]);}else flush();
    }flush();return runs;
  }
  const hasImaginary=(freqs,tol=1e-6)=>freqs.some((f)=>f.some((v)=>v < -tol));
  function diatomicChain(m1,m2,C,nK){
    if(![m1,m2,C].every((v)=>Number.isFinite(v)&&v>0))throw new RangeError('m1, m2 and C must be positive finite numbers');
    if(!Number.isInteger(nK)||nK<2)throw new RangeError('nK must be an integer >= 2');
    const k=Array.from({length:nK},(_,i)=>i/(nK-1)),freqs=[[],[]],sum=1/m1+1/m2;
    k.forEach((v)=>{const root=Math.sqrt(Math.max(0,sum*sum-4*Math.sin(Math.PI*v/2)**2/(m1*m2)));freqs[0].push(Math.sqrt(Math.max(0,C*(sum-root))));freqs[1].push(Math.sqrt(C*(sum+root)));});return {k,freqs};
  }
  function phononChart(def){
    const data=def.data;
    if(!def.name || !def.steps || !def.steps.length || !data || !Array.isArray(data.k) || data.k.length<2 || !data.k.every(Number.isFinite) || !Array.isArray(data.freqs) || !data.freqs.length || data.freqs.some((f)=>f.length!==data.k.length || !f.every(Number.isFinite))) throw new Error('phononChart: valid k and equal-length finite branches required');
    if(data.k.some((v,i)=>i>0 && v<=data.k[i-1]))throw new Error('phononChart: k must be strictly increasing');
    const all=data.freqs.flat(),lo=Math.min(0,...all),hi=Math.max(0,...all),span=Math.max(hi-lo,0.1),gaps=findGaps(data.freqs),n=def.nAcoustic===undefined?3:def.nAcoustic;
    const series=data.freqs.map((f,i)=>({name:String(i+1),peak:false,points:data.k.map((k,j)=>[k,f[j]])}));
    let cur={branches:false,kinds:false,gap:false,soft:false};
    const steps=def.steps.map((step)=>{cur={...cur,...step.state};return {caption:step.caption,state:{...cur,shown:cur.branches?series.length:0}};});
    const kpath=data.kpath || [];
    D.lineChart({name:def.name,heading:def.heading,notes:def.notes,series,hideSeriesLabels:true,
      x:{domain:[data.k[0],data.k[data.k.length-1]],label:'Wave vector',ticks:kpath.map((p)=>p.k),tickFormat:(v)=>{const p=kpath.find((q)=>Math.abs(q.k-v)<1e-9);return p?p.label:'';}},
      y:{domain:[lo-0.08*span,hi+0.12*span],label:`Frequency (${def.frequencyUnit || 'relative'})`},steps,
      seriesColor:(_,i,s,P)=>s.kinds?(i<n?P.accent:P.series[1]):P.muted,
      overlay:({M,P,state,x,y})=>{
        const out=[],addLine=(a,b,c,w=3,key,reveal,progress=0)=>out.push(mark(new M.Line({start:[x(a[0]),y(a[1]),0],end:[x(b[0]),y(b[1]),0],color:c,strokeWidth:w}),key,[a,b,c,w],reveal,progress));
        addLine([data.k[0],0],[data.k[data.k.length-1],0],P.detail,2,'zero',null);
        if(state.branches && state.kinds){out.push(new M.Text({text:'Acoustic',fontFamily:'Lato',fontSize:22,color:P.accent}).moveTo([5.4,1.9,0]));out.push(new M.Text({text:'Optical',fontFamily:'Lato',fontSize:22,color:P.series[1]}).moveTo([5.4,1.5,0]));}
        if(state.branches && state.gap)gaps.forEach((g)=>{const yy=(y(g.from)+y(g.to))/2;out.push(new M.Rectangle({width:0.18,height:Math.max(0.01,y(g.to)-y(g.from)),center:[4.65,yy,0],color:P.accent,fillOpacity:0.2,strokeWidth:2}));out.push(new M.Text({text:`Gap ${g.size.toPrecision(3)}`,fontFamily:'Lato',fontSize:20,color:P.fg}).moveTo([5.6,yy,0]));});
        if(state.branches && state.soft) data.freqs.forEach((f,branch)=>negativeRuns(data.k,f).forEach((run,ri)=>{for(let i=1;i<run.length;i++)addLine(run[i-1],run[i],P.series[4],5,`soft:${branch}:${ri}:${i}`,'soft',i/Math.max(1,run.length-1));}));
        return out;
      },
    });
  }
  D.phononMath={findGaps,negativeRuns,hasImaginary,diatomicChain};D.phononChart=phononChart;
})();
