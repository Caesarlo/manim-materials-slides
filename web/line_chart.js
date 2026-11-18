// Data-driven line charts for live decks, built with manim-web objects.
// Load after deck.js and manim.js. Deck.lineChart({ name, heading, series,
//   x: { domain: [300, 800], label: 'T (K)', ticks: [300, 500, 800] },
//   y: { domain: [0, 2], label: 'zT' },
//   steps: [{ caption: 'Series A', state: { shown: 1 } }, { caption: 'Peak', state: { peaks: true } }] });
// Each series is { name, points: [[x,y], ...], color?, peak? }. null/non-finite values and
// non-positive log values break curves. Lines are clipped to the plot. Axes accept type:'log',
// ticks, tickCount and tickFormat. Step states inherit shown, focus, peaks and refX.
// Deck.lineFromColumns({ x: [1,2], series: [{name:'A', y:[3,null]}] }) preserves missing values.
// Labels are plain text. Call lineChart once for each slide; it registers with Deck.slide.
// Deck.scatterChart({name, x, y, groups:[{name}], points:[{x,y,group,label?}], steps})
// uses states groupsShown, highlight (point indices or null), region {x0,x1,y0,y1} and labels.
// Deck.pointsInRegion(points, region) returns the indices inside a rectangular data-space region.
// Forward clicks animate newly revealed curves/points and blend changes in focus. Jumps and back rebuild instantly.
(function () {
  'use strict';
  const D = window.Deck, B = { l: -5.6, r: 4.5, b: -2.25, t: 2.35 };
  const finite = (v) => typeof v === 'number' && Number.isFinite(v);
  const point = ([x,y]) => [x,y,0];
  const inside = ([x,y]) => x >= B.l && x <= B.r && y >= B.b && y <= B.t;
  const mark = (o, group, progress = 1, key, signature) => {
    o._plotGroup = group; o._plotProgress = progress; o._plotKey = key; o._plotSignature = signature; return o;
  };
  // Crossfade complete target states, with a progressive reveal for newly introduced data.
  // The fast path does no animation and always reconstructs the same final state.
  async function transition(o, ctx, i, isNew) {
    const { M, P, scene, add, play, fast } = ctx;
    const old = i ? o.layers[i - 1] : [], next = o.layers[i];
    if (i === 0) add(o.axes);
    if (fast) { scene.remove(...old); add(next); return; }
    const from = old.map((m) => Number.isFinite(m.opacity) ? m.opacity : 1);
    const to = next.map((m) => Number.isFinite(m.opacity) ? m.opacity : 1);
    // Keep an unchanged element on screen while its opacity changes; this avoids flashing
    // all previously drawn curves/points when the next series is added.
    const oldKeys = new Map();
    old.forEach((m,j) => { if (m._plotKey !== undefined) oldKeys.set(m._plotKey,j); });
    const paired = new Map(), used = new Set();
    next.forEach((m,j) => {
      const k=oldKeys.get(m._plotKey);
      if (k !== undefined && old[k]._plotSignature === m._plotSignature && !used.has(k)) { paired.set(j,k); used.add(k); }
    });
    next.forEach((m) => { m.opacity = 0; });
    add(next);
    const dummy = new M.Dot({ radius: 0.001, color: P.muted, fillOpacity: 0 });
    await play(new M.UpdateFromAlphaFunc(dummy, (_m, alpha) => {
      old.forEach((m, j) => { if (!used.has(j)) m.opacity = from[j] * (1 - alpha); });
      next.forEach((m, j) => {
        if (paired.has(j)) { const k=paired.get(j); old[k].opacity=from[k]+(to[j]-from[k])*alpha; return; }
        const delay = isNew(m) ? 0.72 * (m._plotProgress || 0) : 0;
        const t = Math.max(0, Math.min(1, (alpha - delay) / (isNew(m) ? 0.28 : 1)));
        m.opacity = to[j] * t;
      });
    }, { duration: 1.0 }));
    scene.remove(...old, dummy);
    next.forEach((m, j) => { m.opacity = to[j]; });
    scene.render();
  }
  function axis(a, lo, hi) {
    if (!a || !Array.isArray(a.domain) || a.domain.length !== 2 || !a.domain.every(finite) || a.domain[0] >= a.domain[1]) throw new Error('lineChart: invalid axis domain');
    const log = a.type === 'log';
    if (log && a.domain[0] <= 0) throw new Error('lineChart: log domains must be positive');
    const f = log ? Math.log10 : (v) => v, min = f(a.domain[0]), max = f(a.domain[1]);
    const map = (v) => !finite(v) || (log && v <= 0) ? null : lo + (f(v) - min) / (max - min) * (hi - lo);
    const ticks = a.ticks || (log ? Array.from({length: Math.max(0, Math.floor(max) - Math.ceil(min) + 1)}, (_,i) => 10 ** (Math.ceil(min) + i)) : Array.from({length: (a.tickCount || 4) + 1}, (_,i) => a.domain[0] + i * (a.domain[1] - a.domain[0]) / (a.tickCount || 4)));
    return { map, ticks: ticks.filter((v) => finite(v) && v >= a.domain[0] && v <= a.domain[1]), format: a.tickFormat || ((v) => String(+v.toPrecision(4))) };
  }
  // Liang-Barsky clipping, so out-of-domain points cannot draw outside the plot.
  function clip(a,b) {
    const dx = b[0]-a[0], dy = b[1]-a[1], p = [-dx,dx,-dy,dy], q = [a[0]-B.l,B.r-a[0],a[1]-B.b,B.t-a[1]];
    let lo = 0, hi = 1;
    for (let i=0;i<4;i++) { if (!p[i]) { if(q[i]<0) return null; continue; } const t=q[i]/p[i]; if(p[i]<0) lo=Math.max(lo,t); else hi=Math.min(hi,t); if(lo>hi) return null; }
    return [[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];
  }
  function lineFromColumns(t) { return t.series.map((s) => ({ name: s.name, points: t.x.map((x,i) => finite(x) && finite(s.y[i]) ? [x,s.y[i]] : null) })); }
  function lineChart(def) {
    if (!def.name || !def.steps || !def.steps.length || !Array.isArray(def.series)) throw new Error('lineChart: name, series and steps required');
    const x=axis(def.x,B.l,B.r), y=axis(def.y,B.b,B.t), states=[];
    let state={shown:0,focus:null,peaks:false,refX:null};
    for(const step of def.steps) { state={...state,...step.state}; states.push(state); }
    D.slide(def.name,{ steps:def.steps.length, notes:def.notes || '', mount(frame,{esc}) {
      frame.innerHTML=`<div class="deck-stage"></div>${def.heading ? `<h2 class="deck-heading">${esc(def.heading)}</h2>` : ''}` + def.steps.map((s,i) => `<div class="deck-caption reveal-in" data-show="${i+1}">${esc(s.caption || '')}</div>`).join('');
      const stage=D.manim(frame.querySelector('.deck-stage'),{ build:({M,P}) => {
        const text=(s,pos,c=P.fg,size=28) => new M.Text({text:String(s),fontFamily:'Lato',fontSize:size,color:c}).moveTo(point(pos));
        const line=(a,b,c=P.fg,w=2) => new M.Line({start:point(a),end:point(b),color:c,strokeWidth:w});
        const fade=(o,opacity) => { o.opacity=opacity; return o; };
        const axes=[line([B.l,B.b],[B.r,B.b]),line([B.l,B.b],[B.l,B.t])];
        x.ticks.forEach((v) => { const p=x.map(v); axes.push(line([p,B.b],[p,B.b-0.12]),text(x.format(v),[p,B.b-0.42],P.fg,24)); });
        y.ticks.forEach((v) => { const p=y.map(v); axes.push(line([B.l,p],[B.l-0.12,p]),text(y.format(v),[B.l-0.55,p],P.fg,24)); });
        if(def.x.label) axes.push(text(def.x.label,[B.r-0.4,B.b-0.8]));
        if(def.y.label) axes.push(text(def.y.label,[B.l+0.3,B.t+0.35]));
        function makeState(s) {
          const out=[];
          // Spread the end labels vertically, keeping their order and within the plotting box.
          const ends=def.series.slice(0,Math.max(0,s.shown)).map((series,i)=>{
            const pts=(series.points || []).filter((p)=>p && finite(p[0]) && finite(p[1])).map((p)=>[x.map(p[0]),y.map(p[1])]).filter((p)=>p[0]!==null && p[1]!==null && inside(p));
            return pts.length ? {i,y:pts[pts.length-1][1]} : null;
          }).filter(Boolean).sort((a,b)=>a.y-b.y);
          const gap=ends.length>1 ? Math.min(0.36,(B.t-B.b)/(ends.length-1)) : 0;
          ends.forEach((e,i)=>{e.y=Math.max(B.b,Math.min(B.t,e.y));if(i)e.y=Math.max(e.y,ends[i-1].y+gap);});
          if(ends.length && ends[ends.length-1].y>B.t){ends[ends.length-1].y=B.t;for(let i=ends.length-2;i>=0;i--)ends[i].y=Math.min(ends[i].y,ends[i+1].y-gap);}
          const endYs=new Map(ends.map((e)=>[e.i,e.y]));
          def.series.forEach((series,i) => {
            if(i>=s.shown) return;
            const color=(def.seriesColor && def.seriesColor(series,i,s,P)) || series.color || P.series[i%P.series.length], opacity=s.focus==null || s.focus===i ? 1 : 0.25;
            let previous=null,last=null,peak=null,visible=0;
            (series.points || []).forEach((p, index, points) => {
              if(!p || !finite(p[0]) || !finite(p[1])) { previous=null; return; }
              const xx=x.map(p[0]), yy=y.map(p[1]);
              if(xx===null || yy===null) { previous=null; return; }
              const current=[xx,yy];
              if(inside(current)) { visible++; last=current; if(!peak || p[1]>peak.value || (p[1]===peak.value && p[0]<peak.x)) peak={point:current,value:p[1],x:p[0],raw:p}; }
              if(previous) { const seg=clip(previous,current); if(seg) out.push(mark(fade(line(seg[0],seg[1],color,5),opacity),i,index / Math.max(1,points.length-1),`line:${i}:${index}`,JSON.stringify([seg,color]))); }
              previous=current;
            });
            if(last) { if(visible===1) out.push(mark(fade(new M.Dot({point:point(last),radius:0.08,color}),opacity),i,1,`dot:${i}`,JSON.stringify([last,color]))); if(!def.hideSeriesLabels) { const pos=[Math.min(6.5,last[0]+0.8),endYs.get(i)]; out.push(mark(fade(text(series.name || '',pos,color,25),opacity),i,1,`label:${i}`,JSON.stringify([pos,color,series.name]))); } }
            if(s.peaks && series.peak!==false && peak) { const label=def.peakLabel ? def.peakLabel(series,peak.raw,i) : String(+peak.value.toPrecision(3)); out.push(mark(fade(new M.Dot({point:point(peak.point),radius:0.09,color}),opacity),i,1,`peak:${i}`,JSON.stringify([peak.point,color])),mark(fade(text(label,[peak.point[0],Math.min(B.t+0.25,peak.point[1]+0.3)],color,22),opacity),i,1,`peaklabel:${i}`,JSON.stringify([peak.point,label,color]))); }
          });
          if(def.overlay) out.push(...def.overlay({M,P,state:s,x:x.map,y:y.map}));
          if(s.refX!=null) { const p=x.map(s.refX); if(p!==null && p>=B.l && p<=B.r) out.push(line([p,B.b],[p,B.t],P.muted,2)); }
          return out;
        }
        return {axes,layers:states.map(makeState)};
      },steps:states.map((_,i) => (o,ctx) => transition(o,ctx,i,(m) => (m._plotRevealState && !states[i-1]?.[m._plotRevealState]) || (m._plotGroup !== undefined && m._plotGroup >= (states[i-1]?.shown ?? 0))))});
      return {enter(step,animate) { D.show(frame,step,animate); return stage.go(step,animate); },freeze:stage.freeze,destroy:stage.dispose};
    }});
  }

  // Scatter points use data coordinates and the same axis and theme as line charts.
  function pointsInRegion(points, r) {
    return points.map((p,i) => p.x >= Math.min(r.x0,r.x1) && p.x <= Math.max(r.x0,r.x1) && p.y >= Math.min(r.y0,r.y1) && p.y <= Math.max(r.y0,r.y1) ? i : -1).filter((i)=>i>=0);
  }
  function scatterChart(def) {
    if (!def.name || !def.steps || !def.steps.length || !Array.isArray(def.points) || !Array.isArray(def.groups)) throw new Error('scatterChart: name, groups, points and steps required');
    const x=axis(def.x,B.l,B.r), y=axis(def.y,B.b,B.t), states=[];
    let state={groupsShown:0,highlight:null,region:null,labels:false};
    for(const step of def.steps) { state={...state,...step.state}; states.push(state); }
    D.slide(def.name,{steps:def.steps.length,notes:def.notes || '',mount(frame,{esc}) {
      frame.innerHTML=`<div class="deck-stage"></div>${def.heading ? `<h2 class="deck-heading">${esc(def.heading)}</h2>` : ''}` + def.steps.map((s,i)=>`<div class="deck-caption reveal-in" data-show="${i+1}">${esc(s.caption || '')}</div>`).join('');
      const stage=D.manim(frame.querySelector('.deck-stage'),{build:({M,P})=>{
        const text=(s,pos,c=P.fg,size=26)=>new M.Text({text:String(s),fontFamily:'Lato',fontSize:size,color:c}).moveTo(point(pos));
        const line=(a,b,c=P.fg,w=2)=>new M.Line({start:point(a),end:point(b),color:c,strokeWidth:w});
        const fade=(o,v)=>{o.opacity=v;return o;};
        const axes=[line([B.l,B.b],[B.r,B.b]),line([B.l,B.b],[B.l,B.t])];
        x.ticks.forEach((v)=>{const p=x.map(v);axes.push(line([p,B.b],[p,B.b-0.12]),text(x.format(v),[p,B.b-0.42],P.fg,24));});
        y.ticks.forEach((v)=>{const p=y.map(v);axes.push(line([B.l,p],[B.l-0.12,p]),text(y.format(v),[B.l-0.55,p],P.fg,24));});
        if(def.x.label) axes.push(text(def.x.label,[B.r-0.4,B.b-0.8]));
        if(def.y.label) axes.push(text(def.y.label,[B.l+0.3,B.t+0.35]));
        const layers=states.map((s)=>{
          const out=[];
          if(s.region) {
            const r=s.region, x0=x.map(r.x0),x1=x.map(r.x1),y0=y.map(r.y0),y1=y.map(r.y1);
            if([x0,x1,y0,y1].every((v)=>v!==null)) {
              const l=Math.max(B.l,Math.min(x0,x1)), rr=Math.min(B.r,Math.max(x0,x1)), b=Math.max(B.b,Math.min(y0,y1)), t=Math.min(B.t,Math.max(y0,y1));
              if(rr>l && t>b) { const fill=new M.Rectangle({width:rr-l,height:t-b,center:[(l+rr)/2,(b+t)/2,0],color:P.accent,fillOpacity:0.12,strokeWidth:2}); out.push(fill); }
            }
          }
          if(def.overlay) out.push(...def.overlay({M,P,state:s,x:x.map,y:y.map}));
          def.points.forEach((p,i)=>{
            if(def.visible && !def.visible(p,i,s)) return;
            if(p.group>=s.groupsShown || p.group<0 || p.group>=def.groups.length) return;
            const xx=x.map(p.x),yy=y.map(p.y); if(xx===null || yy===null || !inside([xx,yy])) return;
            const color=def.groups[p.group].color || P.series[p.group%P.series.length], opacity=s.highlight===null || s.highlight.includes(i)?1:0.2;
            out.push(mark(fade(p.hollow ? new M.Circle({radius:0.09,color,strokeWidth:3,fillOpacity:0}).moveTo([xx,yy,0]) : new M.Dot({point:[xx,yy,0],radius:0.09,color}),opacity),i,i/Math.max(1,def.points.length-1),`point:${i}`,JSON.stringify([xx,yy,color,p.hollow])));
            if(s.labels && p.label) out.push(mark(fade(text(p.label,[xx+0.35,yy+0.25],color,22),opacity),i,1,`point-label:${i}`,JSON.stringify([xx,yy,color,p.label])));
          });
          def.groups.forEach((g,i)=>{
            if(def.hideGroupLabels || i>=s.groupsShown) return;
            const pts=def.points.filter((p)=>p.group===i).map((p)=>[x.map(p.x),y.map(p.y)]).filter((p)=>p[0]!==null && p[1]!==null && inside(p));
            if(pts.length) { const cx=pts.reduce((v,p)=>v+p[0],0)/pts.length+(g.dx||0),cy=pts.reduce((v,p)=>v+p[1],0)/pts.length+0.35+(g.dy||0); out.push(text(g.name,[cx,Math.min(B.t+0.2,cy)],g.color || P.series[i%P.series.length],24)); }
          });
          return out;
        });
        return {axes,layers};
      },steps:states.map((_,i)=>(o,ctx)=>transition(o,ctx,i,(m)=>{
        if (m._plotRevealState && !states[i-1]?.[m._plotRevealState]) return true;
        if (m._plotGroup === undefined) return false;
        const p=def.points[m._plotGroup], prev=states[i-1];
        return !prev || p.group >= prev.groupsShown || (def.visible && !def.visible(p,m._plotGroup,prev));
      }))});
      return {enter(step,animate){D.show(frame,step,animate);return stage.go(step,animate);},freeze:stage.freeze,destroy:stage.dispose};
    }});
  }

  Object.assign(D,{lineChart,lineFromColumns,scatterChart,pointsInRegion});
})();
