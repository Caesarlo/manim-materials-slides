// Native ECharts example: 1 one series · 2 two series, using the deck's theme and lifecycle.
{
Deck.slide('echarts-native', {
  steps: 2,
  mount(frame) {
    frame.innerHTML = '<h2 class="deck-heading">Native ECharts: data and options only</h2>';
    const plot = Deck.echart(frame, {
      label: 'ECharts example: two methods across three datasets',
      option(step, { P, u, font }) {
        return {
          grid: { left: '10%', right: '5%', top: '20%', bottom: '15%' },
          legend: { selectedMode: false, textStyle: { color: P.fg, fontFamily: font, fontSize: 1.4 * u } },
          tooltip: { trigger: 'axis', confine: true, renderMode: 'richText' },
          xAxis: { type: 'category', data: ['Dataset A', 'Dataset B', 'Dataset C'], axisLabel: { color: P.fg, fontSize: 1.6 * u } },
          yAxis: { type: 'value', min: 0, max: 100, axisLabel: { color: P.muted, fontSize: 1.3 * u } },
          series: [
            { id: 'baseline', name: 'Baseline', type: 'bar', data: [42, 56, 68], label: { show: true, position: 'top', color: P.fg } },
            { id: 'method', name: 'Method', type: 'bar', data: step >= 2 ? [58, 73, 85] : [null, null, null], label: { show: true, position: 'top', color: P.fg } },
          ],
        };
      },
    });
    return { enter: plot.show, leave: plot.leave, freeze: plot.freeze, destroy: plot.destroy };
  },
});
}
