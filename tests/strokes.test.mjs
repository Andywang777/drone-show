import test from 'node:test';import assert from 'node:assert/strict';
import {strokePoints,sourceColors,detectLineSettings} from '../geometry/strokes.mjs';
import {generateConstrained} from '../geometry/generate.mjs';
import {sampleColors,sampleMotion,defaultMotion} from '../animation/motion.mjs';
const raster=()=>{const width=40,height=20,data=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++)data[i*4+3]=255;for(let x=3;x<=36;x++)data.set([255,100,100,255],(10*width+x)*4);return {width,height,data};};
test('stroke layout follows a straight centerline at even intervals and exact count',()=>{const r=raster(),g={kind:'lineart',sampling:'strokes',sizeM:22,minDistance:0,mode:'light',threshold:80};const a=generateConstrained({generation:g,count:12,asset:{raster:r}});assert.equal(a.positions.length,36);const dx=a.positions[3]-a.positions[0];for(let i=1;i<12;i++){assert.ok(Math.abs(a.positions[i*3]-a.positions[(i-1)*3]-dx)<1e-5);assert.ok(Math.abs(a.positions[i*3+1])<1e-6);}assert.deepEqual(a.uv,strokePoints(r,g,12).uv);});
test('source colors stay colored through brightness modulation and auto detection excludes paper',()=>{const r=raster(),g=detectLineSettings(r);assert.equal(g.mode,'light');const p=strokePoints(r,{...g,sizeM:22},12),colors=sourceColors(r,p.uv);assert.equal(colors[0],1);assert.ok(colors[1]>0&&colors[1]<.2);const brightness=new Float32Array(12).fill(.5),out=new Float32Array(36);sampleColors(p.positions,defaultMotion(),0,[0,1,1],brightness,out,{min:[0,0,0],size:[22,0,0]},colors);assert.equal(out[0],.5);assert.ok(out[1]<.1);});
test('single pixel and closed strokes remain finite for small budgets',()=>{const r=raster();r.data.fill(0);r.data.set([255,255,255,255],(5*40+5)*4);for(const count of [1]){const p=strokePoints(r,{mode:'light',threshold:100,sizeM:22},count);assert.equal(p.positions.length,count*3);assert.ok(p.positions.every(Number.isFinite));}});

test('growth lights ordered stroke points monotonically without movement and completes at entry boundary',()=>{
 const base=new Float32Array([0,0,0,1,0,0,2,0,0,3,0,0]),out=new Float32Array(12),light=new Float32Array(4),m=defaultMotion(),bounds={min:[0,0,0],size:[3,0,0]};m.enter.effect='grow';
 sampleMotion(base,m,0,out,light,bounds,true);assert.ok(light.every(v=>v===0));
 sampleMotion(base,m,.15,out,light,bounds,true);assert.equal(light[0],1);assert.equal(light[3],0);assert.deepEqual(out,base);const previous=light.slice();
 sampleMotion(base,m,.29999,out,light,bounds,true);assert.ok(light.every((v,i)=>v>=previous[i]&&v>.999));
 sampleMotion(base,m,.15,out,light,bounds,false);assert.ok(light.every(v=>v===light[0]));
});

test('isolated pixel rejects impossible density rather than duplicating points',()=>{const r=raster();r.data.fill(0);r.data.set([255,255,255,255],(5*40+5)*4);assert.throws(()=>strokePoints(r,{mode:'light',threshold:100,sizeM:22},3),/减少无人机总数/);});
