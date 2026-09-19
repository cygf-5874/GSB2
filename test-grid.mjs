import { PNG } from 'pngjs';
import fs from 'fs';
const png = PNG.sync.read(fs.readFileSync('shot-overview.png'));
const { width, height, data } = png;
// 打印 12x8 网格平均色（hex）
for (let gy = 0; gy < 8; gy++) {
  const row = [];
  for (let gx = 0; gx < 12; gx++) {
    let r=0,g=0,b=0,n=0;
    for (let dy=0;dy<10;dy+=5) for(let dx=0;dx<10;dx+=5){
      const x=Math.min(width-1,(gx/12*width+dx*4)|0), y=Math.min(height-1,(gy/8*height+dy*4)|0);
      const i=(y*width+x)*4; r+=data[i];g+=data[i+1];b+=data[i+2];n++;
    }
    const hx = v => v.toString(16).padStart(2,'0');
    row.push('#'+hx(r/n|0)+hx(g/n|0)+hx(b/n|0));
  }
  console.log(row.join(' '));
}