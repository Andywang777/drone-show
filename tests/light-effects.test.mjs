import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMotion,sampleMotion,sampleColors,validateMotion} from '../animation/motion.mjs';
import {extent} from '../geometry/spacing.mjs';
import {createProject,createFormation} from '../project/model.mjs';
import {parseProject,serializeProject} from '../project/persistence.mjs';
const base=new Float32Array([-10,-10,0,0,0,0,10,10,0]),bounds=extent(base);
function frame(effect,t,key='hold',palette='cool'){
 const m=defaultMotion();for(const k of Object.keys(m))m[k].effect=k===key?effect:'skip';m.hold.palette=palette;
 const positions=new Float32Array(9),brightness=new Float32Array(3),colors=new Float32Array(9);
 sampleMotion(base,m,t,positions,brightness,bounds);sampleColors(base,m,t,[.1,.4,.8],brightness,colors,bounds);return {positions,brightness,colors};
}
test('directional fades preserve positions, follow direction and have exact endpoints',()=>{
 for(const [effect,key] of [['fade-in','enter'],['wipe-up','enter'],['wipe-down','enter'],['wipe-out','exit'],['wipe-up-out','exit'],['wipe-down-out','exit']]){
  const start=frame(effect,0,key),end=frame(effect,1,key),middle=frame(effect,.5,key);
  assert.deepEqual(middle.positions,base);assert.ok(start.brightness.every(v=>v===(key==='enter'?0:1)));assert.ok(end.brightness.every(v=>v===(key==='enter'?1:0)));
  if(effect!=='fade-in'){const ascending=effect.includes('down')!==(key==='exit');assert.equal(middle.brightness[0]<middle.brightness[2],ascending);}
 }
});
test('scatter moves radially within six percent and dims continuously',()=>{
 let prior=1;for(const t of [0,.2,.5,.8,1]){const f=frame('scatter',t,'exit');for(let i=0;i<3;i++)assert.ok(Math.hypot(...[0,1,2].map(c=>f.positions[i*3+c]-base[i*3+c]))<=1.200001);assert.ok(f.brightness[0]<=prior);prior=f.brightness[0];assert.ok(f.positions[0]<=base[0]);assert.ok(f.positions[6]>=base[6]);}
 assert.equal(prior,0);
});
test('grouped lights keep a visible floor and deterministic, stationary geometry',()=>{
 for(const effect of ['layers','regions','twinkle']){const f=frame(effect,.5);assert.deepEqual(f.positions,base);assert.ok(f.brightness.every(v=>v>=.039999&&v<=1));assert.ok(new Set(f.brightness).size>1);assert.deepEqual(f,frame(effect,.5));assert.ok(frame(effect,0).brightness.every(v=>v===1));assert.ok(frame(effect,1).brightness.every(v=>v===1));}
});
test('palettes differ, spatial color layers differ, boundaries return to base color',()=>{
 for(const effect of ['color-cycle','color-layers'])for(const palette of ['cool','warm','rainbow']){const f=frame(effect,.5,'hold',palette);assert.ok(f.colors.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.deepEqual(f.positions,base);assert.deepEqual(frame(effect,0,'hold',palette).colors,frame('still',0).colors);assert.deepEqual(frame(effect,1,'hold',palette).colors,frame('still',1).colors);}
 assert.notDeepEqual(frame('color-cycle',.5,'hold','cool').colors,frame('color-cycle',.5,'hold','warm').colors);
 const layered=frame('color-layers',.5).colors;assert.notDeepEqual(layered.slice(0,3),layered.slice(6,9));
});
test('palette persists in project files and invalid palette is rejected',()=>{
 const p=createProject(),f=createFormation('colors',base,{kind:'preset',preset:'sphere'});f.motion.hold={effect:'color-layers',duration:2,palette:'warm'};p.formations=[f];p.activeId=f.id;assert.deepEqual(parseProject(serializeProject(p)),p);
 f.motion.hold.palette='unknown';assert.throws(()=>validateMotion(f.motion),/配色/);
});


test('default two-second flashes visibly alternate more than once and reach rendered colors',()=>{
 for(const effect of ['layers','regions','twinkle']){
  const samples=Array.from({length:81},(_,i)=>frame(effect,i/80));
  const levels=samples.map(f=>f.brightness[0]);
  assert.ok(Math.min(...levels)<.05,effect+' must visibly dim');
  assert.ok(Math.max(...levels)>.95,effect+' must fully light');
  let transitions=0;for(let i=1;i<levels.length;i++)if((levels[i]>.5)!==(levels[i-1]>.5))transitions++;
  assert.ok(transitions>=3,effect+' must alternate during default duration');
  for(const f of samples)assert.ok(Math.abs(f.colors[2]-.8*f.brightness[0])<1e-6,'rendered vertex color must carry brightness');
 }
});
