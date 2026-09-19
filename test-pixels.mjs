import { PNG } from 'pngjs';
import fs from 'fs';
for (const f of ['shot-01-start.png','shot-02-world.png','shot-03-move.png','shot-04-bag.png','shot-05-craft.png','shot-06-pets.png','shot-07-map.png','shot-08-gather.png']) {
  if (!fs.existsSync(f)) { console.log(f, 'MISSING'); continue; }
  const png = PNG.sync.read(fs.readFileSync(f));
  const { width, height, data } = png;
  const colors = new Set();
  let nonBlack = 0, greenish = 0, bluish = 0, total = 0;
  for (let y = 0; y < height; y += 6) for (let x = 0; x < width; x += 6) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i+1], b = data[i+2];
    total++;
    if (r + g + b > 60) nonBlack++;
    if (g > r + 15 && g > b + 10) greenish++;
    if (b > r + 15 && b > g - 10) bluish++;
    colors.add((r>>5)+'_'+(g>>5)+'_'+(b>>5));
  }
  console.log(f, 'nonBlack=' + (nonBlack/total*100).toFixed(1) + '%', 'green=' + (greenish/total*100).toFixed(1) + '%', 'blue=' + (bluish/total*100).toFixed(1) + '%', 'buckets=' + colors.size);
}