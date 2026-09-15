/** Canonical project data: meters, seconds, right-handed Y-up. No DOM/Three objects.
 * @typedef {{ids: string[], positions: Float32Array}} PointSet Local XYZ coordinates.
 * @typedef {{id:string, revision:number, name:string, sourceAssetId:string|null,
 * spatialMode:'2D'|'3D', points:PointSet, generation:object,
 * transform:{position:number[]}, color:string, duration:number}} Formation
 */
export const id=()=>crypto.randomUUID();
export function createProject(){return {schemaVersion:1,revision:0,id:id(),name:'未命名项目',units:{length:'m',time:'s'},worldFrame:'Y-up',fleet:{count:1000},assets:[],formations:[],activeId:null,backgroundAssetId:null};}
export function createFormation(name,positions,generation,sourceAssetId=null){return {id:id(),revision:0,name,sourceAssetId,spatialMode:generation.kind==='lineart'?'2D':'3D',points:{ids:Array.from({length:positions.length/3},id),positions},generation,transform:{position:[0,15,0]},color:'#00ccff',duration:12};}
const check=(condition,text)=>{if(!condition)throw new Error(`工程数据无效：${text}`);};
const finiteArray=a=>{if(!a||typeof a.length!=='number')return false;for(const n of a)if(!Number.isFinite(n))return false;return true;};
export function validateProject(p){
 check(p?.schemaVersion===1,'不支持的文件版本');check(Number.isInteger(p.revision)&&p.revision>=0,'项目版本');check(typeof p.id==='string'&&typeof p.name==='string','项目名称或 ID');
 check(p.units?.length==='m'&&p.units?.time==='s'&&p.worldFrame==='Y-up','坐标或单位');
 check(Number.isInteger(p.fleet?.count)&&p.fleet.count>=1&&p.fleet.count<=10000,'机队数量');
 check(Array.isArray(p.assets)&&Array.isArray(p.formations),'素材/编队列表');
 const assetIds=new Set(),formationIds=new Set();
 for(const a of p.assets){
  check(typeof a.id==='string'&&!assetIds.has(a.id),'素材 ID 重复');assetIds.add(a.id);
  check(typeof a.name==='string'&&['mesh','raster','background'].includes(a.type),'素材类型');
  check(a.original instanceof Uint8Array&&a.original.length>0&&typeof a.mime==='string','源文件');
  if(a.type==='mesh')check(a.triangles instanceof Float64Array&&a.triangles.length>0&&a.triangles.length%9===0&&a.triangles.length<=18000000&&finiteArray(a.triangles),'网格数据');
  else {const r=a.raster;check(Number.isInteger(r?.width)&&Number.isInteger(r?.height)&&r.width>0&&r.height>0&&r.width*r.height<=40000000&&r.data instanceof Uint8ClampedArray&&r.data.length===r.width*r.height*4,'图像数据');}
 }
 for(const f of p.formations){
  check(typeof f.id==='string'&&!formationIds.has(f.id),'编队 ID 重复');formationIds.add(f.id);
  check(typeof f.name==='string'&&Number.isInteger(f.revision)&&f.revision>=0,'编队名称/版本');
  check(['2D','3D'].includes(f.spatialMode),'空间模式');
  check(f.points?.positions instanceof Float32Array&&f.points.positions.length>=3&&f.points.positions.length<=30000&&f.points.positions.length%3===0&&finiteArray(f.points.positions),'点坐标');
  check(Array.isArray(f.points.ids)&&f.points.ids.length===f.points.positions.length/3&&f.points.ids.every(x=>typeof x==='string')&&new Set(f.points.ids).size===f.points.ids.length,'逻辑点 ID');
  check(/^#[0-9a-f]{6}$/i.test(f.color),'RGB');check(Number.isFinite(f.duration)&&f.duration>=3&&f.duration<=60,'飞行时长');
  check(Array.isArray(f.transform?.position)&&f.transform.position.length===3&&finiteArray(f.transform.position)&&f.transform.position.every(n=>Math.abs(n)<=1000000),'位置（范围 ±1,000,000 米）');
  check(['preset','mesh','lineart'].includes(f.generation?.kind),'生成方式');
  if(f.generation.kind==='preset')check(['sphere','helix','cube'].includes(f.generation.preset)&&f.sourceAssetId===null,'预设');
  else {const a=p.assets.find(a=>a.id===f.sourceAssetId);check(a&&a.type===(f.generation.kind==='mesh'?'mesh':'raster'),'编队素材引用');}
  if(f.generation.kind==='lineart')check(['dark','light'].includes(f.generation.mode)&&Number.isInteger(f.generation.threshold)&&f.generation.threshold>=1&&f.generation.threshold<=254,'线稿参数');
 }
 check(p.activeId===null||formationIds.has(p.activeId),'当前编队引用');check(p.formations.length===0?p.activeId===null:p.activeId!==null,'未选中编队');
 check(p.backgroundAssetId===null||p.assets.some(a=>a.id===p.backgroundAssetId&&a.type==='background'),'背景引用');return p;
}
/** Immutable-by-convention snapshots share unchanged geometry; commands never mutate buffers. */
export class ProjectStore {
 constructor(project){this.state=validateProject(project);this.undoStack=[];this.redoStack=[];this.version=0;this.revision=project.revision;this.listeners=new Set();}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 emit(label){this.version++;for(const fn of this.listeners)fn(this.state,label);}
 commit(label,change){let next=change(this.state);if(next===this.state)return;validateProject(next);this.revision=Math.max(this.revision,next.revision)+1;next={...next,revision:this.revision};this.undoStack.push({state:this.state,label});if(this.undoStack.length>30)this.undoStack.shift();this.redoStack=[];this.state=next;this.emit(label);}
 replace(project){this.commit('打开项目',()=>validateProject(project));}
 select(activeId){if(activeId===this.state.activeId)return;const next={...this.state,activeId};validateProject(next);this.state=next;this.emit('选择编队');}
 add(formation,asset){this.commit('添加编队',p=>({...p,assets:asset?[...p.assets,asset]:p.assets,formations:[...p.formations,formation],activeId:formation.id}));}
 update(formationId,patch,label='编辑编队'){this.commit(label,p=>({...p,formations:p.formations.map(f=>f.id===formationId?{...f,...patch,revision:f.revision+1}:f)}));}
 undo(){const entry=this.undoStack.pop();if(!entry)return;this.redoStack.push({state:this.state,label:entry.label});this.state=entry.state;this.emit(`撤销${entry.label}`);}
 redo(){const entry=this.redoStack.pop();if(!entry)return;this.undoStack.push({state:this.state,label:entry.label});this.state=entry.state;this.emit(`重做${entry.label}`);}
}
