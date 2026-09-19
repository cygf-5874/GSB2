// ===== 通用工具 =====
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const dist3D = (a, b) => a.distanceTo(b);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// 加权随机
export function weightedPick(table) {
  let total = 0;
  for (const k in table) total += table[k];
  let r = Math.random() * total;
  for (const k in table) { r -= table[k]; if (r <= 0) return k; }
  return Object.keys(table)[0];
}

// 确定性伪随机
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 值噪声（2D，可平铺）
export function makeNoise2D(seed) {
  const rnd = mulberry32(seed);
  const size = 256, perm = new Float32Array(size);
  for (let i = 0; i < size; i++) perm[i] = rnd();
  const at = (ix, iz) => perm[((ix & (size - 1)) * 73 + (iz & (size - 1))) & (size - 1)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = smooth(x - ix), fz = smooth(z - iz);
    const a = at(ix, iz), b = at(ix + 1, iz), c = at(ix, iz + 1), d = at(ix + 1, iz + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
  };
}

// DOM
export const $ = (id) => document.getElementById(id);
export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// 屏幕消息
let toastTimers = [];
export function toast(msg, type = '') {
  const layer = $('toast-layer');
  const d = el('div', 'toast' + (type ? ' ' + type : ''), msg);
  layer.appendChild(d);
  setTimeout(() => d.remove(), 3100);
}

// 时间格式化（游戏内一天 240 秒）
export const DAY_LEN = 240;
export function gameClock(time) {
  const day = Math.floor(time / DAY_LEN) + 1;
  const hourF = ((time % DAY_LEN) / DAY_LEN) * 24 + 6; // 06:00 开始
  const h = Math.floor(hourF) % 24;
  const m = Math.floor((hourF % 1) * 60);
  return { day, h, m, phase: hourF % 24 };
}
export const pad2 = (n) => String(n).padStart(2, '0');

// 简单模板字符串替换（图标+名）
export function itemLabel(id) {
  // 延迟引用避免循环
  return id;
}