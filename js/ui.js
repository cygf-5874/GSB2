// ===== UI：HUD / 快捷栏 / 背包 / 合成 / 宠物 / 地图 =====
import { ITEMS, RECIPES, ANIMALS, BIOMES, EGGS } from './config.js';
import { state, selected, setSelected, selectedItem, countItem, addItem, removeItem, equip, state as S } from './state.js';
import { canCraft, craft, freeCraft } from './crafting.js';
import { callPet, recallPet, collectPetProduce, addEgg } from './pets.js';
import { toast, $, el, gameClock, pad2 } from './utils.js';
import { currentTemp, currentBiome, getBreath, consumeSlot } from './survival.js';
import { drawMap } from './map.js';

let sceneRef = null;
const freePicks = []; // 自由合成槽位选择

export function initUI(scene) {
  sceneRef = scene;
  buildHotbar();
  bindPanels();
  refreshAll();
}

export function refreshAll() {
  renderHotbar();
  renderBag();
  renderCraft();
  renderPets();
}

// ---------- 面板开关 ----------
let openPanelName = null;
function bindPanels() {
  document.querySelectorAll('.menu-btn[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => togglePanel(btn.dataset.panel));
  });
  document.querySelectorAll('.panel-close').forEach(b => b.addEventListener('click', () => closeAllPanels()));
  $('btn-help').addEventListener('click', () => {
    $('help-title').textContent = '❓ 生存手册';
    $('start-btn').classList.add('hidden');
    $('help-close').classList.remove('hidden');
    toggleHelp(true);
  });
  document.querySelectorAll('.craft-tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.craft-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    $('craft-blueprint').classList.toggle('hidden', t.dataset.tab !== 'blueprint');
    $('craft-free').classList.toggle('hidden', t.dataset.tab !== 'free');
  }));
  $('free-craft-btn').addEventListener('click', doFreeCraft);
}
export function toggleHelp(force) {
  const o = $('panel-help');
  const show = force !== undefined ? force : o.classList.contains('hidden');
  o.classList.toggle('hidden', !show);
}
function toggleHelpClose() { toggleHelp(false); }
export function closeAllPanels() {
  ['bag', 'craft', 'pets', 'map'].forEach(n => $('panel-' + n).classList.add('hidden'));
  $('panel-help').classList.add('hidden');
  openPanelName = null;
}
function togglePanel(name) {
  const p = $('panel-' + name);
  const willOpen = p.classList.contains('hidden');
  closeAllPanels();
  if (willOpen) {
    p.classList.remove('hidden');
    openPanelName = name;
    if (name === 'craft') renderCraft();
    if (name === 'pets') renderPets();
    if (name === 'bag') renderBag();
    if (name === 'map') drawMap($('big-map'), true);
  }
}
export function isPanelOpen() { return openPanelName !== null || !$('panel-help').classList.contains('hidden'); }

// ---------- 快捷栏 ----------
function buildHotbar() {
  const hb = $('hotbar');
  hb.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const s = el('div', 'slot');
    s.dataset.i = i;
    s.innerHTML = '<span class="slot-key">' + (i + 1) + '</span><span class="slot-icon"></span><span class="slot-count"></span>';
    s.addEventListener('click', () => { setSelected(i); renderHotbar(); });
    s.addEventListener('contextmenu', (e) => { e.preventDefault(); useHotbar(i); });
    hb.appendChild(s);
  }
}

export function renderHotbar() {
  const slots = $('hotbar').children;
  for (let i = 0; i < 8; i++) {
    const s = slots[i];
    const slot = state.hotbar[i];
    s.classList.toggle('active', i === selected);
    s.querySelector('.slot-icon').textContent = slot ? ITEMS[slot.id].icon : '';
    s.querySelector('.slot-count').textContent = slot && slot.count > 1 ? slot.count : '';
    let dur = s.querySelector('.slot-dur');
    if (dur) dur.remove();
    if (slot && slot.dur && ITEMS[slot.id].dur) {
      const d = el('div', 'slot-dur');
      d.style.width = Math.max(0, slot.dur / ITEMS[slot.id].dur * 92) + '%';
      s.appendChild(d);
    }
  }
}

// 右键快捷栏直接使用（食物/药水）
export function useHotbar(i) {
  const slot = state.hotbar[i];
  if (!slot) return;
  consumeSlot(slot, 'hotbar', i);
  renderHotbar();
}
// ---------- 背包 ----------
let bagSelected = null; // {pool, index}
function renderBag() {
  const grid = $('bag-grid');
  grid.innerHTML = '';
  const renderSlot = (slot, pool, index) => {
    const c = el('div', 'bag-cell');
    if (slot) {
      c.innerHTML = ITEMS[slot.id].icon + '<span class="c">' + ((slot.count || 1) > 1 ? slot.count : '') + '</span>';
      c.title = ITEMS[slot.id].name;
    }
    if (bagSelected && bagSelected.pool === pool && bagSelected.index === index) c.classList.add('selected');
    c.addEventListener('click', () => {
      bagSelected = slot ? { pool, index } : null;
      renderBag();
    });
    grid.appendChild(c);
  };
  state.hotbar.forEach((s, i) => renderSlot(s, 'hotbar', i));
  state.bag.forEach((s, i) => renderSlot(s, 'bag', i));

  const d = $('bag-detail');
  d.innerHTML = '';
  // 装备区
  const w = state.equipped.weapon, a = state.equipped.armor;
  const eq = el('div', '', '🗡️ 武器：' + (w ? ITEMS[w.id].name : '（无）') + '　🛡️ 护甲：' + (a ? ITEMS[a.id].name + '（防御 ' + ITEMS[a.id].defense + '）' : '（无）'));
  eq.style.marginBottom = '8px';
  d.appendChild(eq);

  if (bagSelected) {
    const { pool, index } = bagSelected;
    const slot = pool === 'hotbar' ? state.hotbar[index] : state.bag[index];
    if (!slot) { bagSelected = null; return; }
    const def = ITEMS[slot.id];
    const info = el('div', '', '<b>' + def.icon + ' ' + def.name + '</b> × ' + (slot.count || 1) + '<br><span style="color:#9fd8b0">' + def.desc + '</span>');
    d.appendChild(info);
    const row = el('div', '');

    if (def.type === 'food' || def.heal) {
      const btn = el('button', '', '🍴 使用');
      btn.onclick = () => { consumeSlot(slot, pool, index); bagSelected = null; renderBag(); renderHotbar(); };
      row.appendChild(btn);
    }
    if (def.type === 'egg') {
      const btn = el('button', '', '🥚 放入孵化器');
      btn.onclick = () => { addEgg(slot.id); removeItem(slot.id, 1); toast('宠物蛋开始孵化，营火旁速度翻倍 🐣', 'good'); bagSelected = null; renderBag(); renderPets(); };
      row.appendChild(btn);
    }
    if (def.type === 'tool' || def.type === 'weapon') {
      const btn = el('button', '', '✊ 装备到手上');
      btn.onclick = () => {
        // 武器槽：先卸下旧的
        const prev = state.equipped.weapon;
        state.equipped.weapon = { id: slot.id, dur: slot.dur || def.dur };
        clearSlot(pool, index);
        if (prev) addItem(prev.id, 1);
        toast('已装备：' + def.name, 'good');
        bagSelected = null; renderBag(); renderHotbar();
      };
      row.appendChild(btn);
    }
    if (def.type === 'armor') {
      const btn = el('button', '', '🛡️ 穿上');
      btn.onclick = () => {
        const prev = state.equipped.armor;
        state.equipped.armor = { id: slot.id, dur: slot.dur || def.dur };
        clearSlot(pool, index);
        if (prev) addItem(prev.id, 1);
        toast('已穿上：' + def.name, 'good');
        bagSelected = null; renderBag();
      };
      row.appendChild(btn);
    }
    const drop = el('button', '', '⬇️ 移到背包');
    drop.onclick = () => {
      if (pool === 'hotbar') { state.bag.push(slot); state.hotbar[index] = null; toast('已移入背包'); }
      else {
        const empty = state.hotbar.findIndex(x => !x);
        if (empty >= 0) { state.hotbar[empty] = slot; state.bag.splice(index, 1); }
        else toast('快捷栏已满', 'bad');
      }
      bagSelected = null; renderBag(); renderHotbar();
    };
    row.appendChild(drop);
    d.appendChild(row);
  }
}
function clearSlot(pool, index) {
  if (pool === 'hotbar') state.hotbar[index] = null;
  else state.bag.splice(index, 1);
}

// ---------- 图纸合成 ----------
function renderCraft() {
  const box = $('craft-blueprint');
  box.innerHTML = '';
  for (const r of RECIPES) {
    const chk = canCraft(r);
    const def = ITEMS[r.out];
    const locked = state.level < r.level;
    const card = el('div', 'recipe-card' + (locked ? ' locked' : ''));
    const costHtml = Object.keys(r.cost).map(id => {
      const have = countItem(id), need = r.cost[id];
      const ok = have >= need;
      return '<span class="' + (ok ? '' : 'lack') + '">' + ITEMS[id].icon + have + '/' + need + '</span>';
    }).join(' ');
    card.innerHTML = '<span class="r-icon">' + def.icon + '</span>' +
      '<div class="r-info"><div class="r-name">' + def.name + ' × ' + (r.n || 1) +
      (r.station ? ' <small style="color:#ffd84b">[' + (r.station === 'bench' ? '工作台' : '营火') + ']</small>' : '') +
      '</div><div class="r-cost">' + costHtml + '</div>' +
      (locked ? '<div class="r-lock">🔒 Lv.' + r.level + ' 解锁</div>' : '') +
      (!chk.ok && !locked ? '<div class="r-lock">' + chk.reason + '</div>' : '') + '</div>';
    const btn = el('button', '', locked ? '🔒' : '合成');
    btn.disabled = !chk.ok;
    btn.onclick = () => {
      const res = craft(r);
      if (res.ok) { toast('合成成功：' + def.icon + def.name, 'good'); renderCraft(); renderBag(); renderHotbar(); }
      else toast(res.reason, 'bad');
    };
    card.appendChild(btn);
    box.appendChild(card);
  }
  renderFreeSlots();
}
// ---------- 自由合成 ----------
function renderFreeSlots() {
  const box = $('free-slots');
  box.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const s = el('div', 'free-slot', freePicks[i] ? ITEMS[freePicks[i]].icon : '＋');
    s.style.opacity = freePicks[i] ? '1' : '0.4';
    s.onclick = () => {
      if (freePicks[i]) { freePicks.splice(i, 1); }
      else {
        // 打开背包中可选的材料列表（简易：弹出前 8 种材料供点选）
        const mats = [...new Set([...state.hotbar, ...state.bag].filter(x => x && (ITEMS[x.id].type === 'material')).map(x => x.id))];
        if (!mats.length) { toast('背包里没有可投入的材料', 'bad'); return; }
        const name = prompt('输入要投入的材料（' + mats.map(id => id + '=' + ITEMS[id].name).join('，') + '）', mats[0]);
        if (name && mats.includes(name)) freePicks.push(name);
      }
      renderFreeSlots();
    };
    box.appendChild(s);
  }
}
function doFreeCraft() {
  const res = freeCraft(freePicks.slice());
  const out = $('free-result');
  if (!res.ok) { out.innerHTML = '<span style="color:#ff8a6b">' + res.reason + '</span>'; return; }
  const def = ITEMS[res.out];
  const color = { 普通: '#dff5e6', 精良: '#7fd8ff', 稀有: '#d8a0ff', 史诗: '#ffd84b' }[res.tier];
  out.innerHTML = '🎲 <b style="color:' + color + '">[' + res.tier + ']</b> 炼出了 ' + def.icon + ' <b>' + def.name + '</b>！';
  toast('[' + res.tier + '] ' + def.name + '！', res.tier === '史诗' || res.tier === '稀有' ? 'rare' : 'good');
  freePicks.length = 0;
  renderFreeSlots(); renderCraft(); renderBag(); renderHotbar();
}

// ---------- 宠物面板 ----------
function renderPets() {
  const list = $('pet-list');
  list.innerHTML = '';
  if (!state.pets.length) {
    list.innerHTML = '<div class="empty-tip">还没有宠物。<br>用木棒敲晕野兔/绵羊等野兽，投喂食物后用捕捉器收编。</div>';
  }
  for (const p of state.pets) {
    const def = ANIMALS[p.id];
    const card = el('div', 'pet-card');
    const kindName = { fight: '战斗宠', prod: '生产宠', beauty: '观赏宠', mount: '坐骑' }[p.kind];
    card.innerHTML = '<span class="p-icon">' + defIcon(p.id) + '</span><div class="p-info">' +
      '<div class="p-name">' + p.name + '<span class="pet-tag ' + p.kind + '">' + kindName + '</span></div>' +
      '<div>亲密度 ❤️ ' + p.affinity + '</div>' +
      (p.kind === 'fight' ? '<div>战力 ⚔️ ' + (def.power || 0) + '</div>' : '') +
      (p.pending ? '<div style="color:#ffd84b">📦 有产物可收取</div>' : '') + '</div>';
    const btn = el('button', p.out ? 'pet-recall' : 'pet-call', p.out ? '召回' : '出战');
    btn.onclick = () => {
      if (p.out) { recallPet(sceneRef, p); toast(p.name + ' 已回营休息'); }
      else { callPet(sceneRef, p); toast(p.name + ' 出战！', 'good'); }
      renderPets();
    };
    card.appendChild(btn);
    if (p.kind === 'mount') {
      const mb = el('button', 'pet-call', '🐎 骑乘');
      mb.onclick = () => { window.__mountPet && window.__mountPet(p); closeAllPanels(); };
      card.appendChild(mb);
    }
    if (p.pending) {
      const cb = el('button', 'pet-call', '收取');
      cb.onclick = () => { const got = collectPetProduceProduce(p); renderPets(); renderBag(); renderHotbar(); };
      card.appendChild(cb);
    }
    list.appendChild(card);
  }

  const eggs = $('egg-list');
  eggs.innerHTML = '';
  if (!state.eggs.length) eggs.innerHTML = '<div class="empty-tip">暂无宠物蛋。<br>普通蛋可通过自由合成获得；稀有蛋藏在海底遗迹的宝箱中。</div>';
  for (const e of state.eggs) {
    const def = e.id === 'rare_egg' ? ITEMS.rare_egg : ITEMS.egg;
    const pct = Math.min(100, e.t / e.total * 100);
    const card = el('div', 'egg-card');
    card.innerHTML = def.icon + ' <b>' + def.name + '</b>' +
      '<div class="egg-bar"><div style="width:' + pct + '%"></div></div>' +
      '<div>' + Math.floor(e.t) + ' / ' + e.total + ' 秒' + (pct >= 100 ? '（即将孵化）' : '') + '</div>';
    eggs.appendChild(card);
  }
}
function defIcon(id) { return ANIMALS[id].icon; }
function collectPetProduceProduce(p) {
  // 转发（避免顶层循环引用）
  return window.__collectProduce(p);
}
// ---------- HUD 实时刷新 ----------
import { xpNeed } from './state.js';
let hudAcc = 0;
export function hudTick(dt) {
  hudAcc += dt;
  const fill = (id, v) => { $(id).style.width = Math.max(0, v) + '%'; };
  fill('fill-hp', state.hp); fill('fill-hunger', state.hunger);
  fill('fill-thirst', state.thirst); fill('fill-energy', state.energy);
  fill('fill-xp', state.level >= 6 ? 100 : state.xp / xpNeed(state.level) * 100);
  $('num-hp').textContent = Math.round(state.hp);
  $('num-hunger').textContent = Math.round(state.hunger);
  $('num-thirst').textContent = Math.round(state.thirst);
  $('num-energy').textContent = Math.round(state.energy);
  $('level-badge').textContent = 'Lv.' + state.level;

  const c = gameClock(state.time);
  $('clock-text').textContent = '第' + c.day + '天 ' + pad2(c.h) + ':' + pad2(c.m);
  const t = currentTemp();
  $('temp-text').textContent = '🌡 ' + t + '°C';
  $('clock-icon').textContent = c.h >= 6 && c.h < 18 ? '☀️' : '🌙';
  $('clock-icon').parentElement.title = currentBiome().name;

  // 温度颜色提示
  $('temp-text').style.color = t <= 0 ? '#9fd8ff' : (t >= 35 ? '#ffb07a' : '#d8f5e0');

  if (hudAcc > 0.4) { hudAcc = 0; renderHotbar(); drawMap($('minimap'), false); }
}

// 选中变化时同步手上模型
export function syncSelection() { renderHotbar(); }