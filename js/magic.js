// ===== 法杖绘阵：鼠标/触摸画图案，识别形状释放法术 =====
import * as THREE from '../lib/three.module.js';
import { mobs } from './entities.js';
import { player } from './player.js';
import { state, selectedItem } from './state.js';
import { toast, $ } from './utils.js';

const SPELLS = {
  circle:   { name: '炽焰火球', icon: '🔥', color: '#ff7a3c', cost: 18, desc: '发射火球，造成 40 点范围伤害' },
  triangle: { name: '寒霜新星', icon: '❄️', color: '#7fd8ff', cost: 14, desc: '冰冻周围敌人并造成 22 点伤害' },
  wave:     { name: '生命涌动', icon: '💚', color: '#7bff9a', cost: 12, desc: '回复 35 点生命' },
  cross:    { name: '连环闪电', icon: '⚡', color: '#ffe85c', cost: 20, desc: '随机劈中附近 3 个敌人，各 30 伤害' },
};

let overlay, canvas, ctx, drawing = false, pts = [];
let sceneRef, cameraRef, projectiles = [], effects = [];

export function initMagic(scene, camera) {
  sceneRef = scene; cameraRef = camera;
  overlay = $('magic-overlay'); canvas = $('magic-canvas'); ctx = canvas.getContext('2d');

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * canvas.width / r.width, y: (t.clientY - r.top) * canvas.height / r.height };
  };
  const start = (e) => { e.preventDefault(); drawing = true; pts = [pos(e)]; };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = pos(e), last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > 3) { pts.push(p); redraw(); }
  };
  const end = () => { drawing = false; };
  canvas.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  $('magic-cast').addEventListener('click', castDrawn);
  $('magic-cancel').addEventListener('click', closeMagic);
}

export function openMagic() {
  const sel = selectedItem();
  if (!sel || !sel || !ITEMS_MAGIC(sel)) { toast('需要先在快捷栏装备魔法杖 🪄', 'bad'); return; }
  overlay.classList.remove('hidden');
  pts = []; redraw();
}
function ITEMS_MAGIC(slot) {
  // 延迟引用
  return slot && slot.id === 'wand';
}
export function closeMagic() { overlay.classList.add('hidden'); }

function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (pts.length < 2) return;
  ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#b98bff';
  ctx.shadowColor = '#9a6bff'; ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

// ===== 形状识别 =====
function recognize() {
  if (pts.length < 8) return null;
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, pathLen = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    if (i > 0) pathLen += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
  }
  const w = maxX - minX, h = maxY - minY;
  const diag = Math.hypot(w, h) || 1;
  const closed = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) / diag;
  const fillRatio = pathLen / diag;

  // 方向反转次数（用于波浪 vs 折线）
  let turnsX = 0, turnsY = 0;
  let dxPrev = 0, dyPrev = 0;
  for (let i = 2; i < pts.length; i++) {
    const dx = Math.sign(pts[i].x - pts[i - 1].x), dy = Math.sign(pts[i].y - pts[i - 1].y);
    if (dx && dxPrev && dx !== dxPrev) turnsX++;
    if (dy && dyPrev && dy !== dyPrev) turnsY++;
    if (dx) dxPrev = dx; if (dy) dyPrev = dy;
  }

  // 圆：闭合 + 接近正方形 + 周长比
  if (closed < 0.35 && Math.min(w, h) / Math.max(w, h) > 0.55 && fillRatio > 2.6) return 'circle';
  // 叉：两条来回斜扫，水平方向反转 1 次且垂直反转 1~2 次，且非闭合
  if (closed > 0.45 && turnsX >= 1 && turnsY >= 1 && fillRatio < 2.8) return 'cross';
  // 三角：闭合、尖峰数 2~3
  if (closed < 0.4 && turnsY >= 2) return 'triangle';
  // 波浪：横向延展 + 多次方向反转
  if (w > h * 1.2 && turnsX <= 1 && turnsY >= 2) return 'wave';
  return null;
}
function castDrawn() {
  const shape = recognize();
  if (!shape) { toast('图案无法辨认，再试一次（○ △ 〰 ✕）', 'bad'); pts = []; redraw(); return; }
  const spell = SPELLS[shape];
  if (state.energy < spell.cost) { toast('能量不足，休息一下再施法', 'bad'); return; }
  state.energy -= spell.cost;
  toast(spell.icon + ' ' + spell.name + '！', 'rare');
  closeMagic();

  if (shape === 'wave') {
    state.hp = Math.min(100, state.hp + 35);
    addEffect(new THREE.Vector3(player.group.position.x, player.group.position.y + 1.5, player.group.position.z), 0x7bff9a, 'heal');
    return;
  }
  if (shape === 'triangle') {
    const c = player.group.position;
    for (const m of mobs) {
      if (m.pet || m.state === 'dead') continue;
      const d = Math.hypot(m.mesh.position.x - c.x, m.mesh.position.z - c.z);
      if (d < 8) { m.hp -= 22; m.stunUntil = performance.now() / 1000 + 2.5; if (m.hp > 0) m.state = 'stunned'; }
    }
    addEffect(c.clone(), 0x7fd8ff, 'nova');
    return;
  }
  if (shape === 'cross') {
    const c = player.group.position;
    const targets = mobs.filter(m => !m.pet && m.state !== 'dead' && Math.hypot(m.mesh.position.x - c.x, m.mesh.position.z - c.z) < 14).slice(0, 3);
    for (const m of targets) {
      m.hp -= 30;
      addEffect(m.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xffe85c, 'bolt');
      if (m.hp <= 0) m.state = 'dead';
    }
    if (!targets.length) toast('闪电落空了……附近没有目标', 'bad');
    return;
  }
  if (shape === 'circle') {
    const dir = new THREE.Vector3(Math.sin(player.yaw), -0.08, Math.cos(player.yaw));
    const geo = new THREE.MeshLambertMaterial({ color: 0xff7a3c, emissive: 0xff4000 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), geo);
    const start = player.group.position.clone().add(new THREE.Vector3(0, 1.6, 0)).add(dir.clone().multiplyScalar(1));
    ball.position.copy(start);
    sceneRef.add(ball);
    const light = new THREE.PointLight(0xff7a3c, 1.6, 8);
    ball.add(light);
    projectiles.push({ mesh: ball, dir, life: 2.5 });
  }
}

function addEffect(pos, color, kind) {
  if (kind === 'heal') {
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshBasicMaterial({ color }));
      s.position.copy(pos);
      s.userData = { kind: 'rise', t: 0, vel: new THREE.Vector3((Math.random() - .5) * 1, 2 + Math.random(), (Math.random() - .5) * 1) };
      sceneRef.add(s); effects.push(s);
    }
  } else if (kind === 'nova') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    ring.position.set(pos.x, pos.y + 0.3, pos.z);
    ring.rotation.x = Math.PI / 2;
    ring.userData = { kind: 'ring', t: 0 };
    sceneRef.add(ring); effects.push(ring);
  } else if (kind === 'bolt') {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2, 0.3),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    s.position.copy(pos);
    s.userData = { kind: 'bolt', t: 0 };
    sceneRef.add(s); effects.push(s);
  } else if (kind === 'boom') {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.95 }));
    s.position.copy(pos);
    s.userData = { kind: 'boom', t: 0 };
    sceneRef.add(s); effects.push(s);
  }
}

export function updateMagic(dt) {
  // 火球飞行
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.mesh.position.addScaledVector(p.dir, 14 * dt);
    p.life -= dt;
    let hit = false;
    for (const m of mobs) {
      if (m.pet || m.state === 'dead') continue;
      if (p.mesh.position.distanceTo(m.mesh.position.clone().add(new THREE.Vector3(0, 0.8, 0))) < 1.4) {
        m.hp -= 40;
        if (m.hp <= 0) m.state = 'dead';
        hit = true; break;
      }
    }
    if (hit || p.life <= 0) {
      addEffect(p.mesh.position.clone(), 0xff7a3c, 'boom');
      // 溅射
      if (hit) for (const m of mobs) {
        if (m.pet || m.state === 'dead') continue;
        if (p.mesh.position.distanceTo(m.mesh.position) < 3.5) m.hp -= 12;
      }
      sceneRef.remove(p.mesh);
      projectiles.splice(i, 1);
    }
  }
  // 特效生命周期
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i], u = e.userData; u.t += dt;
    if (u.kind === 'rise') {
      e.position.addScaledVector(u.vel, dt);
      e.material.opacity = 1 - u.t;
    } else if (u.kind === 'ring') {
      e.scale.setScalar(1 + u.t * 9);
      e.material.opacity = 0.9 * (1 - u.t / 0.6);
    } else if (u.kind === 'bolt' || u.kind === 'boom') {
      e.scale.setScalar(1 + u.t * 6);
      e.material.opacity = 1 - u.t;
    }
    if (u.t > 0.7) { sceneRef.remove(e); effects.splice(i, 1); }
  }
}