import {validateProject} from './model.mjs';
export function migrateProject(project){
 for(const f of project?.formations||[])if(f?.motion?.exit?.effect==='flip')f.motion.exit.effect='fade';
 return project;
}
const types={Float32Array,Float64Array,Uint8Array,Uint8ClampedArray};
export function serializeProject(project){
 validateProject(project);
 return JSON.stringify(project,(_,v)=>{
  if(!ArrayBuffer.isView(v))return v;
  const bytes=new Uint8Array(v.buffer,v.byteOffset,v.byteLength);let text='';
  for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {$buffer:v.constructor.name,data:btoa(text)};
 });
}
export function parseProject(text){
 const project=JSON.parse(text,(_,v)=>{
  if(!v||typeof v!=='object'||!Object.hasOwn(v,'$buffer'))return v;
  const Type=Object.hasOwn(types,v.$buffer)?types[v.$buffer]:null;
  if(!Type||typeof v.data!=='string')throw new Error('工程缓冲格式无效');
  const raw=atob(v.data),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
  if(bytes.byteLength%Type.BYTES_PER_ELEMENT)throw new Error('工程缓冲长度无效');
  return new Type(bytes.buffer);
 });return validateProject(migrateProject(project));
}
let database;
async function db(){
 if(!database)database=new Promise((resolve,reject)=>{const r=indexedDB.open('drone-show-projects',1);r.onupgradeneeded=()=>r.result.createObjectStore('autosave');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return database;
}
export async function autosave(project){
 const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('autosave','readwrite');t.objectStore('autosave').put(project,'latest');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
}
export async function readAutosave(){const d=await db();return new Promise((resolve,reject)=>{const r=d.transaction('autosave').objectStore('autosave').get('latest');r.onsuccess=()=>{try{resolve(r.result?validateProject(migrateProject(r.result)):null);}catch(e){reject(e);}};r.onerror=()=>reject(r.error);});}
export function downloadFile(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
