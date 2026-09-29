import {DOT_SIZES,densityStats} from './geometry/visual-density.mjs';
import {setupStoryboard} from './storyboard-ui.js';
import {detectLineSettings} from './geometry/strokes.mjs';
import {advancePlayback,contextualPanels} from './animation/preview.mjs';
import {defaultAudience,audiencePatch} from './geometry/audience.mjs';
import {GeometryJobs} from './jobs/client.mjs';
import {STAGES,motionFor,totalDuration,phaseAt,previewProgress,validateMotion,isColorEffect,scaleMotion} from './animation/motion.mjs';
import {COUNT} from './formation.mjs';
import {id,createProject,createFormation,ProjectStore} from './project/model.mjs';
import {serializeProject,parseProject,autosave,readAutosave,downloadFile} from './project/persistence.mjs';
import {generate} from './assets/generate.mjs';
import {importRaster,createModelImporter} from './assets/import.mjs';
import {createViewport} from './viewport/view.js';
import {setupMedia} from './media.js';
const $=id=>document.getElementById(id);
const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
const names={sphere:'球形素材',helix:'螺旋素材',cube:'立方体素材'};
function initial(){const p=createProject(),f=createFormation('球形素材',generate({kind:'preset',preset:'sphere'},COUNT),{kind:'preset',preset:'sphere'});p.formations.push(f);p.activeId=f.id;return p;}
try{
 const store=new ProjectStore(initial());let busy=false,recording=false,mode='inspect',progress=0,playing=false,last=performance.now(),saveTimer,savedState=null,autosaveReady=false,hasAutosave=false,lastFormation=null,pendingRaster=null,currentTask=null,view,media,storyboard;
 const jobs=new GeometryJobs();
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const active=()=>store.state.formations.find(f=>f.id===store.state.activeId);
 const fullCount=f=>f?.generation.pointBudget||(f?.audienceSource||f?.points)?.ids.length||COUNT;
 const source=f=>store.state.assets.find(a=>a.id===f?.sourceAssetId);
 function draw(){view.draw(progress,mode);}
 function syncPlayback(){
  const duration=active()?.duration||5,inspect=mode==='inspect';$('progress').value=Math.round(progress*1000);$('time').value=inspect?`总时长 ${Number(duration.toFixed(2))} s`:`${(duration*progress).toFixed(1)} / ${Number(duration.toFixed(2))} s`;
  $('play').querySelector('span').textContent=playing?'暂停':inspect?'播放完整片段':'播放';$('play').querySelector('path').setAttribute('d',playing?'M7 5h3v14H7ZM14 5h3v14h-3Z':'m8 5 11 7-11 7Z');
  $('inspect-mode').setAttribute('aria-pressed',String(inspect));$('animation-mode').setAttribute('aria-pressed',String(!inspect));
  $('phase').textContent=!active()?'导入素材开始设计':inspect?'形态检查 · 当前布点静态显示':`${recording?'录制中':playing?'播放中':'已暂停'} · ${{enter:'入场',hold:'持续动态',exit:'退场'}[phaseAt(motionFor(active()),progress).key]}`;
  $('preview-hint').textContent=inspect?'检查形状与布点；点击动画预览观看完整片段。':recording?'录制仅运行一次，不受循环开关影响。':$('loop-preview').checked?'循环预览中；可随时切回形态检查。':'播放结束后自动回到形态检查。';
 }

 function lock(){
  for(const element of document.querySelectorAll('[data-edit]'))element.disabled=busy||recording;
  const panels=contextualPanels(active()?.generation.kind,!!pendingRaster);$('line-options').hidden=!panels.line;$('sampling-field').hidden=!panels.sampling;$('reference-row').hidden=!panels.mesh;$('audience-panel').hidden=!panels.audience;
  const f=active();for(const key of ['inspect-mode','animation-mode','loop-preview','count','formation-name','source-color','light-color','red','green','blue','position-x','position-y','position-z','duplicate-formation','delete-formation','play','restart','progress'])$(key).disabled=busy||recording||!f;
  for(const key of ['size-m','sampling-mode','mesh-layout','regenerate','hold-palette','growth-origin','total-duration','audience-range','audience-depth','set-audience','return-audience',...STAGES.flatMap(k=>[k+'-effect',k+'-duration'])])$(key).disabled=busy||recording||!f;
  for(const key of ['audience-range','audience-depth','set-audience','return-audience'])$(key).disabled=busy||recording||!f||f.spatialMode==='2D';
  $('mesh-layout-field').hidden=f?.generation.kind!=='mesh';$('mesh-layout').disabled=busy||recording||f?.generation.kind!=='mesh';
  $('size-m').disabled=busy||recording||!f;
  $('sampling-mode').disabled=busy||recording||f?.generation.kind!=='lineart';
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
  $('formation-name').value=f?.name||'';$('count').value=fullCount(f);const motion=motionFor(f);for(const key of STAGES){$(key+'-effect').value=motion[key].effect;$(key+'-duration').value=Number(motion[key].duration.toFixed(2));}$('growth-origin').value=motion.enter.origin||'default';$('growth-origin-field').hidden=motion.enter.effect!=='grow';for(const option of $('growth-origin').options)option.disabled=option.value!=='default'&&!f?.points.strokeIds;$('growth-origin-hint').textContent=f?.points.strokeIds?'沿笔画传播，断开的线条按邻近关系接力。':'此素材需点击更新图形与布点，才能选择起点。';$('enter-effect').querySelector('[value="stroke-relay"]').disabled=!f?.points.strokeIds;$('hold-palette').value=motion.hold.palette||'cool';$('palette-field').hidden=!isColorEffect(motion.hold.effect);$('total-duration').value=Number(totalDuration(motion).toFixed(3));$('audience-range').value=f?.audience?.range||'full';$('audience-depth').checked=!!f?.audience?.depth;$('motion-total').textContent=`总时长 ${Number(totalDuration(motion).toFixed(2))} 秒`;
  $('drone-total').textContent=`${f?.points.ids.length||0} 粒子 · ${project.formations.length} 份素材`;
  document.title=`${project.name} · 粒子空间 · v2026.09.20.2`;
  $('filename').hidden=!f?.sourceAssetId;$('filename').textContent=source(f)?.name||'';
  $('line-name').textContent=source(f)?.type==='raster'?source(f).name:'导入线稿将新建独立素材';
  if(f?.generation.kind==='lineart'){$('line-mode').value=f.generation.mode;$('line-threshold').value=f.generation.threshold;}
  $('line-threshold-value').value=$('line-threshold').value;
  $('mesh-layout').value=f?.generation.meshLayout||'surface';$('size-m').value=f?settings(f).sizeM:22;$('sampling-mode').value=f?.generation.sampling||'strokes';$('source-color-field').hidden=f?.generation.kind!=='lineart';$('source-color').checked=f?.colorMode!=='uniform';$('hold-effect').querySelector('[value="color-relay"]').disabled=!(f?.generation.kind==='lineart'&&f?.points.uv&&f?.colorMode!=='uniform');for(const [stage,effect] of [['enter','grow'],['hold','line-flow'],['exit','line-out']])$(stage+'-effect').querySelector('[value="'+effect+'"]').disabled=!(f?.generation.kind==='lineart'&&f?.generation.sampling==='strokes');
  ['x','y','z'].forEach((key,i)=>$('position-'+key).value=f?.transform.position[i]??0);
  setColorFields(f?.color||'#00ccff');
  $('dot-size').value=project.visual?.dotSize||'medium';$('auto-density').checked=!!project.visual?.autoDensity;view.setVisual(project.formations,project.visual);
  const density=f?densityStats(f.points.positions):null,dot=DOT_SIZES[project.visual?.dotSize||'medium'];$('density-status').textContent=density?`亮点 ${f.points.ids.length} / 上限 ${fullCount(f)} · 典型点间距 ${density.median.toFixed(2)} 米 · 光点显示 ${dot.toFixed(2)} 场景单位${density.min<dot?'；局部仍有重叠风险，可选小光点或更新布点':''}`:'导入素材后显示疏密';
  view.setFormation(f,source(f));view.reference($('reference').checked&&source(f)?.type==='mesh');
  const background=project.assets.find(a=>a.id===project.backgroundAssetId);view.background(background);$('background-name').textContent=background?.name||'未设置背景';
  if(lastFormation?.points!==f?.points||lastFormation?.transform!==f?.transform||lastFormation?.id!==f?.id){mode='inspect';playing=false;progress=0;}
  if(lastFormation&&lastFormation.id===f?.id&&lastFormation.motion!==f?.motion){mode=reduced?'inspect':'animation';progress=0;playing=!!f&&!reduced;}
  lastFormation=f;
  draw();syncPlayback();lock();storyboard?.sync();
  if(label?.startsWith('撤销')||label?.startsWith('重做'))message(`${label}；当前素材 ${f?.points.ids.length||0} 点。`);
  if(autosaveReady){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const snapshot=store.state;autosave(snapshot).then(()=>{hasAutosave=true;$('autosave-status').textContent='本机自动保存已更新';$('restore-project').disabled=busy||recording;},()=>{$('autosave-status').textContent='自动保存失败，请手动保存工程';});},600);}
 }
 function setColorFields(hex){$('light-color').value=hex;['red','green','blue'].forEach((key,i)=>$(key).value=parseInt(hex.slice(1+i*2,3+i*2),16));}
 store.subscribe(sync);
 media=setupMedia({renderer:view.renderer,message,isBusy:()=>busy,startFlight(){storyboard?.stop();mode='animation';progress=0;playing=true;last=performance.now();draw();syncPlayback();},onRecordingChange(value){recording=value;if(!value){mode='inspect';playing=false;progress=0;draw();syncPlayback();}lock();}});
 media.setRender(clean=>view.render(clean));
 storyboard=setupStoryboard({store,view,active,source,message,blocked:()=>busy||recording,pause(){playing=false;progress=0;},restore(){mode='inspect';playing=false;progress=0;view.setFormation(active(),source(active()));view.reference($('reference').checked);draw();syncPlayback();lock();}});
 sync(store.state);
 readAutosave().then(p=>{autosaveReady=true;hasAutosave=!!p;$('restore-project').disabled=!p;$('autosave-status').textContent=p?'发现本机自动保存，可点击恢复':'编辑后自动保存到本机';},()=>{autosaveReady=true;$('autosave-status').textContent='自动保存读取失败，请手动打开工程；后续编辑会重建自动保存';});
 async function task(action){
  if(busy||recording)return;busy=true;currentTask={cancelled:false};const token=currentTask,version=store.version;lock();
  $('geometry-task').hidden=false;$('geometry-progress').value=0;$('geometry-progress-text').textContent='准备计算…';
  try{const commit=await action();if(token.cancelled)throw new Error('计算已取消');if(version!==store.version)throw new Error('项目已改变，本次结果未应用。');commit?.();}
  catch(e){$('count').value=fullCount(active());message(`${e.message} 当前工程已保留。`,true);}
  finally{busy=false;currentTask=null;$('geometry-task').hidden=true;lock();}
 }
 $('cancel-task').onclick=()=>{if(currentTask){currentTask.cancelled=true;jobs.cancel();$('geometry-progress-text').textContent='正在取消…';}};
 function settings(f){const fallback=f?.generation.kind==='preset'?(f.generation.preset==='cube'?18:22):22;return {...f?.generation,sizeM:f?.generation.sizeM??fallback,minDistance:f?.generation.minDistance??0,sampling:f?.generation.sampling||'ink'};}
 function requested(g){return {...g,sizeM:Number($('size-m').value),minDistance:0,sampling:$('sampling-mode').value};}
 async function calculate(g,count,asset,previous){
  if(currentTask?.cancelled)throw new Error('计算已取消');
  const input={generation:store.state.visual?.autoDensity?{...g,targetSpacing:.85}:g,count,asset:asset?(asset.type==='mesh'?{triangles:asset.triangles}:{raster:asset.raster}):undefined,previous};
  const result=await jobs.run({type:'generate',input},p=>{$('geometry-progress').value=p.fraction;$('geometry-progress-text').textContent=p.text;});
  if(result.status!=='success')throw new Error(`${result.status==='infeasible'?'约束冲突':'未完成重分布'}：${result.reason}`);
  return result;
 }
 function resultPoints(result){const ids=Array.from({length:result.positions.length/3},(_,i)=>result.lockedIds[i]||id());return {positions:result.positions,ids,lockedIds:result.lockedIds,...(result.uv?{uv:result.uv}:{}),...(result.strokeIds?{strokeIds:result.strokeIds}:{})};}
 function update(patch,label){if(!active()||busy||recording)return;try{store.update(active().id,patch,label);}catch(e){message(e.message,true);sync(store.state);}}
 async function regenerate(generation,count=Number($('count').value),audience=active()?.audience){
  await task(async()=>{const f=active(),g={...requested(generation),...(generation.kind==='mesh'?{meshLayout:$('mesh-layout').value,viewDirection:(audience||defaultAudience()).position.map((v,i)=>v-(audience||defaultAudience()).target[i])}:{})},result=await calculate(g,count,source(f),undefined);
   return ()=>{store.update(f.id,{generation:{...g,pointBudget:count},...audiencePatch(f,resultPoints(result),audience)},'重新生成点阵');message(`已更新布点：${active().points.ids.length.toLocaleString()} 个亮点，总数上限 ${count.toLocaleString()}。`);};});
 }
 $('mesh-layout').onchange=()=>regenerate(active().generation);
 $('regenerate').onclick=()=>regenerate(active().generation);
 function changeAudience(a){const f=active();if(!f||busy||recording)return;try{update(audiencePatch(f,undefined,a),'修改展示范围');}catch(e){message(e.message,true);sync(store.state);}}
 $('audience-range').onchange=()=>changeAudience({...active().audience||defaultAudience(),range:$('audience-range').value});
 $('audience-depth').onchange=()=>changeAudience({...active().audience||defaultAudience(),depth:$('audience-depth').checked});
 $('set-audience').onclick=()=>{const a=view.captureAudience();if(active()?.generation.kind==='mesh'&&$('mesh-layout').value==='contour')regenerate(active().generation,fullCount(active()),a);else changeAudience(a);};
 $('return-audience').onclick=()=>view.returnAudience();
 $('total-duration').onchange=()=>{try{const motion=scaleMotion(motionFor(active()),Number($('total-duration').value));update({motion,duration:totalDuration(motion)},'调整总时长');}catch(e){message(e.message,true);sync(store.state);}};
 $('formation-list').onchange=()=>store.select($('formation-list').value);
 $('formation-name').onchange=()=>update({name:$('formation-name').value.trim()||'未命名素材'},'重命名素材');
 $('project-name').onchange=()=>store.commit('重命名项目',p=>({...p,name:$('project-name').value.trim()||'未命名项目'}));
 $('add-preset').onclick=()=>task(async()=>{const kind=$('formation').value,generation=requested({kind:'preset',preset:kind}),result=await calculate(generation,fullCount(active()));generation.pointBudget=fullCount(active());const f=createFormation(names[kind],result.positions,generation);f.generation.pointBudget=fullCount(active());f.points=resultPoints(result);f.spacingReport=result.report;return ()=>store.add(f);});
 for(const key of ['dot-size','auto-density'])$(key).onchange=()=>{try{store.commit('调整全片光点与疏密',p=>({...p,visual:{dotSize:$('dot-size').value,autoDensity:$('auto-density').checked}}));view.reset();message('已更新全片显示与疏密，可撤销恢复。');}catch(e){message(e.message,true);sync(store.state);}};
 $('count').onchange=()=>regenerate(active().generation,Number($('count').value));
 $('duplicate-formation').onclick=()=>{const f=active(),base=f.audienceSource||f.points,copy={positions:new Float32Array(base.positions),ids:Array.from({length:base.ids.length},id),lockedIds:[],...(base.uv?{uv:new Float32Array(base.uv)}:{}),...(base.strokeIds?{strokeIds:new Float32Array(base.strokeIds)}:{})};store.add({...f,id:id(),revision:0,name:f.name+' 副本',...audiencePatch(f,copy)});};
 $('delete-formation').onclick=()=>store.commit('删除素材',p=>{const formations=p.formations.filter(f=>f.id!==p.activeId);const used=new Set(formations.map(f=>f.sourceAssetId));used.add(p.backgroundAssetId);return {...p,formations,...(p.storyboard?{storyboard:p.storyboard.filter(s=>formations.some(f=>f.id===s.formationId))}:{}),activeId:formations[0]?.id||null,assets:p.assets.filter(a=>used.has(a.id))};});
 $('undo').onclick=()=>store.undo();$('redo').onclick=()=>store.redo();
 document.addEventListener('keydown',e=>{if(busy||recording||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?store.redo():store.undo();}});
 function changeMotion(){
  try{const motion=Object.fromEntries(STAGES.map(k=>[k,{effect:$(k+'-effect').value,duration:Number($(k+'-duration').value)}]));motion.enter.origin=$('growth-origin').value;motion.hold.palette=$('hold-palette').value;validateMotion(motion);update({motion,duration:totalDuration(motion)},'修改动效');}
  catch(e){message(e.message,true);sync(store.state);}
 };
 $('growth-origin').onchange=changeMotion;
 for(const key of STAGES)for(const field of ['effect','duration'])$(key+'-'+field).onchange=changeMotion;
 $('hold-palette').onchange=changeMotion;
 for(const key of ['x','y','z'])$('position-'+key).onchange=()=>{const values=['x','y','z'].map(k=>Number($('position-'+k).value));if(values.some(n=>!Number.isFinite(n))){message('位置必须是有限数字。',true);sync(store.state);return;}update({transform:{position:values}},'移动素材');};
 $('source-color').onchange=()=>update({colorMode:$('source-color').checked?'source':'uniform'},'修改颜色来源');
 $('light-color').oninput=()=>{setColorFields($('light-color').value);view.color($('light-color').value);};
 $('light-color').onchange=()=>update({color:$('light-color').value},'修改颜色');
 for(const key of ['red','green','blue']){
  $(key).oninput=()=>{const values=['red','green','blue'].map(k=>Number($(k).value));if(values.some(n=>!Number.isInteger(n)||n<0||n>255))return;const hex='#'+values.map(n=>n.toString(16).padStart(2,'0')).join('');$('light-color').value=hex;view.color(hex);};
  $(key).onchange=()=>{const valid=['red','green','blue'].every(k=>$(k).value!==''&&Number.isInteger(Number($(k).value))&&Number($(k).value)>=0&&Number($(k).value)<=255);if(valid)update({color:$('light-color').value},'修改颜色');else{setColorFields(active().color);view.color(active().color);message('RGB 分量请输入 0–255 的整数。',true);}};
 }
 const lineSettings=()=>({kind:'lineart',mode:$('line-mode').value,threshold:Number($('line-threshold').value)});
 $('line-threshold').oninput=()=>$('line-threshold-value').value=$('line-threshold').value;
 for(const key of ['line-mode','line-threshold'])$(key).onchange=()=>{if(pendingRaster)return;if(active()?.generation.kind!=='lineart')return;try{regenerate(lineSettings());}catch(e){message(e.message,true);}};
 async function addFile(file,kind){if(!file)return;await task(async()=>{
  message('正在读取素材并生成点阵…');const asset=kind==='mesh'?await modelImporter(file):await importRaster(file);if(currentTask.cancelled)throw new Error('计算已取消');
  if(kind!=='mesh'){const detected=detectLineSettings(asset.raster);$('line-mode').value=detected.mode;$('line-threshold').value=detected.threshold;$('line-threshold-value').value=detected.threshold;pendingRaster=asset;$('line-draft').hidden=false;$('line-draft-name').textContent=file.name;}
  const generation={...requested(kind==='mesh'?{kind:'mesh',meshLayout:'contour',viewDirection:defaultAudience().position}:lineSettings()),...(kind==='mesh'?{}:{sampling:'strokes'})},result=await calculate(generation,fullCount(active()),asset),f=createFormation(file.name,result.positions,generation,asset.id);f.generation.pointBudget=fullCount(active());f.points=resultPoints(result);f.spacingReport=result.report;
  return ()=>{if(kind!=='mesh'){pendingRaster=null;$('line-draft').hidden=true;}store.add(f,asset);message(`${file.name} 已保存为独立素材。`);};
 });}
 $('retry-line').onclick=()=>task(async()=>{const asset=pendingRaster,generation=requested(lineSettings()),result=await calculate(generation,fullCount(active()),asset),f=createFormation(asset.name,result.positions,generation,asset.id);f.generation.pointBudget=fullCount(active());f.points=resultPoints(result);f.spacingReport=result.report;
  return ()=>{pendingRaster=null;$('line-draft').hidden=true;store.add(f,asset);message('线稿已重新识别并新建素材。');};});
 $('discard-line').onclick=()=>{pendingRaster=null;$('line-draft').hidden=true;lock();};
 $('upload').onclick=()=>$('file').click();$('file').onchange=async()=>{await addFile($('file').files[0],'mesh');$('file').value='';};
 $('line-upload').onclick=()=>$('line-file').click();$('line-file').onchange=async()=>{await addFile($('line-file').files[0],'lineart');$('line-file').value='';};
 $('viewport').ondragover=e=>e.preventDefault();$('viewport').ondrop=e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)addFile(file,/\.glb$/i.test(file.name)?'mesh':'lineart');};
 $('reference').onchange=()=>view.reference($('reference').checked);$('reset-view').onclick=()=>view.reset();
 function startPreview(){storyboard?.stop();if(!active()||busy||recording)return;mode='animation';progress=0;playing=true;last=performance.now();draw();syncPlayback();}
 $('inspect-mode').onclick=()=>{if(busy||recording)return;storyboard?.stop();mode='inspect';playing=false;progress=0;draw();syncPlayback();};
 $('animation-mode').onclick=startPreview;
 $('loop-preview').onchange=syncPlayback;
 $('play').onclick=()=>{if(mode==='inspect'){startPreview();return;}if(progress>=1)progress=0;playing=!playing;last=performance.now();draw();syncPlayback();};
 $('restart').onclick=startPreview;
 $('progress').oninput=()=>{mode='animation';progress=Number($('progress').value)/1000;playing=false;draw();syncPlayback();};
 $('background-upload').onclick=()=>$('background-file').click();$('background-file').onchange=async()=>{const file=$('background-file').files[0];if(file)await task(async()=>{const asset=await importRaster(file,'background');if(Math.max(asset.raster.width,asset.raster.height)>view.renderer.capabilities.maxTextureSize)throw new Error('背景超出本机纹理尺寸限制。');return ()=>store.commit('设置背景',p=>({...p,assets:[...p.assets.filter(a=>a.id!==p.backgroundAssetId),asset],backgroundAssetId:asset.id}));});$('background-file').value='';};
 $('background-remove').onclick=()=>store.commit('移除背景',p=>({...p,assets:p.assets.filter(a=>a.id!==p.backgroundAssetId),backgroundAssetId:null}));
 $('new-project').onclick=()=>store.replace(initial());
 $('save-project').onclick=()=>task(async()=>{const snapshot=store.state,text=serializeProject(snapshot);downloadFile(new Blob([text],{type:'application/json'}),(snapshot.name.replace(/[\\/:*?"<>|]/g,'_')||'点阵工程')+'.droneshow.json');return ()=>{savedState=snapshot;$('save-state').textContent='工程已生成，已请求下载';message('工程包含所有素材、点集、源文件与背景，可重新打开继续编辑。');};});
 $('open-project').onclick=()=>$('project-file').click();$('project-file').onchange=async()=>{const file=$('project-file').files[0];if(file)await task(async()=>{if(file.size>512*1024*1024)throw new Error('工程文件超过 512 MB。');const project=checkRuntime(parseProject(await file.text()));return ()=>{store.replace(project);savedState=store.state;$('save-state').textContent='工程已打开';message('工程已打开；可撤销返回之前的项目。');};});$('project-file').value='';};
 $('restore-project').onclick=()=>task(async()=>{const project=await readAutosave();if(!project)throw new Error('没有可恢复的自动保存');checkRuntime(project);return ()=>{store.replace(project);message('已恢复本机自动保存。');};});
 view.renderer.setAnimationLoop(now=>{
  const dt=Math.min((now-last)/1000,.1);last=now;
  if(storyboard?.running){if(!document.hidden)storyboard.tick(dt);return;}
  if(playing&&!document.hidden){const next=advancePlayback(progress,dt,active()?.duration||5,{loop:$('loop-preview').checked,recording});progress=next.progress;playing=next.playing;if(!playing&&!recording)mode='inspect';draw();syncPlayback();}
  view.render();media.frame(progress,active()?.duration||5);
 });
}catch(error){$('fatal').hidden=false;$('fatal').textContent='场景启动失败，请刷新页面或检查浏览器 WebGL 支持。';console.error(error);}
