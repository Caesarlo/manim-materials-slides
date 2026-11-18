// Node-only checks for the ported pure calculations and jump-safe slide states.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const definitions = new Map();
const deck = {slide(name, def) {definitions.set(name,def);}};
const context = vm.createContext({window:{Deck:deck},Deck:deck});
for (const file of ['llm_math.js','llm.js','llm_flow.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',file),'utf8'),context,{filename:file});
}
const L=deck.llmMath;
const tk=L.tokenize.makeTokenizer(['The',' lat','tice']);
const encoded=tk.encode('The lattice🙂');
assert.equal(tk.decode(encoded.ids),'The lattice🙂');
const {Q,K}=L.attention.qkFromTokens(encoded.tokens,4,7);
const matrix=L.attention.attention(Q,K,{causal:true});
matrix.forEach((row,i)=>{assert.ok(Math.abs(row.reduce((a,b)=>a+b,0)-1)<1e-12);row.forEach((p,j)=>{if(j>i)assert.equal(p,0);});});
const p=L.sampling.softmaxT([3,1,0],1);
assert.ok(Math.abs(p.reduce((a,b)=>a+b,0)-1)<1e-12);
assert.ok(L.sampling.entropy(L.sampling.softmaxT([3,1,0],2))>L.sampling.entropy(p));
assert.deepEqual(Array.from(L.embedding.nearest([[1,0],[.9,.1],[0,1]],0,2)),[1,2]);
const trace=L.trace.fromMessages([{type:'human',content:'question'},{type:'ai',tool_calls:[{id:'a',name:'task',args:{description:'lookup'}}]},{type:'tool',tool_call_id:'a',name:'task',content:'ok',additional_kwargs:{subagent_status:'completed'}},{type:'ai',content:'answer'}]);
assert.equal(trace.events.length,4);
function mount(name) {
  const stage={innerHTML:'',classList:{toggle(){}}}, caption={textContent:''};
  const frame={innerHTML:'',querySelector(s){return s.includes('stage')?stage:caption;}};
  const ctrl=definitions.get(name).mount(frame,{css(){},esc(x){return String(x).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}});
  return {stage,caption,ctrl};
}
function jumpSafe(name,last) {
  const direct=mount(name);direct.ctrl.enter(last,false);
  const step=mount(name);for(let k=1;k<=last;k++)step.ctrl.enter(k,false);
  assert.equal(step.stage.innerHTML,direct.stage.innerHTML,`${name} direct jump differs from forward steps`);
  step.ctrl.enter(1,false);step.ctrl.enter(last,false);
  assert.equal(step.stage.innerHTML,direct.stage.innerHTML,`${name} reverse/jump differs`);
}
deck.llmTokenSlide({name:'tokens',text:'The lattice🙂',tokenizer:tk,steps:[{state:{split:false}},{state:{split:true,ids:true}},{state:{focus:2}}]});
deck.llmAttentionSlide({name:'attention',tokens:encoded.tokens,weights:L.attention.attention(Q,K),causalWeights:matrix,steps:[{state:{rowsShown:encoded.tokens.length}},{state:{focusRow:1}},{state:{focusRow:null,masked:true}}]});
deck.llmNextTokenSlide({name:'next',rounds:[{prefix:['a'],candidates:[{label:'b',logit:1},{label:'c',logit:0}],chosen:0}],steps:[{state:{phase:'dist'}},{state:{phase:'pick',temp:.5}}],showEntropy:true});
deck.llmBlockSlide({name:'blocks',blocks:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'db',label:'DB',below:'b'}],links:[{from:'db',to:'b'}],steps:[{state:{shown:1}},{state:{shown:3,active:2}}]});
deck.llmBlockSlide({name:'residual',direction:'column',blocks:[{id:'a',label:'A'},{id:'b',label:'B'}],residuals:[{from:'a',to:'b',side:'start',label:'left'},{from:'a',to:'b',side:'end',label:'right'}],steps:[{state:{shown:2,residuals:1}},{state:{residuals:2}}]});
deck.llmAgentSlide({name:'agent',trace});
const parallel=L.trace.fromMessages([{type:'human',content:'question'},{type:'ai',tool_calls:[{id:'a',name:'task',args:{description:'task a'}},{id:'b',name:'task',args:{description:'task b'}}]},{type:'tool',tool_call_id:'a',name:'task',content:'failed',additional_kwargs:{subagent_status:'failed'}},{type:'ai',tool_calls:[{id:'c',name:'task',args:{description:'task a'}}]}]);
deck.llmAgentSlide({name:'parallel',trace:parallel,group:[[2,3]]});
deck.llmTrainingSlide({name:'training',stages:[{label:'Train',data:'tokens',goal:'predict'},{label:'Align',data:'pairs',goal:'align'}]});
deck.llmEmbeddingSlide({name:'embedding',vectors:[[1,0],[0,1],[1,1]],labels:['a','b','c'],groups:[0,1,1],steps:[{state:{groupsShown:1}},{state:{groupsShown:2,labels:true,highlight:[0,1]}}]});
for (const [name,n] of [['tokens',3],['attention',3],['next',2],['blocks',2],['residual',2],['agent',4],['training',3],['embedding',2]]) jumpSafe(name,n);
const residual=mount('residual');residual.ctrl.enter(2,false);
assert.ok(residual.stage.innerHTML.includes('>left</text>') && residual.stage.innerHTML.includes('>right</text>'));
const residualPaths=[...residual.stage.innerHTML.matchAll(/class="lf-residual" d="([^"]+)/g)].map(x=>x[1]);
assert.equal(residualPaths.length,2);assert.notEqual(residualPaths[0],residualPaths[1]);
// Dense row and column flows still need visible arrow space, and long labels
// must be constrained to the node that contains them.
for (const direction of ['row','column']) for (const count of [6,10,20]) {
  const name=`layout-${direction}-${count}`;
  const blocks=Array.from({length:count},(_,i)=>({id:`b${i}`,label:'A very long node label',shape:'long shape annotation'}));
  deck.llmBlockSlide({name,direction,blocks,steps:[{state:{shown:count}}]});
  const page=mount(name);page.ctrl.enter(1,false);
  const boxes=[...page.stage.innerHTML.matchAll(/<rect class="lf-box[^>]*>/g)].map(([tag])=>{
    const attr=k=>Number(tag.match(new RegExp(`\\b${k}="([^"]+)"`))[1]);
    return {x:attr('x'),y:attr('y'),w:attr('width'),h:attr('height')};
  });
  assert.equal(boxes.length,count);
  for(let i=1;i<count;i++) {
    const gap=direction==='row'?boxes[i].x-boxes[i-1].x-boxes[i-1].w:boxes[i].y-boxes[i-1].y-boxes[i-1].h;
    const expected=Math.min(direction==='row'?26:20,(direction==='row'?870:330)/count*.3);
    assert.ok(gap>=expected-1e-7,`${name}: arrow gap ${gap} is too small`);
  }
  const labels=[...page.stage.innerHTML.matchAll(/<text class="lf-label[^>]*data-fit-width="([^"]+)"[^>]*>/g)];
  assert.equal(labels.length,count);
  labels.forEach(([,width],i)=>assert.ok(+width<=boxes[i].w-14+1e-7));
}
const fitted=mount('blocks'), fittedAttributes={};
const longLabel={getAttribute(){return '45';},getComputedTextLength(){return 90;},setAttribute(k,v){fittedAttributes[k]=v;}};
fitted.stage.querySelectorAll=selector=>selector==='text[data-fit-width]'?[longLabel]:[];
fitted.ctrl.enter(2,false);
assert.equal(fittedAttributes.textLength,'45');assert.equal(fittedAttributes.lengthAdjust,'spacingAndGlyphs');
const replay=mount('parallel');replay.ctrl.enter(2,false);
assert.equal((replay.stage.innerHTML.match(/class="lf-arrow-active"/g)||[]).length,2,'parallel calls need two active arrows');
replay.ctrl.enter(1,false);replay.ctrl.enter(2,true);
assert.equal((replay.stage.innerHTML.match(/<animateMotion/g)||[]).length,2,'parallel calls need two moving messages');
replay.ctrl.enter(3,false);
assert.ok(replay.stage.innerHTML.includes(' C '),'retry should display a loop');
const beforeGallery=new Set(definitions.keys());
vm.runInContext(fs.readFileSync(path.join(__dirname,'../talks/llm-gallery/slides/gallery.js'),'utf8'),context,{filename:'gallery.js'});
const gallery=[...definitions.keys()].filter(k=>!beforeGallery.has(k));
assert.equal(gallery.length,10);
for (const name of gallery) {
  const count=definitions.get(name).steps;
  jumpSafe(name,count);
  const page=mount(name);for(let k=1;k<=count;k++)page.ctrl.enter(k,true);
}
console.log('LLM math, trace and seven slide types: pass');
