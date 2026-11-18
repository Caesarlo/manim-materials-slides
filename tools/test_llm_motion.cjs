// Exercise the actual motion helper with a minimal Web Animations stub. Run: node tools/test_llm_motion.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

async function check(file) {
  const deck = {llmMath:{tokenize:{displayToken:x=>x}}};
  const context = vm.createContext({window:{Deck:deck},Deck:deck,getComputedStyle:el=>el.style});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../web',file),'utf8'),context,{filename:file});
  const created = [];
  const element = (key, x, width, options={}) => ({
    style:{opacity:'1',fill:'rgb(1, 2, 3)',stroke:'none',backgroundColor:'transparent',width:`${width}px`,transform:'none',outlineColor:'transparent',outlineWidth:'0px'},
    parentElement:null,
    getAttribute(name) { return name==='data-llm-motion'?key:name==='data-llm-source'?(options.source || null):null; },
    hasAttribute(name) { return !!options[name]; },
    getBoundingClientRect() { return {left:x,top:0,width}; },
    getTotalLength() { return 42; },
    animate(frames,timing) {
      let reject;
      const a={frames,timing,cancelled:false,finished:new Promise((_,r)=>{reject=r;}),cancel(){this.cancelled=true;reject(new Error('cancelled'));}};
      created.push(a);return a;
    },
  });
  const host={children:[element('row',10,30),element('candidate',40,20)],offsetWidth:100,
    querySelectorAll(){return this.children;},getBoundingClientRect(){return {width:100};}};
  const pending = deck.llmAnimateState(host,()=>{host.children=[
    element('row',20,70),element('prefix',80,25,{source:'candidate'}),
    element('edge',0,30,{'data-llm-draw':true}),
    element('bar',0,60,{'data-llm-grow':true}),
  ];},true);
  assert.equal(created.length,4,`${file}: changed and new objects should animate`);
  assert.equal(created[0].frames[0].width,'30px');
  assert.equal(created[0].frames[1].width,'70px');
  assert.match(created[1].frames[0].transform,/translate\(-40px,0px\)/);
  assert.equal(created[2].frames[0].strokeDashoffset,'42');
  assert.equal(created[3].frames[0].width,'0px');
  deck.llmAnimateState(host,()=>{host.children=[];},false);
  assert.ok(created.every(a=>a.cancelled),`${file}: a jump must cancel pending animation`);
  await pending;
  const count=created.length;
  deck.llmAnimateState(host,()=>{host.children=[element('instant',0,10)];},false);
  assert.equal(created.length,count,`${file}: jump must not start a transition`);
}

(async()=>{await check('llm.js');await check('llm_flow.js');console.log('LLM motion interpolation, path drawing and cancellation: pass');})().catch(error=>{console.error(error);process.exitCode=1;});
