import * as THREE from '../vendor/three.module.min.js';
import {GLTFLoader} from '../vendor/examples/jsm/loaders/GLTFLoader.js';
import {DRACOLoader} from '../vendor/examples/jsm/loaders/DRACOLoader.js';
import {MeshoptDecoder} from '../vendor/examples/jsm/libs/meshopt_decoder.module.js';
import {readSurface,SPAN} from '../formation.mjs';
import {decodeLineArt} from '../lineart.mjs';
import {id} from '../project/model.mjs';
export function dispose(root){const gs=new Set(),ms=new Set(),ts=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>{t.source?.data?.close?.();t.dispose();});}
export async function importRaster(file,type='raster'){
 const raster=await decodeLineArt(file,type==='background'?8192:1024);
 return {id:id(),type,name:file.name,mime:file.type||'image/png',original:new Uint8Array(await file.arrayBuffer()),raster:{width:raster.width,height:raster.height,data:raster.data}};
}
export function createModelImporter(){
 const manager=new THREE.LoadingManager();
 manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const resolved=new URL(url,location.href),base=new URL('../vendor/examples/jsm/libs/draco/gltf/',import.meta.url);if(resolved.href.startsWith(base.href))return resolved.href;throw new Error('请使用包含全部资源的 GLB。');});
 const draco=new DRACOLoader(manager).setDecoderPath(new URL('../vendor/examples/jsm/libs/draco/gltf/',import.meta.url).href);
 const loader=new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
 return async file=>{
  if(!/\.glb$/i.test(file.name)||file.size>100*1024*1024)throw new Error('请选择 100 MB 以内的 GLB 模型。');
  const buffer=await file.arrayBuffer();if(buffer.byteLength<20||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('文件不是有效的 GLB 模型。');
  let loaded;
  try{
   loaded=await loader.parseAsync(buffer,'');const surface=readSurface(loaded.scene),center=surface.box.getCenter(new THREE.Vector3()),size=surface.box.getSize(new THREE.Vector3()),scale=SPAN/Math.max(size.x,size.y,size.z);
   const triangles=surface.triangles;for(let i=0;i<triangles.length;i++)triangles[i]=(triangles[i]-center.getComponent(i%3))*scale;
   return {id:id(),type:'mesh',name:file.name,mime:'model/gltf-binary',original:new Uint8Array(buffer),triangles};
  }finally{if(loaded)for(const scene of new Set(loaded.scenes||[loaded.scene]))dispose(scene);}
 };
}
