import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMotion,motionFor,totalDuration,phaseAt,validateMotion,sampleMotion,previewProgress,EFFECTS} from '../animation/motion.mjs';
import {extent} from '../geometry/spacing.mjs';
import {createFormation,createProject,ProjectStore,validateProject} from '../project/model.mjs';
import {serializeProject,parseProject} from '../project/persistence.mjs';
const base=new Float32Array([-2,0,0,0,1,0,2,0,1]),bounds=extent(base);
function frame(m,p){const positions=new Float32Array(base.length),brightness=new Float32Array(base.length/3);sampleMotion(base,m,p,positions,brightness,bounds);return {positions,brightness};}
test('default stages last five seconds, respect boundaries and skip durations',()=>{
 const m=defaultMotion();assert.equal(totalDuration(m),5);assert.equal(phaseAt(m,0).key,'enter');assert.equal(phaseAt(m,.3).key,'hold');assert.equal(phaseAt(m,.7).key,'exit');assert.equal(phaseAt(m,1).t,1);
 assert.equal(phaseAt(m,previewProgress(m)).key,'hold');m.enter.effect='skip';assert.equal(totalDuration(m),3.5);assert.equal(phaseAt(m,0).key,'hold');
 m.hold.effect='skip';m.exit.effect='skip';assert.throws(()=>validateMotion(m),/至少/);
});
test('all presets are finite, deterministic and do not mutate source points',()=>{
 const original=new Float32Array(base);
 for(const [key,effects] of Object.entries(EFFECTS))for(const effect of effects.filter(x=>x!=='skip')){
  const m=defaultMotion();for(const k of Object.keys(m))m[k].effect=k===key?effect:'skip';
  for(const p of [0,.1,.5,.99,1]){const f=frame(m,p);assert.ok(f.positions.every(Number.isFinite));assert.ok(f.brightness.every(v=>v>=0&&v<=1));assert.deepEqual(f,frame(m,p));}
 }
 assert.deepEqual(base,original);
});
test('directional light sweeps left to right and exit ends dark',()=>{
 const m=defaultMotion();m.hold.effect=m.exit.effect='skip';
 assert.deepEqual([...frame(m,0).brightness],[0,0,0]);assert.deepEqual([...frame(m,1).brightness],[1,1,1]);
 const middle=frame(m,.5);assert.ok(middle.brightness[0]>middle.brightness[2]);assert.deepEqual(middle.positions,base);
 for(const effect of ['fade','scatter']){const m=defaultMotion();m.enter.effect=m.hold.effect='skip';m.exit.effect=effect;assert.deepEqual([...frame(m,1).brightness],[0,0,0]);}
});
test('gather and sustained motion meet the original shape at phase boundaries',()=>{
 for(const effect of ['gather','float','wave']){
  const m=defaultMotion();for(const k of Object.keys(m))m[k].effect='skip';m[effect==='gather'?'enter':'hold'].effect=effect;
  const end=frame(m,1);for(let i=0;i<base.length;i++)assert.ok(Math.abs(end.positions[i]-base[i])<1e-6);
  if(effect!=='gather')assert.deepEqual(frame(m,0).positions,base);
 }
});
test('motion saves and restores, supports undo and legacy duration, rejects invalid recipes atomically',()=>{
 const p=createProject(),f=createFormation('design',base,{kind:'preset',preset:'sphere'});p.formations=[f];p.activeId=f.id;
 assert.deepEqual(parseProject(serializeProject(p)),p);
 const store=new ProjectStore(p),motion=defaultMotion();motion.hold.effect='wave';motion.exit.effect='skip';store.update(f.id,{motion,duration:totalDuration(motion)});store.undo();assert.deepEqual(store.state,p);store.redo();assert.equal(store.state.formations[0].motion.hold.effect,'wave');
 const prior=store.state;assert.throws(()=>store.update(f.id,{motion:{...motion,enter:{effect:'bad',duration:1}}}));assert.equal(store.state,prior);
 const legacy=structuredClone(p);delete legacy.formations[0].motion;legacy.formations[0].duration=12;validateProject(legacy);assert.equal(totalDuration(motionFor(legacy.formations[0])),12);
 const bad=structuredClone(p);bad.formations[0].motion.enter.duration=NaN;assert.throws(()=>validateProject(bad));
});


test('retired flip migrates to stationary fade without changing duration or points',()=>{
 const p=createProject(),f=createFormation('legacy flip',base,{kind:'preset',preset:'sphere'});p.formations=[f];p.activeId=f.id;
 const file=JSON.parse(serializeProject(p));file.formations[0].motion.exit.effect='flip';
 const loaded=parseProject(JSON.stringify(file));assert.equal(loaded.formations[0].motion.exit.effect,'fade');assert.equal(loaded.formations[0].duration,5);assert.deepEqual(loaded.formations[0].points,f.points);
 assert.equal(EFFECTS.exit.includes('flip'),false);assert.equal(defaultMotion().exit.effect,'fade');
 const m=defaultMotion();m.enter.effect=m.hold.effect='skip';assert.deepEqual(frame(m,.5).positions,base);
});
