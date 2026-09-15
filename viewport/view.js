import * as THREE from '../vendor/three.module.min.js';
import {OrbitControls} from '../vendor/examples/jsm/controls/OrbitControls.js';
import {launchGrid,interpolate} from '../formation.mjs';
export function createViewport(container,onContextLost){
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#030910');container.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#030910',.009);
 const camera=new THREE.PerspectiveCamera(43,1,.1,10000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=2000;controls.maxPolarAngle=Math.PI*.49;
 const grid=new THREE.GridHelper(160,80,'#243d55','#193047');grid.material.transparent=true;grid.material.opacity=.65;scene.add(grid);
 const sprite=document.createElement('canvas');sprite.width=sprite.height=64;const ctx=sprite.getContext('2d'),g=ctx.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'white');g.addColorStop(.12,'white');g.addColorStop(.3,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
 const texture=new THREE.CanvasTexture(sprite),material=new THREE.PointsMaterial({size:.8,fog:false,toneMapped:false,map:texture,color:'#00ccff',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
 let geometry=new THREE.BufferGeometry(),points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
 let target=new Float32Array(),from=new Float32Array(),positions=new Float32Array(),current=null,reference=null,source=null,background=null,backgroundId=null;
 function reset(){const p=current?.transform.position||[0,15,0];camera.position.set(p[0]+(current?.spatialMode==='2D'?0:28),p[1]+(current?.spatialMode==='2D'?0:5),p[2]+42);controls.target.set(...p);controls.update();}
 function fit(){if(!background)return;const view=renderer.domElement.width/renderer.domElement.height,ratio=background.image.width/background.image.height;background.repeat.set(Math.min(1,view/ratio),Math.min(1,ratio/view));background.offset.set((1-background.repeat.x)/2,(1-background.repeat.y)/2);}
 const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();fit();});observer.observe(container);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onContextLost();});
 reset();
 return {
  renderer,scene,grid,reset,
  setFormation(f,asset){
   const switched=current?.id!==f?.id;
   if(current?.points===f?.points&&current?.transform===f?.transform&&source===asset){current=f;material.color.set(f?.color||'#00ccff');return;}
   current=f;
   target=f?new Float32Array(f.points.positions.length):new Float32Array();
   if(f)for(let i=0;i<target.length;i++)target[i]=f.points.positions[i]+f.transform.position[i%3];
   from=launchGrid(target.length/3);positions=new Float32Array(target.length);
   geometry.dispose();geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));points.geometry=geometry;
   material.color.set(f?.color||'#00ccff');renderer.domElement.setAttribute('aria-label',`${target.length/3} 架无人机三维光点编队，可拖动旋转`);
   if(source!==asset){if(reference){scene.remove(reference);reference.geometry.dispose();reference.material.dispose();reference=null;}source=asset;
    if(asset?.type==='mesh'){const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(asset.triangles,3));reference=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#4fa8c2',wireframe:true,transparent:true,opacity:.12,depthWrite:false}));reference.visible=false;scene.add(reference);}
   }
   if(reference&&f)reference.position.set(...f.transform.position);
   if(switched)reset();
  },
  color(hex){material.color.set(hex);},
  reference(show){if(reference)reference.visible=show;},
  background(asset){
   if(backgroundId===asset?.id)return;const next=asset?new THREE.DataTexture(asset.raster.data,asset.raster.width,asset.raster.height,THREE.RGBAFormat):null;
   if(next){if(Math.max(asset.raster.width,asset.raster.height)>renderer.capabilities.maxTextureSize)throw new Error('背景超出本机纹理尺寸限制。');next.flipY=true;next.colorSpace=THREE.SRGBColorSpace;next.needsUpdate=true;next.magFilter=THREE.LinearFilter;}
   background?.dispose();background=next;backgroundId=asset?.id;scene.background=next;grid.visible=!next;fit();
  },
  draw(progress){interpolate(from,target,progress,positions);geometry.attributes.position.needsUpdate=true;},
  render(){controls.update();renderer.render(scene,camera);}
 };
}
