// ===== 玩家角色（体素小人）+ 第三人称相机 + 移动/物理 =====
import * as THREE from '../lib/three.module.js';
import { ITEMS } from './config.js';
import { clamp, lerp } from './utils.js';
import { heightAt, world, isOcean, world as W } from './world.js';
import { state } from './state.js';

const M = {
  skin: new THREE.MeshLambertMaterial({ color: 0xf0c090 }),
  shirt: new THREE.MeshLambertMaterial({ color: 0x3f7ac4 }),
  pants: new THREE.MeshLambertMaterial({ color: 0x38424e }),
  hair: new THREE.MeshLambertMaterial({ color: 0x4a2f1a }),
  boot: new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
};
const GEO = new THREE.BoxGeometry(1, 1, 1);

function box(parent, m, x, y, z, sx, sy, sz) {
  const mesh = new THREE.Mesh(GEO, m);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export const player = {
  group: null, parts: {},
  vel: new THREE.Vector3(),
  yaw: 0, pitch: -0.25,
  onGround: false,
  crouch: false,
  moving: false, running: false,
  swim: false,
  attackT: 0, gatherT: 0,
  held: null,
  camDist: 7,

  build(scene) {
    const g = new THREE.Group();
    // 腿
    const legL = new THREE.Group(); legL.position.set(-0.22, 0.75, 0);
    box(legL, M.pants, 0, -0.32, 0, 0.34, 0.62, 0.38);
    box(legL, M.boot, 0, -0.68, 0.04, 0.36, 0.18, 0.46);
    const legR = legL.clone(); legR.position.x = 0.22;
    // 躯干
    box(g, M.shirt, 0, 1.35, 0, 0.85, 0.85, 0.5);
    // 手臂
    const armL = new THREE.Group(); armL.position.set(-0.56, 1.68, 0);
    box(armL, M.shirt, 0, -0.18, 0, 0.28, 0.3, 0.32);
    box(armL, M.skin, 0, -0.55, 0, 0.26, 0.42, 0.3);
    const armR = armL.clone(); armR.position.x = 0.56;
    // 头
    const head = new THREE.Group(); head.position.set(0, 2.12, 0);
    box(head, M.skin, 0, 0, 0, 0.62, 0.6, 0.6);
    box(head, M.hair, 0, 0.26, -0.04, 0.66, 0.2, 0.64);
    box(head, M.boot, 0.09, 0.04, -0.31, 0.09, 0.09, 0.04);
    box(head, M.boot, -0.09, 0.04, -0.31, 0.09, 0.09, 0.04);

    g.add(legL, legR, armL, armR, head);
    g.userData.legs = [legL, legR];
    g.userData.arms = [armL, armR];
    g.userData.head = head;
    this.group = g;
    this.parts = { legL, legR, armL, armR, head };
    scene.add(g);
  },

  placeSpawn(p) {
    this.group.position.copy(p);
    state.pos.x = p.x; state.pos.y = p.y; state.pos.z = p.z;
  },
};
// ===== 手持物（挂在右手）=====
const toolMats = {};
function tMat(color, emissive = 0) {
  const key = color + ':' + emissive;
  if (!toolMats[key]) toolMats[key] = new THREE.MeshLambertMaterial({ color, emissive });
  return toolMats[key];
}
export function refreshHeld(item) {
  const arm = player.parts.armR;
  if (player.held) { arm.remove(player.held); player.held = null; }
  if (!item) return;
  const def = ITEMS[item.id];
  const h = new THREE.Group();
  const wood = tMat(0x8a5a32), stone = tMat(0x90909a), iron = tMat(0xc8ccd4), glow = tMat(0x8a6bff, 0x3a1a88);
  if (def.type === 'tool' && def.toolKind === 'axe') {
    box(h, wood, 0, -0.3, 0.12, 0.1, 0.7, 0.1);
    box(h, def.tier >= 2 ? iron : stone, 0, -0.02, 0.12, 0.34, 0.22, 0.12);
  } else if (def.type === 'tool' && def.toolKind === 'pick') {
    box(h, wood, 0, -0.3, 0.12, 0.1, 0.7, 0.1);
    box(h, def.tier >= 3 ? glow : (def.tier >= 2 ? iron : stone), 0, 0.06, 0.12, 0.5, 0.12, 0.12);
  } else if (def.magic) {
    box(h, wood, 0, -0.3, 0.12, 0.09, 0.6, 0.09);
    box(h, glow, 0, 0.08, 0.12, 0.16, 0.22, 0.16);
  } else if (def.stun) {
    box(h, wood, 0, -0.35, 0.12, 0.14, 0.9, 0.14);
  } else if (def.type === 'weapon') {
    box(h, wood, 0, -0.28, 0.12, 0.1, 0.3, 0.1);
    box(h, iron, 0, 0.08, 0.12, 0.12, 0.55, 0.06);
  } else {
    box(h, tMat(0xd8c89a), 0, -0.2, 0.12, 0.26, 0.34, 0.26);
  }
  arm.add(h);
  player.held = h;
}

// ===== 每帧更新 =====
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();

export function updatePlayer(dt, input, camera) {
  const p = player.group;
  const pos = p.position;

  // 朝向：模型随相机偏航
  p.rotation.y = player.yaw + Math.PI;

  // 相机方向（水平）
  const fwd = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(fwd.z, 0, -fwd.x);

  // 水深判定
  const groundY = heightAt(pos.x, pos.z) + 1;
  const ocean = isOcean(pos.x, pos.z);
  player.swim = ocean && pos.y < W.waterY - 0.2;

  // 移动输入
  let mx = 0, mz = 0;
  if (input.forward) mz += 1;
  if (input.back) mz -= 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.joyX !== 0 || input.joyY !== 0) { mx += input.joyX; mz += input.joyY; }
  const mag = Math.hypot(mx, mz);
  if (mag > 1) { mx /= mag; mz /= mag; }
  player.moving = mag > 0.05;
  player.running = input.run && player.moving && !player.crouch;

  const baseSpeed = player.swim ? 3.2 : (player.crouch ? 2.0 : (player.running ? 7.2 : 4.4));
  const speed = baseSpeed * (state.energy <= 0 ? 0.25 : 1);
  const move = new THREE.Vector3();
  move.addScaledVector(fwd, mz).addScaledVector(right, mx);
  if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed);

  if (player.swim) {
    pos.x += move.x * dt; pos.z += move.z * dt;
    pos.y += (W.waterY - 1.2 - pos.y) * Math.min(1, dt * 3) + (input.jump ? 2.2 : 0) * dt - (input.crouchHold ? 1.6 : 0) * dt;
    pos.y = Math.max(groundY, Math.min(W.waterY + 0.2, pos.y));
    player.onGround = false;
  } else {
    pos.x += move.x * dt; pos.z += move.z * dt;
    // 重力 / 跳跃
    player.vel.y -= 22 * dt;
    if (input.jump && player.onGround && state.energy > 1) {
      player.vel.y = 8.2; player.onGround = false;
    }
    pos.y += player.vel.y * dt;
    if (pos.y <= groundY) { pos.y = groundY; player.vel.y = 0; player.onGround = true; }
  }

  // 世界边界
  pos.x = clamp(pos.x, -W_h() + 1, W_h() - 1);
  pos.z = clamp(pos.z, -W_h() + 1, W_h() - 1);

  // 同步存档位置
  state.pos.x = pos.x; state.pos.y = pos.y; state.pos.z = pos.z;

  animate(dt, speed);
  updateCamera(camera, dt);
}
function W_h() { return world ? 40 : 40; }

function animate(dt, speed) {
  const { legL, legR, armL, armR } = player.parts;
  const t = performance.now() / 1000;
  if (player.attackT > 0) player.attackT -= dt;
  if (player.gatherT > 0) player.gatherT -= dt;

  if (player.attackT > 0) {
    const k = 1 - player.attackT / 0.35;
    armR.rotation.x = -Math.PI * 0.9 * Math.sin(k * Math.PI);
    legL.rotation.x = lerp(legL.rotation.x, 0, 0.2); legR.rotation.x = lerp(legR.rotation.x, 0, 0.2);
    armL.rotation.x = 0;
  } else if (player.gatherT > 0) {
    const k = 1 - player.gatherT / 0.45;
    armR.rotation.x = -Math.PI * 1.1 * Math.sin(k * Math.PI);
  } else if (player.swim) {
    armL.rotation.x = Math.sin(t * 4) * 0.6 - 0.4;
    armR.rotation.x = -Math.sin(t * 4) * 0.6 - 0.4;
    legL.rotation.x = Math.sin(t * 5) * 0.4;
    legR.rotation.x = -Math.sin(t * 5) * 0.4;
  } else if (player.moving) {
    const k = speed * t * 1.7;
    legL.rotation.x = Math.sin(k) * 0.7;
    legR.rotation.x = -Math.sin(k) * 0.7;
    armL.rotation.x = -Math.sin(k) * 0.5;
    armR.rotation.x = Math.sin(k) * 0.5;
  } else {
    legL.rotation.x = lerp(legL.rotation.x, 0, 0.2);
    legR.rotation.x = lerp(legR.rotation.x, 0, 0.2);
    armL.rotation.x = lerp(armL.rotation.x, 0, 0.2);
    armR.rotation.x = lerp(armR.rotation.x, 0, 0.2);
  }
  // 蹲伏下沉
  player.group.scale.y = lerp(player.group.scale.y, player.crouch ? 0.78 : 1, 0.2);
}

function updateCamera(camera, dt) {
  const head = player.group.position.clone();
  head.y += 2.2 * player.group.scale.y;
  const cp = player.pitch;
  const dist = player.camDist;
  camPos.set(
    head.x - Math.sin(player.yaw) * Math.cos(cp) * dist,
    head.y - Math.sin(cp) * dist + 1.2,
    head.z - Math.cos(player.yaw) * Math.cos(cp) * dist
  );
  camera.position.lerp(camPos, Math.min(1, dt * 12));
  lookAt.copy(head).add(new THREE.Vector3(Math.sin(player.yaw) * 2, Math.sin(cp) * 2 - 0.3, Math.cos(player.yaw) * 2));
  camera.lookAt(lookAt);
}

// 相机射线前方点（用于交互）
const _fwd = new THREE.Vector3();
export function frontPoint(range = 2.6) {
  _fwd.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  return new THREE.Vector3(player.group.position.x + _fwd.x * range, player.group.position.y + 1, player.group.position.z + _fwd.z * range);
}
export function facingYaw() { return player.yaw; }