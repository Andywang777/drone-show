// Background and exports use the same rendered canvas, so downloads match the scene.
export function setupMedia({renderer,message,startFlight,isBusy,onRecordingChange=()=>{}}) {
  const $=id=>document.getElementById(id);
  let recording=null;
  function download(blob,extension){
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`粒子空间-${new Date().toISOString().replace(/[:.]/g,'-')}.${extension}`;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  let renderNow=()=>{};
  $('export-image').onclick=()=>{
    const type=$('image-format').value;
    try{
      renderNow(true);
      renderer.domElement.toBlob(blob=>{
        if(!blob){message('图片导出失败，请重试。',true);return;}
        download(blob,type==='image/jpeg'?'jpg':'png');message('图片已生成，已请求浏览器下载。');
      },type,.95);
    }catch(error){message('图片导出失败，请刷新后重试。',true);}
  };
  const supported=typeof MediaRecorder!=='undefined'&&typeof renderer.domElement.captureStream==='function';
  const mime=supported?['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t)):null;
  $('record-video').disabled=!mime;
  $('video-hint').textContent=mime?`录制完整三阶段动画 · ${mime.includes('mp4')?'MP4':'WebM'} · 无声视频`:'当前浏览器不支持视频录制，请使用支持 MediaRecorder 的浏览器。';
  function unlock(state){
    onRecordingChange(false);
    $('record-video').textContent='录制视频';$('record-video').disabled=!mime;
  }
  function stop(error=''){
    if(!recording)return;
    if(error)recording.error=error;
    if(recording.recorder.state!=='inactive')recording.recorder.stop();
    $('record-video').disabled=true;$('record-status').textContent='正在生成视频…';
  }
  $('record-video').onclick=()=>{
    if(recording){stop();return;}
    if(isBusy()){message('请等待模型加载完成后再录制。',true);return;}
    let stream;
    try{
      // A fixed-size copy canvas keeps the video dimensions stable on window resize.
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(2,Math.floor(renderer.domElement.width/2)*2);canvas.height=Math.max(2,Math.floor(renderer.domElement.height/2)*2);
      const context=canvas.getContext('2d');
      stream=canvas.captureStream(30);
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:8000000});
      const state={recorder,stream,canvas,context,chunks:[],error:''};
      recording=state;
      onRecordingChange(true);
      recorder.ondataavailable=e=>{if(e.data.size)state.chunks.push(e.data);};
      recorder.onerror=()=>stop('视频编码失败，请尝试其他浏览器。');
      recorder.onstop=()=>{
        stream.getTracks().forEach(track=>track.stop());recording=null;unlock(state);$('record-status').textContent='';
        if(state.error){message(state.error,true);return;}
        const blob=new Blob(state.chunks,{type:recorder.mimeType});
        if(!blob.size){message('未录制到画面，请重试。',true);return;}
        download(blob,recorder.mimeType.includes('mp4')?'mp4':'webm');message('视频已生成，已请求浏览器下载。');
      };
      startFlight();renderNow(true);context.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
      recorder.start(1000);$('record-video').textContent='停止并保存';$('record-status').textContent='正在录制…';
    }catch(error){stream?.getTracks().forEach(track=>track.stop());if(recording)unlock(recording);recording=null;message('无法开始录制，请尝试其他浏览器。',true);}
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&recording)stop('页面已切到后台，录制已取消；请保持页面可见后重新录制。');});
  return {
    get recording(){return !!recording;},
    setRender(fn){renderNow=fn;},
    stop,
    frame(progress,duration){
      if(!recording||recording.recorder.state!=='recording')return;
      const {context,canvas}=recording;renderNow(true);context.drawImage(renderer.domElement,0,0,canvas.width,canvas.height);
      $('record-status').textContent=`正在录制 ${(progress*duration).toFixed(1)} / ${duration} s`;
      if(progress>=1&&!recording.ending){recording.ending=true;const state=recording;setTimeout(()=>{if(recording===state)stop();},150);}
    }
  };
}
