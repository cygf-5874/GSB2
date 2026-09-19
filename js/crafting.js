// ===== 合成系统：图纸配方 + 自由随机合成 =====
import { RECIPES, FREE_CRAFT, ITEMS } from './config.js';
import { state, countItem, removeItem, addItem, addXp } from './state.js';
import { nearStation, world } from './world.js';
import { weightedPick } from './utils.js';

export function canCraft(recipe) {
  if (state.level < recipe.level) return { ok: false, reason: '等级不足（Lv.' + recipe.level + ' 解锁）' };
  if (recipe.station) {
    const list = recipe.station === 'bench' ? world.benches : world.fires;
    if (!nearStation(state.pos, list, 4.5)) {
      return { ok: false, reason: recipe.station === 'bench' ? '需要靠近工作台' : '需要靠近营火' };
    }
  }
  for (const id in recipe.cost) {
    if (countItem(id) < recipe.cost[id]) return { ok: false, reason: '材料不足' };
  }
  return { ok: true };
}

export function craft(recipe) {
  const chk = canCraft(recipe);
  if (!chk.ok) return chk;
  for (const id in recipe.cost) removeItem(id, recipe.cost[id]);
  addItem(recipe.out, recipe.n || 1);
  addXp(6);
  return { ok: true };
}

// 自由合成：投入材料 id 数组（已扣除），按稀有度返回产出 id
export function freeCraft(matIds) {
  if (matIds.length < FREE_CRAFT.min || matIds.length > FREE_CRAFT.max) {
    return { ok: false, reason: '需要投入 2~5 件材料' };
  }
  let score = 0;
  for (const id of matIds) {
    if (!FREE_CRAFT.rarity[id]) return { ok: false, reason: '只能投入材料类物品' };
    score += FREE_CRAFT.rarity[id];
  }
  for (const id of matIds) removeItem(id, 1);

  // 档位：均分 6 分以下普通；6-10 优秀；11-18 稀有；19+ 史诗
  let pool;
  let tierName;
  if (score >= 19) { pool = FREE_CRAFT.epic; tierName = '史诗'; }
  else if (score >= 11) { pool = FREE_CRAFT.rare; tierName = '稀有'; }
  else if (score >= 6) { pool = FREE_CRAFT.uncommon; tierName = '精良'; }
  else { pool = FREE_CRAFT.common; tierName = '普通'; }

  const out = weightedPick(pool);
  addItem(out, 1);
  addXp(4);
  return { ok: true, out, tier: tierName, score };
}