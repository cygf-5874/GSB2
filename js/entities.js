// ===== 野生动物：体素模型、AI（游荡/逃跑/追击）、击晕驯服流程 =====
import * as THREE from '../lib/three.module.js';
import { ANIMALS } from './config.js';
import { heightAt, isOcean, world as W } from './world.js';
import { rand, randInt, clamp } from './utils.js';

const GEO = new THREE.BoxGeometry(1, 1, 1);
const cache = {};
function mat(c, e = 0) {
  const k = c + ':' + e;
  if (!cache[k]) cache[k] = new THREE.MeshLambertMaterial({ color: c, emissive: e });
  return cache[k]; }
function b(parent, m, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(GEO, m);
  mesh.scale.set(sx, sy, sz); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}

// 每种动物一个小模型
function buildMesh(kind) {
  const g = new THREE.Group();
  const white = mat(0xf2ede2), black = mat(0x2a2a2a), pink = mat(0xff9ab0);
  if (kind === 'rabbit') {
    b(g, white, 0, 0.45, 0, 0.7, 0.55, 0.9);
    b(g, white, 0, 0.62, -0.5, 0.5, 0.5, 0.4);
    b(g, white, -0.12, 1.05, -0.5, 0.12, 0.5, 0.12);
    b(g, white, 0.12, 1.05, -0.5, 0.12, 0.5, 0.12);
    b(g, pink, 0, 0.55, -0.72, 0.18, 0.12, 0.06);
  } else if (kind === 'sheep') {
    b(g, mat(0xe8e2d2), 0, 0.7, 0, 1.1, 0.8, 1.5);
    b(g, mat(0x4a4038), 0, 0.75, -0.85, 0.55, 0.55, 0.4);
    for (const [x, z] of [[-.4,-.5],[.4,-.5],[-.4,.5],[.4,.5]]) b(g, mat(0x4a4038), x, 0.2, z, 0.22, 0.4, 0.22);
  } else if (kind === 'chicken') {
    b(g, white, 0, 0.45, 0, 0.55, 0.5, 0.7);
    b(g, white, 0, 0.6, -0.4, 0.35, 0.4, 0.3);
    b(g, mat(0xff5a3c), 0, 0.52, -0.62, 0.12, 0.1, 0.12);
    b(g, mat(0xff5a3c), 0, 0.12, -0.1, 0.1, 0.24, 0.1);
    b(g, mat(0xff5a3c), 0, 0.12, 0.15, 0.1, 0.24, 0.1);
  } else if (kind === 'pig') {
    b(g, mat(0xd99a82), 0, 0.6, 0, 1, 0.75, 1.5);
    b(g, mat(0xd99a82), 0, 0.65, -0.85, 0.6, 0.6, 0.45);
    b(g, pink, 0, 0.6, -1.12, 0.3, 0.2, 0.1);
  } else if (kind === 'wolf') {
    b(g, mat(0x8a8f98), 0, 0.7, 0, 0.8, 0.7, 1.4);
    b(g, mat(0x747a84), 0, 0.85, -0.8, 0.55, 0.55, 0.5);
    b(g, mat(0x3a3f46), 0, 0.7, -1.1, 0.3, 0.2, 0.18);
    for (const [x, z] of [[-.3,-.5],[.3,-.5],[-.3,.5],[.3,.5]]) b(g, mat(0x6a6f78), x, 0.25, z, 0.2, 0.5, 0.2);
    b(g, mat(0x8a8f98), 0, 1, 0.7, 0.12, 0.4, 0.12);
  } else if (kind === 'leopard') {
    b(g, mat(0xe0b050), 0, 0.7, 0, 0.8, 0.7, 1.5);
    b(g, mat(0xc89038), 0, 0.85, -0.85, 0.55, 0.55, 0.5);
    for (let i = 0; i < 6; i++) b(g, black, rand(-.3, .3), 0.95, rand(-.5, .5), 0.12, 0.12, 0.12);
    for (const [x, z] of [[-.3,-.5],[.3,-.5],[-.3,.5],[.3,.5]]) b(g, mat(0xc89038), x, 0.25, z, 0.2, 0.5, 0.2);
  } else if (kind === 'parrot') {
    b(g, mat(0x3aa0e0), 0, 0.55, 0, 0.5, 0.55, 0.6);
    b(g, mat(0xf5c02b), 0, 0.55, 0, 0.52, 0.3, 0.5);
    b(g, mat(0xe04b5a), 0, 0.62, -0.4, 0.35, 0.35, 0.3);
    b(g, mat(0xffb02b), 0, 0.58, -0.6, 0.12, 0.08, 0.12);
  } else if (kind === 'crab') {
    b(g, mat(0xe0503a), 0, 0.35, 0, 0.9, 0.4, 0.8);
    b(g, mat(0xe0503a), -0.55, 0.4, 0, 0.25, 0.18, 0.18);
    b(g, mat(0xe0503a), 0.55, 0.4, 0, 0.25, 0.18, 0.18);
    for (let i = -1; i <= 1; i++) { b(g, mat(0xc03828), -0.3, 0.15, i * 0.28, 0.3, 0.1, 0.1); b(g, mat(0xc03828), 0.3, 0.15, i * 0.28, 0.3, 0.1, 0.1); }
  } else if (kind === 'turtle') {
    b(g, mat(0x4a7a48), 0, 0.45, 0, 1.1, 0.5, 1.3);
    b(g, mat(0x6aa05f), 0, 0.62, -0.05, 0.95, 0.25, 1.1);
    b(g, mat(0x8ec47e), 0, 0.5, -0.78, 0.35, 0.3, 0.3);
  } else if (kind === 'jelly') {
    const jb = b(g, new THREE.MeshLambertMaterial({ color: 0xff8fc8, transparent: true, opacity: 0.75 }), 0, 0.7, 0, 0.9, 0.8, 0.9);
    for (let i = 0; i < 6; i++) b(g, mat(0xffb8dc), Math.cos(i) * 0.3, 0.2, Math.sin(i) * 0.3, 0.08, 0.6, 0.08);
  } else if (kind === 'octopus') {
    b(g, mat(0xc0507a), 0, 0.8, 0, 0.9, 0.9, 0.9);
    for (let i = 0; i < 6; i++) b(g, mat(0xa04068), Math.cos(i * 1.05) * 0.35, 0.3, Math.sin(i * 1.05) * 0.35, 0.16, 0.7, 0.16);
  } else if (kind === 'horsespirit') {
    b(g, mat(0xf0e8ff), 0, 1.1, 0, 0.8, 0.9, 1.7);
    b(g, mat(0xf0e8ff), 0, 1.35, -1, 0.55, 0.7, 0.5);
    b(g, mat(0x9a6bff), 0.2, 1.6, -0.9, 0.1, 0.35, 0.1);
    for (const [x, z] of [[-.3,-.6],[.3,-.6],[-.3,.6],[.3,.6]]) b(g, mat(0xe0d0ff), x, 0.4, z, 0.22, 0.8, 0.22);
    b(g, mat(0x9a6bff, 0x3a1a88), 0, 1.45, 0.8, 0.16, 0.5, 0.16);
  }
  return g;
}
// ===== 实体管理 =====
export const mobs = [];
let mobUid = 1;
const HALF = 40;

export function spawnAnimals(scene) {
  const perBiome = 5;
  for (let gx = 0; gx < 2; gx++) {
    for (let gy = 0; gy < 3; gy++) {
      const biomeKey = gx === 0 ? ['snow', 'jungle', 'desert'][gy] : ['plains', 'beach', 'ocean'][gy];
      const kinds = Object.keys(ANIMALS).filter(k => {
        const a = ANIMALS[k];
        return a.biomes.includes(biomeKey) && !a.fromEgg;
      });
      for (let i = 0; i < perBiome; i++) {
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (!kind) continue;
        const x = -HALF + gx * 40 + rand(3, 37);
        const z = -HALF + gy * 40 + rand(3, 37);
        spawnMob(scene, kind, x, z);
      }
    }
  }
}

export function spawnMob(scene, kind, x, z, tamedData = null) {
  const def = ANIMALS[kind];
  const y = heightAt(x, z) + 1;
  const mesh = buildMesh(kind);
  mesh.position.set(x, y, z);
  if (def.fly) mesh.position.y += 4;
  scene.add(mesh);
  const m = {
    uid: 'm' + (mobUid++), kind, def, mesh,
    hp: def.hp,
    state: 'idle',          // idle / flee / chase / stunned
    target: null,
    wait: rand(1, 3),
    wanderDir: rand(0, Math.PI * 2),
    stunUntil: 0,
    affinity: 0, tameReady: false,
    pet: !!tamedData,
    data: tamedData || null,
    bobT: rand(0, 10),
    attackCd: 0,
  };
  mobs.push(m);
  return m;
}

export function nearestMob(pos, range = 2.8) {
  let best = null, bd = range;
  for (const m of mobs) {
    if (m.pet || m.state === 'dead') continue;
    const d = Math.hypot(m.mesh.position.x - pos.x, m.mesh.position.z - pos.z);
    if (d < bd && Math.abs(m.mesh.position.y - pos.y) < 3.5) { bd = d; best = m; }
  }
  return best;
}

// 攻击野兽（rod 击晕）
export function hurtMob(m, dmg, stun, now) {
  if (m.state === 'dead') return null;
  m.hp -= dmg;
  if (stun && m.hp > 0) {
    m.state = 'stunned';
    m.stunUntil = now + 5;
    return 'stun';
  }
  if (m.hp <= 0) {
    m.state = 'dead';
    return 'dead';
  }
  if (m.def.flee) m.state = 'flee';
  else if (m.def.hostile || m.def.charge) m.state = 'chase';
  else m.state = 'flee';
  return 'hit';
}

// 投喂
export function feedMob(m, foodId) {
  if (foodId !== m.def.food) return 'wrong';
  if (m.state !== 'stunned') return 'awake';
  m.affinity += 45;
  if (m.affinity >= 100) { m.affinity = 100; m.tameReady = true; return 'ready'; }
  return 'like';
}

export function removeMob(m, scene) {
  scene.remove(m.mesh);
  const i = mobs.indexOf(m);
  if (i >= 0) mobs.splice(i, 1);
}

// ===== AI 更新 =====
export function updateMobs(dt, now, playerPos, scene, onAttackPlayer) {
  for (const m of mobs) {
    if (m.state === 'dead') continue;
    const pos = m.mesh.position;
    const dPlayer = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);
    m.attackCd = Math.max(0, m.attackCd - dt);

    if (m.state === 'stunned') {
      // 星星旋转
      m.mesh.rotation.z = Math.sin(now * 6) * 0.12;
      if (now >= m.stunUntil) { m.state = 'idle'; m.mesh.rotation.z = 0; }
      continue;
    }
    m.mesh.rotation.z = 0;

    let dir = null, speed = 0;

    if (m.state === 'chase' && dPlayer < 16) {
      dir = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      speed = m.def.speed;
      if (dPlayer < 1.6 && m.attackCd <= 0) {
        m.attackCd = 1.2;
        onAttackPlayer(m.def.dmg);
      }
      if (dPlayer > 18) m.state = 'idle';
    } else if (m.state === 'flee' && dPlayer < 12) {
      dir = Math.atan2(pos.x - playerPos.x, pos.z - playerPos.z);
      speed = m.def.speed * 1.15;
      if (dPlayer > 14) m.state = 'idle';
    } else {
      m.wait -= dt;
      if (m.wait <= 0) { m.wait = rand(1.5, 4.5); m.wanderDir = rand(0, Math.PI * 2); }
      if (m.def.hostile && !m.pet && dPlayer < 10) m.state = 'chase';
      dir = m.wanderDir;
      speed = m.def.speed * 0.35;
    }

    if (dir !== null && speed > 0) {
      pos.x += Math.sin(dir) * speed * dt;
      pos.z += Math.cos(dir) * speed * dt;
      m.mesh.rotation.y = dir;
    }

    // 贴地 / 水中 / 飞行
    const ocean = isOcean(pos.x, pos.z);
    if (m.def.fly) {
      pos.y = heightAt(pos.x, pos.z) + 5 + Math.sin(now * 1.5 + m.uid.length) * 0.5;
    } else if (ocean && m.def.swims) {
      pos.y = W.waterY - 1.5 + Math.sin(now + m.bobT) * 0.3;
    } else if (ocean && !m.def.swims) {
      // 不会水的动物尝试离开海
      pos.x += Math.sign(20 - pos.x) * dt;
      pos.z += Math.sin(now + m.bobT) * 0.05;
      pos.y = W.waterY - 0.2;
    } else {
      const gy = heightAt(pos.x, pos.z) + 1;
      pos.y += (gy - pos.y) * Math.min(1, dt * 8);
    }
    pos.x = clamp(pos.x, -HALF + 1, HALF - 1);
    pos.z = clamp(pos.z, -HALF + 1, HALF - 1);
    m.bobT += dt * (m.def.swims || m.def.fly ? 4 : 0);
  }
}