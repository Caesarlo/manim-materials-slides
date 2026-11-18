// Reusable LLM diagrams and trace playback. Load deck.js, llm_math.js, then this file.
// Deck.llmBlockSlide({name, blocks:[{id:'a',label:'Question'}, {id:'b',label:'Retrieve'},
//   {id:'db',label:'Knowledge base',below:'b'}], links:[{from:'db',to:'b'}],
//   direction:'row', steps:[{caption:'Question',state:{shown:1,active:0}}, ...]});
// Supports row/column layouts, side blocks, additional links, groups and residuals.
// Deck.llmTrainingSlide({name, stages:[{label:'Pretraining',data:'tokens',goal:'Predict next token'}]});
// Deck.llmAgentSlide({name, trace:Deck.llmMath.trace.fromMessages(messages), group:[[2,3]]});
// Deck.llmEmbeddingSlide({name, vectors, labels, groups, steps:[{caption:'Points',state:{groupsShown:3}},
//   {caption:'Nearest',state:{labels:true,highlight:[0,1]}}]});
// PCA coordinates are for display; nearest-neighbour calculations use the original vectors.
// Diagrams and inputs are schematic; no model, training or retrieval is executed.
(function () {
  'use strict';
  const L = window.Deck.llmMath;
  if (!L) throw new Error('llm_math.js must be loaded before llm_flow.js');

  // Match persistent visual elements across steps; redraws remain jump-safe and active
  // animations are cancelled before a new state is applied.
  const animateState = window.Deck.llmAnimateState || (window.Deck.llmAnimateState = (() => {
    const running = new WeakMap();
    const stop = (host) => {
      for (const anim of running.get(host) || []) anim.cancel();
      running.delete(host);
    };
    const read = (host) => {
      const found = new Map();
      if (!host.querySelectorAll || typeof getComputedStyle !== 'function') return found;
      host.querySelectorAll('[data-llm-motion]').forEach((el) => {
        const key = el.getAttribute('data-llm-motion'), r = el.getBoundingClientRect(), s = getComputedStyle(el);
        found.set(key, {x:r.left,y:r.top,opacity:s.opacity,fill:s.fill,stroke:s.stroke,
          backgroundColor:s.backgroundColor,width:s.width,transform:s.transform,
          outlineColor:s.outlineColor,outlineWidth:s.outlineWidth});
      });
      return found;
    };
    const apply = (host, render, play) => {
      stop(host);
      const before = play ? read(host) : null;
      render();
      if (!play || !host.querySelectorAll || typeof getComputedStyle !== 'function') return;
      const scale = host.offsetWidth ? host.getBoundingClientRect().width / host.offsetWidth || 1 : 1;
      const animations = [];
      host.querySelectorAll('[data-llm-motion]').forEach((el, index) => {
        if (typeof el.animate !== 'function') return;
        const key = el.getAttribute('data-llm-motion');
        const source = before.get(key) || before.get(el.getAttribute('data-llm-source'));
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        // A new parent already fades its children; avoid doubling that transition.
        const parent = el.parentElement && el.parentElement.closest('[data-llm-motion]');
        if (!source && parent && !before.has(parent.getAttribute('data-llm-motion')) && !el.hasAttribute('data-llm-grow')) return;
        const transform = s.transform === 'none' ? '' : s.transform;
        const start = {}, end = {};
        if (!source) {
          start.opacity = 0; end.opacity = s.opacity;
          if (el.hasAttribute('data-llm-grow')) { start.width = '0px'; end.width = s.width; }
          else if (el.hasAttribute('data-llm-draw') && typeof el.getTotalLength === 'function') {
            const length = el.getTotalLength();
            if (Number.isFinite(length) && length > 0) {
              start.strokeDasharray = `${length} ${length}`; end.strokeDasharray = `${length} ${length}`;
              start.strokeDashoffset = String(length); end.strokeDashoffset = '0';
            }
          } else { start.transform = `${el.hasAttribute('data-llm-pop') ? 'scale(.4)' : 'translateY(12px)'} ${transform}`; end.transform = transform || 'none'; }
        } else {
          const dx = (source.x-r.left)/scale, dy = (source.y-r.top)/scale;
          if (Math.abs(dx)>1 || Math.abs(dy)>1) {
            start.transform = `translate(${dx}px,${dy}px) ${transform}`; end.transform = transform || 'none';
          }
          for (const prop of ['opacity','fill','stroke','backgroundColor','width','outlineColor','outlineWidth']) {
            if (source[prop] && s[prop] && source[prop] !== s[prop]) {
              start[prop] = source[prop]; end[prop] = s[prop];
            }
          }
        }
        if (!Object.keys(start).length) return;
        const anim = el.animate([start,end], {duration:550,delay:source?0:Math.min(index*30,210),
          easing:'cubic-bezier(.22,.72,.2,1)',fill:'both'});
        animations.push(anim);
      });
      running.set(host, animations);
      return Promise.all(animations.map(a => a.finished.catch(() => {}))).then(() => {
        if (running.get(host) === animations) stop(host);
      });
    };
    apply.stop = stop;
    return apply;
  })());
  const styles = `
    .deck-frame .lf-stage { position:absolute; left:5%; right:5%; top:17%; bottom:17%; display:flex; align-items:center; justify-content:center; }
    .deck-frame .lf-detail { position:absolute; right:5%; top:12%; font-size:var(--t-micro); color:var(--detail); }
    .deck-frame .lf-caption { text-align:center; }
    .deck-frame .lf-diagram { width:100%; height:100%; overflow:visible; }
    .deck-frame .lf-box { fill:var(--bg); stroke:var(--muted); stroke-width:2.4; }
    .deck-frame .lf-box.active { fill:var(--accent); stroke:var(--accent); }
    .deck-frame .lf-label { fill:var(--fg); font-size:22px; font-family:Arial,'Microsoft YaHei',sans-serif; text-anchor:middle; dominant-baseline:middle; }
    .deck-frame .lf-label.active { fill:var(--bg); }
    .deck-frame .lf-sub { fill:var(--muted); font-size:15px; font-family:Arial,'Microsoft YaHei',sans-serif; text-anchor:middle; }
    .deck-frame .lf-line { stroke:var(--muted); stroke-width:2; fill:none; }
    .deck-frame .lf-residual { stroke:var(--plot-2); stroke-width:2; stroke-dasharray:7 4; fill:none; }
    .deck-frame .lf-group { stroke:var(--muted); stroke-width:2; stroke-dasharray:6 4; fill:none; }
    .deck-frame .lf-arrow-active { stroke:var(--accent); stroke-width:4; fill:none; }
    .deck-frame .lf-arrow-past { stroke:var(--muted); stroke-width:2; opacity:.35; fill:none; }
    .deck-frame .lf-status-running { stroke:var(--plot-2); stroke-width:3; } .deck-frame .lf-status-ok { stroke:var(--done); stroke-width:3; }
    .deck-frame .lf-status-failed, .deck-frame .lf-status-cancelled, .deck-frame .lf-status-timed_out { stroke:var(--plot-5); stroke-width:3; }
    .deck-frame .lf-dim { opacity:.45; }
    .deck-frame .lf-agents { display:flex; gap:calc(var(--u) * 2); align-items:center; justify-content:center; width:100%; }
    .deck-frame .lf-actor { border:calc(var(--u) * .12) solid var(--muted); border-radius:calc(var(--u) * .35); padding:calc(var(--u) * .7); min-width:calc(var(--u) * 8); text-align:center; font-size:var(--t-small); }
    .deck-frame .lf-actor.running { border-color:var(--accent); } .deck-frame .lf-actor.ok { border-color:var(--plot-2); } .deck-frame .lf-actor.failed, .deck-frame .lf-actor.timed_out, .deck-frame .lf-actor.cancelled { border-style:dashed; }
    .deck-frame .lf-actor small { display:block; font-size:var(--t-micro); color:var(--muted); }
    .deck-frame .lf-stack { display:flex; flex-direction:column; gap:calc(var(--u) * .5); }
    .deck-frame .lf-event { max-width:calc(var(--u) * 18); font-size:var(--t-caption); color:var(--muted); text-align:center; }
    .deck-frame .lf-scatter { position:relative; width:75%; height:90%; border-left:calc(var(--u) * .1) solid var(--muted); border-bottom:calc(var(--u) * .1) solid var(--muted); }
    .deck-frame .lf-point { position:absolute; width:calc(var(--u) * .7); height:calc(var(--u) * .7); background:var(--plot-1); border-radius:50%; transform:translate(-50%,50%); }
    .deck-frame .lf-point.g1 { background:var(--plot-2); } .deck-frame .lf-point.g2 { background:var(--plot-3); } .deck-frame .lf-point.g3 { background:var(--plot-4); } .deck-frame .lf-point.g4 { background:var(--plot-5); }
    .deck-frame .lf-point.dim { opacity:.2; } .deck-frame .lf-point.hot { outline:calc(var(--u) * .18) solid var(--fg); outline-offset:calc(var(--u) * .15); }
    .deck-frame .lf-point span { position:absolute; top:calc(var(--u) * .7); left:calc(var(--u) * .25); white-space:nowrap; color:var(--fg); font-size:var(--t-micro); }
    .deck-frame .lf-axis-x { position:absolute; right:0; top:100%; font-size:var(--t-caption); color:var(--muted); } .deck-frame .lf-axis-y { position:absolute; left:0; bottom:100%; font-size:var(--t-caption); color:var(--muted); }
  `;
  const setup = (def, initial, draw) => {
    if (!def.name || !Array.isArray(def.steps) || !def.steps.length) throw new Error('A name and at least one step are required');
    Deck.slide(def.name, {steps:def.steps.length, notes:def.notes || '', mount(frame, {css,esc}) {
      css(styles);
      frame.innerHTML = `<h2 class="deck-heading">${esc(def.heading || def.name)}</h2><div class="lf-stage"></div>`
        + (def.note ? `<div class="lf-detail">${esc(def.note)}</div>` : '') + '<div class="deck-caption lf-caption"></div>';
      const host = frame.querySelector('.lf-stage'), caption = frame.querySelector('.lf-caption');
      let last = null;
      return {enter(k, animate) {
        const n = Math.max(1, Math.min(k, def.steps.length));
        const state = Object.assign({}, initial, ...def.steps.slice(0,n).map(s => s.state || {}));
        const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const play = animate === true && !reduced && (last === null ? n === 1 : n === last + 1);
        last = n;
        caption.textContent = def.steps[n-1].caption || '';
        return animateState(host, () => draw(host,state,esc,play), play);
      }, leave() { animateState.stop(host); }, destroy() { animateState.stop(host); }};
    }});
  };

  function blockSlide(def) {
    const blocks = def.blocks || [], ids = new Map();
    blocks.forEach((b,i) => {if (!b.id || ids.has(b.id)) throw new Error('Block ids must be unique'); ids.set(b.id,i);});
    if (!blocks.length) throw new Error('At least one block is required');
    const row = (def.direction || 'row') === 'row';
    if (!row && blocks.some(b => b.below)) throw new Error('Side blocks require row direction');
    const main = blocks.map((b,i) => b.below ? -1 : i).filter(i => i >= 0);
    const childTargets = new Set();
    blocks.forEach(b => {if (b.below) { if (!ids.has(b.below) || blocks[ids.get(b.below)].below || childTargets.has(b.below)) throw new Error('Invalid side block'); childTargets.add(b.below); }});
    // Reserve a real gutter for arrows, including dense six-node flows such as RAG.
    // The gutter shrinks proportionally for unusually large diagrams, rather than
    // letting boxes overlap or turning the usable box width negative.
    const side = blocks.some(b => b.below), cell = (row ? 870 : 330) / main.length;
    const gutter = Math.min(row ? 26 : 20, cell * .3);
    const boxW = row ? Math.min(150, cell - gutter) : 320;
    const boxH = row ? 70 : Math.min(54, cell - gutter);
    const rects = [];
    main.forEach((idx,i) => {
      const x = row ? 65 + (i + .5) * 870 / main.length - boxW/2 : 500 - boxW/2;
      const y = row ? (side ? 120 : 165) : 45 + (i + .5) * 330 / main.length - boxH/2;
      rects[idx] = {x,y,w:boxW,h:boxH};
    });
    blocks.forEach((b,i) => {if (b.below) {const r=rects[ids.get(b.below)];rects[i]={...r,y:r.y+145};}});
    const edges = main.slice(1).map((to,i)=>({from:main[i],to}));
    (def.links || []).forEach(e => {if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) throw new Error('Invalid link'); edges.push({from:ids.get(e.from),to:ids.get(e.to)});});
    const groups = [...new Set(blocks.map(b => b.group).filter(Boolean))];
    const center = r => ({x:r.x+r.w/2,y:r.y+r.h/2});
    const path = (a,b) => {const ca=center(a),cb=center(b),dx=cb.x-ca.x,dy=cb.y-ca.y;
      if (Math.abs(dx)>Math.abs(dy)) return `M ${ca.x+Math.sign(dx)*a.w/2} ${ca.y} L ${cb.x-Math.sign(dx)*b.w/2} ${cb.y}`;
      return `M ${ca.x} ${ca.y+Math.sign(dy)*a.h/2} L ${cb.x} ${cb.y-Math.sign(dy)*b.h/2}`;};
    setup(def, {shown:0,active:null,residuals:0,group:false}, (host,s,esc) => {
      const visible = i => i < s.shown;
      let svg = `<svg class="lf-diagram" viewBox="0 0 1000 420" role="img" aria-label="${esc(def.name)}"><defs><marker id="lf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted)"/></marker></defs>`;
      if (s.group) groups.forEach((g,gi) => {const rs=blocks.map((b,i)=>b.group===g && visible(i)?rects[i]:null).filter(Boolean);if(!rs.length)return; const x=Math.min(...rs.map(r=>r.x))-12,y=Math.min(...rs.map(r=>r.y))-16,right=Math.max(...rs.map(r=>r.x+r.w))+12,bottom=Math.max(...rs.map(r=>r.y+r.h))+28;svg+=`<g data-llm-motion="group:${gi}"><rect class="lf-group" x="${x}" y="${y}" width="${right-x}" height="${bottom-y}" rx="8"/><text class="lf-sub" x="${right-15}" y="${y-5}">× N</text></g>`;});
      edges.filter(e=>visible(e.from)&&visible(e.to)).forEach((e,i)=>{svg+=`<path class="lf-line" data-llm-motion="edge:${e.from}:${e.to}:${i}" data-llm-draw d="${path(rects[e.from],rects[e.to])}" marker-end="url(#lf-arrow)"/>`;});
      (def.residuals || []).slice(0,s.residuals).forEach((r,ri)=>{
        const a=ids.get(r.from),b=ids.get(r.to);if(a===undefined||b===undefined||!visible(a)||!visible(b))return;
        const from=rects[a],to=rects[b], start=r.side!=='end';
        const gap=row ? 870/main.length-boxW : 330/main.length-boxH;
        let d, lx, ly;
        if(row){const y=from.y+from.h/2, out=start?Math.min(from.y,to.y)-65:Math.max(from.y+from.h,to.y+to.h)+65, x1=from.x-gap/2,x2=to.x+to.w+gap/2;
          d=`M ${x1} ${y} V ${out} H ${x2} V ${y}`;lx=(x1+x2)/2;ly=out+(start?-8:20);
        }else{const x=from.x+from.w/2, out=start?Math.min(from.x,to.x)-70:Math.max(from.x+from.w,to.x+to.w)+70, y1=from.y-gap/2,y2=to.y+to.h+gap/2;
          d=`M ${x} ${y1} H ${out} V ${y2} H ${x}`;lx=out+(start?-30:30);ly=(y1+y2)/2;
        }
        svg+=`<path class="lf-residual" d="${d}" data-llm-motion="residual:${ri}" data-llm-draw marker-end="url(#lf-arrow)"/>${r.label?`<text class="lf-sub" data-llm-motion="residual-label:${ri}" x="${lx}" y="${ly}">${esc(r.label)}</text>`:''}`;
      });
      blocks.forEach((b,i)=>{
        if(!visible(i))return;
        const r=rects[i],active=s.active===i,insideShape=!row && !!b.shape;
        const labelSize=Math.min(22,r.h*(insideShape ? .34 : .65));
        const shapeSize=insideShape ? Math.min(15,r.h*.25) : 15;
        const labelY=r.y+r.h*(insideShape ? .36 : .5), shapeY=insideShape ? r.y+r.h*.78 : r.y+r.h+20;
        const fit=Math.max(1,r.w-14);
        svg+=`<g data-llm-motion="block:${i}"><rect class="lf-box${active?' active':''}" data-llm-motion="block-box:${i}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="9"/><text class="lf-label${active?' active':''}" data-llm-motion="block-text:${i}" data-fit-width="${fit}" style="font-size:${labelSize}px" x="${r.x+r.w/2}" y="${labelY}">${esc(b.label || '')}</text>${b.shape?`<text class="lf-sub" data-fit-width="${fit}" style="font-size:${shapeSize}px" x="${r.x+r.w/2}" y="${shapeY}">${esc(b.shape)}</text>`:''}</g>`;
      });
      host.innerHTML=svg+'</svg>';
      // SVG text has no automatic wrapping. Only condense labels that exceed
      // their own box; short labels retain their normal letter spacing.
      if (host.querySelectorAll) host.querySelectorAll('text[data-fit-width]').forEach(el=>{
        const limit=Number(el.getAttribute('data-fit-width'));
        if (typeof el.getComputedTextLength==='function' && el.getComputedTextLength()>limit) {
          el.setAttribute('textLength',String(limit)); el.setAttribute('lengthAdjust','spacingAndGlyphs');
        }
      });
    });
  }

  function agentSlide(def) {
    const trace = def.trace, spans = L.trace.stepsFromGroups(trace.events.length,def.group || []);
    if (!spans.length) throw new Error('Trace must contain events');
    const d = {...def,steps:spans.map(span => ({caption:L.trace.describeEvent(trace.events[span.to],trace),state:{at:span.to+1}}))};
    setup(d,{at:0},(host,s,esc,animate)=>{
      const states=L.trace.actorStatesAt(trace,s.at), span=spans.find(v=>v.to+1===s.at) || {from:s.at-1,to:s.at-1};
      const events=trace.events.slice(span.from,span.to+1), flows=events.flatMap(L.trace.eventFlows);
      const involved=new Set(events.flatMap(L.trace.eventActors));
      const side=trace.actors.filter(a=>a.kind==='worker'||a.kind==='tool');
      const boxes=new Map();
      trace.actors.forEach(a=>{if(a.kind==='user')boxes.set(a.id,{x:40,y:180,w:150,h:60});else if(a.kind==='lead')boxes.set(a.id,{x:320,y:175,w:180,h:70});});
      side.forEach((a,i)=>{const h=Math.min(58,300/Math.max(1,side.length)-4);boxes.set(a.id,{x:700,y:55+(i+.5)*310/side.length-h/2,w:185,h});});
      const p=(id,edge)=>{const b=boxes.get(id);return b?{x:b.x+(edge==='left'?0:b.w),y:b.y+b.h/2}:null;};
      const activePairs=new Set(flows.map(f=>`${f.from}|${f.to}`));
      let svg='<svg class="lf-diagram" viewBox="0 0 1000 420" role="img"><defs><marker id="lf-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10z" fill="var(--accent)"/></marker></defs>';
      const used=new Map();
      trace.events.slice(0,s.at).flatMap(L.trace.eventFlows).forEach(f=>{const key=[f.from,f.to].sort().join('|');used.set(key,f);});
      const actorIndex=id=>trace.actors.findIndex(a=>a.id===id), edgeKey=(from,to)=>[actorIndex(from),actorIndex(to)].sort((a,b)=>a-b).join(':');
      used.forEach(f=>{if(activePairs.has(`${f.from}|${f.to}`)||activePairs.has(`${f.to}|${f.from}`))return;const from=boxes.get(f.from),to=boxes.get(f.to);if(!from||!to)return;const left=from.x<to.x;const a=p(f.from,left?'right':'left'),b=p(f.to,left?'left':'right');svg+=`<path class="lf-arrow-past" data-llm-motion="flow:${edgeKey(f.from,f.to)}" d="M ${a.x} ${a.y} L ${b.x} ${b.y}"/>`;});
      flows.forEach(f=>{const from=boxes.get(f.from),to=boxes.get(f.to);if(!from||!to)return;const left=from.x<to.x;const a=p(f.from,left?'right':'left'),b=p(f.to,left?'left':'right'),path=`M ${a.x} ${a.y} L ${b.x} ${b.y}`;svg+=`<path class="lf-arrow-active" data-llm-motion="flow:${edgeKey(f.from,f.to)}" data-llm-draw d="${path}" marker-end="url(#lf-flow-arrow)"/>`;
        if(animate===true)svg+=`<circle r="6" fill="var(--accent)" opacity="0"><animateMotion path="${path}" dur="0.45s" fill="freeze"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.85;1" dur="0.45s" fill="freeze"/></circle>`;
      });
      trace.events.slice(0,s.at).forEach((event,i)=>{if(event.type!=='retry')return;event.calls.forEach(call=>{const a=p(call.from,'right'),b=p(call.to,'right');if(!a||!b)return;const isCurrent=i>=span.from&&i<=span.to;const self=call.from===call.to;const y1=a.y-(self?12:0),y2=b.y+(self?12:0);svg+=`<path class="${isCurrent?'lf-arrow-active':'lf-arrow-past'}" d="M ${a.x} ${y1} C ${a.x+65} ${y1}, ${b.x+65} ${y2}, ${b.x} ${y2}"${isCurrent?' marker-end="url(#lf-flow-arrow)"':''}/>`;});});
      const symbols={running:'…',ok:'✓',failed:'×',timed_out:'…',cancelled:'−'};
      trace.actors.forEach((a,i)=>{const box=boxes.get(a.id),state=states[a.id];if(!box||state==='hidden')return;const dim=!involved.has(a.id);svg+=`<g data-llm-motion="actor:${i}"${dim?' class="lf-dim"':''}><rect class="lf-box lf-status-${esc(state)}" data-llm-motion="actor-box:${i}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="8"/><text class="lf-label" x="${box.x+box.w/2}" y="${box.y+box.h/2}">${esc(a.label)}</text>${symbols[state]?`<text class="lf-sub" x="${box.x+box.w-15}" y="${box.y+17}">${symbols[state]}</text>`:''}</g>`;});
      host.innerHTML=svg+'</svg>';
    });
  }

  function trainingSlide(def) {
    if (!Array.isArray(def.stages) || !def.stages.length) throw new Error('At least one training stage is required');
    const blocks = def.stages.map((stage,i) => ({id:`training-${i}`,label:stage.label,shape:stage.data,kind:'attn'}));
    const steps = def.stages.map((stage,i) => ({caption:stage.goal,state:{shown:i+1,active:i}}));
    steps.push({caption:`${def.stages.length} 个训练阶段依次进行`,state:{shown:def.stages.length,active:null}});
    blockSlide({...def,blocks,steps});
  }

  function embeddingSlide(def) {
    if (!def.vectors || !def.labels || def.vectors.length!==def.labels.length || !def.vectors.length) throw new Error('vectors and labels must have matching nonzero lengths');
    const coords=L.embedding.pca2d(def.vectors), xs=coords.map(x=>x[0]),ys=coords.map(x=>x[1]);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const norm=(v,min,max)=>max===min?50:10+80*(v-min)/(max-min);
    setup(def,{groupsShown:Infinity,labels:false,highlight:null},(host,s,esc)=>{
      host.innerHTML=`<div class="lf-scatter"><div class="lf-axis-y">PC2</div><div class="lf-axis-x">PC1</div>${coords.map(([x,y],i)=>{const group=(def.groups||[])[i]||0;if(group>=s.groupsShown)return ''; const highlight=Array.isArray(s.highlight);const cls=highlight?(s.highlight.includes(i)?' hot':' dim'):'';return `<div class="lf-point g${group%5}${cls}" data-llm-pop data-llm-motion="point:${i}" style="left:${norm(x,minX,maxX)}%;bottom:${norm(y,minY,maxY)}%" title="${esc(def.labels[i])}">${s.labels?`<span data-llm-motion="point-label:${i}">${esc(def.labels[i])}</span>`:''}</div>`;}).join('')}</div>`;
    });
  }
  Object.assign(window.Deck,{llmBlockSlide:blockSlide,llmAgentSlide:agentSlide,llmTrainingSlide:trainingSlide,llmEmbeddingSlide:embeddingSlide});
})();
