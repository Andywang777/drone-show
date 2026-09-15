import { readInk, sampleInk, decodeLineArt } from './lineart.mjs';
import { setupMedia } from './media.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { COUNT, SPAN, CENTER_Y, readSurface, sampleTriangles, preset, launchGrid, interpolate } from './formation.mjs';

const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['line-upload','line-file','line-name','line-mode','line-threshold','line-threshold-value','count','drone-total','light-color','red','green','blue','viewport','file','upload','formation','duration','reference','message','filename','play','restart','progress','time','phase','reset-view','fatal'].map(id=>[id,$(id)]));
function message(text,error=false){ui.message.textContent=text;ui.message.classList.toggle('error',error);}
function dispose(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.source?.data?.close?.();t.dispose();});}

try {
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor('#030910');
  ui.viewport.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','1000 架无人机三维光点编队，可拖动旋转');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#030910',.009);
  const camera = new THREE.PerspectiveCamera(43,1,.1,300);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.minDistance=15;controls.maxDistance=110;controls.maxPolarAngle=Math.PI*.49;
  function resetView(){if(ui.formation.value==='lineart')camera.position.set(0,CENTER_Y,42);else camera.position.set(28,20,40);controls.target.set(0,15,0);controls.update();}
  resetView();
  ui['reset-view'].onclick=resetView;
  const grid=new THREE.GridHelper(160,80,'#243d55','#193047');grid.material.transparent=true;grid.material.opacity=.65;scene.add(grid);
  let count=COUNT,positions=new Float32Array(count*3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  const textureCanvas=document.createElement('canvas');textureCanvas.width=64;textureCanvas.height=64;const ctx=textureCanvas.getContext('2d');const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.12,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.55)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(textureCanvas);
  const material=new THREE.PointsMaterial({size:.8,fog:false,toneMapped:false,map:texture,color:ui['light-color'].value,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;scene.add(points);
  let target=preset(),from=launchGrid(),progress=1,playing=false,duration=12,reference=null,modelTarget=null,modelName='',modelSurface=null,lineImage=null,lineInk=null,lineName='',pendingLineName='',busy=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sync(){
    ui.progress.value=Math.round(progress*1000);ui.time.value=`${(progress*duration).toFixed(1)} / ${duration} s`;
    ui.play.querySelector('span').textContent=playing?'暂停':'播放';
    ui.play.querySelector('path').setAttribute('d',playing?'M7 5h3v14H7ZM14 5h3v14h-3Z':'m8 5 11 7-11 7Z');
    ui.phase.textContent=playing?'飞行成形中':progress===1?'编队就绪':progress===0?'等待起飞':'已暂停';
  }
  function drawFormation(){interpolate(from,target,progress,positions);geometry.attributes.position.needsUpdate=true;sync();}
  function setTarget(next,autoplay=true){target=next;from=launchGrid(count);progress=reduced?1:0;playing=autoplay&&!reduced;drawFormation();}
  ui.play.onclick=()=>{if(progress>=1)progress=0;playing=!playing;drawFormation();};
  ui.restart.onclick=()=>{from=launchGrid(count);progress=0;playing=false;drawFormation();};
  ui.progress.oninput=()=>{playing=false;progress=Number(ui.progress.value)/1000;drawFormation();};
  ui.duration.onchange=()=>{duration=Math.min(60,Math.max(3,Math.round(Number(ui.duration.value)||12)));ui.duration.value=duration;sync();};
  ui.reference.onchange=()=>{if(reference)reference.visible=ui.reference.checked&&ui.formation.value==='model';};
  ui.formation.onchange=()=>{
    const isModel=ui.formation.value==='model';
    if(ui.formation.value==='lineart'&&lineInk){setTarget(sampleInk(lineInk,count));ui.reference.disabled=true;if(reference)reference.visible=false;resetView();message(`${lineName} · 已生成 ${count.toLocaleString()} 个线稿光点`);return;}
    // 尚未上传模型时没有可用的点阵目标，回退到球形编队，避免后续绘制拿到空目标而静默失效。
    if(isModel&&!modelTarget){ui.formation.value='sphere';ui.reference.disabled=true;if(reference)reference.visible=false;setTarget(preset('sphere',count));message('请先上传 GLB 模型，再选择模型编队。',true);return;}
    setTarget(isModel?modelTarget:preset(ui.formation.value,count));
    ui.reference.disabled=!isModel;if(reference)reference.visible=isModel&&ui.reference.checked;
    message(isModel?`${modelName} · 已生成 ${count.toLocaleString()} 个表面光点`:'示例编队已载入。可上传 GLB 生成模型点阵。');
  };
  function syncCount(){
    ui['drone-total'].textContent=`${count.toLocaleString()} 架`;
    renderer.domElement.setAttribute('aria-label',`${count} 架无人机三维光点编队，可拖动旋转`);
    document.title=`点阵飞行 · ${count.toLocaleString()} 架无人机`;
  }
  ui.count.onchange=()=>{
    const requested=Number(ui.count.value);
    if(!Number.isInteger(requested)||requested<1||requested>10000){ui.count.value=count;message('请输入 1–10,000 之间的整数架数。',true);return;}
    if(requested===count)return;
    const nextModel=modelSurface?sampleTriangles(modelSurface,requested):null;
    const next=ui.formation.value==='model'?nextModel:ui.formation.value==='lineart'?sampleInk(lineInk,requested):preset(ui.formation.value,requested);
    count=requested;modelTarget=nextModel;
    // Release the old GPU buffers before replacing the position attribute.
    geometry.dispose();positions=new Float32Array(count*3);
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    syncCount();setTarget(next);
    message(`${ui.formation.value==='model'?modelName:ui.formation.value==='lineart'?lineName:'示例编队'} · 已生成 ${count.toLocaleString()} 个光点`);
  };
  const channels=['red','green','blue'];
  ui['light-color'].oninput=()=>{
    const hex=ui['light-color'].value;
    channels.forEach((id,i)=>ui[id].value=parseInt(hex.slice(1+i*2,3+i*2),16));
    material.color.set(hex);
  };
  channels.forEach(id=>ui[id].oninput=()=>{
    if(channels.some(key=>ui[key].value===''||!Number.isInteger(Number(ui[key].value))||Number(ui[key].value)<0||Number(ui[key].value)>255))return;
    const hex='#'+channels.map(key=>Number(ui[key].value).toString(16).padStart(2,'0')).join('');
    ui['light-color'].value=hex;material.color.set(hex);
  });
  channels.forEach((id,i)=>ui[id].onchange=()=>{
    if(ui[id].value===''||!Number.isInteger(Number(ui[id].value))||Number(ui[id].value)<0||Number(ui[id].value)>255){
      ui[id].value=parseInt(ui['light-color'].value.slice(1+i*2,3+i*2),16);message('RGB 分量请输入 0–255 之间的整数。',true);
    }
  });
  syncCount();
  function applyLine(image,name){
    const ink=readInk(image,Number(ui['line-threshold'].value),ui['line-mode'].value);
    const next=sampleInk(ink,count);
    lineImage=image;lineInk=ink;lineName=name;
    ui['line-name'].textContent=name;
    ui.formation.querySelector('[value=lineart]').disabled=false;ui.formation.value='lineart';
    ui.reference.disabled=true;if(reference)reference.visible=false;
    setTarget(next);resetView();message(`${name} · 已生成 ${count.toLocaleString()} 个线稿光点`);
  }
  ui['line-upload'].onclick=()=>ui['line-file'].click();
  ui['line-file'].onchange=async()=>{
    const file=ui['line-file'].files[0];if(!file||busy||media.recording)return;
    busy=true;
    const locked=['line-upload','upload','count','formation','line-mode','line-threshold'];
    locked.forEach(id=>ui[id].disabled=true);message('正在识别二维线稿…');
    try{lineImage=await decodeLineArt(file);pendingLineName=file.name;applyLine(lineImage,pendingLineName); }
    catch(error){message(`${error.message} 当前编队已保留。`,true);}
    finally{busy=false;locked.forEach(id=>ui[id].disabled=false);ui['line-file'].value='';}
  };
  ui['line-threshold'].oninput=()=>{ui['line-threshold-value'].value=ui['line-threshold'].value;};
  function updateLine(){if(!lineImage||busy||media.recording)return;try{applyLine(lineImage,pendingLineName||lineName);}catch(error){message(`${error.message} 当前编队已保留。`,true);}}
  ui['line-threshold'].onchange=updateLine;ui['line-mode'].onchange=updateLine;
  const manager=new THREE.LoadingManager();
  // GLB must be self-contained. Prevent unexpected remote resources from a model.
  manager.setURLModifier(url=>{if(url.startsWith('blob:')||url.startsWith('data:'))return url;const resolved=new URL(url,location.href);const decoderBase=new URL('./vendor/examples/jsm/libs/draco/gltf/',location.href);if(resolved.href.startsWith(decoderBase.href))return resolved.href;throw new Error('请使用包含全部资源的 GLB，当前文件引用了外部资源。');});
  const draco=new DRACOLoader(manager).setDecoderPath(new URL('./vendor/examples/jsm/libs/draco/gltf/',location.href).href);
  const loader=new GLTFLoader(manager).setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  async function importFile(file){
    if(!file||busy||media.recording)return;
    if(!/\.glb$/i.test(file.name)){message('请选择 .glb 格式的三维模型。',true);return;}
    if(file.size>100*1024*1024){message('文件超过 100 MB，请先简化模型。',true);return;}
    busy=true;ui.upload.disabled=true;ui.formation.disabled=true;ui.count.disabled=true;message(`正在解析模型并生成 ${count.toLocaleString()} 个光点…`);
    let loaded=null,newReference=null;
    try {
      const buffer=await file.arrayBuffer();
      if(buffer.byteLength<20||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw new Error('文件不是有效的 GLB 模型。');
      loaded=await loader.parseAsync(buffer,'');
      const surface=readSurface(loaded.scene),next=sampleTriangles(surface,count);
      // Reference uses baked triangles, keeping it aligned even for skins and instances.
      const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(surface.triangles,3));
      const center=surface.box.getCenter(new THREE.Vector3()),size=surface.box.getSize(new THREE.Vector3()),scale=SPAN/Math.max(size.x,size.y,size.z);
      g.translate(-center.x,-center.y,-center.z);g.scale(scale,scale,scale);g.translate(0,CENTER_Y,0);
      newReference=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:'#4fa8c2',wireframe:true,transparent:true,opacity:.12,depthWrite:false}));newReference.visible=ui.reference.checked;
      scene.add(newReference);
      if(reference){scene.remove(reference);dispose(reference);}reference=newReference;modelTarget=next;modelSurface=surface;modelName=file.name;
      ui.filename.hidden=false;ui.filename.textContent=file.name;ui.formation.querySelector('[value=model]').disabled=false;ui.formation.value='model';ui.reference.disabled=false;
      setTarget(next);resetView();message(`${file.name} · 已生成 ${count.toLocaleString()} 个表面光点`);
    }catch(error){
      if(newReference&&newReference!==reference){scene.remove(newReference);dispose(newReference);}
      console.warn('GLB import:',error);
      const detail=/[\u4e00-\u9fff]/.test(error.message)?error.message:'解析失败。请使用资源内嵌的 GLB；支持 Draco / Meshopt，暂不支持 KTX2 纹理。';message(`${detail} 当前编队已保留。`,true);
    }finally{if(loaded)for(const s of new Set(loaded.scenes||[loaded.scene]))dispose(s);busy=false;ui.upload.disabled=false;ui.formation.disabled=false;ui.count.disabled=false;ui.file.value='';}
  }
  ui.upload.onclick=()=>ui.file.click();ui.file.onchange=()=>importFile(ui.file.files[0]);
  ui.viewport.addEventListener('dragover',e=>e.preventDefault());ui.viewport.addEventListener('drop',e=>{e.preventDefault();importFile(e.dataTransfer.files[0]);});
  const media=setupMedia({renderer,scene,grid,message,isBusy:()=>busy,startFlight(){from=launchGrid(count);progress=0;playing=true;drawFormation();}});
  media.setRender(()=>renderer.render(scene,camera));
  new ResizeObserver(()=>{const {width,height}=ui.viewport.getBoundingClientRect();renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();media.resize();}).observe(ui.viewport);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();media.stop('三维渲染连接中断，视频录制已取消。');playing=false;sync();ui.fatal.hidden=false;ui.fatal.textContent='三维渲染连接已中断，请刷新页面重新开启。';});
  drawFormation();let last=performance.now();
  renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&!document.hidden){progress=Math.min(1,progress+dt/duration);if(progress===1)playing=false;drawFormation();}controls.update();renderer.render(scene,camera);media.frame(progress,duration);});
}catch(error){ui.fatal.hidden=false;ui.fatal.textContent='无法启动三维场景，请使用支持 WebGL 2 的浏览器并开启硬件加速。';ui.play.disabled=true;ui.restart.disabled=true;ui.upload.disabled=true;console.error(error);}
