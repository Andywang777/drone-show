import test from 'node:test';
import assert from 'node:assert/strict';
import {audiencePatch,defaultAudience,depthFactors,validateAudience} from '../geometry/audience.mjs';
import {generate} from '../assets/generate.mjs';
import {createFormation,createProject,ProjectStore} from '../project/model.mjs';
import {serializeProject,parseProject} from '../project/persistence.mjs';
import {defaultMotion,scaleMotion,totalDuration} from '../animation/motion.mjs';
function sphere(){return createFormation('sphere',generate({kind:'preset',preset:'sphere'},3000),{kind:'preset',preset:'sphere'});}
test('sphere crops allocate fewer real points, preserve density and restore exact source',()=>{
 const f=sphere(),before=new Float32Array(f.points.positions),a={...defaultAudience(),position:[0,0,42]};
 for(const [range,ratio] of [['two-thirds',2/3],['half',.5]]){
  const patch=audiencePatch(f,undefined,{...a,range});assert.ok(Math.abs(patch.points.ids.length/3000-ratio)<.015);
  const cut=range==='half'?0:-11/3;for(let i=2;i<patch.points.positions.length;i+=3)assert.ok(patch.points.positions[i]>=cut-.02);
  assert.equal(patch.points.ids.length,patch.points.positions.length/3);
  const restored=audiencePatch({...f,...patch},undefined,{...a,range:'full'});assert.equal(restored.points,f.points);
 }
 assert.deepEqual(f.points.positions,before);
});
test('audience direction changes crop, world translation does not; depth is observer-relative',()=>{
 const f=sphere(),a={...defaultAudience(),position:[0,0,42],range:'half',depth:true};
 const p=audiencePatch(f,undefined,a),back=audiencePatch(f,undefined,{...a,position:[0,0,-42]});assert.notDeepEqual(p.points.ids,back.points.ids);
 assert.deepEqual(audiencePatch({...f,transform:{position:[100,40,-20]}},undefined,a).points,p.points);
 const b=depthFactors(new Float32Array([0,0,-10,0,0,10]),new Float32Array([0,0,-10,0,0,10]),a);assert.ok(b[0]<b[1]);assert.ok(b[0]>=.39);assert.equal(b[1],1);
 assert.deepEqual([...depthFactors(f.points.positions,f.points.positions,{...a,depth:false})],Array(3000).fill(1));
});
test('crop settings and source persist with undo; invalid observer data is rejected',()=>{
 const f=sphere(),p=createProject();p.formations=[f];p.activeId=f.id;const store=new ProjectStore(p);
 store.update(f.id,audiencePatch(f,undefined,{...defaultAudience(),range:'half'}));assert.deepEqual(parseProject(serializeProject(store.state)),store.state);store.undo();assert.equal(store.state,p);store.redo();assert.ok(store.state.formations[0].points.ids.length<3000);
 assert.throws(()=>validateAudience({...defaultAudience(),position:[0,0,0]}));assert.throws(()=>validateAudience({...defaultAudience(),range:'bad'}));
});
test('total duration scales active phases only and preserves effect/palette',()=>{
 const m=defaultMotion();m.hold.palette='warm';const scaled=scaleMotion(m,10);assert.deepEqual([scaled.enter.duration,scaled.hold.duration,scaled.exit.duration],[3,4,3]);assert.equal(scaled.hold.palette,'warm');assert.equal(totalDuration(m),5);
 m.exit.effect='skip';const skipped=scaleMotion(m,7);assert.equal(skipped.exit.duration,1.5);assert.equal(totalDuration(skipped),7);assert.equal(skipped.enter.duration,3);assert.equal(skipped.hold.duration,4);
 assert.throws(()=>scaleMotion(m,.1));assert.throws(()=>scaleMotion(m,61));
});
