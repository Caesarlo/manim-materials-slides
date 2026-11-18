// Apache ECharts bridge for live decks; load vendor/echarts/echarts.min.js and this file after deck.js.
// Deck.echart(frame, { label, option(step, { P, u, font }) }) accepts native ECharts options; no chart drawing code.
// Returns { root, show(step, animate), leave, freeze, destroy }. Wire these into the slide controller.
// The bridge supplies the project palette, scaled typography, resize/disposal and SVG overview snapshots.
// Forward steps use ECharts transitions; back/jumps and freeze render the complete target state instantly.
(function () {
  'use strict';
  const D = window.Deck;
  D.css(`.deck-echart{position:absolute;left:4.2%;right:4.2%;top:19%;height:59%}`);

  D.echart = function (frame, { label, option }) {
    const root = document.createElement('div');
    root.className = 'deck-echart';
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', label);
    frame.append(root);
    let chart = null, step = 1, dead = false, settle = null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const context = () => ({ P: D.palette, u: parseFloat(getComputedStyle(frame).fontSize), font: getComputedStyle(frame).fontFamily });

    function draw(animate = false) {
      if (settle) settle();
      if (dead || !root.clientWidth || !root.clientHeight) return;
      if (!chart) chart = window.echarts.init(root, null, { renderer: 'svg' });
      chart.resize({ silent: true, animation: { duration: 0 } });
      const ctx = context();
      const next = {
        backgroundColor: 'transparent', color: ctx.P.series,
        textStyle: { color: ctx.P.fg, fontFamily: ctx.font, fontSize: 1.4 * ctx.u },
        animationDuration: 650, animationDurationUpdate: 400,
        ...option(step, ctx), animation: animate === true && !reduced.matches,
      };
      // Resolve even if a step changes during animation; old promises must not keep the deck busy.
      let done;
      const result = next.animation ? new Promise((resolve) => { done = resolve; }) : undefined;
      if (done) {
        const finish = () => {
          clearTimeout(timer);
          chart?.off('finished', finish);
          settle = null;
          done();
        };
        const timer = setTimeout(finish, 1200);
        settle = finish;
        chart.on('finished', finish);
      }
      chart.setOption(next, { replaceMerge: ['series'] });
      return result;
    }

    const observer = new ResizeObserver(() => draw(false));
    observer.observe(root);
    return {
      root,
      show(target, animate = true) { step = target; return draw(animate); },
      leave() { draw(false); },
      freeze() { draw(false); },
      destroy() {
        if (settle) settle();
        dead = true;
        observer.disconnect();
        // The deck removes canvases on eviction. Keep a static SVG for overview and speaker thumbnails.
        const snapshot = root.querySelector('svg')?.cloneNode(true);
        chart?.dispose();
        chart = null;
        if (snapshot) root.replaceChildren(snapshot);
      },
    };
  };
})();
