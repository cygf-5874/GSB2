// ===== 生存系统：温度环境 / 四维状态衰减 / 进食饮水 / 受伤 =====
import { ITEMS } from './config.js';
import { state, clampVitals, defense, selectedItem, removeItem, addItem } from './state.js';
import { biomeAtXZ, world as W } from './world.js';
import { player } from './player.js';
import { DAY_LEN, gameClock, toast } from './utils.js';

// 当前环境温度：群系基准 + 昼夜偏移（正午热、深夜冷）
export function currentTemp() {
  const b = biomeAtXZ(state.pos.x, state.pos.z);
  const { phase } = gameClock(state.time);
  // 14 点最热(+5)，2~5 点最冷(-7)
  const dayCurve = Math.sin(((phase - 8) / 24) * Math.PI * 2);
  const off = dayCurve * 6;
  return Math.round(b.temp + off);
}
export function currentBiome() { return biomeAtXZ(state.pos.x, state.pos.z); }
export function isUnderwater() {
  return player.swim;
}

let dmgFlash = 0;
export function getDamageFlash() { return dmgFlash; }
export function damagePlayer(raw, silent = false) {
  const dmg = Math.max(1, raw - defense() * 0.7);
  state.hp -= dmg;
  dmgFlash = 0.4;
  if (!silent) toast('受到 ' + Math.round(dmg) + ' 点伤害', 'bad');
  clampVitals();
}

// 死亡回调由 main 注入
let onDeath = null;
export function setDeathHandler(fn) { onDeath = fn; }

// 进食 / 使用消耗品（从指定槽位）
export function consumeSlot(slotRef, poolKey, index) {
  if (!slotRef) return false;
  const def = ITEMS[slotRef.id];
  if (def.type === 'food') {
    state.hunger = Math.min(100, state.hunger + (def.hunger || 0));
    state.thirst = Math.min(100, state.thirst + (def.thirst || 0));
    toast('享用了 ' + def.name + ' 😋', 'good');
    if (slotRef.id === 'waterskin') {
      // 水袋喝完变空袋
      removeFromPool(poolKey, index, slotRef);
      addItem('emptybottle', 1);
    } else {
      slotRef.count = (slotRef.count || 1) - 1;
      if (slotRef.count <= 0) clearPoolSlot(poolKey, index);
    }
    return true;
  }
  if (def.heal) {
    if (state.hp >= 100) { toast('生命值已满', 'bad'); return false; }
    state.hp = Math.min(100, state.hp + def.heal);
    toast(def.name + ' 回复了生命 ✨', 'good');
    slotRef.count = (slotRef.count || 1) - 1;
    if (slotRef.count <= 0) clearPoolSlot(poolKey, index);
    return true;
  }
  toast(def.name + ' 不能直接使用', 'bad');
  return false;
}
function removeFromPool(key, index, slotRef) { clearPoolSlot(key, index); }
function clearPoolSlot(key, index) {
  if (key === 'hotbar') state.hotbar[index] = null;
  else state.bag.splice(index, 1);
}

// 在水源处用空水袋打水
export function fillWater() {
  if (!player.swim && !nearShoreWater()) return false;
  const idx = state.hotbar.findIndex(s => s && s.id === 'emptybottle');
  const bagIdx = state.bag.findIndex(s => s && s.id === 'emptybottle');
  if (idx >= 0) { removeItem('emptybottle', 1); addItem('waterskin', 1); }
  else if (bagIdx >= 0) { removeItem('emptybottle', 1); addItem('waterskin', 1); }
  else {
    // 没水袋也能直接喝河水
    state.thirst = Math.min(100, state.thirst + 30);
    toast('捧起河水喝了几口 💧', 'good');
    return true;
  }
  toast('水袋装满了 💧', 'good');
  return true;
}
function nearShoreWater() {
  // 海洋边缘 2 格内算岸边
  const p = state.pos;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
    if (biomeAtXZ(p.x + dx, p.z + dz).key === 'ocean') return true;
  }
  return false;
}

// ===== 每秒生存结算 =====
let statTick = 0, breath = 100;
export function getBreath() { return breath; }

export function survivalTick(dt) {
  dmgFlash = Math.max(0, dmgFlash - dt);
  state.time += dt;
  const temp = currentTemp();

  // 行动量
  const active = player.moving || player.running;
  if (active) state.energy -= (player.running ? 3.2 : 1.4) * dt;
  else state.energy += (player.crouch ? 5 : 3.2) * dt;

  // 饥饿 / 口渴基础衰减
  const hungerRate = 0.42 * (temp <= 0 ? 1.9 : 1) * (active ? 1.3 : 1);
  const thirstRate = 0.5 * (temp >= 35 ? 2.0 : 1) * (active ? 1.3 : 1);
  state.hunger -= hungerRate * dt;
  state.thirst -= thirstRate * dt;

  // 归零扣血
  statTick += dt;
  if (statTick >= 1) {
    statTick = 0;
    if (state.hunger <= 0) { state.hp -= 2; dmgFlash = 0.3; }
    if (state.thirst <= 0) { state.hp -= 3; dmgFlash = 0.3; }
  }

  // 水下呼吸
  if (player.swim) {
    breath -= 12 * dt;
    if (breath <= 0) { state.hp -= 6 * dt; dmgFlash = 0.3; }
  } else {
    breath = Math.min(100, breath + 25 * dt);
  }

  clampVitals();
  if (state.hp <= 0 && onDeath) onDeath();
}