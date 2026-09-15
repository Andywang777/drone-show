import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject,createFormation,ProjectStore,id,validateProject} from '../project/model.mjs';
import {parseProject,serializeProject} from '../project/persistence.mjs';
import {generate} from '../assets/generate.mjs';
function fixture(){
 const raster={width:3,height:3,data:new Uint8ClampedArray([255,255,255,255,0,0,0,255,255,255,255,255,255,255,255,255,0,0,0,255,255,255,255,255,255,255,255,255,0,0,0,255,255,255,255,255])};
 const a={id:id(),name:'line.png',type:'raster',mime:'image/png',original:new Uint8Array([1,2,3]),raster};
 const b={id:id(),name:'mesh.glb',type:'mesh',mime:'model/gltf-binary',original:new Uint8Array([4,5]),triangles:new Float64Array([-2,-2,0,2,-2,0,0,2,0])};
 const p=createProject(),g1={kind:'lineart',mode:'dark',threshold:160},g2={kind:'mesh'};
 p.assets=[a,b];p.formations=[createFormation('线稿',generate(g1,37,a),g1,a.id),createFormation('模型',generate(g2,100,b),g2,b.id)];p.activeId=p.formations[0].id;return p;
}
test('two asset types share local points and edits do not alter another formation',()=>{
 const p=fixture(),store=new ProjectStore(p),[a,b]=p.formations;
 store.update(a.id,{color:'#ff0000',duration:7},'编辑');assert.equal(store.state.formations[1],b);assert.equal(a.color,'#00ccff');assert.equal(store.state.formations[0].points,a.points);
 store.select(b.id);assert.equal(store.state.activeId,b.id);assert.equal(store.state.formations[0].color,'#ff0000');
 store.undo();assert.equal(store.state.formations[0].color,'#00ccff');store.redo();assert.equal(store.state.formations[0].color,'#ff0000');
});
test('project round trip preserves exact point buffers, IDs, recipes, assets and background',()=>{
 const p=fixture();const bg={...p.assets[0],id:id(),type:'background'};p.assets.push(bg);p.backgroundAssetId=bg.id;
 const loaded=parseProject(serializeProject(p));assert.deepEqual(loaded,p);
 for(const f of loaded.formations){const asset=loaded.assets.find(a=>a.id===f.sourceAssetId);assert.deepEqual(generate(f.generation,f.points.ids.length,asset),f.points.positions);}
});
test('invalid commands and invalid loads are atomic and leave history untouched',()=>{
 const store=new ProjectStore(fixture()),before=store.state;
 assert.throws(()=>store.update(before.activeId,{color:'broken'}));assert.equal(store.state,before);assert.equal(store.undoStack.length,0);
 for(const patch of [{schemaVersion:9},{activeId:'missing'},{assets:[]},{units:{length:'ft',time:'s'}}])assert.throws(()=>store.replace({...before,...patch}));
 assert.equal(store.state,before);assert.equal(store.version,0);
});
test('validation rejects duplicate IDs, NaN, missing assets and inconsistent point counts',()=>{
 for(const mutate of [p=>p.formations.push(p.formations[0]),p=>p.formations[0].points.positions[0]=NaN,p=>p.formations[0].points.ids.pop(),p=>p.formations[0].points.ids[1]=p.formations[0].points.ids[0],p=>p.assets[0].raster.data=new Uint8ClampedArray(1),p=>p.backgroundAssetId=p.assets[1].id]){const p=fixture();mutate(p);assert.throws(()=>validateProject(p));}
 assert.throws(()=>parseProject('{"$buffer":"constructor","data":"AA=="}'));
});
test('resampling creates independent point identity; color/position preserve identity',()=>{
 const store=new ProjectStore(fixture()),f=store.state.formations[0],asset=store.state.assets[0];
 const positions=generate(f.generation,500,asset),ids=Array.from({length:500},id);
 store.update(f.id,{points:{positions,ids}});assert.equal(store.state.formations[0].points.ids.length,500);assert.ok(ids.every(x=>!f.points.ids.includes(x)));
 assert.equal(store.state.formations[1].points.ids.length,100);store.undo();assert.deepEqual(store.state.formations[0].points,f.points);
});
test('new edit after undo discards redo and replacement can be undone',()=>{
 const store=new ProjectStore(fixture()),original=store.state;store.replace(createProject());assert.equal(store.state.formations.length,0);store.undo();assert.equal(store.state,original);
 store.update(original.activeId,{name:'new'});assert.equal(store.redoStack.length,0);
});
test('local generation is detached from world placement for all sources',()=>{
 for(const f of fixture().formations)assert.ok(f.points.positions.every((n,i)=>i%3!==1||Math.abs(n)<=11));
 const g={kind:'preset',preset:'sphere'},p=generate(g,500);assert.ok(p.every((n,i)=>i%3!==1||Math.abs(n)<=11));
});
