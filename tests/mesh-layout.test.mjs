import test from 'node:test';
import assert from 'node:assert/strict';
import {structuredMesh} from '../geometry/mesh-layout.mjs';
import {generateConstrained} from '../geometry/generate.mjs';
import {createFormation,createProject} from '../project/model.mjs';
import {serializeProject,parseProject} from '../project/persistence.mjs';
const plane=z=>[-1,-1,z,1,-1,z,1,1,z,-1,-1,z,1,1,z,-1,1,z];
test('contour layout honors exact counts, deterministic rows and surface coordinates',()=>{
 const triangles=new Float64Array(plane(0));
 for(const count of [1,17,300,1000,10000]){
  const p=structuredMesh(triangles,count,2,[0,0,1]);assert.equal(p.length,count*3);assert.ok(p.every(Number.isFinite));assert.deepEqual(p,structuredMesh(triangles,count,2,[0,0,1]));
  const unique=new Set();let boundary=0;for(let i=0;i<count;i++){const [x,y,z]=p.slice(i*3,i*3+3);assert.equal(z,0);assert.ok(Math.abs(x)<=1.000001&&Math.abs(y)<=1.000001);unique.add([x,y,z].join(','));if(Math.max(Math.abs(x),Math.abs(y))>.97)boundary++;}
  assert.equal(unique.size,count);if(count<=1000&&count>=17)assert.ok(boundary>=count*.3);
 }
});
test('nearest observer-facing surface wins over hidden overlapping faces',()=>{
 const triangles=new Float64Array([...plane(-.5),...plane(.5)]);
 for(const [direction,z] of [[[0,0,1],.5],[[0,0,-1],-.5]]){const p=structuredMesh(triangles,100,2,direction);for(let i=2;i<p.length;i+=3)assert.equal(p[i],z);}
 assert.throws(()=>structuredMesh(new Float64Array(plane(0)),100,2,[1,0,0]),/网格点不足/);
});
test('worker generation uses structured layout and recipes survive project round trip',()=>{
 const triangles=new Float64Array(plane(0)),g={kind:'mesh',sizeM:2,minDistance:0,meshLayout:'contour',viewDirection:[0,0,1]};
 const result=generateConstrained({generation:g,count:300,asset:{triangles}});assert.equal(result.status,'success');assert.deepEqual(result.positions,structuredMesh(triangles,300,2,[0,0,1]));
 const p=createProject(),asset={id:'mesh',name:'mesh.glb',type:'mesh',mime:'model/gltf-binary',original:new Uint8Array([1]),triangles},f=createFormation('mesh',result.positions,g,'mesh');p.assets=[asset];p.formations=[f];p.activeId=f.id;assert.deepEqual(parseProject(serializeProject(p)),p);
});
