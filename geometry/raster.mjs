import {readInk} from '../lineart.mjs';
import {seededRandom} from '../formation.mjs';
/** Modes: legacy ink; boundary of foreground; even-odd closed-stroke fill; 50/50 mix.
 * Fill assumes closed linework. Open strokes are retained, not guessed semantically.
 */
export function rasterCandidates(raster,generation,count){
 const {width,height}=raster,ink=readInk(raster,generation.threshold,generation.mode),mask=new Uint8Array(width*height);
 for(let i=0;i<ink.pixels.length;i+=2)mask[ink.pixels[i+1]*width+ink.pixels[i]]=1;
 const sampling=generation.sampling||'ink',filled=new Uint8Array(mask);
 if(sampling==='fill'||sampling==='mixed'){
  // Each run through a stroke crosses a boundary. Nested closed strokes use even-odd parity.
  for(let y=0;y<height;y++){
   const runs=[];for(let x=0;x<width;x++)if(mask[y*width+x]){const start=x;while(x+1<width&&mask[y*width+x+1])x++;runs.push([start,x]);}
   for(let r=0;r+1<runs.length;r+=2)for(let x=runs[r][1]+1;x<runs[r+1][0];x++)filled[y*width+x]=1;
  }
 }
 const outline=[],fill=[],all=[];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x;
  if(mask[i]){all.push(i);if(!x||!y||x===width-1||y===height-1||!mask[i-1]||!mask[i+1]||!mask[i-width]||!mask[i+width])outline.push(i);}
  if(filled[i])fill.push(i);
 }
 const random=seededRandom(generation.seed??8317),positions=new Float32Array(count*3),uv=new Float32Array(count*2);
 const scale=(generation.sizeM??22)/Math.max(ink.maxX-ink.minX+1,ink.maxY-ink.minY+1);
 for(let i=0;i<count;i++){
  const pool=sampling==='outline'?outline:sampling==='fill'?fill:sampling==='mixed'?(i%2?fill:outline):all;
  const index=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))],x=index%width,y=Math.floor(index/width),jx=random()-.5,jy=random()-.5;
  positions[i*3]=(x-(ink.minX+ink.maxX)/2+jx)*scale;positions[i*3+1]=-(y-(ink.minY+ink.maxY)/2+jy)*scale;
  uv[i*2]=(x+.5+jx)/width;uv[i*2+1]=(y+.5+jy)/height;
 }
 return {positions,uv};
}
