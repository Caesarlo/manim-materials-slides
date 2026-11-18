// Binary formation-energy hull. Load after line_chart.js. Input x is B fraction (0..1),
// e is formation energy (eV/atom): Deck.hullChart({name, points:[{x:0.5,e:-0.4,label:'AB'}],
// steps:[{caption:'Points',state:{shown:1}},{caption:'Hull',state:{hull:true}},
// {caption:'Distances',state:{drops:true}},{caption:'Focus',state:{focus:0}}]});
// Endpoints (0,0)/(1,0) are added if absent. Stability and hull distances use ALL input
// points regardless of the number revealed. Exposes Deck.hullMath for reuse and testing.
// Points, hull segments and distance markers appear with the chart's step animations.
(function () {
  'use strict';
  const D=window.Deck, EPS=1e-9;
  const mark=(o,key,signature,reveal,progress=0)=>{o._plotKey=key;o._plotSignature=JSON.stringify(signature);o._plotRevealState=reveal;o._plotProgress=progress;return o;};
  function lowerHull(points) {
    const sorted=points.slice().sort((a,b)=>a.x-b.x || a.e-b.e), unique=[];
    sorted.forEach((p)=>{if(!unique.length || unique[unique.length-1].x!==p.x)unique.push(p);});
    const h=[]; const cross=(o,a,b)=>(a.x-o.x)*(b.e-o.e)-(a.e-o.e)*(b.x-o.x);
    unique.forEach((p)=>{while(h.length>=2 && cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);});
    return h;
  }
  function energyAt(h,x) {
    if(!h.length)return 0; if(x<=h[0].x)return h[0].e; if(x>=h[h.length-1].x)return h[h.length-1].e;
    for(let i=1;i<h.length;i++) if(x<=h[i].x) {const a=h[i-1],b=h[i];return a.e+(x-a.x)/(b.x-a.x)*(b.e-a.e);}
  }
  function hullChart(def) {
    if(!def.name || !Array.isArray(def.points) || !def.steps || !def.steps.length)throw new Error('hullChart: name, points and steps required');
    if(def.points.some((p)=>!Number.isFinite(p.x)||p.x<0||p.x>1||!Number.isFinite(p.e)))throw new Error('hullChart: x must be in [0,1] and energies finite');
    const extra=[]; if(!def.points.some((p)=>p.x===0))extra.push({x:0,e:0,label:'A'}); if(!def.points.some((p)=>p.x===1))extra.push({x:1,e:0,label:'B'});
    const raw=[...extra,...def.points], hull=lowerHull(raw);
    const pts=raw.map((p,i)=>{const d=p.e-energyAt(hull,p.x);return {x:p.x,y:p.e,group:0,label:p.label,idx:i-extra.length,dist:Math.abs(d)<EPS?0:Math.max(0,d),hollow:d>=EPS};});
    const min=Math.min(0,...raw.map((p)=>p.e)),max=Math.max(0,...raw.map((p)=>p.e)),span=Math.max(0.1,max-min),yDomain=[min-0.2*span,max+0.2*span];
    let current={shown:0,hull:false,drops:false,focus:null};
    const steps=def.steps.map((step)=>{current={...current,...step.state};return {caption:step.caption,state:{...current,groupsShown:1,labels:true,highlight:current.focus===null?null:[current.focus+extra.length]}};});
    D.scatterChart({name:def.name,heading:def.heading,notes:def.notes,groups:[{name:''}],points:pts,hideGroupLabels:true,
      x:{domain:[0,1],label:'B fraction'},y:{domain:yDomain,label:'Formation energy (eV/atom)'},steps,
      visible:(p,i,s)=>p.idx<0 || p.idx<s.shown,
      overlay:({M,P,state,x,y})=>{
        const out=[];
        if(state.hull) for(let i=1;i<hull.length;i++) {const a=[x(hull[i-1].x),y(hull[i-1].e),0],b=[x(hull[i].x),y(hull[i].e),0];out.push(mark(new M.Line({start:a,end:b,color:P.accent,strokeWidth:4}),`hull:${i}`,[a,b,P.accent],'hull',i/Math.max(1,hull.length-1)));}
        if(state.drops) pts.forEach((p)=>{
          if(p.idx>=0 && p.idx>=state.shown || p.dist===0)return;
          const a=[x(p.x),y(p.y),0],b=[x(p.x),y(p.y-p.dist),0];
          const line=new M.DashedLine({start:a,end:b,color:P.muted,strokeWidth:2,dashLength:0.12});
          const txt=new M.Text({text:p.dist.toFixed(2)+' eV',fontFamily:'Lato',fontSize:20,color:P.muted}).moveTo([a[0]+0.5,(a[1]+b[1])/2,0]);
          if(state.focus!==null && p.idx!==state.focus){line.opacity=0.25;txt.opacity=0.25;} out.push(mark(line,`drop:${p.idx}`,[a,b,P.muted],'drops',p.idx/Math.max(1,def.points.length-1)),mark(txt,`drop-label:${p.idx}`,[a,b,p.dist,P.muted],'drops',p.idx/Math.max(1,def.points.length-1)));
        });
        return out;
      },
    });
  }
  D.hullMath={lowerHull,energyAt}; D.hullChart=hullChart;
})();
