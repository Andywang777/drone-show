import {strokeRouting} from './stroke-routing.mjs';
import {sampleMotion,motionFor} from './motion.mjs';
export function advancePlayback(progress,dt,duration,{loop=false,recording=false}={}){
 const next=progress+Math.max(0,dt)/duration;
 if(next<1)return {progress:next,playing:true};
 if(loop&&!recording)return {progress:next%1,playing:true};
 return {progress:1,playing:false};
}
export function samplePreview(f,mode,progress,out,brightness,bounds,depth){
 if(mode==='inspect'){out.set(f.points.positions);brightness.fill(1);}
 else sampleMotion(f.points.positions,motionFor(f),progress,out,brightness,bounds,f.generation?.kind==='lineart'&&f.generation?.sampling==='strokes',f.points.strokeIds?{...strokeRouting(f.points,motionFor(f).enter.origin||'default'),ids:f.points.strokeIds}:null);
 for(let i=0;i<out.length;i++)out[i]+=f.transform.position[i%3];
 for(let i=0;i<brightness.length;i++)brightness[i]*=depth[i]??1;
}
export function contextualPanels(kind,pending=false){return {line:kind==='lineart'||pending,sampling:kind==='lineart',mesh:kind==='mesh',audience:!!kind&&kind!=='lineart'};}
