import { PNG } from 'pngjs';
import fs from 'fs';
const png = PNG.sync.read(fs.readFileSync('shot-overview.png'));
const { width, height, data } = png;
// 俯拍：世界 -40..80 映射到屏幕；x 向右，相机 up=-z 所以 z 向下
function worldPx(wx, wz) {
  // 相机在 (0,130,-0.01) lookAt origin, up=(0,0,-1) → 屏幕右=+x，屏幕下=+z
  const px = (wx + 40) / 80 * width;
  const py = (wz + 40) / 80 * height;
  return [px|0, py|0];
}
const sectors = [['snow',-20,-20],['plains',20,-20],['jungle',-20,20],['beach',20,20],['desert',-20,60],['ocean',20,60]];
for (const [name,wx,wz] of sectors) {
  const [x,y] = worldPx(wx,wz);
  const cols = [];
  for (let dy=-30;dy<=30;dy+=15) for (let dx=-30;dx<=30;dx+=15) {
    const i=((y+dy)*width+(x+dx))*4;
    cols.push([data[i],data[i+1],data[i+2]]);
  }
  const avg = cols.reduce((a,c)=>[a[0]+c[0],a[1]+c[1],a[2]+c[2]],[0,0,0]).map(v=>v/cols.length|0);
  console.log(name.padEnd(8), 'rgb('+avg.join(',')+')');
}