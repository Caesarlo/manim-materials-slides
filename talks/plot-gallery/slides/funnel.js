// A six-stage funnel with illustrative candidate counts.
Deck.funnelChart({
  name:'funnel',heading:'Screening candidates',
  stages:[{label:'Candidates',count:100000},{label:'Stable',count:8000},{label:'Band gap',count:1200},{label:'Low thermal conductivity',count:150},{label:'Synthesizable',count:40},{label:'Selected',count:12}],
  steps:[{caption:'Start from a candidate library',state:{shown:1}},{caption:'Select stable materials',state:{shown:2}},{caption:'Require a suitable band gap',state:{shown:3}},{caption:'Select low thermal conductivity',state:{shown:4}},{caption:'Consider synthesis',state:{shown:5}},{caption:'Twelve candidates remain',state:{shown:6,focusLast:true}}],
  notes:'Illustrative data; widths are proportional to log10(count).',
});
