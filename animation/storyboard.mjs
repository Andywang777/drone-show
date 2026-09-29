import {motionFor,totalDuration} from './motion.mjs';
export const MAX_SCENES=12;
// Connection policies are shared by validation, UI and playback. Add future modes here.
export const TRANSITIONS=Object.freeze({dark:{label:'熄灭换形',replaceEdges:false,dark:true},morph:{label:'连续变形',replaceEdges:true,dark:false}});
export const stageDuration=(m,key)=>m[key].effect==='skip'?0:m[key].duration;

export const scenesFor=p=>(p.storyboard||[]).filter(s=>p.formations.some(f=>f.id===s.formationId));
export function validateStoryboard(p){
 if(p.storyboard===undefined)return;
 if(!Array.isArray(p.storyboard)||p.storyboard.length>MAX_SCENES)throw new Error('最多支持 12 幕');
 const ids=new Set();for(const s of p.storyboard){if(typeof s.id!=='string'||ids.has(s.id)||!p.formations.some(f=>f.id===s.formationId))throw new Error('分镜引用无效');ids.add(s.id);if(!Object.hasOwn(TRANSITIONS,s.transition?.effect)||!Number.isFinite(s.transition.duration)||s.transition.duration<.2||s.transition.duration>30)throw new Error('转场时长应为 0.2–30 秒');}
}
export function sceneMotion(f,incoming=null,outgoing=null){const m=structuredClone(motionFor(f));if(TRANSITIONS[incoming]?.replaceEdges)m.enter.effect='skip';if(TRANSITIONS[outgoing]?.replaceEdges)m.exit.effect='skip';return m;}
export function sequence(p){const scenes=scenesFor(p),segments=[];let time=0;
 scenes.forEach((s,i)=>{const f=p.formations.find(f=>f.id===s.formationId),motion=sceneMotion(f,i?scenes[i-1].transition.effect:null,i<scenes.length-1?s.transition.effect:null),duration=totalDuration(motion);if(duration>0)segments.push({kind:'scene',scene:s,f,motion,index:i,start:time,duration});time+=duration;if(i<scenes.length-1){segments.push({kind:'transition',scene:s,f,to:p.formations.find(f=>f.id===scenes[i+1].formationId),index:i,start:time,duration:s.transition.duration});time+=s.transition.duration;}});return {segments,duration:time};}
export function segmentAt(plan,time){const s=plan.segments.find(s=>time<s.start+s.duration)||plan.segments.at(-1);return s?{...s,t:Math.max(0,Math.min(1,(time-s.start)/s.duration))}:null;}
export function connectionRange(segment){const preserve=!TRANSITIONS[segment.scene.transition.effect].replaceEdges;return {start:segment.start-(preserve?stageDuration(motionFor(segment.f),'exit'):0),end:segment.start+segment.duration+(preserve?stageDuration(motionFor(segment.to),'enter'):0)};}
// Deterministic spatial ordering supplies a bijection without all-pairs matching.
// Recursive longest-axis partition preserves locality; not collision-free flight planning.
export function matchPoints(a,b){const n=a.length/3;if(b.length!==a.length)throw new Error('各幕点数需一致，请先将素材总数调整一致');const mapping=new Uint32Array(n);
 function partition(ai,bi){if(ai.length<=1){if(ai.length)mapping[ai[0]]=bi[0];return;}let axis=0,best=-1;for(let k=0;k<3;k++){let lo=Infinity,hi=-Infinity;for(const i of ai){lo=Math.min(lo,a[i*3+k]);hi=Math.max(hi,a[i*3+k]);}if(hi-lo>best){best=hi-lo;axis=k;}}ai.sort((i,j)=>a[i*3+axis]-a[j*3+axis]||i-j);bi.sort((i,j)=>b[i*3+axis]-b[j*3+axis]||i-j);const mid=ai.length>>1;partition(ai.slice(0,mid),bi.slice(0,mid));partition(ai.slice(mid),bi.slice(mid));}
 partition(Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i));return mapping;}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function transitionFrame(a,b,ca,cb,map,t,effect,out,colors){const policy=TRANSITIONS[effect];if(!policy)throw new Error('不支持的转场方式');const move=ease(t),light=policy.dark?0:1;
 for(let i=0;i<map.length;i++)for(let k=0;k<3;k++){out[i*3+k]=a[i*3+k]*(1-move)+b[map[i]*3+k]*move;colors[i*3+k]=(ca[i*3+k]*(1-move)+cb[map[i]*3+k]*move)*light;}}

// Spare lanes are dark at their inactive endpoint, anchored to the active formation.
// No surplus lit points are left occupying the target outline.
export function prepareTransition(a,b,ca,cb){
 const count=Math.max(a.length,b.length)/3;if(!a.length||!b.length)throw new Error('分镜至少需要一个亮点');
 function pad(p,c){const positions=new Float32Array(count*3),colors=new Float32Array(count*3),n=p.length/3;positions.set(p);colors.set(c);for(let i=n;i<count;i++)positions.set(p.subarray((i%n)*3,(i%n)*3+3),i*3);return {positions,colors};}
 const from=pad(a,ca),to=pad(b,cb);return {a:from.positions,b:to.positions,ca:from.colors,cb:to.colors,map:matchPoints(from.positions,to.positions),out:new Float32Array(count*3),colors:new Float32Array(count*3)};
}
