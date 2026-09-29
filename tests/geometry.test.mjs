import test from 'node:test';
import assert from 'node:assert/strict';
import {generateConstrained} from '../geometry/generate.mjs';
import {analyzeSpacing,extent} from '../geometry/spacing.mjs';
import {rasterCandidates} from '../geometry/raster.mjs';
import {GeometryJobs} from '../jobs/client.mjs';
import {createProject,createFormation,ProjectStore} from '../project/model.mjs';
import {serializeProject,parseProject} from '../project/persistence.mjs';
import {Worker} from 'node:worker_threads';
const generation={kind:'preset',preset:'cube',sizeM:18,minDistance:0,sampling:'ink'};
test('spacing sweep matches brute force, including duplicates and threshold equality',()=>{
 const p=Float32Array.from({length:180},(_,i)=>Math.sin(i*7)*5);p.set(p.subarray(0,3),3);
 for(const threshold of [0,.1,2,20]){
  let best=Infinity,pairs=0;const unsafe=new Set();
  for(let i=0;i<p.length/3;i++)for(let j=i+1;j<p.length/3;j++){
   const distance=Math.hypot(...[0,1,2].map(a=>p[i*3+a]-p[j*3+a]));best=Math.min(best,distance);
   if(distance<threshold){pairs++;unsafe.add(i);unsafe.add(j);}
  }
  const report=analyzeSpacing(p,threshold);assert.equal(report.minimumDistance,best);assert.equal(report.conflictPairs,pairs);assert.deepEqual(report.unsafeIndices,[...unsafe].sort((a,b)=>a-b));
 }
 assert.equal(analyzeSpacing(new Float32Array([0,0,0,1,0,0]),1).conflictPairs,0);
 assert.equal(analyzeSpacing(new Float32Array([0,0,0]),1).minimumDistance,null);
});
test('presets meet count, physical bounds and positive spacing deterministically',()=>{
 for(const preset of ['sphere','cube','helix']){
  const input={generation:{...generation,preset,sizeM:30,minDistance:1},count:80};
  const result=generateConstrained(input);assert.equal(result.status,'success');assert.equal(result.positions.length,240);
  assert.ok(Math.max(...extent(result.positions).size)<=30.00001);assert.ok(result.report.minimumDistance>=1);
  assert.deepEqual(result.positions,generateConstrained(input).positions);
 }
 const result=generateConstrained({generation,count:10000});assert.equal(result.status,'success');assert.equal(result.positions.length,30000);
});
test('mesh candidates honor requested dimensions',()=>{
 const result=generateConstrained({generation:{...generation,kind:'mesh',sizeM:10},count:100,asset:{triangles:new Float64Array([-2,-2,0,2,-2,0,0,2,0])}});
 assert.equal(result.status,'success');assert.ok(result.positions.every(v=>Math.abs(v)<=5));assert.ok(extent(result.positions).size[0]>7);
});
test('locks preserve coordinates and identity, reject incompatible constraints without mutation',()=>{
 const previous={ids:['a','b','c'],positions:new Float32Array([-9,0,0,9,0,0,0,9,0]),lockedIds:['c','a'],generation};
 const before=structuredClone(previous),result=generateConstrained({generation,count:12,previous});
 assert.equal(result.status,'success');assert.deepEqual(result.lockedIds,['c','a']);assert.deepEqual([...result.positions.slice(0,6)],[0,9,0,-9,0,0]);
 for(const input of [{generation,count:1},{generation:{...generation,sizeM:20},count:12},{generation:{...generation,minDistance:20},count:12}])assert.equal(generateConstrained({...input,previous}).status,'infeasible');
 assert.deepEqual(previous,before);
 assert.equal(generateConstrained({generation:{...generation,sizeM:1,minDistance:10},count:10}).status,'infeasible');
});
function closedRaster(){
 const width=9,height=9,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)if(x===2||x===6||y===2||y===6)data.set([0,0,0,255],(y*width+x)*4);
 return {width,height,data};
}
test('2D modes preserve planar coordinates and UV; fill samples closed interior',()=>{
 const raster=closedRaster();
 for(const sampling of ['ink','outline','fill','mixed']){
  const result=rasterCandidates(raster,{kind:'lineart',mode:'dark',threshold:160,sizeM:10,sampling},1000);
  assert.ok(result.positions.every(Number.isFinite));assert.ok(result.uv.every(v=>v>=0&&v<=1));
  let interior=0;
  for(let i=0;i<1000;i++){
   assert.equal(result.positions[i*3+2],0);
   const x=Math.floor(result.uv[i*2]*9),y=Math.floor(result.uv[i*2+1]*9);if(x>2&&x<6&&y>2&&y<6)interior++;
  }
  assert.equal(interior>0,sampling==='fill'||sampling==='mixed');
 }
});
test('extended project buffers and locks survive save, undo and redo',()=>{
 const p=createProject(),f=createFormation('test',new Float32Array([0,0,0,1,0,0]),generation);
 f.points.lockedIds=[f.points.ids[1]];f.points.uv=new Float32Array([0,0,1,1]);f.spacingReport=analyzeSpacing(f.points.positions,1);
 p.formations=[f];p.activeId=f.id;assert.deepEqual(parseProject(serializeProject(p)),p);
 const store=new ProjectStore(p);store.update(f.id,{points:{...f.points,lockedIds:[]}});store.undo();assert.deepEqual(store.state,p);store.redo();assert.deepEqual(store.state.formations[0].points.lockedIds,[]);
});
test('worker cancellation terminates work and ignores late replies; later jobs recover',async()=>{
 const workers=[],jobs=new GeometryJobs(()=>{const worker={postMessage(){},terminate(){this.stopped=true;}};workers.push(worker);return worker;});
 const first=jobs.run({});const rejected=assert.rejects(first,/取消/);jobs.cancel();await rejected;assert.equal(workers[0].stopped,true);
 const progress=[],second=jobs.run({},p=>progress.push(p));workers[0].onmessage({data:{type:'result',result:'stale'}});
 workers[1].onmessage({data:{type:'progress',progress:{fraction:.5}}});workers[1].onmessage({data:{type:'result',result:'fresh'}});
 assert.equal(await second,'fresh');assert.deepEqual(progress,[{fraction:.5}]);assert.equal(jobs.pending,null);
 const failed=jobs.run({});workers[2].onerror();await assert.rejects(failed,/后台计算失败/);assert.equal(jobs.pending,null);
});
test('worker entry executes generation and transfers buffers without detaching input',async()=>{
 const entry=new URL('../jobs/worker.js',import.meta.url).href;
 const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(data,transfer)=>parentPort.postMessage(data,transfer)};import(${JSON.stringify(entry)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`,{eval:true});
 try{
  const positions=new Float32Array([9,0,0]);
  const result=await new Promise((resolve,reject)=>{
   worker.on('error',reject);worker.on('message',data=>{if(data.type==='result')resolve(data.result);if(data.type==='error')reject(new Error(data.message));});
   worker.postMessage({type:'generate',input:{generation,count:20,previous:{positions,ids:['locked'],lockedIds:['locked'],generation}}});
  });
  assert.equal(result.status,'success');assert.ok(result.positions instanceof Float32Array);assert.equal(result.positions.length,60);assert.deepEqual([...result.positions.slice(0,3)],[9,0,0]);assert.equal(positions.byteLength,12);
 }finally{await worker.terminate();}
});
