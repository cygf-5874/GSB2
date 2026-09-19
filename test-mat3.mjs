import { PNG } from 'pngjs';
import fs from 'fs';
const png = PNG.sync.read(fs.readFileSync('shot-mat.png'));
const { width, height, data } = png;
const buckets = {};
for (let y=0;y<height;y+=2) for (let x=0;x<width;x+=2) {
  const i=(y*width+x)*4; const r=data[i],g=data[i+1],b=data[i+2];
  if (Math.abs(r-34)<12 && Math.abs(g-34)<12 && Math.abs(b-34)<12) continue;
  const k = (r>>5)+','+(g>>5)+','+(b>>5);
  buckets[k] = (buckets[k]||0)+1;
}
console.log(Object.entries(buckets).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>'rgb('+k.split(',').map(x=>(x*32+16)).join(',')+') x'+v).join('\n'));