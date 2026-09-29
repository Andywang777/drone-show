/** One isolated Worker per calculation. Inputs are cloned (never detach project buffers). */
export class GeometryJobs {
 constructor(factory=()=>new Worker(new URL('./worker.js',import.meta.url),{type:'module'})){this.factory=factory;this.pending=null;}
 run(payload,onProgress=()=>{}){
  this.cancel();return new Promise((resolve,reject)=>{
   const worker=this.factory(),entry={worker,reject};this.pending=entry;
   const finish=()=>{worker.terminate();if(this.pending===entry)this.pending=null;};
   worker.onmessage=({data})=>{if(this.pending!==entry)return;if(data.type==='progress'){onProgress(data.progress);return;}finish();data.type==='error'?reject(new Error(data.message)):resolve(data.result);};
   worker.onerror=()=>{finish();reject(new Error('后台计算失败，请重试。'));};
   try{worker.postMessage(payload);}catch(e){finish();reject(e);}
  });
 }
 cancel(){const entry=this.pending;if(!entry)return;this.pending=null;entry.worker.terminate();entry.reject(new Error('计算已取消'));}
}
