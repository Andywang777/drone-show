import test from 'node:test';
import assert from 'node:assert/strict';
import {readInk,sampleInk} from '../lineart.mjs';
function drawing(light=false){
 const width=20,height=10,data=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<width*height;i++){data.fill(light?0:255,i*4,i*4+3);data[i*4+3]=255;}
 for(let x=2;x<18;x++){const i=(3*width+x)*4;data.fill(light?255:0,i,i+3);}
 return {width,height,data};
}
test('dark and light ink produce the same flat, finite formation at any count',()=>{
 const dark=readInk(drawing()),light=readInk(drawing(true),160,'light');
 assert.deepEqual(dark,light);
 for(const count of [1,37,1000,10000]){
  const p=sampleInk(dark,count);assert.equal(p.length,count*3);assert.ok(p.every(Number.isFinite));
  for(let i=0;i<p.length;i+=3){assert.equal(p[i+2],0);assert.ok(Math.abs(p[i])<=11);assert.ok(p[i+1]>0);}
  assert.deepEqual(sampleInk(dark,count),p);
 }
});
test('transparent pixels never become ink and empty or fully filled images fail',()=>{
 const img=drawing();for(let i=3;i<img.data.length;i+=4)img.data[i]=0;
 assert.throws(()=>readInk(img),/没有识别/);
 img.data.fill(255);assert.throws(()=>readInk(img),/没有识别/);
 for(let i=0;i<img.data.length;i+=4)img.data.fill(0,i,i+3);
 assert.throws(()=>readInk(img),/几乎覆盖/);
});
test('threshold changes include faint strokes and y axis preserves image orientation',()=>{
 const img=drawing();const i=(1*img.width+2)*4;img.data.fill(180,i,i+3);
 assert.equal(readInk(img,160).pixels.length,32);
 const ink=readInk(img,200);assert.equal(ink.pixels.length,34);
 const points=sampleInk(ink,1000);assert.ok(points[1]>points[points.length-2]);
});
