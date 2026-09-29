import test from 'node:test';
import assert from 'node:assert/strict';
import {preset,CENTER_Y} from '../formation.mjs';
import {generateConstrained} from '../geometry/generate.mjs';
test('latitude spheres have exact counts, unique poles and shared longitude columns',()=>{
 for(const count of [1,2,3,17,300,1000,10000]){
  const p=preset('sphere',count);assert.equal(p.length,count*3);assert.ok(p.every(Number.isFinite));
  const unique=new Set();const rows=new Map();
  for(let i=0;i<count;i++){const [x,y,z]=p.slice(i*3,i*3+3);assert.ok(Math.abs(Math.hypot(x,y-CENTER_Y,z)-11)<.00001);unique.add([x,y,z].join(','));if(Math.abs(y-CENTER_Y)<10.999){const row=rows.get(y)||[];row.push([x,z]);rows.set(y,row);}}
  assert.equal(unique.size,count);
  if(count>=17){const columns=Math.max(...[...rows.values()].map(r=>r.length));for(const row of rows.values())for(const [x,z] of row){const slot=((Math.atan2(z,x)+Math.PI*2)%(Math.PI*2))/(Math.PI*2)*columns;assert.ok(Math.abs(slot-Math.round(slot))<.0001);}assert.ok(rows.size<count/2);}
 }
});
test('normal sphere generation preserves complete rows instead of random subsampling',()=>{
 const g={kind:'preset',preset:'sphere',sizeM:22,minDistance:0};const result=generateConstrained({generation:g,count:300}),expected=preset('sphere',300);
 for(let i=1;i<expected.length;i+=3)expected[i]-=CENTER_Y;
 assert.equal(result.status,'success');assert.deepEqual(result.positions,expected);
});
