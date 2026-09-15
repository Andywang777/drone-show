import * as THREE from '../vendor/three.module.min.js';
import {preset,sampleTriangles,CENTER_Y} from '../formation.mjs';
import {readInk,sampleInk} from '../lineart.mjs';
/** All adapters return local XYZ; placement belongs to Formation.transform. */
export function generate(generation,count,asset){
 if(!Number.isInteger(count)||count<1||count>10000)throw new Error('请输入 1–10,000 之间的整数架数。');
 let positions;
 if(generation.kind==='preset')positions=preset(generation.preset,count);
 else if(generation.kind==='lineart')positions=sampleInk(readInk(asset.raster,generation.threshold,generation.mode),count);
 else if(generation.kind==='mesh'){
  const t=asset.triangles,cumulative=new Float64Array(t.length/9),box=new THREE.Box3();let total=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
  for(let i=0;i<t.length;i+=9){a.fromArray(t,i);b.fromArray(t,i+3);c.fromArray(t,i+6);total+=ab.subVectors(b,a).cross(ac.subVectors(c,a)).length()*.5;cumulative[i/9]=total;box.expandByPoint(a).expandByPoint(b).expandByPoint(c);}
  if(!total)throw new Error('模型没有有效表面。');
  return sampleTriangles({triangles:t,cumulative,total,box},count,{normalize:false});
 }else throw new Error('不支持的生成方式');
 for(let i=1;i<positions.length;i+=3)positions[i]-=CENTER_Y;return positions;
}
