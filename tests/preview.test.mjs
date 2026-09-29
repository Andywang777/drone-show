import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePlayback,samplePreview,contextualPanels} from '../animation/preview.mjs';
import {defaultMotion} from '../animation/motion.mjs';
import {extent} from '../geometry/spacing.mjs';
test('inspection shows original shape and light at every animation time',()=>{
 const base=new Float32Array([-2,0,0,2,1,0]),f={points:{positions:base},transform:{position:[1,2,3]},motion:defaultMotion()},out=new Float32Array(6),light=new Float32Array(2),bounds=extent(base),depth=new Float32Array([.5,1]);
 for(const effect of ['scatter','fade']){f.motion.exit.effect=effect;for(const p of [0,.5,1]){samplePreview(f,'inspect',p,out,light,bounds,depth);assert.deepEqual([...out],[-1,2,3,3,3,3]);assert.deepEqual([...light],[.5,1]);}}
 samplePreview(f,'animation',1,out,light,bounds,depth);assert.deepEqual([...light],[0,0]);
 samplePreview(f,'inspect',1,out,light,bounds,depth);assert.deepEqual([...light],[.5,1]);assert.deepEqual([...base],[-2,0,0,2,1,0]);
});
test('loop wraps preview, but recording finishes once even with looping enabled',()=>{
 const loop=advancePlayback(.99,.1,5,{loop:true});assert.equal(loop.playing,true);assert.ok(Math.abs(loop.progress-.01)<1e-9);
 assert.deepEqual(advancePlayback(.99,.1,5,{loop:true,recording:true}),{progress:1,playing:false});
 assert.deepEqual(advancePlayback(.99,.1,5,{loop:false}),{progress:1,playing:false});
 assert.deepEqual(advancePlayback(.5,0,5,{loop:true}),{progress:.5,playing:true});
});
test('context panels follow asset type and failed image drafts remain editable',()=>{
 assert.deepEqual(contextualPanels('preset'),{line:false,sampling:false,mesh:false,audience:true});
 assert.deepEqual(contextualPanels('mesh'),{line:false,sampling:false,mesh:true,audience:true});
 assert.deepEqual(contextualPanels('lineart'),{line:true,sampling:true,mesh:false,audience:false});
 assert.equal(contextualPanels('mesh',true).line,true);assert.equal(contextualPanels(undefined).audience,false);
});
