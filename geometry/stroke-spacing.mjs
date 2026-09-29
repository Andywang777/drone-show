// Merge nearby samples globally, then refill the longest usable arc gaps.
// All replacements stay on their original stroke and retain ordered metadata.
export function spaceStrokeSamples(curves,alloc,width,count,targetSpacing=0){
 const total=curves.reduce((n,c)=>n+c.length,0),gap=Math.max(1e-4,targetSpacing?targetSpacing*.7:total/Math.max(1,count)*.28),grid=new Map(),byCurve=curves.map(()=>[]);let size=0;
 function point(k,d){const c=curves[k];let lo=0,hi=c.lengths.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(c.lengths[mid]<d)lo=mid+1;else hi=mid;}const j=Math.max(1,lo),a=c.path[j-1]??c.path[0],b=c.path[j]??a,t=c.length?(d-(c.lengths[j-1]||0))/((c.lengths[j]||0)-(c.lengths[j-1]||0)||1):0;return {k,d,x:a%width+(b%width-a%width)*t,y:Math.floor(a/width)+(Math.floor(b/width)-Math.floor(a/width))*t};}
 function add(p){const gx=Math.floor(p.x/gap),gy=Math.floor(p.y/gap);for(let y=gy-1;y<=gy+1;y++)for(let x=gx-1;x<=gx+1;x++)for(const q of grid.get(x+','+y)||[])if(Math.hypot(p.x-q.x,p.y-q.y)<gap)return false;const key=gx+','+gy;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);byCurve[p.k].push(p);size++;return true;}
 // Keep isolated short strokes before processing intersections on long strokes.
 const order=curves.map((_,i)=>i).sort((a,b)=>curves[a].length-curves[b].length);
 for(const k of order)for(let j=0;j<alloc[k];j++)add(point(k,alloc[k]===1?curves[k].length/2:curves[k].length*j/(alloc[k]-1)));
 const rejected=new Set();
 while(!targetSpacing&&size<count){let best=null;
  for(let k=0;k<curves.length;k++){const c=curves[k],list=byCurve[k].sort((a,b)=>a.d-b.d),arcs=[];
   if(!list.length)arcs.push([0,c.length]);else{if(list[0].d>0)arcs.push([0,list[0].d]);for(let j=1;j<list.length;j++)arcs.push([list[j-1].d,list[j].d]);if(list.at(-1).d<c.length)arcs.push([list.at(-1).d,c.length]);}
   for(const [a,b] of arcs){const key=k+':'+a+':'+b;if(b-a<gap*2||rejected.has(key))continue;if(!best||b-a>best.span)best={k,d:(a+b)/2,span:b-a,key};}
  }
  if(!best)throw new Error('可用线条不足以在避免局部扎堆的同时容纳当前点数，请减少无人机总数或调整线条识别阈值。原点阵未替换。');
  if(!add(point(best.k,best.d)))rejected.add(best.key);
 }
 return byCurve.flatMap(list=>list.sort((a,b)=>a.d-b.d));
}
