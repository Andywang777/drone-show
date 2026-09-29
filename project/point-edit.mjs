export function editPoint(f,pointId,operation){
 if(f?.spatialMode!=='2D')throw new Error('点位编辑仅支持二维素材');
 const source=f.points,index=source.ids.indexOf(pointId);if(index<0)throw new Error('请先选择一个光点');
 let points;
 if(operation.type==='move'){
  const {x,y}=operation;if(![x,y].every(v=>Number.isFinite(v)&&Math.abs(v)<=10000))throw new Error('点位坐标超出范围');
  if(source.positions[index*3]===x&&source.positions[index*3+1]===y)return null;
  const positions=new Float32Array(source.positions);positions[index*3]=x;positions[index*3+1]=y;points={...source,positions};
 }else if(operation.type==='delete'){
  if(source.ids.length<=1)throw new Error('至少保留一个光点；删除整个素材请使用素材管理');
  const ids=source.ids.filter((_,i)=>i!==index),take=(a,stride)=>Float32Array.from(Array.from({length:source.ids.length},(_,i)=>i).filter(i=>i!==index).flatMap(i=>Array.from(a.subarray(i*stride,i*stride+stride))));
  points={...source,ids,positions:take(source.positions,3),lockedIds:(source.lockedIds||[]).filter(id=>id!==pointId)};
  if(source.uv)points.uv=take(source.uv,2);
  if(source.strokeIds){const raw=take(source.strokeIds,1),groups=new Map();for(const id of raw)if(!groups.has(id))groups.set(id,groups.size);points.strokeIds=Float32Array.from(raw,id=>groups.get(id));}
 }else throw new Error('不支持的点位操作');
 return {points,audienceSource:points,manualEdited:true,spacingReport:null};
}
