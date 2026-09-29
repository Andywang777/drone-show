import {DOT_SIZES} from '../geometry/visual-density.mjs';
import {sourceColors} from '../geometry/strokes.mjs';
import {samplePreview} from '../animation/preview.mjs';
import * as THREE from '../vendor/three.module.min.js';
import {OrbitControls} from '../vendor/examples/jsm/controls/OrbitControls.js';
import {sampleMotion,sampleColors,motionFor} from '../animation/motion.mjs';
import {defaultAudience,depthFactors} from '../geometry/audience.mjs';
import {extent} from '../geometry/spacing.mjs';
export function createViewport(container,onContextLost){
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#030910');container.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#030910',.009);
 const camera=new THREE.PerspectiveCamera(43,1,.1,10000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=2;controls.maxDistance=2000;controls.maxPolarAngle=Math.PI;
 const grid=new THREE.GridHelper(160,80,'#243d55','#193047');grid.material.transparent=true;grid.material.opacity=.65;grid.visible=false;scene.add(grid);
 const material=new THREE.PointsMaterial({size:.45,fog:false,toneMapped:false,color:'#ffffff',vertexColors:true,transparent:true,depthWrite:false,blending:THREE.NormalBlending});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 float radius=length(gl_PointCoord-vec2(0.5));
 if(radius>0.5) discard;
 `).replace('#include <opaque_fragment>',`diffuseColor.a *= 1.0-smoothstep(0.46,0.5,length(gl_PointCoord-vec2(0.5)));
 #include <opaque_fragment>`);};
 let geometry=new THREE.BufferGeometry(),points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
 let sharedFrame=null,frameKey=null,transitionActive=false,originalColors=null,inspection=true,depth=new Float32Array(),currentProgress=0,colors=new Float32Array(),brightness=new Float32Array(),bounds=extent([]),tint=new THREE.Color(),target=new Float32Array(),positions=new Float32Array(),current=null,reference=null,source=null,background=null,backgroundId=null;

 const marker=new THREE.Group();
 const corners=[[-.45,-.3,0],[.45,-.3,0],[.45,.3,0],[-.45,.3,0],[-.45,-.3,.6],[.45,-.3,.6],[.45,.3,.6],[-.45,.3,.6]];
 const edges=[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],vertices=[];
 for(const [a,b] of edges)vertices.push(...corners[a],...corners[b]);
 // Open direction chevron: no filled triangles or camera-facing cone.
 vertices.push(-.22,0,-.12,0,0,-.48,0,0,-.48,.22,0,-.12);
 marker.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(vertices,3)),new THREE.LineBasicMaterial({color:0xffc773,transparent:true,opacity:.65,depthWrite:false})));scene.add(marker);
 const observerBadge=document.createElement('span');observerBadge.className='observer-badge';observerBadge.textContent='▱ 观众视角';observerBadge.hidden=true;container.append(observerBadge);
 function updateMarkerVisibility(){
  const enabled=!!current&&current.spatialMode!=='2D',near=camera.position.distanceTo(marker.position)<Math.max(camera.near*8,marker.scale.x*4);
  marker.visible=enabled&&!near;observerBadge.hidden=!enabled;observerBadge.textContent=near?'▱ 观众视角':'▱ 观众位置已标记';
 }

 function syncAudience(){
  marker.visible=!!current&&current.spatialMode!=='2D';if(!current)return;
  const a=current.audience||defaultAudience(),offset=new THREE.Vector3(...current.transform.position),eye=new THREE.Vector3(...a.position).add(offset),aim=new THREE.Vector3(...a.target).add(offset);
  const size=Math.max(...extent((current.audienceSource||current.points).positions).size),length=Math.max(.12,Math.min(2,size*.055));
  marker.position.copy(eye);marker.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),aim.clone().sub(eye).normalize());marker.scale.setScalar(length);
  depth=depthFactors(current.points.positions,(current.audienceSource||current.points).positions,current.audience);
 }
 function reset(){if(sharedFrame){const {center,radius}=sharedFrame,distance=radius/Math.sin(camera.fov*Math.PI/360)/Math.min(1,camera.aspect)*1.15;camera.position.set(center[0],center[1],center[2]+distance);controls.target.set(...center);camera.far=Math.max(10000,distance*4);camera.updateProjectionMatrix();controls.update();return;}const p=current?.transform.position||[0,15,0];camera.position.set(p[0]+(current?.spatialMode==='2D'?0:28),p[1]+(current?.spatialMode==='2D'?0:5),p[2]+42);controls.target.set(...p);controls.update();}
 function fit(){if(!background)return;const view=renderer.domElement.width/renderer.domElement.height,ratio=background.image.width/background.image.height;background.repeat.set(Math.min(1,view/ratio),Math.min(1,ratio/view));background.offset.set((1-background.repeat.x)/2,(1-background.repeat.y)/2);}
 const observer=new ResizeObserver(()=>{const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();fit();});observer.observe(container);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();onContextLost();});
 reset();
 return {
  renderer,scene,grid,reset,
  setVisual(formations,visual){material.size=DOT_SIZES[visual?.dotSize||'medium'];sharedFrame=null;frameKey=null;},
  captureAudience(){const offset=current.transform.position;return {...(current.audience||defaultAudience()),position:camera.position.toArray().map((v,i)=>v-offset[i]),target:controls.target.toArray().map((v,i)=>v-offset[i])};},
  returnAudience(){if(!current)return;const a=current.audience||defaultAudience(),p=current.transform.position;controls.enableDamping=false;camera.position.set(...a.position.map((v,i)=>v+p[i]));controls.target.set(...a.target.map((v,i)=>v+p[i]));controls.update();controls.enableDamping=true;},
  setFormation(f,asset){
   if(transitionActive){current=null;transitionActive=false;}
   const switched=current?.id!==f?.id;
   if(current?.points===f?.points&&current?.transform===f?.transform&&source===asset){current=f;tint.set(f?.color||'#00ccff');syncAudience();return;}
   current=f;originalColors=f?.points.uv&&asset?.raster?sourceColors(asset.raster,f.points.uv,f.generation):null;
   target=f?new Float32Array(f.points.positions.length):new Float32Array();
   if(f)for(let i=0;i<target.length;i++)target[i]=f.points.positions[i]+f.transform.position[i%3];
   bounds=extent(f?.points.positions||[]);positions=new Float32Array(target.length);colors=new Float32Array(target.length);brightness=new Float32Array(target.length/3);
   geometry.dispose();geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));points.geometry=geometry;
   tint.set(f?.color||'#00ccff');renderer.domElement.setAttribute('aria-label',`${target.length/3} 个空间粒子，可拖动旋转`);
   if(source!==asset){if(reference){scene.remove(reference);reference.geometry.dispose();reference.material.dispose();reference=null;}source=asset;
    if(asset?.type==='mesh'){const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(asset.triangles,3));reference=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:'#4fa8c2',wireframe:true,transparent:true,opacity:.12,depthWrite:false}));reference.visible=false;scene.add(reference);}
   }
   if(reference&&f){
    reference.position.set(...f.transform.position);
    reference.geometry.computeBoundingBox();
    const size=reference.geometry.boundingBox.getSize(new THREE.Vector3());
    reference.scale.setScalar(f.generation.sizeM===undefined?1:f.generation.sizeM/Math.max(size.x,size.y,size.z));
   }
   syncAudience();if(switched)reset();
  },
  transition(p,c){
   if(!transitionActive||positions.length!==p.length){geometry.dispose();positions=new Float32Array(p.length);colors=new Float32Array(c.length);geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3).setUsage(THREE.DynamicDrawUsage));points.geometry=geometry;}
   transitionActive=true;positions.set(p);colors.set(c);geometry.attributes.position.needsUpdate=true;geometry.attributes.color.needsUpdate=true;if(reference)reference.visible=false;
  },
  color(hex){tint.set(hex);},
  reference(show){if(reference)reference.visible=show;},
  background(asset){
   if(backgroundId===asset?.id)return;const next=asset?new THREE.DataTexture(asset.raster.data,asset.raster.width,asset.raster.height,THREE.RGBAFormat):null;
   if(next){if(Math.max(asset.raster.width,asset.raster.height)>renderer.capabilities.maxTextureSize)throw new Error('背景超出本机纹理尺寸限制。');next.flipY=true;next.colorSpace=THREE.SRGBColorSpace;next.needsUpdate=true;next.magFilter=THREE.LinearFilter;}
   background?.dispose();background=next;backgroundId=asset?.id;scene.background=next;grid.visible=false;fit();
  },
  draw(progress,mode='animation'){inspection=mode==='inspect';currentProgress=progress;if(!current)return;samplePreview(current,mode,progress,positions,brightness,bounds,depth);geometry.attributes.position.needsUpdate=true;},
  render(clean=false){if(!transitionActive&&current&&inspection){for(let i=0;i<brightness.length;i++){const rgb=current.colorMode!=='uniform'&&originalColors?originalColors.subarray(i*3,i*3+3):[tint.r,tint.g,tint.b];for(let c=0;c<3;c++)colors[i*3+c]=rgb[c]*brightness[i];}}else if(!transitionActive&&current)sampleColors(current.points.positions,motionFor(current),currentProgress,[tint.r,tint.g,tint.b],brightness,colors,bounds,current.colorMode!=='uniform'?originalColors:null);if(geometry.attributes.color)geometry.attributes.color.needsUpdate=true;controls.update();updateMarkerVisibility();if(transitionActive){marker.visible=false;observerBadge.hidden=true;}const visible=marker.visible,refVisible=reference?.visible;if(clean){marker.visible=false;if(reference)reference.visible=false;}try{renderer.render(scene,camera);}finally{marker.visible=visible;if(reference)reference.visible=refVisible;}}
 };
}
