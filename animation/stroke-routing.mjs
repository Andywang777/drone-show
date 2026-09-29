// Routing follows sampled stroke edges. Gaps carry delay, never visible connector points.
const cache=new WeakMap();
export function strokeRouting(points,start='default'){
 let all=cache.get(points.positions);if(!all){all=new Map();cache.set(points.positions,all);}if(all.has(start))return all.get(start);
 const p=points.positions,ids=points.strokeIds,n=p.length/3,order=Float32Array.from({length:n},(_,i)=>i/Math.max(1,n-1));
 if(!ids||start==='default'){const value={order};all.set(start,value);return value;}
 const distance=(a,b)=>Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2]);
 const adj=Array.from({length:n},()=>[]),ends=[];
 function link(a,b){const d=Math.max(distance(a,b),1e-6);adj[a].push([b,d]);adj[b].push([a,d]);}
 for(let i=0;i<n;i++){if(i&&ids[i]===ids[i-1])link(i-1,i);if(!i||ids[i]!==ids[i-1]||i===n-1||ids[i]!==ids[i+1])ends.push(i);}
 // Connect each stroke endpoint to its nearest different stroke. Shared junctions reconnect here.
 for(const a of ends){let best=-1,d=Infinity;for(const b of ends)if(ids[a]!==ids[b]){const v=distance(a,b);if(v<d){d=v;best=b;}}if(best>=0)link(a,best);}
 let root=0,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<n;i++){minX=Math.min(minX,p[i*3]);maxX=Math.max(maxX,p[i*3]);minY=Math.min(minY,p[i*3+1]);maxY=Math.max(maxY,p[i*3+1]);}
 const cx=(minX+maxX)/2,cy=(minY+maxY)/2;let score=Infinity;
 for(let i=0;i<n;i++){const v=start==='left'?p[i*3]:start==='right'?-p[i*3]:Math.hypot(p[i*3]-cx,p[i*3+1]-cy);if(v<score){score=v;root=i;}}
 const dist=new Float64Array(n).fill(Infinity),done=new Uint8Array(n),heap=[];
 function push(i,d){let k=heap.length;heap.push([i,d]);while(k){const q=(k-1)>>1;if(heap[q][1]<=d)break;heap[k]=heap[q];k=q;}heap[k]=[i,d];}
 function pop(){const top=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let q=k*2+1;if(q+1<heap.length&&heap[q+1][1]<heap[q][1])q++;if(heap[q][1]>=last[1])break;heap[k]=heap[q];k=q;}heap[k]=last;}return top;}
 dist[root]=0;push(root,0);let visited=0;
 while(visited<n){
  if(!heap.length){let a=-1,b=-1,best=Infinity;for(const x of ends)if(done[x])for(const y of ends)if(!done[y]){const d=distance(x,y);if(d<best){best=d;a=x;b=y;}}if(b<0)break;link(a,b);dist[b]=dist[a]+best;push(b,dist[b]);}
  const [i,d]=pop();if(done[i])continue;done[i]=1;visited++;for(const [j,w] of adj[i])if(!done[j]&&d+w<dist[j]){dist[j]=d+w;push(j,dist[j]);}
 }
 let max=0;for(const d of dist)if(Number.isFinite(d))max=Math.max(max,d);for(let i=0;i<n;i++)order[i]=Number.isFinite(dist[i])?dist[i]/(max||1):1;
 const value={order};all.set(start,value);return value;
}
