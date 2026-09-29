import * as THREE from '../vendor/three.module.min.js';
export function attachPointEditor({canvas,container,camera,controls,getFormation,getPositions,refresh,onMove,onSelect}){
 let enabled=false,selected=null,drag=null;
 const badge=document.createElement('span');badge.className='point-selection';badge.hidden=true;badge.setAttribute('aria-hidden','true');container.append(badge);
 const ray=new THREE.Raycaster(),vector=new THREE.Vector3();canvas.tabIndex=0;
 function locate(e,z){const r=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),-z),new THREE.Vector3());}
 function cancel(){if(!drag)return;const positions=getPositions();positions.set(drag.original,drag.index*3);refresh();drag=null;}
 canvas.addEventListener('pointerdown',e=>{if(!enabled||e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();canvas.focus();const f=getFormation(),r=canvas.getBoundingClientRect(),p=getPositions();let index=-1,best=12;
  for(let i=0;i<f.points.ids.length;i++){vector.fromArray(p,i*3).project(camera);if(vector.z< -1||vector.z>1)continue;const d=Math.hypot((vector.x+1)*r.width/2+r.left-e.clientX,(1-vector.y)*r.height/2+r.top-e.clientY);if(d<best){best=d;index=i;}}
  selected=index<0?null:f.points.ids[index];onSelect(selected);if(index<0)return;
  const original=Array.from(p.subarray(index*3,index*3+3)),hit=locate(e,original[2]);if(!hit)return;drag={index,id:selected,pointer:e.pointerId,original,start:hit,x:e.clientX,y:e.clientY,moved:false,formation:f.id};canvas.setPointerCapture(e.pointerId);
 },true);
 canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointer)return;e.preventDefault();e.stopImmediatePropagation();if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3)drag.moved=true;if(!drag.moved)return;const hit=locate(e,drag.original[2]);if(!hit)return;const p=getPositions();p[drag.index*3]=drag.original[0]+hit.x-drag.start.x;p[drag.index*3+1]=drag.original[1]+hit.y-drag.start.y;refresh();},true);
 canvas.addEventListener('pointerup',e=>{if(!drag)return;e.preventDefault();e.stopImmediatePropagation();const d=drag,p=getPositions(),f=getFormation(),x=p[d.index*3]-f.transform.position[0],y=p[d.index*3+1]-f.transform.position[1];drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(d.moved&&d.formation===f.id)onMove(d.id,x,y);},true);
 canvas.addEventListener('pointercancel',cancel,true);canvas.addEventListener('lostpointercapture',cancel);
 canvas.addEventListener('keydown',e=>{if(e.key==='Escape'){cancel();selected=null;onSelect(null);}},true);
 return {set(active,id){if(!active)cancel();enabled=active;selected=id;controls.enableRotate=!active;controls.enablePan=!active;canvas.style.cursor=active?'crosshair':'';if(!active)badge.hidden=true;},cancel,
 render(clean=false){const f=getFormation(),index=f?.points.ids.indexOf(selected)??-1;if(clean||!enabled||index<0){badge.hidden=true;return;}const r=canvas.getBoundingClientRect();vector.fromArray(getPositions(),index*3).project(camera);badge.hidden=vector.z< -1||vector.z>1;badge.style.left=((vector.x+1)*r.width/2)+'px';badge.style.top=((1-vector.y)*r.height/2)+'px';}
 };
}
