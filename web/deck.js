// Runtime for live decks: every slide is a module that draws into its own 16:9 frame (HTML, SVG, and
// manim-web scenes via window.ManimWeb), and Reveal.js only supplies navigation, steps and speaker notes.
//
// A slide module registers itself:
//
//   Deck.slide('outline', {
//     steps: 2,                        // click-steps on the slide (default 1)
//     notes: 'speaker notes',
//     interactive: true,               // the slide takes drags/scrolls (no swipe-to-navigate on touch)
//     smoothBack: true,                // it plays steps in reverse on one click back (see Deck.start's smoothBack)
//     mount(frame, ctx) {              // build into `frame`; ctx = {theme, palette, data, M, css, esc}
//       return {
//         enter(step, animate) {},     // show steps 1..step. animate: true going forward; 'back' for one click
//                                      // back (play the step in reverse, quickly, if it makes sense); false: jump
//         leave() {},                  // off screen: stop anything running
//         freeze() {},                 // optional: redraw canvases now, so the deck can picture them
//         destroy() {},                // unmounted to stay under the browser's WebGL context limit
//       };                             // (enter may return a Promise that settles when the step is shown)
//     },
//   });
//
// and the deck page lists the modules in order, then calls Deck.start({title}). Press T to switch theme,
// L for a laser pointer (shared with the speaker view); left click steps forward, right click back. A 3D view turned in one
// window turns in the other too: see Deck.shareView.
//
// Helpers for slides: Deck.show(frame, step, animate) reveals the elements marked data-from="k" (shown from
// step k on) or data-show="1 3" (shown on exactly those steps); Deck.points([...]) writes a numbered column
// (.deck-col in deck.css); Deck.manim (web/manim.js) runs a manim-web scene a click at a time.
//
// The section footer: Deck.sections([[num, name], ...]) names the talk's sections (outline.js does), and a
// Deck.section(num) between the page's script tags puts the slides listed after it in that section. Every
// slide in a section shows the numbered sections along the bottom, its own lit; click one to go there.
// Deck.topics({num: [[title, [slide names], blurb], ...]}) splits a section into topics: the current
// section then shows a dot per topic (solid when done, accent for the one you are in, hollow ahead), and
// Deck.topicsOf(num) gives them to a checklist slide. Deck.expand(num) gives a dense section the whole
// footer while you are in it: the sections before it shrink to their numbers, and its topics spread along
// the bar as numbered segments (num.1, num.2, ... in topic order) that fill like a progress bar.
(function () {
  'use strict';

  // Mol*'s element colours (Jmol's CPK set), for atoms drawn with Deck.molstar (web/addons/molstar.js).
  const CPK = { C: '#909090', N: '#3050f8', O: '#ff0d0d', S: '#ffff30', P: '#ff8000', other: '#ff1493' };
  // The drawing palettes: the same colours as the CSS variables in web/deck.css, for canvases and SVG that
  // cannot read CSS. Keep the two in step. `series` matches --plot-1.. (charts and manim-web figures alike);
  // `neutral` is the grey for whatever is context rather than the point; `ligand` and `metal` colour small
  // molecules' carbons and metal ions in 3D; `ss` and `el` are for the 3D add-ons
  // (helix / strand / coil, and element colours for flat drawings). Lit 3D surfaces read darker than flat 2D
  // strokes, so the light theme's 3D greys are lifted.
  const PALETTES = {
    dark: {
      bg: '#0f1218', fg: '#edf0f4', muted: '#9aa0a6', detail: '#929dad', accent: '#82a7ff', done: '#4db6ac',
      highlight: '#ff9a4d', highlightText: '#ff9a4d', surface: '#192333',
      series: ['#82a7ff', '#ff9a4d', '#4db6ac', '#f06292', '#64a5f5', '#80b0ff', '#aed581', '#ffd54f'],
      rainbow: ['#80b0ff', '#64a5f5', '#4db6ac', '#aed581', '#ffd54f', '#ffb74d', '#ff7b72', '#f06292'],
      neutral: '#9aa0a6', ligand: '#6fdc8c', metal: '#c79bf2', ss: { H: '#e8575c', E: '#f2c14e', C: '#8a9099' },
      el: { C: '#b8bec7', N: '#6c8cff', O: '#ef6b6b', S: '#f2c14e', P: '#ff9f43', other: '#c79bf2' },
      ambient: 0.35, cpk: CPK,
    },
    light: {
      bg: '#fbfaf8', fg: '#11224e', muted: '#5c6370', detail: '#687386', accent: '#3166dd', done: '#007f73',
      highlight: '#ff7200', highlightText: '#a84600', surface: '#ffffff',
      series: ['#3166dd', '#ff7200', '#009688', '#ad1457', '#1565c0', '#448aff', '#8bc34a', '#ffc107'],
      rainbow: ['#448aff', '#1565c0', '#009688', '#8bc34a', '#ffc107', '#ff9800', '#f44336', '#ad1457'],
      neutral: '#b4bac3', ligand: '#1f8a3c', metal: '#8a4fd0', ss: { H: '#d6334a', E: '#c98a00', C: '#8b919b' },
      el: { C: '#7d848f', N: '#3a5bd9', O: '#cf3434', S: '#c98a00', P: '#e67700', other: '#8a4fd0' },
      ambient: 1.1, cpk: CPK,
    },
  };
  // Most browsers keep about 16 WebGL contexts and silently drop the oldest beyond that; each manim-web
  // scene holds one. Slides further than this from the current one are unmounted, and rebuilt on return.
  // 3 keeps at most 7 slides live, well under the limit, so stepping back rarely meets a rebuilt slide.
  const KEEP = 3;

  // light by default; ?theme=dark (or T while presenting) for the dark theme
  const theme = new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  const slides = [];
  const styled = new Set();
  let sections = [], part = null;  // the footer's sections, and the one slides are being added to
  let topics = {};                 // section number -> [[title, [slide names], blurb], ...]
  const expanded = new Set();      // sections whose topics spread along the footer (Deck.expand)

  function css(text) {
    if (styled.has(text)) return;
    styled.add(text);
    const el = document.createElement('style');
    el.textContent = text;
    document.head.append(el);
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // How going back looks, for the whole deck (Deck.start({ smoothBack })): 'none' jumps back everywhere; '3d'
  // plays one click back in reverse on the slides that declare smoothBack: true (the 3D slides with their own
  // reverse moves) and jumps elsewhere; 'all' also fades back the plain reveals and charts of every slide.
  let smoothBack = 'none';

  function start({ title, smoothBack: back = 'none' }) {
    document.title = title;
    smoothBack = back;
    const container = document.querySelector('.reveal .slides');
    for (const s of slides) {
      // The frame lives inside Reveal's section, so Reveal places, fades and thumbnails it (overview).
      const section = document.createElement('section');
      section.dataset.slide = s.name;
      if (s.def.interactive) section.dataset.preventSwipe = '';
      s.frame = Object.assign(document.createElement('div'), { className: 'deck-frame' });
      section.append(s.frame);
      for (let i = 1; i < (s.def.steps || 1); i++) {
        section.append(Object.assign(document.createElement('span'), { className: 'fragment deck-step' }));
      }
      if (s.def.notes) {
        section.append(Object.assign(document.createElement('aside'), { className: 'notes', textContent: s.def.notes }));
      }
      container.append(section);
      Object.assign(s, { section, state: 'empty', ctrl: null, shots: null });
    }

    Reveal.initialize({
      width: '100%', height: '100%', margin: 0, center: false,
      // no arrows, except on touch screens: there the 3D slides take swipes to turn what they show
      controls: matchMedia('(pointer: coarse)').matches, progress: true, slideNumber: 'c', hash: true,
      transition: 'fade', transitionSpeed: 'fast', backgroundTransition: 'none',
      plugins: window.RevealNotes ? [window.RevealNotes] : [],
    });
    Reveal.addKeyBinding({ keyCode: 84, key: 'T', description: 'Switch dark / light theme' }, () => {
      const q = new URLSearchParams(location.search);
      q.set('theme', theme === 'light' ? 'dark' : 'light');
      location.href = `${location.pathname}?${q}${location.hash}`;
    });
    // A laser pointer for the talk: L toggles a dot that follows the mouse. The dot is pointer-events: none,
    // so the draggable 3D slides still take their drags, and it only appears once the mouse has moved. This
    // takes L over from Reveal, which binds it to navigate-right alongside the right arrow; the arrow stays.
    //
    // The pointer is shared by every window of the same deck, like the laser of a presenter view: the audience
    // window and the speaker view's current-slide preview (a `?receiver` copy of the deck inside the speaker
    // window) talk over a BroadcastChannel. Moving the mouse in one shows a dot in both, under the mouse in
    // that window and at the same place on the slide in the other (positions are fractions of the slide frame,
    // so windows of different sizes agree), and L in either window switches it on or off in both. The
    // upcoming-slide preview is left out. Like the speaker view itself this needs http(s), not file://.
    const laser = Object.assign(document.createElement('div'), { className: 'deck-laser' });
    const ghost = Object.assign(document.createElement('div'), { className: 'deck-laser remote' });
    document.body.append(laser, ghost);
    const preview = /receiver/i.test(location.search);
    let upcoming = false;
    if (preview) { try { upcoming = !!(window.frameElement && window.frameElement.closest('#upcoming-slide')); } catch (err) { /* cross-origin parent */ } }
    const channel = typeof BroadcastChannel === 'function' && !upcoming ? new BroadcastChannel(`deck-laser:${location.pathname}`) : null;
    const send = (m) => { if (channel) channel.postMessage(m); };
    shareSend = channel ? send : null;
    const frameBox = () => {
      const f = document.querySelector('.reveal .slides section.present .deck-frame');
      return (f || document.documentElement).getBoundingClientRect();
    };
    const showAt = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; el.classList.add('on'); };
    let lasing = false, lastMove = null, sentAt = 0, sendTimer = 0, ghostTimer = 0;
    const flushMove = () => {
      sendTimer = 0;
      sentAt = performance.now();
      const b = frameBox();
      if (lastMove && b.width && b.height) send({ t: 'move', x: (lastMove.clientX - b.left) / b.width, y: (lastMove.clientY - b.top) / b.height });
    };
    const trackLaser = (e) => {
      showAt(laser, e.clientX, e.clientY);
      lastMove = e;
      const wait = 16 - (performance.now() - sentAt);  // at most about 60 messages a second, and the last position always goes out
      if (wait <= 0) flushMove(); else if (!sendTimer) sendTimer = setTimeout(flushMove, wait);
    };
    const dropLaser = (e) => { if (!e.relatedTarget) { laser.classList.remove('on'); send({ t: 'hide' }); } };
    const setLasing = (on, announce) => {
      if (on === lasing) return;
      lasing = on;
      document.documentElement.classList.toggle('deck-lasing', on);
      laser.classList.remove('on');  // wait for the first move, so it never flashes in the corner
      ghost.classList.remove('on');
      const bind = on ? addEventListener : removeEventListener;
      bind('pointermove', trackLaser);
      bind('pointerout', dropLaser);
      if (announce) send({ t: 'lase', on });
    };
    if (channel) {
      channel.onmessage = ({ data: m }) => {
        if (!m) return;
        if (m.t === 'lase') setLasing(!!m.on, false);
        else if (m.t === 'hello') { if (lasing) send({ t: 'lase', on: true }); }  // a window that opened late catches up
        else if (m.t === 'hide') ghost.classList.remove('on');
        else if (m.t === 'view') {
          for (const e of shares) if (shareKey(e.host) === m.k) { e.set(m.s); e.last = e.get(); }  // adopt it as ours, so it is not sent back
        }
        else if (m.t === 'move' && lasing && !Reveal.isOverview()) {
          const b = frameBox();
          showAt(ghost, b.left + m.x * b.width, b.top + m.y * b.height);
          clearTimeout(ghostTimer);
          ghostTimer = setTimeout(() => ghost.classList.remove('on'), 1500);  // the other window stopped moving or went away
        }
      };
      send({ t: 'hello' });
    }
    Reveal.addKeyBinding({ keyCode: 76, key: 'L', description: 'Laser pointer on / off (also in the speaker view)' }, () => setLasing(!lasing, true));
    // Click to turn the page, like a clicker: left forward, right back. Three things are not that click: a
    // press that moved is a drag on one of the 3D slides, a press on a control belongs to that control, and
    // in the overview a click picks a slide, which Reveal does itself. The 3D hosts capture the pointer, so
    // their pointerup still arrives here and the distance test is what keeps a turned model on its slide.
    // The context menu is suppressed over the deck, or the right click would open it instead of going back.
    const CONTROLS = 'button, a, input, select, textarea, label, [role="button"]';
    const stage = document.querySelector('.reveal');
    let press = null;
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    stage.addEventListener('pointerdown', (e) => {
      press = e.button === 0 || e.button === 2 ? { x: e.clientX, y: e.clientY, button: e.button } : null;
    });
    stage.addEventListener('pointerup', (e) => {
      const from = press;
      press = null;
      if (!from || e.button !== from.button || Reveal.isOverview()) return;
      if (Math.hypot(e.clientX - from.x, e.clientY - from.y) > 6) return;
      if (e.target.closest && e.target.closest(CONTROLS)) return;
      if (e.button === 0) Reveal.next(); else Reveal.prev();
    });
    ['ready', 'slidechanged', 'fragmentshown', 'fragmenthidden', 'overviewhidden'].forEach((e) => Reveal.on(e, sync));
    if (sections.length) {
      const light = footer();
      ['ready', 'slidechanged'].forEach((e) => Reveal.on(e, light));
      if (Reveal.isReady()) light();
    }
    Reveal.on('overviewshown', (e) => {
      sync(e);
      // The overview shows slides complete (Reveal's convention): jump live ones to their last step.
      for (const s of slides) {
        if (s.state === 'live') Promise.resolve(s.ctrl.enter(s.def.steps || 1, false)).then(() => s.ctrl && s.ctrl.leave && s.ctrl.leave());
      }
      fillOverview();
    });
    if (Reveal.isReady()) sync();
  }

  // The footer lives outside the slides, so it stays put while they fade; it returns the function that lights
  // the current slide's section (and hides the footer on slides in none, like the title).
  function footer() {
    const nav = Object.assign(document.createElement('nav'), { className: 'deck-footer' });
    nav.innerHTML = sections.map(([num, name]) => {
      const list = topics[num] || [];
      // an expanded section also carries a segment per topic, shown in place of its name and dots
      const subs = expanded.has(num) && list.length ? `<span class="deck-subs">${list.map(([title], i) =>
        `<span class="deck-sub" data-i="${i}"><b>${esc(num)}.${i + 1}</b>${esc(title)}</span>`).join('')}</span>` : '';
      return `<a data-num="${esc(num)}"><b>${esc(num)}</b><span class="deck-name">${esc(name)}</span>${
        list.length ? `<span class="deck-dots">${list.map(() => '<i></i>').join('')}</span>` : ''}${subs}</a>`;
    }).join('');
    document.querySelector('.reveal').append(nav);
    const items = [...nav.children];
    const firstOf = (names) => slides.findIndex((s) => names.includes(s.name));
    for (const a of items) {
      const first = slides.findIndex((s) => s.part === a.dataset.num);
      if (first < 0) a.classList.add('empty'); else a.addEventListener('click', () => Reveal.slide(first));
      // each segment is its own link, to its topic's first slide rather than the section's
      a.querySelectorAll('.deck-sub').forEach((el) => {
        const to = firstOf(topics[a.dataset.num][+el.dataset.i][1]);
        if (to >= 0) el.addEventListener('click', (e) => { e.stopPropagation(); Reveal.slide(to); });
      });
    }
    const indexOf = (name) => slides.findIndex((x) => x.name === name);
    return () => {
      const h = Reveal.getIndices().h, s = slides[h];
      const here = s ? s.part : null;
      nav.classList.toggle('on', here !== null);
      for (const a of items) a.classList.toggle('current', a.dataset.num === here);
      // the topic this slide belongs to: those before it are done. A slide named in no topic belongs to the
      // last topic that has begun by now, so one slipped in mid-topic does not blank the bar; a slide before
      // any topic begins, like a checklist that opens the section, has done none.
      const list = topics[here] || [];
      let at = s ? list.findIndex(([, names]) => names.includes(s.name)) : -1;
      if (s && at < 0) list.forEach(([, names], i) => { if (Math.min(...names.map(indexOf).filter((p) => p >= 0)) <= h) at = i; });
      // how far through a topic this slide is: its slides shown so far, counting by position, out of those
      // actually in the deck (a topic may name a slide that is switched off, which must not stop it filling)
      const through = (names) => {
        const at = names.map(indexOf).filter((p) => p >= 0);
        return at.length ? at.filter((p) => p <= h).length / at.length : 0;
      };
      nav.classList.toggle('wide', expanded.has(here) && list.length > 0);
      const dots = here === null ? [] : nav.querySelectorAll(`a[data-num="${here}"] .deck-dots i`);
      dots.forEach((d, i) => { d.className = i < at ? 'done' : i === at ? 'now' : ''; });
      // the segments fill like a progress bar: done ones whole, the current one as far as this slide
      // within its topic, the rest empty
      const segs = here === null ? [] : nav.querySelectorAll(`a[data-num="${here}"] .deck-sub`);
      segs.forEach((el, i) => {
        const names = list[i][1];
        el.className = `deck-sub${i < at ? ' done' : i === at ? ' now' : ''}`;
        el.style.setProperty('--fill', i < at ? 1 : i === at ? through(names) : 0);
      });
    };
  }

  // A slide is 'empty' (never built), 'live' (its module is running) or 'still' (its WebGL freed and its
  // canvases replaced by pictures of their last frame, so the overview still has a thumbnail).
  function mount(s) {
    s.frame.replaceChildren();
    s.ctrl = s.def.mount(s.frame, { theme, palette: PALETTES[theme], data: window.DATA || {}, M: window.ManimWeb, css, esc });
    s.state = 'live';
  }

  // Picture every canvas while the slide is laid out. A WebGL canvas can only be read in the task that
  // drew it, so the module's freeze() redraws first. Taken after each step, because by the time a slide
  // is unmounted Reveal may already have hidden it (display: none leaves nothing to read).
  // A still is only ever seen small (an overview thumbnail), so it is taken at most STILL_W pixels wide: reading
  // back and encoding a full-size canvas (3200 px on a Retina screen) would stall the page after every step.
  const STILL_W = 800;
  function still(c) {
    const k = Math.min(1, STILL_W / c.width);
    if (k === 1) return c.toDataURL('image/webp', 0.85);
    const t = Object.assign(document.createElement('canvas'), { width: Math.round(c.width * k), height: Math.round(c.height * k) });
    t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
    return t.toDataURL('image/webp', 0.85);
  }

  function capture(s) {
    if (s.state !== 'live' || !s.frame.getClientRects().length) return;
    if (s.ctrl.freeze) s.ctrl.freeze();
    const box = s.frame.getBoundingClientRect();
    s.shots = [...s.frame.querySelectorAll('canvas')].map((c) => {
      let src = null;
      try { src = still(c); } catch (err) { /* lost context */ }
      const r = c.getBoundingClientRect();
      return { src, left: (r.left - box.left) / box.width, top: (r.top - box.top) / box.height,
               width: r.width / box.width, height: r.height / box.height };
    }).filter((shot) => shot.src && shot.width > 0);
  }

  // Give a canvas's WebGL context back to the browser now. dispose() frees what a scene made, but the context
  // itself lingers until garbage collection, and past ~16 the browser drops the oldest one, which can be a
  // slide still on screen. getContext returns the context the canvas already has (null for a 2D canvas).
  function release(canvas) {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const lose = gl && gl.getExtension('WEBGL_lose_context');
    if (!lose || gl.isContextLost()) return;
    // the slide is gone, so nobody needs telling: keep the disposed renderer from reporting the loss
    canvas.addEventListener('webglcontextlost', (e) => e.stopImmediatePropagation(), { capture: true, once: true });
    lose.loseContext();
  }

  function freeze(s) {
    if (s.state !== 'live') return;
    const canvases = [...s.frame.querySelectorAll('canvas')];  // before destroy(), which may take them out
    if (s.ctrl.leave) s.ctrl.leave();
    if (s.ctrl.destroy) s.ctrl.destroy();
    s.ctrl = null;
    canvases.forEach((c) => { release(c); c.remove(); });
    for (const shot of s.shots || []) {
      const img = Object.assign(new Image(), { src: shot.src, className: 'deck-still' });
      Object.assign(img.style, { left: `${shot.left * 100}%`, top: `${shot.top * 100}%`,
                                 width: `${shot.width * 100}%`, height: `${shot.height * 100}%` });
      s.frame.append(img);
    }
    s.state = 'still';
  }

  // While a slide is still animating (its enter() returned a promise not yet settled), a dot pulses by the slide
  // number, so you can tell a step that is still running from one that is waiting for your click. Shown only
  // after 150 ms, so steps that settle at once don't flash it.
  let busyRun = 0, busyTimer = 0;
  function busy(result) {
    if (!result || typeof result.then !== 'function') return result;
    const run = ++busyRun, root = document.documentElement;
    clearTimeout(busyTimer);
    busyTimer = setTimeout(() => { if (run === busyRun) root.classList.add('deck-busy'); }, 150);
    const done = () => { if (run === busyRun) { clearTimeout(busyTimer); root.classList.remove('deck-busy'); } };
    result.then(done, done);
    return result;
  }

  function sync(event) {
    const current = Reveal.getIndices().h;
    const overview = Reveal.isOverview();
    slides.forEach((s, i) => {
      if (Math.abs(i - current) > KEEP) { freeze(s); return; }
      if (i !== current || overview) {
        if (s.ctrl && s.ctrl.leave) s.ctrl.leave();
        return;
      }
      // Built on arrival, when the frame has a size, so nothing runs until it is needed.
      if (s.state !== 'live') mount(s);
      const step = 1 + s.section.querySelectorAll('.deck-step.visible').length;
      // Animate going forward. One click back is 'back' where smoothBack allows it (above): the slide may play
      // that step in reverse ('back' is truthy, so its CSS reveals fade rather than snap). A second click back in
      // quick succession, or arriving from a later slide, jumps straight to the step.
      let animate = !event || event.type === 'ready' || event.type === 'fragmentshown'
        || (event.type === 'slidechanged' && step === 1);
      if (event && event.type === 'fragmenthidden') {
        const now = performance.now();
        const allowed = smoothBack === 'all' || (smoothBack === '3d' && s.def.smoothBack);
        animate = allowed && now - lastBack > BACK_REPEAT ? 'back' : false;
        lastBack = now;
      }
      Promise.resolve(busy(s.ctrl.enter(step, animate))).then(() => {
        if (Reveal.getIndices().h === i && !Reveal.isOverview()) capture(s);
      });
    });
    // The next slide is built ahead, so it has drawn its opening frame before you arrive: crossfading into a
    // frame that is still building reads as a cut, and breaks hand-offs that continue one picture onto the next.
    const ahead = (s) => {
      if (!s || Reveal.isOverview() || s.state === 'live' || !s.section.getClientRects().length) return;
      mount(s);
      if (s.ctrl.leave) s.ctrl.leave();
    };
    if (!overview) ahead(slides[current + 1]);
    // The previous slide is built too, so stepping back lands on a slide that is ready rather than one that
    // builds (3D setup takes a moment) as you arrive. It waits a little, so its setup does not hold up the
    // step you are watching, and only if you are still on this slide.
    clearTimeout(behindTimer);
    if (!overview) behindTimer = setTimeout(() => { if (Reveal.getIndices().h === current) ahead(slides[current - 1]); }, 400);
  }
  let behindTimer = 0;
  // a click back this soon after the last one jumps instead of playing in reverse (ms)
  const BACK_REPEAT = 700;
  let lastBack = -Infinity;

  // The overview shows every slide's frame; build the ones never visited, one at a time and at their last
  // step, then freeze them, so thumbnails exist without holding a WebGL context per slide.
  let filling = false;
  async function fillOverview() {
    if (filling) return;
    filling = true;
    const current = Reveal.getIndices().h;
    for (const [i, s] of slides.entries()) {
      if (!Reveal.isOverview()) break;
      if (s.state !== 'empty' || !s.section.getClientRects().length) continue;
      mount(s);
      await s.ctrl.enter(s.def.steps || 1, false);
      capture(s);
      if (Math.abs(i - current) > KEEP) freeze(s); else s.ctrl.leave && s.ctrl.leave();
      await new Promise(requestAnimationFrame);
    }
    filling = false;
  }

  // Step reveals, the deck's usual way of building a slide up a click at a time: an element with
  // data-from="k" is shown from step k on, one with data-show="1 3" on exactly those steps. Showing is adding
  // the class `in`; .reveal-in (deck.css) fades and slides in on it, and a slide may style `.in` its own way.
  // animate=false (arriving from a later slide) skips the transitions.
  // 3D views that the audience window and the speaker view's current-slide preview should show alike. A view
  // registers with `Deck.shareView(host, { get, set })`: get() returns its pose as an array of numbers, set(pose)
  // applies one. The returned handle is used by the view: changed() once per frame (sends when the pose moved),
  // push() right after a user input, settle() to adopt the current pose without sending (a scripted camera move
  // runs in every window on its own), dispose(). Poses travel over the laser pointer's BroadcastChannel; a view is
  // found in the other window by where it sits (slide index, and its order among the slide's views).
  const shares = new Set();
  let shareSend = null;
  const shareKey = (host) => {
    const sec = host.closest('section');
    if (!sec || !window.Reveal) return null;
    const i = Reveal.getIndices(sec);
    return `${i.h}:${i.v}:${[...sec.querySelectorAll('[data-share-view]')].indexOf(host)}`;
  };
  function shareView(host, { get, set }) {
    host.setAttribute('data-share-view', '');
    const e = { host, get, set, last: get(), sentAt: 0, timer: 0 };
    shares.add(e);
    const same = (a, b) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-4);
    const send = () => {
      e.timer = 0;
      e.sentAt = performance.now();
      const k = shareKey(host);
      if (k !== null && shareSend) shareSend({ t: 'view', k, s: e.last });
    };
    const schedule = () => {  // at most about 60 messages a second, and the last pose always goes out
      const wait = 16 - (performance.now() - e.sentAt);
      if (wait <= 0) send(); else if (!e.timer) e.timer = setTimeout(send, wait);
    };
    return {
      changed() { const s = get(); if (!same(s, e.last)) { e.last = s; schedule(); } },
      settle() { e.last = get(); },
      push() { e.last = get(); schedule(); },
      dispose() { clearTimeout(e.timer); shares.delete(e); host.removeAttribute('data-share-view'); },
    };
  }

  function show(frame, step, animate = true) {
    frame.classList.toggle('instant', !animate);
    void frame.offsetWidth;  // flush styles, so a fresh mount fades in from the hidden state
    for (const el of frame.querySelectorAll('[data-from], [data-show]')) {
      const on = el.dataset.show ? el.dataset.show.split(/\s+/).map(Number).includes(step)
        : step >= Number(el.dataset.from);
      el.classList.toggle('in', on);
    }
  }

  // A numbered column of points (.deck-col in deck.css), each revealed on its own step:
  //   Deck.points([{ title: 'Idea', sub: 'the line under it', from: 2 }, ...], { className: 'my-col' })
  // Titles and subs are text (escaped); pass `html: true` on a point to use markup instead.
  function points(list, { className = '' } = {}) {
    const text = (p, s) => (p.html ? s : esc(s));
    return `<div class="deck-col ${className}">${list.map((p, i) => `
      <div class="deck-point reveal-in" data-from="${p.from || i + 1}">
        <div class="deck-point-t"><span>${p.num || i + 1}</span>${text(p, p.title)}</div>
        ${p.sub ? `<div class="deck-point-s">${text(p, p.sub)}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  window.Deck = {
    theme, palette: PALETTES[theme], PALETTES, esc, css, start, show, points, shareView,
    // def.before: put this slide just ahead of an already registered one (its section is still the one current
    // here), for a slide whose neighbours live in another module
    slide(name, def) {
      const at = def.before ? slides.findIndex((s) => s.name === def.before) : -1;
      if (def.before && at < 0) console.warn(`Deck.slide('${name}'): no slide '${def.before}' to go before`);
      slides.splice(at < 0 ? slides.length : at, 0, { name, def, part });
    },
    sections(list) { sections = list.map(([num, name]) => [String(num), name]); },
    section(num) { part = num === null ? null : String(num); },
    topics(map) { topics = Object.fromEntries(Object.entries(map).map(([k, v]) => [String(k), v])); },
    expand(...nums) { nums.forEach((n) => expanded.add(String(n))); },
    // Take slides out of the talk without touching their code: call it after their files load and before
    // Deck.start. Un-hiding is deleting the call. A topic may still name a hidden slide; the footer skips it.
    hide(...names) {
      for (const name of names) {
        const at = slides.findIndex((s) => s.name === name);
        if (at < 0) console.warn(`Deck.hide('${name}'): no such slide`);
        else slides.splice(at, 1);
      }
    },
    topicsOf(num) { return topics[String(num)] || []; },
    // The running controller of a slide (null unless it is live): handy for tests and the console.
    controller(name) { const s = slides.find((x) => x.name === name); return s ? s.ctrl : null; },
  };
})();
