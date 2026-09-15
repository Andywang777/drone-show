import {COUNT} from './formation.mjs';
import {id,createProject,createFormation,ProjectStore} from './project/model.mjs';
import {serializeProject,parseProject,autosave,readAutosave,downloadFile} from './project/persistence.mjs';
import {generate} from './assets/generate.mjs';
import {importRaster,createModelImporter} from './assets/import.mjs';
import {createViewport} from './viewport/view.js';
import {setupMedia} from './media.js';
const $=id=>document.getElementById(id);
const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
const names={sphere:'球形编队',helix:'螺旋编队',cube:'立方体编队'};
function initial(){const p=createProject(),f=createFormation('球形编队',generate({kind:'preset',preset:'sphere'},COUNT),{kind:'preset',preset:'sphere'});p.formations.push(f);p.activeId=f.id;return p;}
try{
 const store=new ProjectStore(initial());let busy=false,recording=false,progress=1,playing=false,last=performance.now(),saveTimer,savedState=null,autosaveReady=false,hasAutosave=false,lastFormation=null,pendingRaster=null,view,media;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const active=()=>store.state.formations.find(f=>f.id===store.state.activeId);
 const source=f=>store.state.assets.find(a=>a.id===f?.sourceAssetId);
 function syncPlayback(){const duration=active()?.duration||12;$('progress').value=Math.round(progress*1000);$('time').value=`${(duration*progress).toFixed(1)} / ${duration} s`;$('play').querySelector('span').textContent=playing?'暂停':'播放';$('play').querySelector('path').setAttribute('d',playing?'M7 5h3v14H7ZM14 5h3v14h-3Z':'m8 5 11 7-11 7Z');$('phase').textContent=playing?'飞行成形中':progress===1?'编队就绪':progress===0?'等待起飞':'已暂停';}
 function lock(){
  for(const element of document.querySelectorAll('[data-edit]'))element.disabled=busy||recording;
  const f=active();for(const key of ['count','formation-name','duration','light-color','red','green','blue','position-x','position-y','position-z','duplicate-formation','delete-formation','play','restart','progress'])$(key).disabled=busy||recording||!f;
  $('undo').disabled=busy||recording||!store.undoStack.length;$('redo').disabled=busy||recording||!store.redoStack.length;
  $('reference').disabled=busy||recording||source(f)?.type!=='mesh';
  $('line-mode').disabled=$('line-threshold').disabled=busy||recording;
  $('background-remove').disabled=busy||recording||!store.state.backgroundAssetId;
  $('retry-line').disabled=$('discard-line').disabled=busy||recording||!pendingRaster;
  $('record-video').disabled=busy||(!recording&&!f)||!videoSupported();
  $('restore-project').disabled=busy||recording||!hasAutosave;
 }
 const videoSupported=()=>typeof MediaRecorder!=='undefined'&&typeof view?.renderer.domElement.captureStream==='function'&&['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].some(t=>MediaRecorder.isTypeSupported(t));
 view=createViewport($('viewport'),()=>{playing=false;media?.stop('三维渲染中断，录制已取消。');syncPlayback();$('fatal').hidden=false;$('fatal').textContent='三维渲染连接中断，请刷新恢复工程。';});
 const modelImporter=createModelImporter();
 function checkRuntime(project){const bg=project.assets.find(a=>a.id===project.backgroundAssetId);if(bg&&Math.max(bg.raster.width,bg.raster.height)>view.renderer.capabilities.maxTextureSize)throw new Error('工程背景尺寸超过本机支持上限。');return project;}
 function sync(project,label){
  const f=active();$('project-name').value=project.name;$('save-state').textContent=project===savedState?'工程已保存':'有未保存更改';
  const list=$('formation-list');list.replaceChildren();for(const item of project.formations){const option=document.createElement('option');option.value=item.id;option.textContent=`${item.name} · ${item.points.ids.length} 点`;list.append(option);}list.value=project.activeId||'';
  $('formation-name').value=f?.name||'';$('count').value=f?.points.ids.length||COUNT;$('duration').value=f?.duration||12;
  $('drone-total').textContent=`${f?.points.ids.length||0} 架 · ${project.formations.length} 个编队`;
  document.title=`${project.name} · 点阵飞行`;
  $('filename').hidden=!f?.sourceAssetId;$('filename').textContent=source(f)?.name||'';
  $('line-name').textContent=source(f)?.type==='raster'?source(f).name:'导入线稿将新建独立编队';
  if(f?.generation.kind==='lineart'){$('line-mode').value=f.generation.mode;$('line-threshold').value=f.generation.threshold;}
  $('line-threshold-value').value=$('line-threshold').value;
  ['x','y','z'].forEach((key,i)=>$('position-'+key).value=f?.transform.position[i]??0);
  setColorFields(f?.color||'#00ccff');
  view.setFormation(f,source(f));view.reference($('reference').checked&&source(f)?.type==='mesh');
  const background=project.assets.find(a=>a.id===project.backgroundAssetId);view.background(background);$('background-name').textContent=background?.name||'未设置背景';
  if(lastFormation?.points!==f?.points||lastFormation?.transform!==f?.transform||lastFormation?.id!==f?.id){playing=false;progress=1;}
  lastFormation=f;
  if(label==='添加编队'&&!reduced){playing=true;progress=0;}
  view.draw(progress);syncPlayback();lock();
  if(label?.startsWith('撤销')||label?.startsWith('重做'))message(`${label}；当前编队 ${f?.points.ids.length||0} 点。`);
  if(autosaveReady){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const snapshot=store.state;autosave(snapshot).then(()=>{hasAutosave=true;$('autosave-status').textContent='本机自动保存已更新';$('restore-project').disabled=busy||recording;},()=>{$('autosave-status').textContent='自动保存失败，请手动保存工程';});},600);}
 }
 function setColorFields(hex){$('light-color').value=hex;['red','green','blue'].forEach((key,i)=>$(key).value=parseInt(hex.slice(1+i*2,3+i*2),16));}
 store.subscribe(sync);
 media=setupMedia({renderer:view.renderer,message,isBusy:()=>busy,startFlight(){progress=0;playing=true;view.draw(0);syncPlayback();},onRecordingChange(value){recording=value;lock();}});
 media.setRender(()=>view.render());
 sync(store.state);
 readAutosave().then(p=>{autosaveReady=true;hasAutosave=!!p;$('restore-project').disabled=!p;$('autosave-status').textContent=p?'发现本机自动保存，可点击恢复':'编辑后自动保存到本机';},()=>{autosaveReady=true;$('autosave-status').textContent='自动保存读取失败，请手动打开工程；后续编辑会重建自动保存';});
 async function task(action){if(busy||recording)return;busy=true;lock();const version=store.version;try{const commit=await action();if(version!==store.version)throw new Error('项目已改变，本次结果未应用。');commit?.();}catch(e){message(`${e.message} 当前工程已保留。`,true);}finally{busy=false;lock();}}
 function update(patch,label){if(!active()||busy||recording)return;try{store.update(active().id,patch,label);}catch(e){message(e.message,true);sync(store.state);}}
 function regenerate(generation,count=active().points.ids.length){const f=active(),positions=generate(generation,count,source(f));update({generation,points:{positions,ids:Array.from({length:count},id)}},'重新生成点阵');message(`已重新生成 ${count.toLocaleString()} 个光点；其他编队保持不变。`);}
 $('formation-list').onchange=()=>store.select($('formation-list').value);
 $('formation-name').onchange=()=>update({name:$('formation-name').value.trim()||'未命名编队'},'重命名编队');
 $('project-name').onchange=()=>store.commit('重命名项目',p=>({...p,name:$('project-name').value.trim()||'未命名项目'}));
 $('add-preset').onclick=()=>{const kind=$('formation').value,generation={kind:'preset',preset:kind};store.add(createFormation(names[kind],generate(generation,active()?.points.ids.length||COUNT),generation));};
 $('count').onchange=()=>{try{regenerate(active().generation,Number($('count').value));}catch(e){message(e.message,true);$('count').value=active().points.ids.length;}};
 $('duplicate-formation').onclick=()=>{const f=active();store.add({...f,id:id(),revision:0,name:f.name+' 副本',points:{positions:new Float32Array(f.points.positions),ids:Array.from({length:f.points.ids.length},id)}});};
 $('delete-formation').onclick=()=>store.commit('删除编队',p=>{const formations=p.formations.filter(f=>f.id!==p.activeId);const used=new Set(formations.map(f=>f.sourceAssetId));used.add(p.backgroundAssetId);return {...p,formations,activeId:formations[0]?.id||null,assets:p.assets.filter(a=>used.has(a.id))};});
 $('undo').onclick=()=>store.undo();$('redo').onclick=()=>store.redo();
 document.addEventListener('keydown',e=>{if(busy||recording||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?store.redo():store.undo();}});
 $('duration').onchange=()=>update({duration:Math.min(60,Math.max(3,Math.round(Number($('duration').value)||12)))},'修改时长');
 for(const key of ['x','y','z'])$('position-'+key).onchange=()=>{const values=['x','y','z'].map(k=>Number($('position-'+k).value));if(values.some(n=>!Number.isFinite(n))){message('位置必须是有限数字。',true);sync(store.state);return;}update({transform:{position:values}},'移动编队');};
 $('light-color').oninput=()=>{setColorFields($('light-color').value);view.color($('light-color').value);};
 $('light-color').onchange=()=>update({color:$('light-color').value},'修改颜色');
 for(const key of ['red','green','blue']){
  $(key).oninput=()=>{const values=['red','green','blue'].map(k=>Number($(k).value));if(values.some(n=>!Number.isInteger(n)||n<0||n>255))return;const hex='#'+values.map(n=>n.toString(16).padStart(2,'0')).join('');$('light-color').value=hex;view.color(hex);};
  $(key).onchange=()=>{const valid=['red','green','blue'].every(k=>$(k).value!==''&&Number.isInteger(Number($(k).value))&&Number($(k).value)>=0&&Number($(k).value)<=255);if(valid)update({color:$('light-color').value},'修改颜色');else{setColorFields(active().color);view.color(active().color);message('RGB 分量请输入 0–255 的整数。',true);}};
 }
 const lineSettings=()=>({kind:'lineart',mode:$('line-mode').value,threshold:Number($('line-threshold').value)});
 $('line-threshold').oninput=()=>$('line-threshold-value').value=$('line-threshold').value;
 for(const key of ['line-mode','line-threshold'])$(key).onchange=()=>{if(pendingRaster)return;if(active()?.generation.kind!=='lineart')return;try{regenerate(lineSettings());}catch(e){message(e.message,true);}};
 async function addFile(file,kind){if(!file)return;await task(async()=>{message('正在读取素材并生成点阵…');const asset=kind==='mesh'?await modelImporter(file):await importRaster(file);if(kind!=='mesh'){pendingRaster=asset;$('line-draft').hidden=false;$('line-draft-name').textContent=file.name;}const generation=kind==='mesh'?{kind:'mesh'}:lineSettings(),positions=generate(generation,active()?.points.ids.length||COUNT,asset),f=createFormation(file.name,positions,generation,asset.id);return ()=>{if(kind!=='mesh'){pendingRaster=null;$('line-draft').hidden=true;}store.add(f,asset);message(`${file.name} 已保存为独立编队。`);};});}
 $('retry-line').onclick=()=>task(async()=>{const asset=pendingRaster,generation=lineSettings(),positions=generate(generation,active()?.points.ids.length||COUNT,asset),f=createFormation(asset.name,positions,generation,asset.id);return ()=>{pendingRaster=null;$('line-draft').hidden=true;store.add(f,asset);message('线稿已重新识别并新建编队。');};});
 $('discard-line').onclick=()=>{pendingRaster=null;$('line-draft').hidden=true;lock();};
 $('upload').onclick=()=>$('file').click();$('file').onchange=async()=>{await addFile($('file').files[0],'mesh');$('file').value='';};
 $('line-upload').onclick=()=>$('line-file').click();$('line-file').onchange=async()=>{await addFile($('line-file').files[0],'lineart');$('line-file').value='';};
 $('viewport').ondragover=e=>e.preventDefault();$('viewport').ondrop=e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)addFile(file,/\.glb$/i.test(file.name)?'mesh':'lineart');};
 $('reference').onchange=()=>view.reference($('reference').checked);$('reset-view').onclick=()=>view.reset();
 $('play').onclick=()=>{if(progress>=1)progress=0;playing=!playing;view.draw(progress);syncPlayback();};$('restart').onclick=()=>{progress=0;playing=false;view.draw(0);syncPlayback();};$('progress').oninput=()=>{progress=Number($('progress').value)/1000;playing=false;view.draw(progress);syncPlayback();};
 $('background-upload').onclick=()=>$('background-file').click();$('background-file').onchange=async()=>{const file=$('background-file').files[0];if(file)await task(async()=>{const asset=await importRaster(file,'background');if(Math.max(asset.raster.width,asset.raster.height)>view.renderer.capabilities.maxTextureSize)throw new Error('背景超出本机纹理尺寸限制。');return ()=>store.commit('设置背景',p=>({...p,assets:[...p.assets.filter(a=>a.id!==p.backgroundAssetId),asset],backgroundAssetId:asset.id}));});$('background-file').value='';};
 $('background-remove').onclick=()=>store.commit('移除背景',p=>({...p,assets:p.assets.filter(a=>a.id!==p.backgroundAssetId),backgroundAssetId:null}));
 $('new-project').onclick=()=>store.replace(initial());
 $('save-project').onclick=()=>task(async()=>{const snapshot=store.state,text=serializeProject(snapshot);downloadFile(new Blob([text],{type:'application/json'}),(snapshot.name.replace(/[\\/:*?"<>|]/g,'_')||'点阵工程')+'.droneshow.json');return ()=>{savedState=snapshot;$('save-state').textContent='工程已生成，已请求下载';message('工程包含所有编队、点集、源文件与背景，可重新打开继续编辑。');};});
 $('open-project').onclick=()=>$('project-file').click();$('project-file').onchange=async()=>{const file=$('project-file').files[0];if(file)await task(async()=>{if(file.size>512*1024*1024)throw new Error('工程文件超过 512 MB。');const project=checkRuntime(parseProject(await file.text()));return ()=>{store.replace(project);savedState=store.state;$('save-state').textContent='工程已打开';message('工程已打开；可撤销返回之前的项目。');};});$('project-file').value='';};
 $('restore-project').onclick=()=>task(async()=>{const project=await readAutosave();if(!project)throw new Error('没有可恢复的自动保存');checkRuntime(project);return ()=>{store.replace(project);message('已恢复本机自动保存。');};});
 view.renderer.setAnimationLoop(now=>{const dt=Math.min((now-last)/1000,.1);last=now;if(playing&&!document.hidden){progress=Math.min(1,progress+dt/(active()?.duration||12));if(progress===1)playing=false;view.draw(progress);syncPlayback();}view.render();media.frame(progress,active()?.duration||12);});
}catch(error){$('fatal').hidden=false;$('fatal').textContent='场景启动失败，请刷新页面或检查浏览器 WebGL 支持。';console.error(error);}
