// Pure numerical regression checks for migrated chart data logic. Run: node tools/test-plots.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const slides=[];
const Deck={slide:(name,def)=>slides.push({name,def})};
const sandbox={window:{Deck},console};
for(const file of ['web/line_chart.js','web/funnel_chart.js','web/hull_chart.js','web/phonon_chart.js']) runInNewContext(readFileSync(file,'utf8'),sandbox,{filename:file});
const plain=(v)=>JSON.parse(JSON.stringify(v));
assert.deepEqual(plain(Deck.lineFromColumns({x:[1,2,3],series:[{name:'A',y:[4,null,6]}]})),[{name:'A',points:[[1,4],null,[3,6]]}]);
const pts=[{x:1,y:2},{x:2,y:3},{x:3,y:2}];
assert.deepEqual(plain(Deck.pointsInRegion(pts,{x0:2,x1:3,y0:3,y1:2})),[1,2]);
const hull=Deck.hullMath.lowerHull([{x:0,e:0},{x:0.5,e:-0.5},{x:0.5,e:-0.1},{x:1,e:0}]);
assert.deepEqual(plain(hull),[{x:0,e:0},{x:0.5,e:-0.5},{x:1,e:0}]);
assert.equal(Deck.hullMath.energyAt(hull,0.25),-0.25);
assert.deepEqual(plain(Deck.phononMath.findGaps([[0,1],[2,3],[0.5,2.5]])),[]);
assert.deepEqual(plain(Deck.phononMath.findGaps([[0,1],[2,3]])),[{lower:0,upper:1,from:1,to:2,size:1}]);
assert.deepEqual(plain(Deck.phononMath.negativeRuns([0,1,2],[1,-1,1])),[[[0.5,0],[1,-1],[1.5,0]]]);
const chain=Deck.phononMath.diatomicChain(1,2,1,3);
assert.ok(Math.abs(chain.freqs[0][0])<1e-12);
assert.ok(Math.abs(chain.freqs[1][0]-Math.sqrt(3))<1e-12);
assert.ok(Math.abs(chain.freqs[1][2]-Math.sqrt(2))<1e-12);
assert.throws(()=>Deck.phononMath.diatomicChain(0,2,1,3),/positive finite/);
assert.throws(()=>Deck.lineChart({name:'bad',x:{domain:[0,1],type:'log'},y:{domain:[0,1]},series:[],steps:[{}]}),/log domains/);
assert.throws(()=>Deck.funnelChart({name:'bad',stages:[{count:0}],steps:[{}]}),/positive/);
console.log('Plot numerical checks passed.');

// Mount the chart with stand-in manim primitives to check clipping and state reconstruction.
class Shape {
  constructor(opts={}) { this.opts=opts; this.opacity=1; }
  moveTo(p) { this.position=p; return this; }
  shift(p) { this.offsetY=(this.offsetY || 0)+p[1]; return this; }
  setFill() { return this; }
}
class UpdateFromAlphaFunc { constructor(target,update) { this.target=target; this.update=update; } }
const M={Line:Shape,Text:Shape,Dot:Shape,Rectangle:Shape,RoundedRectangle:Shape,Arrow:Shape,Circle:Shape,DashedLine:Shape,UpdateFromAlphaFunc};
const P={fg:'fg',muted:'muted',detail:'detail',accent:'accent',neutral:'neutral',bg:'bg',series:['a','b','c','d','e']};
let latestScene, midFrame;
Deck.manim=(_host,{build,steps})=>{
  let objects; const scene={items:[],add(...xs){this.items.push(...xs.flat());},remove(...xs){this.items=this.items.filter((x)=>!xs.includes(x));},render(){}};
  latestScene=scene;
  return {scene,freeze(){},dispose(){},async go(n,animate=false){scene.items=[];objects=build({M,P});for(let i=0;i<n;i++)await steps[i](objects,{M,P,scene,fast:!animate || i<n-1,add:(...xs)=>scene.add(...xs),play:async(a)=>{a.update(a.target,0);a.update(a.target,0.5);midFrame=scene.items.map((m)=>({key:m._plotKey ?? m._funnelKey,opacity:m.opacity,offsetY:m.offsetY || 0,group:m._plotGroup,progress:m._plotProgress}));a.update(a.target,1);}});}};
};
Deck.show=()=>{};
const def={name:'test-line',x:{domain:[0,1]},y:{domain:[0,1]},series:[{name:'A',points:[[-1,0.5],[0.5,0.5],[2,0.5]]}],steps:[{state:{shown:1}},{state:{shown:1,focus:0}}]};
Deck.lineChart(def);
const frame={innerHTML:'',querySelector:()=>({})}; const controller=slides[slides.length-1].def.mount(frame,{esc:String});
await controller.enter(2,false); await controller.enter(1,false);
const lines=latestScene.items.filter((shape)=>shape.opts.color==='a' && shape.opts.start);
assert.equal(lines.length,2);
for(const l of lines) for(const p of [l.opts.start,l.opts.end]) assert.ok(p[0]>=-5.6000001 && p[0]<=4.5000001 && p[1]>=-2.2500001 && p[1]<=2.3500001);
assert.ok(Math.abs(lines[0].opts.start[0]+5.6)<1e-10);
assert.ok(Math.abs(lines[1].opts.end[0]-4.5)<1e-10);
console.log('Plot state checks passed.');
Deck.lineChart({name:'animated-line',x:{domain:[0,3]},y:{domain:[0,3]},series:[
  {name:'A',points:[[0,0],[1,1],[2,2],[3,3]]}, {name:'B',points:[[0,1],[1,2],[2,1],[3,2]]}
],steps:[{state:{shown:1}},{state:{shown:2}}]});
const animated=slides[slides.length-1].def.mount({innerHTML:'',querySelector:()=>({})},{esc:String});
await animated.enter(2,true);
assert.ok(midFrame.some((m)=>m.key==='line:0:1' && m.opacity===1), 'previous curve stays visible during reveal');
const newSegments=midFrame.filter((m)=>m.group===1 && String(m.key).startsWith('line:1:'));
assert.ok(newSegments.some((m)=>m.opacity>0) && newSegments.some((m)=>m.opacity===0), 'new curve reveals progressively');
const animatedFinal=latestScene.items.filter((m)=>m._plotKey).map((m)=>[m._plotKey,m.opacity]);
await animated.enter(2,false);
assert.deepEqual(latestScene.items.filter((m)=>m._plotKey).map((m)=>[m._plotKey,m.opacity]),animatedFinal, 'animated and jumped final states match');
console.log('Plot animation and jump checks passed.');
// Exercise every gallery slide at its last step using the same stage/shape stubs.
sandbox.Deck=Deck;
for(const file of ['line','funnel','scatter','hull','phonon']) runInNewContext(readFileSync(`talks/plot-gallery/slides/${file}.js`,'utf8'),sandbox,{filename:file});
for(const slide of slides.slice(1)) {
  const ctrl=slide.def.mount({innerHTML:'',querySelector:()=>({})},{esc:String});
  await ctrl.enter(slide.def.steps,false);
}
console.log('Gallery mount and final state checks passed.');
const funnel=slides.find((slide)=>slide.name==='funnel').def.mount({innerHTML:'',querySelector:()=>({})},{esc:String});
await funnel.enter(2,true);
assert.ok(midFrame.some((m)=>m.key==='box:0' && m.opacity===1),'previous funnel stage remains visible');
assert.ok(midFrame.some((m)=>m.key==='box:1' && m.opacity>0 && m.opacity<1),'new funnel stage fades in');
assert.ok(midFrame.some((m)=>m.key==='box:1' && m.offsetY<0),'new funnel stage lifts into place');
const funnelFinal=latestScene.items.filter((m)=>m._funnelKey).map((m)=>[m._funnelKey,m.opacity,m.offsetY || 0]);
await funnel.enter(2,false);
assert.deepEqual(latestScene.items.filter((m)=>m._funnelKey).map((m)=>[m._funnelKey,m.opacity,m.offsetY || 0]),funnelFinal,'funnel animated and jumped final states match');
const hullCtrl=slides.find((slide)=>slide.name==='hull').def.mount({innerHTML:'',querySelector:()=>({})},{esc:String});
await hullCtrl.enter(2,true);
assert.ok(midFrame.some((m)=>String(m.key).startsWith('hull:') && m.opacity>0),'hull begins drawing during the step');
console.log('Funnel and hull animation checks passed.');
