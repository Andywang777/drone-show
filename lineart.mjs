import { SPAN, CENTER_Y, seededRandom } from './formation.mjs';

// Sample ink pixels, excluding transparent paper. Keep the drawing in the XY plane.
export function readInk({data,width,height}, threshold=160, mode='dark') {
  const pixels=[];
  let minX=width,minY=height,maxX=-1,maxY=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    const light=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];
    if(data[i+3]<128||(mode==='dark'?light>=threshold:light<=threshold))continue;
    pixels.push(x,y);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  }
  if(!pixels.length)throw new Error('没有识别到线条，请调整识别阈值或切换线条颜色。');
  if(pixels.length/2>width*height*.9)throw new Error('识别区域几乎覆盖整张图片，请切换黑/白线条或调整阈值。');
  return {pixels:new Uint16Array(pixels),minX,maxX,minY,maxY};
}
export function sampleInk(ink,count){
  const {pixels,minX,maxX,minY,maxY}=ink,random=seededRandom();
  const scale=SPAN/Math.max(maxX-minX+1,maxY-minY+1),out=new Float32Array(count*3),n=pixels.length/2;
  for(let i=0;i<count;i++){
    const index=Math.min(n-1,Math.floor((i+random())/count*n))*2;
    out[i*3]=(pixels[index]-(minX+maxX)/2+(random()-.5))*scale;
    out[i*3+1]=CENTER_Y-(pixels[index+1]-(minY+maxY)/2+(random()-.5))*scale;
  }
  return out;
}
export async function decodeLineArt(file,maxSide=1024){
  if(!/\.(png|jpe?g|webp)$/i.test(file.name)||file.size>20*1024*1024)throw new Error('请选择 20 MB 以内的 PNG、JPG 或 WebP 线稿。');
  const url=URL.createObjectURL(file);
  try{
    const image=new Image();image.src=url;
    try{await image.decode();}catch{throw new Error('无法读取线稿图片，请检查文件是否有效。');}
    if(image.width*image.height>40000000)throw new Error('图片尺寸过大，请缩小到 4,000 万像素以内。');
    const scale=Math.min(1,maxSide/Math.max(image.width,image.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
    const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,canvas.width,canvas.height);
    return context.getImageData(0,0,canvas.width,canvas.height);
  }finally{URL.revokeObjectURL(url);}
}
