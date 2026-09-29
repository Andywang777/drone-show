import {extent} from './spacing.mjs';
export function viewBasis(direction=[28,5,42]){
 const length=Math.hypot(...direction);if(!Number.isFinite(length)||length<1e-8)throw new Error('观众方向无效');
 const forward=direction.map(v=>v/length),seed=Math.abs(forward[1])>.98?[0,0,1]:[0,1,0];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],right=cross(seed,forward),r=Math.hypot(...right);for(let i=0;i<3;i++)right[i]/=r;
 return {right,up:cross(forward,right),forward};
}
// Orthographic observer-plane grid. Each sample resolves to the nearest visible mesh surface.
export function structuredMesh(triangles,count,sizeM,direction,progress=()=>{}){
 const basis=viewBasis(direction),axes=[basis.right,basis.up,basis.forward],projected=new Float64Array(triangles.length);
 for(let i=0;i<triangles.length;i+=3)for(let a=0;a<3;a++)projected[i+a]=axes[a].reduce((sum,v,k)=>sum+triangles[i+k]*v,0);
 const bounds=extent(projected),span=Math.max(bounds.size[0],bounds.size[1]);if(span<1e-9)throw new Error('此方向没有可识别的模型轮廓，请换一个观众方向。');
 const resolution=Math.min(768,Math.max(128,Math.ceil(Math.sqrt(count)*5))),step=span/(resolution-3),width=Math.max(3,Math.ceil(bounds.size[0]/step)+3),height=Math.max(3,Math.ceil(bounds.size[1]/step)+3),ox=bounds.min[0]-step,oy=bounds.min[1]-step;
 const depths=new Float64Array(width*height).fill(-Infinity);let work=0;
 for(let i=0;i<projected.length;i+=9){
  const ax=(projected[i]-ox)/step,ay=(projected[i+1]-oy)/step,bx=(projected[i+3]-ox)/step,by=(projected[i+4]-oy)/step,cx=(projected[i+6]-ox)/step,cy=(projected[i+7]-oy)/step;
  const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(det)<1e-12)continue;
  const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx))),x1=Math.min(width-1,Math.floor(Math.max(ax,bx,cx))),y0=Math.max(0,Math.ceil(Math.min(ay,by,cy))),y1=Math.min(height-1,Math.floor(Math.max(ay,by,cy)));
  work+=(x1-x0+1)*(y1-y0+1);if(work>100000000)throw new Error('模型投影过于复杂，请简化模型或使用表面均匀模式。');
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const u=((by-cy)*(x-cx)+(cx-bx)*(y-cy))/det,v=((cy-ay)*(x-cx)+(ax-cx)*(y-cy))/det,w=1-u-v;
   if(u>=-1e-10&&v>=-1e-10&&w>=-1e-10){const z=u*projected[i+2]+v*projected[i+5]+w*projected[i+8],index=y*width+x;if(z>depths[index])depths[index]=z;}
  }
  if(i%9000===0)progress({fraction:.05+.6*i/projected.length,text:'识别观众方向轮廓与规则网格'});
 }
 const valid=[],edge=[];
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=y*width+x;if(!Number.isFinite(depths[i]))continue;valid.push(i);if(!Number.isFinite(depths[i-1])||!Number.isFinite(depths[i+1])||!Number.isFinite(depths[i-width])||!Number.isFinite(depths[i+width]))edge.push(i);}
 if(valid.length<count)throw new Error('当前方向可用网格点不足，请减少总数或调整观众方向。');
 const chosen=[],used=new Set();
 const take=(pool,n)=>{if(n<=0)return;for(let j=0;j<n;j++){const i=pool[Math.floor((j+.5)*pool.length/n)];if(!used.has(i)){used.add(i);chosen.push(i);}}};
 take(edge,Math.min(edge.length,Math.ceil(count*.35)));
 const remaining=count-chosen.length;let stride=Math.max(1,Math.floor(Math.sqrt(valid.length/Math.max(1,remaining)))),grid=[];
 for(;stride>=1;stride--){grid=valid.filter(i=>i%width%stride===0&&Math.floor(i/width)%stride===0&&!used.has(i));if(grid.length>=remaining)break;}
 take(grid,remaining);
 const positions=new Float32Array(count*3),scale=sizeM/Math.max(...extent(triangles).size);
 chosen.forEach((index,i)=>{const coords=[ox+(index%width)*step,oy+Math.floor(index/width)*step,depths[index]];for(let k=0;k<3;k++)positions[i*3+k]=axes.reduce((sum,axis,a)=>sum+axis[k]*coords[a],0)*scale;});
 progress({fraction:1,text:'轮廓与横竖网格布点完成'});return positions;
}
