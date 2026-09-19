import { PNG } from 'pngjs';
import fs from 'fs';
const png = PNG.sync.read(fs.readFileSync('shot-overview.png'));
const { width, height, data } = png;
let counts = {};
for (let y = 0; y < height; y += 3) for (let x = 0; x < width; x += 3) {
  const i = (y * width + x) * 4;
  const r = data[i], g = data[i+1], b = data[i+2];
  let k;
  if (g >= r && g >= b && g > 70 && g-r < 90) k='GREEN';
  else if (r>150&&g>130&&b<160&&r>=b+20) k='SAND/DESERT';
  else if (b>=r&&b>=g&&b>90) k='BLUE';
  else if (r+g+b<150) k='dark';
  else k='other';
  counts[k]=(counts[k]||0)+1;
}
const tot=Object.values(counts).reduce((a,b)=>a+b,0);
console.log(Object.entries(counts).map(([k,v])=>k+':'+(v/tot*100).toFixed(1)+'%').join('  '));