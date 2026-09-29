import {strokePoints} from './strokes.mjs';
import {structuredMesh} from './mesh-layout.mjs';
import {generate} from '../assets/generate.mjs';
import {seededRandom} from '../formation.mjs';
import {rasterCandidates} from './raster.mjs';
import {analyzeSpacing,SeparationGrid,extent} from './spacing.mjs';
export function validateSettings(g,count){
 if(!Number.isInteger(count)||count<1||count>10000)throw new Error('点数必须为 1–10,000 的整数。');
 if(!Number.isFinite(g.sizeM)||g.sizeM<.1||g.sizeM>1000)throw new Error('最长边尺寸应在 0.1–1,000 米之间。');
 if(!Number.isFinite(g.minDistance)||g.minDistance<0||g.minDistance>1000)throw new Error('最小间距应在 0–1,000 米之间。');
 if(g.meshLayout!==undefined&&!['contour','surface'].includes(g.meshLayout))throw new Error('三维布点模式无效');
 if(g.viewDirection!==undefined&&(!Array.isArray(g.viewDirection)||g.viewDirection.length!==3||!g.viewDirection.every(Number.isFinite)||Math.hypot(...g.viewDirection)<1e-8))throw new Error('观众方向无效');
 if(g.sampling&&!['strokes','ink','outline','fill','mixed'].includes(g.sampling))throw new Error('不支持的二维采样模式。');
}
function candidates(g,count,asset){
 if(g.kind==='lineart')return rasterCandidates(asset.raster,g,count);
 const positions=generate(g,count,asset,{maxCount:240000});
 const span=g.kind==='mesh'?Math.max(...extent(asset.triangles).size):g.preset==='cube'?18:22;
 for(let i=0;i<positions.length;i++)positions[i]*=g.sizeM/span;
 return {positions};
}
/** Returns a draft. Only status=success may replace the committed point set. */
export function generateConstrained({generation:g,count,asset,previous},progress=()=>{}){
 validateSettings(g,count);progress({fraction:.02,text:'准备候选点'});
 const locks=previous?.lockedIds||[],lockedIndices=locks.map(id=>previous.ids.indexOf(id));
 if(lockedIndices.some(i=>i<0))throw new Error('锁点引用已失效。');
 if(locks.length>count)return {status:'infeasible',reason:`已锁定 ${locks.length} 点，目标数量不能少于锁点数量。`};
 const lockedPositions=new Float32Array(locks.length*3);lockedIndices.forEach((j,i)=>lockedPositions.set(previous.positions.subarray(j*3,j*3+3),i*3));
 const lockedReport=analyzeSpacing(lockedPositions,g.minDistance);
 if(lockedReport.conflictPairs)return {status:'infeasible',reason:'锁定点之间已经违反最小间距；请解锁相关点或降低间距。'};
 // Size changes and semantic mode changes require explicit unlocking; never move locked points silently.
 if(locks.length&&previous.generation&&['sizeM','sampling','mode','threshold'].some(k=>g[k]!==previous.generation[k]))return {status:'infeasible',reason:'修改尺寸或采样区域前请先解锁点；锁点不会被自动缩放或移到新区域。'};
 if(g.kind==='lineart'&&g.sampling==='strokes'){
  if(locks.length||g.minDistance>0)throw new Error('沿线布点不支持旧版锁点或间距约束');
  const result=strokePoints(asset.raster,g,count);return {status:'success',...result,lockedIds:[],report:analyzeSpacing(result.positions,0),bounds:extent(result.positions)};
 }
 if(g.kind==='mesh'&&g.meshLayout==='contour'){
  if(locks.length||g.minDistance>0)throw new Error('轮廓优先模式不支持旧版锁点或间距约束');
  const positions=structuredMesh(asset.triangles,count,g.sizeM,g.viewDirection,progress);
  return {status:'success',positions,lockedIds:[],report:analyzeSpacing(positions,0),bounds:extent(positions)};
 }
 if(g.kind==='preset'&&g.preset==='sphere'&&g.minDistance===0&&!locks.length){
  const {positions}=candidates(g,count,asset);progress({fraction:1,text:'经纬点阵完成'});
  return {status:'success',positions,lockedIds:[],report:analyzeSpacing(positions,0),bounds:extent(positions)};
 }
 const budget=g.minDistance>0?Math.min(240000,Math.max(8000,count*32)):Math.min(240000,Math.max(count*2,1000));
 const pool=candidates(g,budget,asset);
 if(g.minDistance>0){
  // Proven conservative upper bound: every cell has diagonal < minimum distance, at most one point per cell.
  const side=g.minDistance/(Math.sqrt(3)*1.001),domainSize=[g.sizeM,g.sizeM,g.kind==='lineart'?0:g.sizeM],upper=domainSize.reduce((n,s)=>n*(Math.floor(s/side)+1),1);
  if(count>upper)return {status:'infeasible',reason:`当前尺寸与间距下，包围盒最多容纳 ${upper} 点（保守上界），少于目标 ${count} 点。`};
 }
 let best=locks.length,bestResult;
 for(let attempt=0;attempt<(g.minDistance>0?3:1);attempt++){
  const chosen=new Float32Array(count*3),uv=pool.uv?new Float32Array(count*2):undefined;
  chosen.set(lockedPositions);if(uv&&previous?.uv)lockedIndices.forEach((j,i)=>uv.set(previous.uv.subarray(j*2,j*2+2),i*2));
  const grid=new SeparationGrid(Math.max(1e-7,g.minDistance*(1+1e-6)+1e-7));let found=locks.length;
  for(let i=0;i<locks.length;i++)grid.add(Array.from(lockedPositions.subarray(i*3,i*3+3)));
  const order=Uint32Array.from({length:budget},(_,i)=>i),random=seededRandom(8317+attempt*997);
  for(let i=budget-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  for(let i=0;i<budget&&found<count;i++){
   const j=order[i],p=Array.from(pool.positions.subarray(j*3,j*3+3));
   if(grid.accepts(p)){grid.add(p);chosen.set(p,found*3);if(uv)uv.set(pool.uv.subarray(j*2,j*2+2),found*2);found++;}
   if(i%4096===0)progress({fraction:.1+.8*(attempt+i/budget)/(g.minDistance>0?3:1),text:`间距重分布：${found} / ${count} 点（第 ${attempt+1} 次）`});
  }
  best=Math.max(best,found);
  if(found===count){progress({fraction:.94,text:'精确检查最终间距'});const report=analyzeSpacing(chosen,g.minDistance);
   if(report.conflictPairs===0){bestResult={status:'success',positions:chosen,uv,lockedIds:locks,report:{...report,status:g.minDistance>0?'pass':'unchecked',algorithm:'candidate-grid-v1',candidateBudget:budget,attempts:attempt+1},bounds:extent(chosen)};break;}
  }
 }
 progress({fraction:1,text:'计算完成'});
 return bestResult||{status:'unresolved',reason:`在本次候选点预算内找到 ${best} / ${count} 个满足间距的点，未能完成；这不证明无解。可增大尺寸、减小间距或减少数量。`,found:best};
}
