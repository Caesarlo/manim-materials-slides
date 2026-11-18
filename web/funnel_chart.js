// Screening funnel using manim-web primitives; load after deck.js and manim.js.
// Deck.funnelChart({ name:'screen', heading:'Screening', stages:[
//   {label:'Candidates', count:100000}, {label:'Stable', count:8000}],
//   steps:[{caption:'Candidates', state:{shown:1}},
//          {caption:'Stable', state:{shown:2,focusLast:true}}] });
// Stage widths vary linearly with log10(count); counts must be positive. Each gap shows
// the percentage passed to the next stage. Steps inherit shown and focusLast. Stage labels
// and captions are plain text; data is supplied by the caller, not fetched or generated.
// Forward clicks lift new stages into place and blend focus changes; jumps and back are immediate.
(function () {
  'use strict';
  const D=window.Deck;
  const mark=(o,stage,key,style)=>{o._funnelStage=stage;o._funnelKey=key;o._funnelStyle=style;return o;};
  async function transition(o,ctx,i,previousShown) {
    const {M,P,scene,add,play,fast}=ctx, old=i?o.layers[i-1]:[], next=o.layers[i];
    if(fast){scene.remove(...old);add(next);return;}
    const from=old.map((m)=>Number.isFinite(m.opacity)?m.opacity:1), to=next.map((m)=>Number.isFinite(m.opacity)?m.opacity:1);
    const oldKeys=new Map();old.forEach((m,j)=>oldKeys.set(m._funnelKey,j));
    const pairs=new Map(), used=new Set(), offset=next.map(()=>0);next.forEach((m,j)=>{const k=oldKeys.get(m._funnelKey);if(k!==undefined&&old[k]._funnelStyle===m._funnelStyle){pairs.set(j,k);used.add(k);}});
    next.forEach((m)=>{m.opacity=0;});add(next);
    const dummy=new M.Dot({radius:0.001,color:P.muted,fillOpacity:0});
    await play(new M.UpdateFromAlphaFunc(dummy,(_m,a)=>{
      old.forEach((m,j)=>{if(!used.has(j))m.opacity=from[j]*(1-a);});
      next.forEach((m,j)=>{if(pairs.has(j)){const k=pairs.get(j);old[k].opacity=from[k]+(to[j]-from[k])*a;return;}const isNew=m._funnelStage>=previousShown, delay=isNew?0.28:0, t=Math.max(0,Math.min(1,(a-delay)/(1-delay)));m.opacity=to[j]*t;if(isNew && typeof m.shift==='function'){const y=-0.18*(1-t);m.shift([0,y-offset[j],0]);offset[j]=y;}});
    },{duration:0.85}));
    scene.remove(...old,dummy);next.forEach((m,j)=>{m.opacity=to[j];if(offset[j] && typeof m.shift==='function')m.shift([0,-offset[j],0]);});scene.render();
  }
  function funnelChart(def) {
    if(!def.name || !def.stages || !def.stages.length || !def.steps || !def.steps.length) throw new Error('funnelChart: name, stages and steps required');
    if(def.stages.some((s) => typeof s.count!=='number' || !Number.isFinite(s.count) || s.count<=0)) throw new Error('funnelChart: counts must be positive finite numbers');
    const logs=def.stages.map((s)=>Math.log10(s.count)), lo=Math.min(...logs), hi=Math.max(...logs);
    const widths=logs.map((v)=>hi-lo<1e-12 ? 10 : 4.4+(v-lo)/(hi-lo)*5.6);
    const n=def.stages.length, band=4.9/n, barH=Math.min(0.55,band*0.65);
    const states=[]; let state={shown:0,focusLast:false};
    for(const step of def.steps) { state={...state,...step.state}; states.push(state); }
    D.slide(def.name,{steps:def.steps.length,notes:def.notes || '',mount(frame,{esc}) {
      frame.innerHTML=`<div class="deck-stage"></div>${def.heading ? `<h2 class="deck-heading">${esc(def.heading)}</h2>` : ''}` + def.steps.map((s,i)=>`<div class="deck-caption reveal-in" data-show="${i+1}">${esc(s.caption || '')}</div>`).join('');
      const stage=D.manim(frame.querySelector('.deck-stage'),{build:({M,P})=>{
        const text=(s,pos,color,size=26)=>new M.Text({text:String(s),fontFamily:'Lato',fontSize:size,color}).moveTo([pos[0],pos[1],0]);
        const fade=(o,opacity)=>{o.opacity=opacity;return o;};
        const layers=states.map((s)=>{
          const out=[];
          def.stages.forEach((item,i)=>{
            if(i>=s.shown) return;
            const active=s.focusLast && i===Math.min(s.shown,n)-1;
            const opacity=s.focusLast && !active ? 0.3 : 1;
            const y=2.15-i*band, w=widths[i];
            const box=new M.RoundedRectangle({width:w,height:barH,cornerRadius:0.12,color:active?P.accent:P.muted,strokeWidth:2,fillOpacity:1,center:[0,y,0]});
            box.setFill(active?P.accent:P.bg,1); box.opacity=opacity; out.push(mark(box,i,`box:${i}`,String(active)));
            out.push(mark(fade(text(item.label,[-w*0.24,y],active?P.bg:P.fg,25),opacity),i,`label:${i}`,String(active)));
            out.push(mark(fade(text(Math.round(item.count).toLocaleString('en-US'),[w*0.32,y],active?P.bg:P.fg,25),opacity),i,`count:${i}`,String(active)));
            if(i>0) {
              const mid=y+band/2, rate=Math.round(item.count/def.stages[i-1].count*1000)/10;
              out.push(mark(fade(new M.Arrow({start:[0,mid+0.1,0],end:[0,mid-0.1,0],color:P.muted,strokeWidth:2,tipLength:0.08,tipWidth:0.08}),opacity),i,`arrow:${i}`,'same'));
              out.push(mark(fade(text(`${rate}%`,[0.65,mid],P.muted,20),opacity),i,`rate:${i}`,'same'));
            }
          });
          return out;
        });
        return {layers};
      },steps:states.map((_,i)=>(o,ctx)=>transition(o,ctx,i,states[i-1]?.shown ?? 0))});
      return {enter(step,animate){D.show(frame,step,animate);return stage.go(step,animate);},freeze:stage.freeze,destroy:stage.dispose};
    }});
  }
  D.funnelChart=funnelChart;
})();


