// Reusable LLM teaching slides (illustrative data; no model, inference or retrieval is run).
// Load deck.js, llm_math.js, then this file. Register a slide using:
//   Deck.llmTokenSlide({name, text, tokenizer: Deck.llmMath.tokenize.makeTokenizer(vocab),
//     steps:[{caption:'Split', state:{split:true, ids:true}}, {caption:'Focus', state:{focus:2}}]});
//   Deck.llmAttentionSlide({name, tokens, weights, causalWeights, steps:[
//     {caption:'Rows', state:{rowsShown:tokens.length}}, {caption:'Focus', state:{focusRow:1}},
//     {caption:'Causal', state:{masked:true}}]});
//   Deck.llmNextTokenSlide({name, rounds:[{prefix:['A'], candidates:[{label:'B',logit:2}], chosen:0}],
//     steps:[{caption:'Distribution', state:{round:0,phase:'dist',temp:1,k:5}},
//            {caption:'Pick',state:{phase:'pick'}}], showEntropy:true});
// Each step merges its state with previous steps; a jump or reverse redraws the complete target state.
// Inputs and calculations follow the archived components. Forward steps animate the changed
// elements; jump and reverse show the complete target state immediately.
(function () {
  'use strict';
  const L = window.Deck.llmMath;
  if (!L) throw new Error('llm_math.js must be loaded before llm.js');

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
    .deck-frame .llm-stage { position:absolute; left:5%; right:5%; top:17%; bottom:17%; display:flex; align-items:center; justify-content:center; }
    .deck-frame .llm-detail { position:absolute; right:5%; top:12%; font-size:var(--t-micro); color:var(--detail); }
    .deck-frame .llm-caption { text-align:center; }
    .deck-frame .llm-tokens { display:flex; align-items:flex-start; justify-content:center; flex-wrap:wrap; gap:calc(var(--u) * .5); max-width:100%; }
    .deck-frame .llm-token { --llm-tone:var(--accent); text-align:center; color:var(--fg); font-size:var(--t-body); }
    .deck-frame .llm-token.alt { --llm-tone:var(--plot-2); }
    .deck-frame .llm-token > span { display:block; padding:calc(var(--u) * .45) calc(var(--u) * .6); border:calc(var(--u) * .13) solid var(--llm-tone); border-radius:calc(var(--u) * .3); background:color-mix(in srgb, var(--llm-tone) 13%, transparent); }
    .deck-frame .llm-token.shade > span { background:color-mix(in srgb, var(--llm-tone) 30%, transparent); }
    .deck-frame .llm-token small { display:block; margin-top:calc(var(--u) * .4); color:var(--muted); font-size:var(--t-caption); }
    .deck-frame .llm-token.dim { opacity:.3; } .deck-frame .llm-token.hot > span { background:var(--llm-tone); color:var(--bg); }
    .deck-frame .llm-sentence { white-space:pre-wrap; font-size:var(--t-lead); text-align:center; }
    .deck-frame .llm-mapwrap { display:flex; gap:calc(var(--u) * 2); align-items:center; justify-content:center; width:100%; height:100%; }
    .deck-frame .llm-grid { display:grid; gap:calc(var(--u) * .12); align-items:stretch; font-size:var(--t-micro); }
    .deck-frame .llm-grid .axis { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--muted); align-self:center; text-align:center; }
    .deck-frame .llm-grid .cell { aspect-ratio:1; border:calc(var(--u) * .06) solid var(--muted); min-width:0; }
    .deck-frame .llm-grid .cell.masked { background:repeating-linear-gradient(135deg, transparent 0 35%, var(--muted) 36% 39%, transparent 40% 100%); }
    .deck-frame .llm-grid .cell.focus { outline:calc(var(--u) * .12) solid var(--accent); outline-offset:calc(var(--u) * -.06); }
    .deck-frame .llm-bars { width:25%; font-size:var(--t-caption); } .deck-frame .llm-barrow { display:flex; align-items:center; gap:calc(var(--u) * .5); margin:calc(var(--u) * .25) 0; }
    .deck-frame .llm-barlabel { width:26%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:right; }
    .deck-frame .llm-track { flex:1; height:calc(var(--u) * 1.2); border-bottom:calc(var(--u) * .08) solid var(--muted); }
    .deck-frame .llm-fill { height:100%; background:var(--accent); } .deck-frame .llm-value { min-width:4em; text-align:right; }
    .deck-frame .llm-next { width:85%; align-self:center; } .deck-frame .llm-next .llm-prefix { display:flex; justify-content:center; flex-wrap:wrap; gap:calc(var(--u) * .5); margin-bottom:calc(var(--u) * 2); }
    .deck-frame .llm-next .llm-prefix span { padding:calc(var(--u) * .3) calc(var(--u) * .6); border:calc(var(--u) * .1) solid var(--accent); border-radius:calc(var(--u) * .3); font-size:var(--t-small); }
    .deck-frame .llm-next .llm-barlabel { width:22%; } .deck-frame .llm-next .llm-track { height:calc(var(--u) * 1.5); } .deck-frame .llm-next .llm-barrow { font-size:var(--t-small); margin:calc(var(--u) * .5) 0; }
    .deck-frame .llm-info { text-align:right; font-size:var(--t-caption); color:var(--muted); }
  `;
  const mergeAt = (initial, steps, k) => Object.assign({}, initial, ...steps.slice(0, k).map(s => s.state || {}));
  const display = L.tokenize.displayToken;
  const setup = (def, initial, draw) => {
    if (!def.name || !Array.isArray(def.steps) || !def.steps.length) throw new Error('A name and at least one step are required');
    Deck.slide(def.name, {
      steps: def.steps.length, notes: def.notes || '',
      mount(frame, { css, esc }) {
        css(styles);
        frame.innerHTML = `<h2 class="deck-heading">${esc(def.heading || def.name)}</h2><div class="llm-stage"></div>`
          + (def.note ? `<div class="llm-detail">${esc(def.note)}</div>` : '')
          + '<div class="deck-caption llm-caption"></div>';
        const stage = frame.querySelector('.llm-stage'), caption = frame.querySelector('.llm-caption');
        let last = null;
        return { enter(k, animate) {
          const n = Math.max(1, Math.min(k, def.steps.length));
          const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const play = animate === true && !reduced && (last === null ? n === 1 : n === last + 1);
          last = n;
          caption.textContent = def.steps[n - 1].caption || '';
          return animateState(stage, () => draw(stage, mergeAt(initial, def.steps, n), esc), play);
        }, leave() { animateState.stop(stage); }, destroy() { animateState.stop(stage); } };
      },
    });
  };

  function tokenSlide(def) {
    const result = def.tokenizer.encode(def.text), tokens = result.tokens, ids = result.ids;
    let word = -1, subword = 0;
    const tones = tokens.map((t,i) => {if(L.tokenize.isWordStart(t,i)){word++;subword=0;}else subword++;return {alt:word%2===1,shade:subword%2===1};});
    setup(def, { split:false, ids:false, focus:null }, (host, state, esc) => {
      if (!state.split) { host.innerHTML = `<div class="llm-sentence" data-llm-motion="sentence">${esc(def.text)}</div>`; return; }
      host.innerHTML = `<div class="llm-tokens">${tokens.map((token, i) => {
        const cls = (tones[i].alt ? ' alt' : '') + (tones[i].shade ? ' shade' : '')
          + (state.focus === null || state.focus === undefined ? '' : state.focus === i ? ' hot' : ' dim');
        return `<div class="llm-token${cls}" data-llm-motion="token:${i}"><span data-llm-motion="token-box:${i}">${esc(display(token))}</span>${state.ids ? `<small data-llm-motion="token-id:${i}">${esc(String(ids[i]))}</small>` : ''}</div>`;
      }).join('')}</div>`;
    });
  }

  function attentionSlide(def) {
    const n = def.tokens.length;
    if (!n || !Array.isArray(def.weights) || def.weights.length !== n || def.weights.some(r => r.length !== n)) throw new Error('weights must be n by n');
    if (def.causalWeights && (def.causalWeights.length !== n || def.causalWeights.some(r => r.length !== n))) throw new Error('causalWeights must be n by n');
    const causal = def.causalWeights || def.weights.map((r, i) => r.map((v, j) => j > i ? 0 : v));
    const max = Math.max(Number.EPSILON, ...def.weights.flat(), ...causal.flat());
    setup(def, {rowsShown:0, focusRow:null, masked:false}, (host, state, esc) => {
      const weights = state.masked ? causal : def.weights;
      const side = Math.max(1, Math.min(3.7, 31 / n));
      const grid = `<div class="llm-grid" style="grid-template-columns:calc(var(--u) * 5) repeat(${n},calc(var(--u) * ${side}));">`
        + '<div></div>' + def.tokens.map((t,i) => `<div class="axis" data-llm-motion="column:${i}" title="${esc(t)}">${esc(display(t))}</div>`).join('')
        + def.tokens.map((t, i) => `<div class="axis" ${i < state.rowsShown ? `data-llm-motion="row:${i}"` : ''} title="${esc(t)}">${i < state.rowsShown ? esc(display(t)) : ''}</div>`
          + weights[i].map((w, j) => {
            const visible = i < state.rowsShown, mask = state.masked && j > i;
            const background = visible && !mask ? `background:color-mix(in srgb,var(--accent) ${Math.max(0, Math.min(100, 100 * w / max))}%,transparent);` : '';
            return `<div class="cell${mask && visible ? ' masked' : ''}${visible && state.focusRow === i ? ' focus' : ''}" data-llm-motion="cell:${i}:${j}" style="${background}${visible ? '' : 'opacity:0'}" title="${visible ? esc(String(w)) : ''}"></div>`;
          }).join('')).join('') + '</div>';
      let bars = '';
      if (Number.isInteger(state.focusRow) && state.focusRow >= 0 && state.focusRow < n && state.focusRow < state.rowsShown) {
        bars = `<div class="llm-bars">${weights[state.focusRow].map((v, i) => `<div class="llm-barrow" data-llm-motion="attention-bar:${i}"><span class="llm-barlabel">${esc(display(def.tokens[i]))}</span><div class="llm-track"><div class="llm-fill" data-llm-grow data-llm-motion="attention-fill:${i}" style="width:${100 * Math.max(0, Math.min(1, v))}%"></div></div><span class="llm-value">${(100*v).toFixed(1)}%</span></div>`).join('')}</div>`;
      }
      host.innerHTML = `<div class="llm-mapwrap">${grid}${bars}</div>`;
    });
  }

  function nextTokenSlide(def) {
    if (!Array.isArray(def.rounds) || !def.rounds.length || def.rounds.some(r => !r.candidates || !r.candidates.length || !r.candidates.every(c => Number.isFinite(c.logit)) || !Number.isInteger(r.chosen) || r.chosen < 0 || r.chosen >= r.candidates.length)) throw new Error('Each round needs finite candidate logits and a valid chosen index');
    const initial = {round:0, phase:'dist', temp:def.temp ?? 1, k:def.k ?? 5};
    setup(def, initial, (host, state, esc) => {
      const ri = Math.max(0, Math.min(def.rounds.length - 1, state.round));
      const round = def.rounds[ri], probs = L.sampling.softmaxT(round.candidates.map(c => c.logit), state.temp);
      const selected = round.chosen;
      const order = probs.map((p,i) => ({p,i})).sort((a,b) => b.p-a.p || a.i-b.i);
      const selectedRank = order.findIndex(x => x.i === selected);
      const count = Math.min(8, order.length, Math.max(0, state.k, selectedRank + 1));
      const prefix = [...def.rounds[0].prefix, ...def.rounds.slice(0,ri).map(r => r.candidates[r.chosen].label)];
      if (state.phase === 'pick' && round.candidates[selected]) prefix.push(round.candidates[selected].label);
      host.innerHTML = `<div class="llm-next"><div class="llm-prefix">${prefix.map((t,i) => `<span data-llm-motion="prefix:${i}"${state.phase === 'pick' && i === prefix.length-1 ? ` data-llm-source="candidate-label:${ri}:${selected}"` : ''}>${esc(t)}</span>`).join('')}</div>`
        + (def.showEntropy ? `<div class="llm-info">T = ${esc(String(state.temp))} · H = ${L.sampling.entropy(probs).toFixed(2)} bit</div>` : '')
        + order.slice(0,count).map(({p,i}) => `<div class="llm-barrow" data-llm-motion="candidate:${ri}:${i}"${state.phase === 'pick' ? (i === selected ? ' style="font-weight:700"' : ' style="opacity:.3"') : ''}><span class="llm-barlabel" data-llm-motion="candidate-label:${ri}:${i}">${esc(round.candidates[i].label)}</span><div class="llm-track"><div class="llm-fill" data-llm-grow data-llm-motion="candidate-fill:${ri}:${i}" style="width:${100*p}%"></div></div><span class="llm-value">${(100*p).toFixed(1)}%</span></div>`).join('') + '</div>';
    });
  }

  Object.assign(window.Deck, {llmTokenSlide:tokenSlide, llmAttentionSlide:attentionSlide, llmNextTokenSlide:nextTokenSlide});
})();
