export const STAGES=['enter','hold','exit'];
export const EFFECTS={enter:['stroke-relay','grow','skip','appear','gather','wipe','fade-in','wipe-up','wipe-down'],hold:['local-breathe','color-relay','line-flow','skip','still','float','wave','layers','regions','twinkle','color-cycle','color-layers'],exit:['line-out','skip','fade','scatter','wipe-out','wipe-up-out','wipe-down-out']};
export function defaultMotion(duration=5){return {enter:{effect:'wipe',duration:duration*.3},hold:{effect:'layers',duration:duration*.4},exit:{effect:'fade',duration:duration*.3}};}
export const motionFor=f=>f?.motion||defaultMotion(f?.duration||5);
export const totalDuration=m=>STAGES.reduce((n,k)=>n+(m[k].effect==='skip'?0:m[k].duration),0);
export function validateMotion(m){
 if(!m||!STAGES.every(k=>m[k]&&EFFECTS[k].includes(m[k].effect)&&Number.isFinite(m[k].duration)&&m[k].duration>=.1&&m[k].duration<=60))throw new Error('动效阶段或时长无效');
 if(m.enter.origin!==undefined&&!['default','center','left','right'].includes(m.enter.origin))throw new Error('生长起点无效');
 if(m.hold.palette!==undefined&&!['cool','warm','rainbow'].includes(m.hold.palette))throw new Error('配色无效');
 const total=totalDuration(m);if(total<.1||total>60)throw new Error('至少保留一个阶段，总时长不能超过 60 秒');return m;
}
export function phaseAt(m,progress){
 const total=totalDuration(m),time=Math.max(0,Math.min(1,progress))*total;let start=0,last;
 for(const key of STAGES){const stage=m[key];if(stage.effect==='skip')continue;last={key,effect:stage.effect,t:1};if(time<start+stage.duration)return {key,effect:stage.effect,t:(time-start)/stage.duration};start+=stage.duration;}
 return last||{key:'hold',effect:'still',t:1};
}
export function previewProgress(m){const enter=m.enter.effect==='skip'?0:m.enter.duration,hold=m.hold.effect==='skip'?0:m.hold.duration;return hold?(enter+hold*.5)/totalDuration(m):enter?enter*.95/totalDuration(m):0;}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return (x-Math.floor(x))*2-1;};
// Stateless sampling: seeking, playback and video all produce the same frame.
export function sampleMotion(base,m,progress,out,brightness,bounds,orderedStrokes=false,routing=null){
 const phase=phaseAt(m,progress),{key,effect,t}=phase,ease=smooth(t);
 const span=Math.max(...bounds.size,1),amplitude=span*.025;
 let groupCount=0;if(routing?.ids)for(const id of routing.ids)groupCount=Math.max(groupCount,id+1);
 for(let i=0;i<base.length/3;i++){
  let x=base[i*3],y=base[i*3+1],z=base[i*3+2],light=1;
  if(effect==='scatter'){
   const dx=x-(bounds.min[0]+bounds.size[0]/2),dy=y-(bounds.min[1]+bounds.size[1]/2),dz=z-(bounds.min[2]+bounds.size[2]/2),length=Math.hypot(dx,dy,dz)||1;
   const distance=Math.min(span*.06,1.2)*ease;x+=dx/length*distance;y+=dy/length*distance;z+=dz/length*distance;light=1-ease;
  }else if(effect==='gather'){
   const spread=effect==='gather'?1-ease:ease;
   x+=noise(i*3)*span*.8*spread;y+=noise(i*3+1)*span*.8*spread;z+=noise(i*3+2)*span*.8*spread;
   light=effect==='gather'?ease:1-ease;
  }else if(effect.startsWith('wipe')){
   const axis=effect.includes('up')||effect.includes('down')?1:0;let u=bounds.size[axis]>1e-6?(base[i*3+axis]-bounds.min[axis])/bounds.size[axis]:.5;
   if(effect.includes('down'))u=1-u;const reveal=smooth((t*1.2-u)/.2);light=effect.endsWith('-out')?1-reveal:reveal;
  }else if(effect==='stroke-relay'){
   const group=routing?.ids?.[i]??0;light=groupCount?smooth((t*(groupCount+.5)-group)/.5):ease;
  }else if(effect==='local-breathe'){
   const selected=routing?.ids?Math.floor(routing.ids[i])%3===0:(x>bounds.min[0]+bounds.size[0]*.5);
   if(selected)light=1-.7*Math.sin(Math.PI*t)**2;
  }else if(effect==='line-flow'){
   if(orderedStrokes){
    const u=routing?.order?.[i]??i/Math.max(1,base.length/3-1),head=t*1.3-.15;
    const band=1-smooth(Math.abs(u-head)/.15),envelope=smooth(t/.12)*smooth((1-t)/.12);
    light=1-envelope*(1-(.22+.78*band));
   }
  }else if(effect==='line-out'){
   const order=routing?.order?.[i]??i/Math.max(1,base.length/3-1);light=orderedStrokes?1-smooth((t*1.04-order)/.04):1-ease;
  }else if(effect==='grow'){
   const order=routing?.order?.[i]??i/Math.max(1,base.length/3-1);light=orderedStrokes?smooth((t*1.04-order)/.04):ease;
  }else if(effect==='fade-in')light=ease;
  else if(['layers','regions','twinkle'].includes(effect)){
   const ny=(y-bounds.min[1])/Math.max(bounds.size[1],1e-6),nx=(x-bounds.min[0])/Math.max(bounds.size[0],1e-6);
   const group=effect==='layers'?Math.min(3,Math.floor(ny*4)):effect==='regions'?(nx>=.5?1:0)+(ny>=.5?2:0):(noise(i)+1)*2;
   const seconds=t*m.hold.duration,edge=Math.min(.15,m.hold.duration*.2);
   const envelope=smooth(seconds/edge)*smooth((m.hold.duration-seconds)/edge);
   const frequency=effect==='twinkle'?1.1+(noise(i+71)+1)*.2:1.25;
   const pulse=smooth((Math.cos(seconds*Math.PI*2*frequency+group*Math.PI*.5)+.3)/.6);
   light=1-envelope*(1-(.04+.96*pulse));
  }else if(effect==='float'||effect==='wave'){
   const envelope=Math.sin(Math.PI*t)**2;
   if(effect==='float'){x+=Math.sin(t*Math.PI*2+i*1.7)*amplitude*envelope;y+=Math.cos(t*Math.PI*2+i*.8)*amplitude*envelope;z+=Math.sin(t*Math.PI*2+i*.4)*amplitude*envelope;}
   else z+=Math.sin(x/span*Math.PI*4-t*Math.PI*4)*span*.08*envelope;
  }else if(effect==='fade')light=1-ease;
  out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;brightness[i]=light;
 }
 return key;
}

export const isColorEffect=effect=>effect==='color-cycle'||effect==='color-layers';
// Linear RGB palettes match Three.js vertex colors. Endpoints return to the selected base color.
const PALETTES={cool:[[.015,.45,1],[.25,.04,1],[.01,1,.65]],warm:[[1,.08,.01],[1,.55,.03],[1,.04,.22]],rainbow:[[1,.025,.12],[1,.5,.01],[.01,.8,.25],[.015,.2,1],[.6,.025,1]]};
// Cache classification per immutable source-color buffer, not per animation frame.
const relayCache=new WeakMap();
export function colorRelayGroups(colors){
 if(relayCache.has(colors))return relayCache.get(colors);
 const srgb=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
 const labels=new Uint8Array(colors.length/3),used=new Set();
 for(let i=0;i<labels.length;i++){
  const r=srgb(colors[i*3]),g=srgb(colors[i*3+1]),b=srgb(colors[i*3+2]),max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
  let label=6;
  if(max>.03&&d/max>.18){let hue=max===r?(g-b)/d:max===g?(b-r)/d+2:(r-g)/d+4;hue=(hue+6)%6;label=Math.floor(hue+.5)%6;}
  labels[i]=label;used.add(label);
 }
 const palette=[...used].sort((a,b)=>a-b),groups=Uint8Array.from(labels,v=>palette.indexOf(v));
 const result={groups,count:palette.length};relayCache.set(colors,result);return result;
}
export function sampleColors(base,m,progress,tint,brightness,out,bounds,sourceColors=null){
 const {key,effect,t}=phaseAt(m,progress),active=key==='hold'&&isColorEffect(effect),palette=PALETTES[m.hold.palette||'cool'];
 const blend=active?Math.sin(Math.PI*t)**2:0;
 const relay=key==='hold'&&effect==='color-relay'&&sourceColors?colorRelayGroups(sourceColors):null;
 const relayEnvelope=smooth(t/.12)*smooth((1-t)/.12);
 for(let i=0;i<brightness.length;i++){
  const layer=effect==='color-layers'?Math.min(3,Math.floor((base[i*3+1]-bounds.min[1])/Math.max(bounds.size[1],1e-6)*4))/4:0;
  const phase=((t*m.hold.duration*.3+layer)%1)*palette.length,a=Math.floor(phase),b=(a+1)%palette.length,f=smooth(phase-a);
  let relayLight=1;
  if(relay?.count>1){const center=(relay.groups[i]+.5)/relay.count,weight=1-smooth(Math.abs(t-center)*relay.count);relayLight=1-relayEnvelope*(1-(.22+.78*weight));}
  for(let c=0;c<3;c++){const baseColor=sourceColors?sourceColors[i*3+c]:tint[c],color=active?palette[a][c]*(1-f)+palette[b][c]*f:baseColor;out[i*3+c]=(baseColor*(1-blend)+color*blend)*brightness[i]*relayLight;}
 }
}

export function scaleMotion(m,total){
 validateMotion(m);if(!Number.isFinite(total)||total<.1||total>60)throw new Error('总时长应在 0.1–60 秒之间');
 const ratio=total/totalDuration(m),next=Object.fromEntries(STAGES.map(k=>[k,{...m[k],duration:m[k].effect==='skip'?m[k].duration:m[k].duration*ratio}]));
 validateMotion(next);return next;
}
