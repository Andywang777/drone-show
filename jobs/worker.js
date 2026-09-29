import {generateConstrained} from '../geometry/generate.mjs';
import {analyzeSpacing} from '../geometry/spacing.mjs';
self.onmessage=({data})=>{try{
 const result=data.type==='analyze'?analyzeSpacing(data.positions,data.minimum):generateConstrained(data.input,p=>self.postMessage({type:'progress',progress:p}));
 const transfer=[];if(result.positions)transfer.push(result.positions.buffer);if(result.uv)transfer.push(result.uv.buffer);
 self.postMessage({type:'result',result},transfer);
}catch(error){self.postMessage({type:'error',message:error.message});}};
