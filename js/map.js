// ===== 小地图 & 大地图 =====
import { BIOMES, WORLD } from './config.js';
import { state } from './state.js';
import { world } from './world.js';
import { $ } from './utils.js';

const COLORS = {
  plains: '#7db454', jungle: '#4c9442', desert: '#e8c884',
  beach: '#f0dfa8', snow: '#f4faff', ocean: '#2f9fd0',
};

export function drawMap(canvas, big) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const cell = W / 3; // 3 行 × 2 列 → 按 sector 3 高 2 宽
  const cw = W / 2, ch = H / 3;
  for (const b of BIOMES) {
    ctx.fillStyle = COLORS[b.key];
    ctx.fillRect(b.gx * cw, b.gy * ch, cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.font = (big ? '16px' : '0px') + ' sans-serif';
    if (big) ctx.fillText(b.name, b.gx * cw + 10, b.gy * ch + 22);
  }
  // 工作台 / 营火
  const dot = (wx, wz, color, r) => {
    const px = (wx + WORLD.half) / (WORLD.half * 2) * W;
    const py = (wz + WORLD.half) / (WORLD.half * 2) * H;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const p of world.benches) dot(p.x, p.z, '#c87a3a', big ? 5 : 3);
  for (const p of world.fires) dot(p.x, p.z, '#ff7a3c', big ? 5 : 3);

  // 玩家箭头
  dot(state.pos.x, state.pos.z, '#ffffff', big ? 6 : 4);
  ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc((state.pos.x + WORLD.half) / 80 * W, (state.pos.z + WORLD.half) / 80 * H, big ? 6 : 4, 0, Math.PI * 2); ctx.stroke();

  if (big) {
    const lg = $('biome-legend');
    lg.innerHTML = BIOMES.map(b => '<span><i class="lg-dot" style="background:' + COLORS[b.key] + '"></i>' + b.name + '</span>').join('') +
      '<span><i class="lg-dot" style="background:#ff7a3c"></i>营地</span><span><i class="lg-dot" style="background:#fff"></i>你</span>';
  }
}