import {extent} from './spacing.mjs';
export const defaultAudience=()=>({range:'full',depth:false,position:[28,5,42],target:[0,0,0]});
export function validateAudience(a){
 if(!a||!['full','two-thirds','half'].includes(a.range)||typeof a.depth!=='boolean'||!['position','target'].every(k=>Array.isArray(a[k])&&a[k].length===3&&a[k].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))||Math.hypot(...a.position.map((v,i)=>v-a.target[i]))<.001)throw new Error('观众视角数据无效');return a;
}
export function projection(positions,a){
 const bounds=extent(positions),center=bounds.min.map((v,i)=>(v+bounds.max[i])/2),delta=a.position.map((v,i)=>v-a.target[i]),length=Math.hypot(...delta),direction=delta.map(v=>v/length);
 const values=new Float64Array(positions.length/3);let min=Infinity,max=-Infinity;
 for(let i=0;i<values.length;i++){const d=direction.reduce((n,v,k)=>n+(positions[i*3+k]-center[k])*v,0);values[i]=d;min=Math.min(min,d);max=Math.max(max,d);}
 return {values,min,max};
}
// Source geometry is an editing recipe. Only returned points are allocated/rendered.
export function audiencePatch(f,source=f.audienceSource||f.points,a=f.audience||defaultAudience()){
 validateAudience(a);const config=f.spatialMode==='2D'?{...a,range:'full'}:a;
 if(config.range==='full')return {audience:config,audienceSource:source,points:source,spacingReport:null};
 const {values,min,max}=projection(source.positions,config),cut=min+(max-min)*(config.range==='half'?.5:1/3),indices=[];
 for(let i=0;i<values.length;i++)if(values[i]>=cut)indices.push(i);
 const ids=indices.map(i=>source.ids[i]),positions=new Float32Array(indices.length*3),uv=source.uv?new Float32Array(indices.length*2):undefined;
 indices.forEach((j,i)=>{positions.set(source.positions.subarray(j*3,j*3+3),i*3);if(uv)uv.set(source.uv.subarray(j*2,j*2+2),i*2);});
 return {audience:config,audienceSource:source,points:{ids,positions,lockedIds:(source.lockedIds||[]).filter(id=>ids.includes(id)),...(uv?{uv}:{})},spacingReport:null};
}
export function depthFactors(points,source,a){
 const factors=new Float32Array(points.length/3).fill(1);if(!a?.depth)return factors;
 const full=projection(source,a);
 // Absolute projections share the source center, not the center of the cropped bounds.
 const direction=a.position.map((v,i)=>v-a.target[i]),length=Math.hypot(...direction),bounds=extent(source),center=bounds.min.map((v,i)=>(v+bounds.max[i])/2);
 for(let i=0;i<factors.length;i++){const d=direction.reduce((n,v,k)=>n+(points[i*3+k]-center[k])*v/length,0),u=(d-full.min)/Math.max(full.max-full.min,1e-6);factors[i]=.4+.6*Math.max(0,Math.min(1,u));}
 return factors;
}
