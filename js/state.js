// ===== 玩家状态、背包、宠物数据 + localStorage 存档 =====
import { ITEMS, XP_LEVELS } from './config.js';
import { clamp } from './utils.js';

const SAVE_KEY = 'wild-era-save-v1';

export const state = {
  started: false,
  hp: 100, hunger: 100, thirst: 100, energy: 100,
  level: 1, xp: 0,
  time: 0,                     // 游戏世界秒
  pos: { x: 20, y: 0, z: 20 }, // 出生点（草原靠水一侧，main 会修正到地面）
  hotbar: new Array(8).fill(null),   // {id, count, dur}
  bag: [],                          // 同结构
  equipped: { weapon: null, armor: null },
  pets: [],           // {uid, id, name, kind, affinity, hp, out:出战中, produceTick}
  eggs: [],           // {uid, id, t, total}
  seed: Math.floor(Math.random() * 1e9),
  cooldowns: {},
};

export function xpNeed(lv) {
  if (lv >= XP_LEVELS.length - 1) return XP_LEVELS[XP_LEVELS.length - 1];
  return XP_LEVELS[lv];
}
export function addXp(n) {
  state.xp += n;
  let leveled = false;
  while (state.level < XP_LEVELS.length - 1 && state.xp >= xpNeed(state.level)) {
    state.xp -= xpNeed(state.level);
    state.level++;
    leveled = true;
  }
  return leveled;
}

// ---------- 物品存取 ----------
function sameItem(a, b) { return a && b && a.id === b.id; }

export function countItem(id, includeEquip = false) {
  let n = 0;
  for (const s of [...state.hotbar, ...state.bag]) if (s && s.id === id) n += s.count || 1;
  return n;
}

export function addItem(id, count = 1) {
  const def = ITEMS[id];
  if (!def) return false;
  const stackable = def.type === 'material' || def.type === 'food' || def.type === 'egg' || def.type === 'misc';
  if (stackable) {
    const all = [...state.hotbar, ...state.bag];
    for (const s of all) {
      if (s && s.id === id && s.count < 99) {
        const take = Math.min(count, 99 - s.count);
        s.count += take; count -= take;
        if (count <= 0) return true;
      }
    }
  }
  while (count > 0) {
    const slot = { id, count: stackable ? Math.min(count, 99) : 1 };
    if (def.dur) slot.dur = def.dur;
    let placed = false;
    for (let i = 0; i < state.hotbar.length; i++) {
      if (!state.hotbar[i]) { state.hotbar[i] = slot; placed = true; break; }
    }
    if (!placed) state.bag.push(slot);
    count -= slot.count;
  }
  return true;
}

export function removeItem(id, count = 1) {
  if (countItem(id) < count) return false;
  const pools = [state.hotbar, state.bag];
  for (const pool of pools) {
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(count, s.count || 1);
      s.count = (s.count || 1) - take; count -= take;
      if (s.count <= 0) pool[i] = null;
      if (count <= 0) return true;
    }
  }
  return true;
}

// 选中的快捷栏
export let selected = 0;
export function setSelected(i) { selected = ((i % 8) + 8) % 8; }
export function selectedItem() { return state.hotbar[selected]; }

// 装备穿脱
export function equip(slot, id) {
  const prev = state.equipped[slot];
  state.equipped[slot] = { id, dur: ITEMS[id].dur };
  return prev; // 返回替换下来的装备（调用方放回背包）
}
export function defense() {
  const a = state.equipped.armor;
  return a ? ITEMS[a.id].defense || 0 : 0;
}

// 损耗耐久
export function wearTool(slotRef, n = 1) {
  if (!slotRef || !slotRef.dur) return;
  slotRef.dur -= n;
  if (slotRef.dur <= 0) slotRef.broken = true;
}

// ---------- 存档 ----------
export function save() {
  try {
    const data = JSON.stringify({
      hp: state.hp, hunger: state.hunger, thirst: state.thirst, energy: state.energy,
      level: state.level, xp: state.xp, time: state.time, pos: state.pos,
      hotbar: state.hotbar, bag: state.bag, equipped: state.equipped,
      pets: state.pets, eggs: state.eggs, seed: state.seed, started: true,
    });
    localStorage.setItem(SAVE_KEY, data);
  } catch (e) { /* 存档失败静默 */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    Object.assign(state, d);
    state.hotbar = Array.isArray(d.hotbar) ? d.hotbar : new Array(8).fill(null);
    while (state.hotbar.length < 8) state.hotbar.push(null);
    state.bag = d.bag || [];
    state.pets = d.pets || [];
    state.eggs = d.eggs || [];
    return true;
  } catch (e) { return false; }
}
export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
export function wipeSave() { localStorage.removeItem(SAVE_KEY); }

export function clampVitals() {
  state.hp = clamp(state.hp, 0, 100);
  state.hunger = clamp(state.hunger, 0, 100);
  state.thirst = clamp(state.thirst, 0, 100);
  state.energy = clamp(state.energy, 0, 100);
}