import {strokePoints} from './strokes.mjs';
import {audiencePatch} from './audience.mjs';
export const DOT_SIZES={small:.35,medium:.58,large:.75};
const cache=new WeakMap();
export function densityStats(p){if(cache.has(p))return cache.get(p);const n=p.length/3;
 function build(ids,depth=0){if(!ids.length)return null;const axis=depth%3;ids.sort((a,b)=>p[a*3+axis]-p[b*3+axis]);const mid=ids.length>>1;return {i:ids[mid],axis,left:build(ids.slice(0,mid),depth+1),right:build(ids.slice(mid+1),depth+1)};}
 const tree=build(Array.from({length:n},(_,i)=>i)),distances=[];
 for(let i=0;i<n;i++){let best=Infinity;function visit(node){if(!node)return;const j=node.i;if(i!==j){let d=0;for(let k=0;k<3;k++)d+=(p[i*3+k]-p[j*3+k])**2;best=Math.min(best,d);}const delta=p[i*3+node.axis]-p[j*3+node.axis];visit(delta<0?node.left:node.right);if(delta*delta<best)visit(delta<0?node.right:node.left);}visit(tree);if(Number.isFinite(best))distances.push(Math.sqrt(best));}
 distances.sort((a,b)=>a-b);const result={median:distances[Math.floor(distances.length*.5)]||0,p10:distances[Math.floor(distances.length*.1)]||0,min:distances[0]||0};cache.set(p,result);return result;}
const normalized=new WeakMap();
export function normalizeVisualDensity(p){if(!p.visual?.autoDensity)return p;let changed=false;
 const formations=p.formations.map(f=>{if(f.manualEdited)return f;const budget=f.generation.pointBudget||f.points.ids.length,spacing=.85,key=JSON.stringify([f.generation,spacing,budget,f.audience]);if(normalized.get(f.points.positions)===key)return f;
 const source=f.audienceSource||f.points;let full;
 if(f.generation.kind==='lineart'&&f.generation.sampling==='strokes'){
  const asset=p.assets.find(a=>a.id===f.sourceAssetId);if(!asset?.raster)return f;
  const result=strokePoints(asset.raster,{...f.generation,targetSpacing:spacing},budget);full={...result,ids:Array.from({length:result.positions.length/3},()=>crypto.randomUUID()),lockedIds:[]};
 }else{
  // Other shapes retain ordered geometric samples with a deterministic spatial spacing filter.
  const indices=[],grid=new Map(),gap=spacing*.7,p=source.positions;
  for(let i=0;i<p.length/3&&indices.length<budget;i++){const cell=[0,1,2].map(k=>Math.floor(p[i*3+k]/gap));let close=false;for(let x=-1;x<=1&&!close;x++)for(let y=-1;y<=1&&!close;y++)for(let z=-1;z<=1&&!close;z++)for(const j of grid.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))||[])if(Math.hypot(...[0,1,2].map(k=>p[i*3+k]-p[j*3+k]))<gap){close=true;break;}if(close)continue;indices.push(i);const key=cell.join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);}
  full={ids:indices.map(i=>source.ids[i]),positions:Float32Array.from(indices.flatMap(i=>Array.from(p.subarray(i*3,i*3+3)))),lockedIds:[],...(source.uv?{uv:Float32Array.from(indices.flatMap(i=>Array.from(source.uv.subarray(i*2,i*2+2))))}:{}),...(source.strokeIds?{strokeIds:Float32Array.from(indices,i=>source.strokeIds[i])}:{})};
 }
 const generation={...f.generation,pointBudget:budget},patch=audiencePatch(f,full);const next={...f,...patch,generation,revision:f.revision+1};
 // Keep the complete source for reversible 3D filtering; 2D can regenerate from its image.
 if(f.generation.kind!=='lineart')next.audienceSource=source;
 normalized.set(next.points.positions,JSON.stringify([generation,spacing,budget,next.audience]));changed=true;return next;
 });return changed?{...p,formations}:p;}
