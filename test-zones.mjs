import { PNG } from 'pngjs';
import fs from 'fs';
function zones(f) {
  const png = PNG.sync.read(fs.readFileSync(f));
  const { width, height, data } = png;
  const out = [];
  for (const [name, cx, cy] of [['TL',.2,.2],['TR',.8,.2],['C',.5,.5],['BL',.2,.8],['BR',.8,.8]]) {
    let r=0,g=0,b=0,n=0;
    for (let dy=-10;dy<=10;dy+=4) for(let dx=-10;dx<=10;dx+=4){
      const i=(((height*cy+dy)|0)*width+((width*cx+dx)|0))*4;
      r+=data[i];g+=data[i+1];b+=data[i+2];n++;
    }
    out.push(name+':' + (r/n|0)+','+(g/n|0)+','+(b/n|0));
  }
  return out.join('  ');
}
for (const f of ['shot-02-world.png','shot-03-move.png','shot-08-gather.png']) console.log(f, '\n ', zones(f));