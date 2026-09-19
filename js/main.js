// ===== 主入口：渲染器 / 输入 / 游戏循环 / 交互 =====
import * as THREE from '../lib/three.module.js';
import { ITEMS, NODES, ANIMALS } from './config.js';
import { clamp, toast, $, randInt } from './utils.js';
import { state, load, save, wipeSave, selected, setSelected, selectedItem, addItem, removeItem, addXp, wearTool } from './state.js';
import { buildWorld, world, nearestNode, breakNode, updateNodes, heightAt, isOcean } from './world.js';
import { player, updatePlayer, refreshHeld } from './player.js';
import { spawnAnimals, mobs, nearestMob, hurtMob, feedMob, removeMob } from './entities.js';
import { tameAnimal, callPet, recallPet, updatePets, addEgg, updateEggs, hatchResult, clearHatchResult, mountPet, unmount, riding, updateRiding, collectPetProduce } from './pets.js';
import { initMagic, openMagic, closeMagic, updateMagic } from './magic.js';
import { survivalTick, damagePlayer, setDeathHandler, fillWater, isUnderwater, getDamageFlash } from './survival.js';
import { initUI, hudTick, refreshAll, closeAllPanels, toggleHelp, isPanelOpen } from './ui.js';
import { renderHotbar } from './ui.js';

// 桥接给 UI 面板按钮
window.__mountPet = (p) => {
  if (mountPet(scene, p)) toast('骑上了 ' + p.name + '！按 Z 下骑', 'good');
};
window.__collectProduce = (p) => {
  const got = collectPetProduce(p);
  if (got) toast('收取了宠物产物 ✨', 'good');
  return got;
};

// ---------- 渲染器 / 场景 ----------
const canvas = $('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8d8f0);
scene.fog = new THREE.Fog(0xbfe0f0, 40, 95);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 300);

const hemi = new THREE.HemisphereLight(0xdff0ff, 0x506040, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
sun.position.set(40, 60, 20);
scene.add(sun);
const ambient = new THREE.AmbientLight(0xffffff, 0.25);
scene.add(ambient);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- 开局 ----------
function startGame(continued) {
  const seed = continued && state.seed ? state.seed : Math.floor(Math.random() * 1e9);
  buildWorld(scene, seed);
  state.seed = seed;
  player.build(scene);
  if (continued) player.placeSpawn(new THREE.Vector3(state.pos.x, Math.max(state.pos.y, heightAt(state.pos.x, state.pos.z) + 1), state.pos.z));
  else player.placeSpawn(world.spawn.clone());
  spawnAnimals(scene);
  initMagic(scene, camera);
  initUI(scene);
  refreshHeld(selectedItem());
  bindInput();
  state.started = true;
  toast(continued ? '🌿 回到荒野，继续生存' : '🌿 你在草原营火旁醒来。先采集浆果活下去吧！', 'good');
  setTimeout(() => toast('提示：靠近树木按「采集」，靠近野兽按「攻击」'), 3500);
}

setDeathHandler(() => {
  if (dead) return;
  dead = true;
  toast('你倒下了……', 'bad');
  setTimeout(() => {
    $('help-title').textContent = '💀 你倒下了';
    $('help-body').innerHTML = '<p style="text-align:center;font-size:15px">饥饿、寒冷与野兽终结了这次冒险。<br>营火的微光在记忆深处闪烁——再来一次吗？</p><h4>本次生存</h4><ul><li>存活天数：第 ' + Math.floor(state.time / 240 + 1) + ' 天</li><li>达到等级：Lv.' + state.level + '</li><li>驯服宠物：' + state.pets.length + ' 只</li></ul>';
    $('start-btn').textContent = '🔥 从营地重生（保留背包）';
    $('start-btn').classList.remove('hidden');
    $('help-close').classList.add('hidden');
    $('panel-help').classList.remove('hidden');
  }, 800);
});
let dead = false;

function respawn() {
  state.hp = 80; state.hunger = 70; state.thirst = 70; state.energy = 100;
  player.placeSpawn(world.spawn.clone());
  dead = false;
  closeAllPanels();
  $('panel-help').classList.add('hidden');
  toast('在营地篝火旁重生', 'good');
}

$('start-btn').addEventListener('click', () => {
  if (dead) { respawn(); return; }
  const continued = load();
  if (!continued) {
    // 新号送点基础物资
    addItem('woodaxe', 1);
    addItem('berry', 3);
  } else {
    toast('读取到上次存档', 'good');
  }
  $('panel-help').classList.add('hidden');
  startGame(continued);
  loop();
});

// 触屏标记
if ('ontouchstart' in window) document.body.classList.add('touch');
// ---------- 输入 ----------
const input = { forward: false, back: false, left: false, right: false, run: false, jump: false, crouchHold: false, joyX: 0, joyY: 0 };

function bindInput() {
  window.addEventListener('keydown', (e) => {
    if (isPanelOpen() && e.key !== 'Escape') return;
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.forward = true; break;
      case 'KeyS': case 'ArrowDown': input.back = true; break;
      case 'KeyA': case 'ArrowLeft': input.left = true; break;
      case 'KeyD': case 'ArrowRight': input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.run = true; break;
      case 'Space': input.jump = true; e.preventDefault(); break;
      case 'KeyC': player.crouch = !player.crouch; $('btn-crouch').classList.toggle('toggled', player.crouch); break;
      case 'KeyF': doGather(); break;
      case 'KeyJ': doAttack(); break;
      case 'KeyZ': if (riding.active) { unmount(scene); toast('下骑'); } break;
      case 'KeyE': doInteract(); break;
      case 'Escape': closeAllPanels(); closeMagic(); break;
    }
    if (e.key >= '1' && e.key <= '8') { setSelected(parseInt(e.key) - 1); renderHotbar(); refreshHeld(selectedItem()); }
  });
  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': case 'ArrowUp': input.forward = false; break;
      case 'KeyS': case 'ArrowDown': input.back = false; break;
      case 'KeyA': case 'ArrowLeft': input.left = false; break;
      case 'KeyD': case 'ArrowRight': input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.run = false; break;
      case 'Space': input.jump = false; break;
    }
  });

  // 鼠标拖拽视角 + 滚轮缩放
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => dragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    rotateView(e.clientX - lastX, e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    player.camDist = clamp(player.camDist + Math.sign(e.deltaY) * 0.6, 3.5, 13);
    e.preventDefault();
  }, { passive: false });

  // 触屏右半屏拖动视角
  let touchLook = null;
  canvas.addEventListener('touchstart', (e) => {
    for (const t of e.changedTouches) {
      if (t.clientX > window.innerWidth * 0.4 && t.clientY < window.innerHeight - 200) {
        touchLook = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (!touchLook) return;
    for (const t of e.changedTouches) {
      if (t.identifier === touchLook.id) {
        rotateView(t.clientX - touchLook.x, t.clientY - touchLook.y);
        touchLook.x = t.clientX; touchLook.y = t.clientY;
      }
    }
  }, { passive: true });
  canvas.addEventListener('touchend', (e) => {
    for (const t of e.changedTouches) if (t.identifier === touchLook?.id) touchLook = null;
  });

  // 虚拟摇杆
  const joy = $('joystick'), knob = $('joystick-knob');
  let joyId = null, cx = 0, cy = 0;
  const joyStart = (e) => {
    e.preventDefault();
    const t = e.touches ? e.changedTouches[0] : e;
    joyId = e.touches ? t.identifier : 'mouse';
    const r = joy.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    joyMove(e);
  };
  const joyMove = (e) => {
    if (joyId === null) return;
    let t;
    if (e.touches) { t = [...e.changedTouches].find(x => x.identifier === joyId); if (!t) return; } else t = e;
    let dx = t.clientX - cx, dy = t.clientY - cy;
    const max = 46;
    const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    input.joyX = dx / max; input.joyY = -dy / max;
  };
  const joyEnd = () => { joyId = null; input.joyX = 0; input.joyY = 0; knob.style.transform = ''; };
  joy.addEventListener('touchstart', joyStart, { passive: false });
  window.addEventListener('touchmove', joyMove, { passive: false });
  window.addEventListener('touchend', joyEnd);
  joy.addEventListener('mousedown', joyStart);
  window.addEventListener('mousemove', joyMove);
  window.addEventListener('mouseup', joyEnd);

  // 动作按钮
  const bindHold = (id, on, off) => { const b = $(id); b.addEventListener('mousedown', on); b.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false }); if (off) { window.addEventListener('mouseup', off); window.addEventListener('touchend', off); } };
  bindHold('btn-jump', () => input.jump = true, () => input.jump = false);
  $('btn-crouch').addEventListener('click', () => { player.crouch = !player.crouch; $('btn-crouch').classList.toggle('toggled', player.crouch); });
  $('btn-attack').addEventListener('click', doAttack);
  $('btn-gather').addEventListener('click', doGather);
  $('btn-magic').addEventListener('click', () => openMagic());
}

function rotateView(dx, dy) {
  player.yaw += dx * 0.005;
  player.pitch = clamp(player.pitch + dy * 0.004, -1.1, 0.25);
}
// ---------- 动作：攻击 / 采集 / 交互 ----------
function spendEnergy(n) {
  if (state.energy < n) { toast('⚡ 精疲力尽，停下休息一下', 'bad'); return false; }
  state.energy -= n;
  return true;
}

function doAttack() {
  if (dead || isPanelOpen()) return;
  const slot = selectedItem();
  const def = slot ? ITEMS[slot.id] : null;
  if (!spendEnergy(5)) return;
  player.attackT = 0.35;

  const mob = nearestMob(player.group.position, 3);
  if (mob) {
    const dmg = def ? (def.dmg || 3) : 3;
    const isRod = def && def.stun;
    const r = hurtMob(mob, isRod ? dmg : dmg, isRod, performance.now() / 1000);
    if (slot) wearTool(slot, 1);
    if (r === 'stun') toast(mob.def.name + ' 被敲晕了 💫 快投喂 ' + ITEMS[mob.def.food].name, 'good');
    else if (r === 'dead') {
      const drops = mob.def.drop;
      let got = [];
      for (const id in drops) { const n = randInt(drops[id][0], drops[id][1]); if (n > 0) { addItem(id, n); got.push(ITEMS[id].name + '×' + n); } }
      addXp(mob.def.xp || 4);
      toast('击败 ' + mob.def.name + (got.length ? '，获得 ' + got.join('、') : ''), 'good');
      removeMob(mob, scene);
    } else {
      toast('对 ' + mob.def.name + ' 造成 ' + dmg + ' 伤害');
    }
    renderHotbar();
    return;
  }
  // 空手挥击也可当采集？提示
  toast('面前没有目标', '');
}

function doGather() {
  if (dead || isPanelOpen()) return;
  const slot = selectedItem();
  const def = slot ? ITEMS[slot.id] : null;
  const node = nearestNode(player.group.position, 3);
  if (node) {
    const nd = NODES[node.userData.type];
    // 工具需求
    if (nd.tool) {
      if (!def || def.toolKind !== nd.tool || (def.tier || 0) < nd.tier) {
        if (nd.tier >= 3) toast('需要水晶镐才能开采 💎', 'bad');
        else if (nd.tier >= 2) toast('需要更好的镐/斧（铁镐/石斧）', 'bad');
        else toast('这个资源需要 ' + (nd.tool === 'axe' ? '斧头' : '镐子'), 'bad');
        return;
      }
    }
    if (!spendEnergy(4)) return;
    player.gatherT = 0.45;
    node.userData.hp -= 1;
    if (slot) wearTool(slot, 1);
    if (node.userData.hp <= 0) {
      const drops = breakNode(node);
      const got = [];
      for (const id in drops) { addItem(id, drops[id]); got.push(ITEMS[id].name + '×' + drops[id]); }
      addXp(3);
      toast('采集到 ' + got.join('、'), 'good');
      if (node.userData.type === 'ruinegg') toast('🏺 遗迹宝箱！获得稀有宠物蛋！', 'rare');
    } else {
      toast('叮！' + nd.name + '（剩余 ' + node.userData.hp + '）');
    }
    renderHotbar();
    return;
  }
  // 水中或水边 → 喝水/打水
  if (player.swim) { fillWater(); return; }
  toast('附近没有可采集的资源', '');
}

function doInteract() {
  if (dead || isPanelOpen()) return;
  // 优先级：眩晕可驯服野兽 > 资源点 > 喝水
  const mob = nearestMob(player.group.position, 2.6);
  if (mob) {
    const slot = selectedItem();
    if (mob.state === 'stunned') {
      // 先投喂手持食物
      if (slot && slot.id === mob.def.food) {
        removeItem(slot.id, 1);
        const r = feedMob(mob, slot.id);
        if (r === 'ready') toast('亲密度满！它冒出了 ❤️，快用捕捉器/项圈', 'rare');
        else if (r === 'like') toast('它很喜欢！亲密度 ' + mob.affinity + '%', 'good');
        renderHotbar();
        return;
      }
      if (mob.tameReady && slot && (slot.id === 'trap' || slot.id === 'collar')) {
        const fail = slot.id === 'trap' && Math.random() < 0.25;
        if (fail) { toast('捕捉失败！它挣脱了，再喂点食物吧', 'bad'); mob.affinity = 70; mob.tameReady = false; return; }
        removeItem(slot.id, 1);
        const pet = tameAnimal(mob);
        removeMob(mob, scene);
        addXp(25);
        toast('🎉 成功驯服 ' + pet.name + '！打开宠物面板查看', 'rare');
        renderHotbar();
        return;
      }
      toast('投喂 ' + ITEMS[mob.def.food].name + ' 提升亲密度；满 ❤️ 后用捕捉器收编', '');
      return;
    }
    toast(mob.def.name + ' 还醒着，先用木棒敲晕', '');
    return;
  }
  const node = nearestNode(player.group.position, 3);
  if (node) { doGather(); return; }
  if (player.swim) { fillWater(); return; }
}

// 交互提示
const hint = $('interact-hint');
function updateHint() {
  if (dead || isPanelOpen()) { hint.textContent = ''; return; }
  const mob = nearestMob(player.group.position, 2.8);
  if (mob) {
    if (mob.state === 'stunned') {
      hint.textContent = (mob.tameReady ? '❤️ 按 E/采集 使用捕捉器收编 ' : '🍖 投喂 ' + ITEMS[mob.def.food].name + '（手持后按 E）驯服 ') + mob.def.name;
    } else if (mob.def.hostile) hint.textContent = '⚠️ ' + mob.def.name + '（攻击/逃跑）';
    else hint.textContent = mob.def.name + ' · 木棒击晕可驯服';
    return;
  }
  const node = nearestNode(player.group.position, 3);
  if (node) { hint.textContent = '⛏️ 采集 ' + NODES[node.userData.type].name + '（F / 采集键）'; return; }
  if (player.swim) { hint.textContent = '💧 按 F 喝水 / 用水袋打水'; return; }
  hint.textContent = '';
}
// ---------- 昼夜 / 环境 ----------
const dayColor = new THREE.Color(0xa8d8f0), nightColor = new THREE.Color(0x141c30);
const duskColor = new THREE.Color(0xf0a060);
function updateEnvironment(dt) {
  // 一天 240 秒，06:00 起
  const phase = ((state.time % 240) / 240) * 24 + 6;
  const t = ((phase - 6) / 24) * Math.PI * 2; // 06:00 = 0
  const sunH = Math.sin(t);
  sun.position.set(Math.cos(t) * 60, Math.max(-30, sunH * 70), 30);
  const dayAmt = clamp(sunH * 2 + 0.25, 0, 1);
  const duskAmt = clamp(1 - Math.abs(sunH) * 3, 0, 1) * 0.4;
  sun.intensity = 0.15 + dayAmt * 1.1;
  hemi.intensity = 0.35 + dayAmt * 0.65;
  scene.background.copy(nightColor).lerp(dayColor, dayAmt).lerp(duskColor, duskAmt);
  scene.fog.color.copy(scene.background);
  sun.color.setHex(dayAmt > 0.5 ? 0xfff2d0 : 0xffb070);

  // 水下雾效
  if (player.swim) {
    scene.background.set(0x1a5a78);
    scene.fog.color.set(0x2a7a98);
    scene.fog.near = 8; scene.fog.far = 45;
  } else {
    scene.fog.near = 40; scene.fog.far = 95;
  }

  // 水面波动
  if (world.water) {
    world.water.position.y = world.waterY + Math.sin(performance.now() / 900) * 0.08;
    world.water.material.opacity = player.swim ? 0.08 : 0.62;
  }
}

// ---------- 主循环 ----------
let last = performance.now(), saveAcc = 0, started = false, levelSnapshot = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!state.started) { renderer.render(scene, camera); return; }

  if (!dead) {
    if (riding.active) {
      // 骑乘：输入加速，相机跟随（宠物位置由 updateRiding 同步）
      const sp = ANIMALS[riding.pet.id].speed;
      const before = player.group.position.clone();
      updatePlayer(dt, { ...input, run: true }, camera);
    } else {
      updatePlayer(dt, input, camera);
    }
    survivalTick(dt);
    updateRiding(dt, player.group);
    updateMobsWrap(dt, now / 1000);
    updatePets(dt, now / 1000, scene, player.group.position, petAttack);
    updateEggs(dt, scene, player.group.position);
    if (hatchResult) {
      const h = hatchResult;
      toast('🐣 宠物蛋孵化了：' + ANIMALS[h.id].icon + ' ' + h.name + '！', 'rare');
      clearHatchResult();
    }
    updateMagic(dt);
    updateNodes(now / 1000);
    if (state.level !== levelSnapshot) {
      levelSnapshot = state.level;
      toast('🎊 升级到 Lv.' + state.level + '！解锁了新图纸', 'rare');
    }
  }

  updateEnvironment(dt);
  updateHint();
  hudTick(dt);

  // 受伤红屏
  const flash = getDamageFlash();
  canvas.style.boxShadow = flash > 0 ? ('inset 0 0 120px rgba(255,30,20,' + flash + ')') : 'none';

  saveAcc += dt;
  if (saveAcc > 8) { saveAcc = 0; save(); }

  renderer.render(scene, camera);
}

// 动物 AI 包装（含玩家受伤）
function updateMobsWrap(dt, now) {
  const mobUpdate = (function () {
    // 直接引用 entities 的 updateMobs
    return _updateMobsRef;
  })();
  mobUpdate(dt, now, player.group.position, scene, (dmg) => {
    if (!dead) damagePlayer(dmg);
  });
}
import { updateMobs as _updateMobsRef } from './entities.js';

function petAttack(enemy, dmg) {
  const r = hurtMob(enemy, dmg, false, performance.now() / 1000);
  if (r === 'dead') {
    const drops = enemy.def.drop;
    for (const id in drops) { const n = randInt(drops[id][0], drops[id][1]); if (n > 0) addItem(id, n); }
    addXp(enemy.def.xp || 4);
    removeMob(enemy, scene);
  }
}

// 渲染一次帮助页背景
renderer.setClearColor(0x0b1612);

// 调试钩子
if (location.search.includes('debug')) {
  window.__G = { THREE, scene, camera, player, world, state, mobs, startGame,
    overview() {
      const c = new THREE.Vector3(0, 95, 0);
      camera.position.copy(c); camera.lookAt(0, 0, 0);
      player.group.visible = false;
      return 'overview';
    } };
}