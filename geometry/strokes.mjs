import {spaceStrokeSamples} from './stroke-spacing.mjs';
import {readInk} from '../lineart.mjs';
// Topology-preserving Zhang-Suen thinning, followed by ordered graph paths.
export function strokePoints(raster,g,count){
 const {width:w,height:h}=raster,ink=readInk(raster,g.threshold,g.mode),m=new Uint8Array(w*h);
 for(let i=0;i<ink.pixels.length;i+=2)m[ink.pixels[i+1]*w+ink.pixels[i]]=1;
 // Distance to paper estimates local stroke half-width before thinning.
 const widthMap=new Float32Array(w*h);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;widthMap[i]=m[i]?Math.min(x+1,y+1,w-x,h-y):0;if(m[i])widthMap[i]=Math.min(widthMap[i],x?widthMap[i-1]+1:1,y?widthMap[i-w]+1:1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(m[i])widthMap[i]=Math.min(widthMap[i],x+1<w?widthMap[i+1]+1:1,y+1<h?widthMap[i+w]+1:1);}
 const at=(x,y)=>x>=0&&y>=0&&x<w&&y<h?m[y*w+x]:0;
 let changed=true;
 while(changed){changed=false;for(let step=0;step<2;step++){
  const remove=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(at(x,y)){
   const p=[at(x,y-1),at(x+1,y-1),at(x+1,y),at(x+1,y+1),at(x,y+1),at(x-1,y+1),at(x-1,y),at(x-1,y-1)];
   const n=p.reduce((a,b)=>a+b,0),trans=p.reduce((s,v,i)=>s+(!v&&p[(i+1)%8]?1:0),0);
   if(n>=2&&n<=6&&trans===1&&(step? ! (p[0]*p[2]*p[6])&&! (p[0]*p[4]*p[6]):! (p[0]*p[2]*p[4])&&! (p[2]*p[4]*p[6])))remove.push(y*w+x);
  }
  for(const i of remove)m[i]=0;if(remove.length)changed=true;
 }}
 const nodes=[];for(let i=0;i<m.length;i++)if(m[i])nodes.push(i);
 const neighbors=i=>{const x=i%w,y=Math.floor(i/w),out=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&at(x+dx,y+dy)&&(!(dx&&dy)||(!at(x+dx,y)&&!at(x,y+dy))))out.push((y+dy)*w+x+dx);return out;};
 const graph=new Map(nodes.map(i=>[i,neighbors(i)])),seen=new Set(),paths=[];
 const edge=(a,b)=>a<b?a+':'+b:b+':'+a;
 function walk(start,next){const path=[start];let prev=start,cur=next;seen.add(edge(prev,cur));
  while(true){path.push(cur);const adj=graph.get(cur);if(adj.length!==2)break;const n=adj.find(v=>v!==prev);if(seen.has(edge(cur,n)))break;seen.add(edge(cur,n));prev=cur;cur=n;}
  paths.push(path);
 }
 for(const i of nodes)if(graph.get(i).length!==2){if(!graph.get(i).length)paths.push([i]);for(const j of graph.get(i))if(!seen.has(edge(i,j)))walk(i,j);}
 for(const i of nodes)for(const j of graph.get(i))if(!seen.has(edge(i,j)))walk(i,j);
 const curves=paths.map(path=>{const lengths=[0];for(let j=1;j<path.length;j++)lengths.push(lengths[j-1]+Math.hypot(path[j]%w-path[j-1]%w,Math.floor(path[j]/w)-Math.floor(path[j-1]/w)));return {path,lengths,length:lengths.at(-1)};}).filter(c=>{const a=c.path[0],b=c.path.at(-1),junction=graph.get(a).length>=3&&graph.get(b).length===1?a:graph.get(b).length>=3&&graph.get(a).length===1?b:null;return junction===null||widthMap[junction]<2||c.length>widthMap[junction]*.8;}).sort((a,b)=>b.length-a.length);
 if(!curves.length)throw new Error('没有可用的笔画中心线。');
 if(g.targetSpacing){const scale=g.sizeM/Math.max(ink.maxX-ink.minX+1,ink.maxY-ink.minY+1);count=Math.min(count,curves.reduce((n,c)=>n+Math.max(1,Math.ceil(c.length*scale/g.targetSpacing)+1),0));}
 // Prefer long strokes when the point budget cannot retain every tiny component.
 const selected=curves.slice(0,count),alloc=selected.map(()=>1);let remaining=count-selected.length;
 const total=selected.reduce((s,c)=>s+Math.max(c.length,1),0),raw=selected.map(c=>remaining*Math.max(c.length,1)/total);
 raw.forEach((v,i)=>alloc[i]+=Math.floor(v));let extra=count-alloc.reduce((a,b)=>a+b,0);
 const order=raw.map((v,i)=>({i,f:v%1})).sort((a,b)=>b.f-a.f);for(let i=0;i<extra;i++)alloc[order[i].i]++;
 const samples=spaceStrokeSamples(selected,alloc,w,count,g.targetSpacing?g.targetSpacing*Math.max(ink.maxX-ink.minX+1,ink.maxY-ink.minY+1)/g.sizeM:0);
 count=samples.length;
 const strokeIds=new Float32Array(count),positions=new Float32Array(count*3),uv=new Float32Array(count*2),scale=g.sizeM/Math.max(ink.maxX-ink.minX+1,ink.maxY-ink.minY+1);
 samples.forEach(({x,y,k},index)=>{positions[index*3]=(x-(ink.minX+ink.maxX)/2)*scale;positions[index*3+1]=-(y-(ink.minY+ink.maxY)/2)*scale;uv[index*2]=(x+.5)/w;uv[index*2+1]=(y+.5)/h;strokeIds[index]=k;});
 return {positions,uv,strokeIds};
}
export function sourceColors(raster,uv,g={}){
 const {width:w,height:h,data}=raster,out=new Float32Array(uv.length/2*3),linear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
 const mode=g.mode||'light',threshold=g.threshold??0;
 function pixel(x,y,d){const p=(y*w+x)*4,r=data[p]/255,green=data[p+1]/255,b=data[p+2]/255,lo=Math.min(r,green,b),hi=Math.max(r,green,b),chroma=[r-lo,green-lo,b-lo],length=Math.hypot(...chroma),luma=(.2126*r+.7152*green+.0722*b)*255;return {p,d,luma,alpha:data[p+3]/255,sat:hi?(hi-lo)/hi:0,hue:chroma.map(v=>v/(length||1))};}
 for(let i=0;i<uv.length/2;i++){
  const x=Math.max(0,Math.min(w-1,Math.floor(uv[i*2]*w))),y=Math.max(0,Math.min(h-1,Math.floor(uv[i*2+1]*h))),center=pixel(x,y,0),candidates=[];
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){if(x+dx<0||x+dx>=w||y+dy<0||y+dy>=h)continue;const q=pixel(x+dx,y+dy,Math.hypot(dx,dy));if(q.alpha>=.5&&(mode==='dark'?q.luma<threshold:q.luma>threshold))candidates.push(q);}
  candidates.sort((a,b)=>a.d-b.d);const ref=candidates[0]||center;let best=ref,score=-Infinity;
  for(const q of candidates){const similar=ref.sat<.2?q.sat<.2:q.sat>=.2&&q.hue.reduce((n,v,k)=>n+v*ref.hue[k],0)>.94;if(!similar)continue;const contrast=(mode==='dark'?255-q.luma:q.luma)*q.alpha-q.d*.5;if(contrast>score){score=contrast;best=q;}}
  for(let c=0;c<3;c++)out[i*3+c]=linear(data[best.p+c]/255);
 }
 return out;
}

// Otsu threshold plus border polarity keeps colored strokes on dark paper.
export function detectLineSettings({width:w,height:h,data}){
 const hist=new Float64Array(256);let n=0,sum=0,border=0,bn=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;if(data[p+3]<128)continue;const v=Math.round(.2126*data[p]+.7152*data[p+1]+.0722*data[p+2]);hist[v]++;n++;sum+=v;if(!x||!y||x===w-1||y===h-1){border+=v;bn++;}}
 let weight=0,part=0,best=-1,threshold=128;
 for(let t=0;t<255;t++){weight+=hist[t];part+=hist[t]*t;if(!weight||weight===n)continue;const score=weight*(n-weight)*(part/weight-(sum-part)/(n-weight))**2;if(score>best){best=score;threshold=t;}}
 return {mode:bn&&border/bn>threshold?'dark':'light',threshold:Math.max(1,Math.min(254,threshold+1))};
}
