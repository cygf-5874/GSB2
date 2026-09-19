// ===== 宠物：收编 / 出战跟随 / 生产 / 骑乘 / 蛋孵化 =====
import * as THREE from '../lib/three.module.js';
import { ANIMALS, EGGS } from './config.js';
import { state, addItem } from './state.js';
import { spawnMob, mobs, removeMob } from './entities.js';
import { heightAt, isOcean, world as W, nearStation } from './world.js';
import { rand, weightedPick, clamp } from './utils.js';

let uidc = 1;

// 驯服收编
export function tameAnimal(mob) {
  const pet = {
    uid: 'p' + uidc++,
    id: mob.kind,
    name: mob.def.name,
    kind: mob.def.kind,
    affinity: 100,
    hp: mob.def.hp,
    out: false,
    produceTick: 0,
  };
  state.pets.push(pet);
  return pet;
}

export function callPet(scene, pet) {
  if (pet.out) return;
  // 同类型最多出战一只
  for (const p of state.pets) if (p.out && p !== pet) recallPet(scene, p);
  const m = spawnMob(scene, pet.id, state.pos.x, state.pos.z, pet);
  pet.out = true;
  pet.mob = m;
  m.data = pet;
  m.state = 'idle';
}

export function recallPet(scene, pet) {
  if (!pet.out) return;
  const m = pet.mob;
  if (m) removeMob(m, scene);
  pet.out = false;
  pet.mob = null;
}

// 宠物跟随 / 助战 / 生产
export function updatePets(dt, now, scene, playerPos, onPetAttack) {
  for (const pet of state.pets) {
    if (!pet.out || !pet.mob) continue;
    const m = pet.mob;
    const pos = m.mesh.position;
    const d = Math.hypot(pos.x - playerPos.x, pos.z - playerPos.z);

    // 寻找最近敌对目标
    let enemy = null, ed = 9;
    if (pet.kind === 'fight') {
      for (const e of mobs) {
        if (e.pet || e.state === 'dead' || e.state === 'stunned') continue;
        const dd = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z);
        if (dd < ed) { ed = dd; enemy = e; }
      }
    }

    if (enemy) {
      const dir = Math.atan2(enemy.mesh.position.x - pos.x, enemy.mesh.position.z - pos.z);
      const sp = m.def.speed * 1.1;
      pos.x += Math.sin(dir) * sp * dt; pos.z += Math.cos(dir) * sp * dt;
      m.mesh.rotation.y = dir;
      m.attackCd = Math.max(0, (m.attackCd || 0) - dt);
      if (ed < 1.5 && m.attackCd <= 0) {
        m.attackCd = 1;
        onPetAttack(enemy, m.def.power || 8);
      }
    } else if (d > 2.5) {
      const dir = Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z);
      const sp = Math.min(m.def.speed * 1.4, 6.5);
      pos.x += Math.sin(dir) * sp * dt; pos.z += Math.cos(dir) * sp * dt;
      m.mesh.rotation.y = dir;
    } else {
      pos.x += Math.sin(now * 0.7 + m.bobT) * dt * 0.3;
      pos.z += Math.cos(now * 0.6 + m.bobT) * dt * 0.3;
    }

    const gy = heightAt(pos.x, pos.z) + 1;
    if (m.def.swims && isOcean(pos.x, pos.z)) pos.y = W.waterY - 1.5;
    else if (m.def.fly) pos.y = gy + 4;
    else pos.y += (gy - pos.y) * Math.min(1, dt * 8);
    pos.x = clamp(pos.x, -39, 39); pos.z = clamp(pos.z, -39, 39);

    // 生产宠产出
    if (m.def.produce) {
      pet.produceTick = (pet.produceTick || 0) + dt;
      const need = m.def.produceTime || 50;
      if (pet.produceTick >= need) {
        pet.produceTick = 0;
        pet.pending = pet.pending || {};
        for (const id in m.def.produce) {
          const [a, b] = m.def.produce[id];
          const n = rand(a, b + 1) | 0;
          if (n > 0) pet.pending[id] = (pet.pending[id] || 0) + n;
        }
      }
    }
  }
}

export function collectPetProduce(pet) {
  if (!pet.pending) return null;
  const got = pet.pending;
  for (const id in got) addItem(id, got[id]);
  pet.pending = null;
  return got;
}
// ===== 蛋孵化 =====
let eggUid = 1;
export function addEgg(id) {
  const conf = EGGS[id];
  state.eggs.push({ uid: 'e' + eggUid++, id, t: 0, total: conf.time });
}

export function updateEggs(dt, scene, playerPos) {
  for (let i = state.eggs.length - 1; i >= 0; i--) {
    const e = state.eggs[i];
    // 营火旁孵化更快
    const nearFire = nearStation(playerPos, W.fires, 6);
    e.t += dt * (nearFire ? 2.2 : 1);
    if (e.t >= e.total) {
      const id = weightedPick(EGGS[e.id].pool);
      const pet = {
        uid: 'p' + uidc++, id, name: ANIMALS[id].name, kind: ANIMALS[id].kind,
        affinity: 100, hp: ANIMALS[id].hp, out: false, produceTick: 0, hatched: true,
      };
      state.pets.push(pet);
      state.eggs.splice(i, 1);
      hatchResult = { id, name: pet.name };
    }
  }
}
export let hatchResult = null;
export function clearHatchResult() { hatchResult = null; }

// ===== 骑乘 =====
export const riding = { active: false, pet: null };
export function mountPet(scene, pet) {
  if (pet.kind !== 'mount') return false;
  if (!pet.out) callPet(scene, pet);
  riding.active = true; riding.pet = pet;
  return true;
}
export function unmount(scene) {
  riding.active = false; riding.pet = null;
}

export function updateRiding(dt, playerGroup) {
  if (!riding.active || !riding.pet?.mob) return;
  const m = riding.pet.mob;
  m.mesh.position.set(playerGroup.position.x, playerGroup.position.y - 0.2, playerGroup.position.z);
  m.mesh.rotation.y = playerGroup.rotation.y;
}
