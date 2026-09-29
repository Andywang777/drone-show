/** Exact minimum and threshold conflicts; sweep prunes pairs by X.
 * Worst case O(n²), executed off the UI thread. Indices refer to the supplied array.
 */
export function analyzeSpacing(positions,minimum=0){
 const n=positions.length/3,order=Array.from({length:n},(_,i)=>i).sort((a,b)=>positions[a*3]-positions[b*3]);
 let best=Infinity,conflicts=0;const unsafe=new Set(),limit2=minimum*minimum;
 for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){
  const i=order[a]*3,j=order[b]*3,dx=positions[j]-positions[i];
  if(dx*dx>=Math.max(best,limit2))break;
  const dy=positions[j+1]-positions[i+1],dz=positions[j+2]-positions[i+2],d2=dx*dx+dy*dy+dz*dz;
  if(d2<best)best=d2;
  if(d2<limit2){conflicts++;unsafe.add(order[a]);unsafe.add(order[b]);}
 }
 return {minimumDistance:Number.isFinite(best)?Math.sqrt(best):null,conflictPairs:conflicts,unsafeIndices:[...unsafe].sort((a,b)=>a-b),threshold:minimum,scope:'formation-only'};
}
export class SeparationGrid {
 constructor(distance){this.distance=distance;this.cells=new Map();}
 cell(p){return p.map(v=>Math.floor(v/this.distance));}
 accepts(p){const c=this.cell(p),d2=this.distance*this.distance;
  for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
   const bucket=this.cells.get(`${c[0]+x},${c[1]+y},${c[2]+z}`);
   if(bucket)for(const q of bucket)if((p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2<d2)return false;
  }return true;
 }
 add(p){const key=this.cell(p).join(','),bucket=this.cells.get(key);if(bucket)bucket.push(p);else this.cells.set(key,[p]);}
}
export function extent(positions){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(let i=0;i<positions.length;i++) {const a=i%3;min[a]=Math.min(min[a],positions[i]);max[a]=Math.max(max[a],positions[i]);}return positions.length?{min,max,size:max.map((n,i)=>n-min[i])}:{min:[0,0,0],max:[0,0,0],size:[0,0,0]};}
