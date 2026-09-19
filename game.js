/* ============================================================
   校优秀 · 3D沙盒生存  game.js
   ============================================================ */
"use strict";

/* ---------------- 噪声工具 ---------------- */
function hash2(x, y) { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }
function smooth(t) { return t * t * (3 - 2 * t); }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { s += vnoise(x * f, y * f) * amp; amp *= 0.5; f *= 2; }
  return s;
}
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- 场景基础 ---------------- */
const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x87b5e0, 60, 260);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a5a3a, 0.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 1.1);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -80; sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80; sun.shadow.camera.bottom = -80;
sun.shadow.camera.far = 300;
scene.add(sun);
scene.add(sun.target);

/* ---------------- 地形与地貌 ---------------- */
const WORLD = 400, WATER_Y = 0;

function biomeAt(x, z) {
  if (z < -140) return "ocean";
  if (z < -95) return "beach";
  if (x < -110) return "snow";
  if (x > 110) return "desert";
  if (z > 110) return "jungle";
  return "grass";
}
const BIOME_NAME = { grass:"草原", desert:"沙漠", jungle:"丛林", beach:"海滩", snow:"雪原", ocean:"海底" };

function terrainHeight(x, z) {
  let h = fbm(x * 0.02 + 7, z * 0.02 + 3) * 9 - 2 + fbm(x * 0.09, z * 0.09) * 1.6;
  const b = biomeAt(x, z);
  if (b === "ocean") {
    const t = clamp((-140 - z) / 50, 0, 1);
    h = -4 - t * 8 - fbm(x * 0.05, z * 0.05) * 3;
  } else if (b === "beach") {
    const t = clamp((-95 - z) / 45, 0, 1);
    h = h * (1 - t) + (1.5 - t * 5) * t * 2 - t * 3;
  } else if (b === "desert") {
    h = fbm(x * 0.03, z * 0.03) * 5 + Math.sin(x * 0.08) * 0.8;
  } else if (b === "snow") {
    h = fbm(x * 0.025, z * 0.025) * 11;
  } else if (b === "jungle") {
    h = fbm(x * 0.03, z * 0.03) * 7;
  }
  return h;
}

const BIOME_COLOR = {
  grass: [0x5f9e4a, 0x6fae54], desert: [0xd9b878, 0xe6c98c], jungle: [0x2f7a3d, 0x3f9450],
  beach: [0xe8d9a0, 0xf0e2b4], snow: [0xe8eef4, 0xffffff], ocean: [0x2a4a6e, 0x1e3a5a]
};
function buildTerrain() {
  const seg = 160;
  const geo = new THREE.PlaneGeometry(WORLD, WORLD, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cA = new THREE.Color(), cB = new THREE.Color(), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const b = biomeAt(x, z);
    cA.setHex(BIOME_COLOR[b][0]); cB.setHex(BIOME_COLOR[b][1]);
    c.copy(cA).lerp(cB, hash2(x * 3.1, z * 2.7));
    if (h < WATER_Y + 0.4 && b !== "ocean") c.lerp(new THREE.Color(0xe8d9a0), 0.6);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
buildTerrain();

/* 水面 */
const waterGeo = new THREE.PlaneGeometry(WORLD, WORLD, 48, 48);
waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({
  color: 0x2e7fc2, transparent: true, opacity: 0.62
}));
water.position.y = WATER_Y;
scene.add(water);
const waterBase = waterGeo.attributes.position.array.slice();

/* 简易天空太阳 */
const sunBall = new THREE.Mesh(new THREE.SphereGeometry(6, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: false }));
scene.add(sunBall);
/* ---------------- 资源节点 ---------------- */
const nodes = [];   // {type, mesh, x,z,y, hp, maxHp, res, needTool, alive, respawn}
const NODE_DEFS = {
  tree:   { hp: 3, res: "wood",  needTool: "axe",     name: "树木" },
  pine:   { hp: 3, res: "wood",  needTool: "axe",     name: "雪松" },
  cactus: { hp: 2, res: "fiber", needTool: null,      name: "仙人掌" },
  rock:   { hp: 4, res: "stone", needTool: "pick",    name: "岩石" },
  iron:   { hp: 5, res: "iron",  needTool: "pick",    name: "铁矿" },
  gem:    { hp: 6, res: "gem",   needTool: "pick",    name: "宝石矿" },
  bush:   { hp: 1, res: "fiber", needTool: null,      name: "灌木" },
  berry:  { hp: 1, res: "berry", needTool: null,      name: "浆果丛" },
  coral:  { hp: 2, res: "coral", needTool: null,      name: "珊瑚" },
  egg:    { hp: 1, res: "petegg",needTool: null,      name: "神秘宠物蛋" }
};
const MAT = {
  trunk: new THREE.MeshLambertMaterial({ color: 0x7a5230 }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x3f8f3f }),
  pineleaf: new THREE.MeshLambertMaterial({ color: 0x2e6b4f }),
  snowleaf: new THREE.MeshLambertMaterial({ color: 0xdfe9f2 }),
  cactus: new THREE.MeshLambertMaterial({ color: 0x4f9e5a }),
  rock: new THREE.MeshLambertMaterial({ color: 0x8d8d94 }),
  iron: new THREE.MeshLambertMaterial({ color: 0x9a7b5a }),
  gem: new THREE.MeshLambertMaterial({ color: 0x7fe0ff, emissive: 0x2277aa }),
  bush: new THREE.MeshLambertMaterial({ color: 0x4a8f3f }),
  berry: new THREE.MeshLambertMaterial({ color: 0xd94f6a }),
  coral1: new THREE.MeshLambertMaterial({ color: 0xff7f9a, emissive: 0x551122 }),
  coral2: new THREE.MeshLambertMaterial({ color: 0xffb27f, emissive: 0x552211 }),
  egg: new THREE.MeshLambertMaterial({ color: 0xcfa8ff, emissive: 0x4422aa })
};
function shadowed(m) { m.castShadow = true; return m; }

function makeNodeMesh(type) {
  const g = new THREE.Group();
  if (type === "tree") {
    const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 7), MAT.trunk)); t.position.y = 1.5;
    const l = shadowed(new THREE.Mesh(new THREE.SphereGeometry(2, 8, 7), MAT.leaf)); l.position.y = 4.2; l.scale.y = 1.2;
    g.add(t, l);
  } else if (type === "pine") {
    const t = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 2.4, 7), MAT.trunk)); t.position.y = 1.2;
    for (let i = 0; i < 3; i++) {
      const cone = shadowed(new THREE.Mesh(new THREE.ConeGeometry(2 - i * 0.5, 2.2, 8), i === 0 ? MAT.pineleaf : MAT.snowleaf));
      cone.position.y = 2.6 + i * 1.5; g.add(cone);
    }
    g.add(t);
  } else if (type === "cactus") {
    const b = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 3.2, 8), MAT.cactus)); b.position.y = 1.6;
    const a1 = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 6), MAT.cactus));
    a1.position.set(0.8, 2.0, 0); a1.rotation.z = Math.PI / 2.4;
    g.add(b, a1);
  } else if (type === "rock" || type === "iron" || type === "gem") {
    const m = type === "rock" ? MAT.rock : type === "iron" ? MAT.iron : MAT.gem;
    const r = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(type === "gem" ? 1.0 : 1.4, 0), m));
    r.position.y = 0.8; r.rotation.set(rand(0, 3), rand(0, 3), 0);
    g.add(r);
    if (type !== "rock") {
      const r2 = shadowed(new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), m));
      r2.position.set(1.1, 0.4, 0.6); g.add(r2);
    }
  } else if (type === "bush" || type === "berry") {
    const b = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1.0, 7, 6), MAT.bush)); b.position.y = 0.7; b.scale.y = 0.75;
    g.add(b);
    if (type === "berry") for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), MAT.berry);
      s.position.set(rand(-0.8, 0.8), rand(0.5, 1.2), rand(-0.8, 0.8)); g.add(s);
    }
  } else if (type === "coral") {
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, rand(1, 2.2), 5), i % 2 ? MAT.coral1 : MAT.coral2);
      c.position.set(rand(-0.8, 0.8), 0.6, rand(-0.8, 0.8)); c.rotation.z = rand(-0.3, 0.3); g.add(c);
    }
  } else if (type === "egg") {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), MAT.egg);
    e.scale.y = 1.3; e.position.y = 0.9; g.add(e);
  }
  return g;
}

function scatterNodes() {
  const plan = [
    ["tree", 90, b => b === "grass" || b === "jungle"],
    ["pine", 55, b => b === "snow"],
    ["cactus", 35, b => b === "desert"],
    ["rock", 70, b => b !== "ocean"],
    ["iron", 26, b => b === "snow" || b === "desert" || b === "jungle"],
    ["gem", 10, b => b === "snow" || b === "ocean"],
    ["bush", 60, b => b === "grass" || b === "jungle"],
    ["berry", 40, b => b === "grass" || b === "jungle"],
    ["coral", 45, b => b === "ocean"],
    ["egg", 6, b => b === "ocean"]
  ];
  for (const [type, count, ok] of plan) {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < count * 40) {
      const x = rand(-WORLD / 2 + 8, WORLD / 2 - 8), z = rand(-WORLD / 2 + 8, WORLD / 2 - 8);
      const b = biomeAt(x, z);
      if (!ok(b)) continue;
      const y = terrainHeight(x, z);
      if (b !== "ocean" && y < WATER_Y + 0.3) continue;
      const mesh = makeNodeMesh(type);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rand(0, Math.PI * 2);
      scene.add(mesh);
      const def = NODE_DEFS[type];
      nodes.push({ type, mesh, x, z, y, hp: def.hp, maxHp: def.hp, res: def.res, needTool: def.needTool, alive: true, respawn: 0 });
      placed++;
    }
  }
}
scatterNodes();

/* 海底遗迹 */
function buildRuins() {
  const ruinMat = new THREE.MeshLambertMaterial({ color: 0x6a7a8c });
  for (let i = 0; i < 3; i++) {
    const cx = rand(-120, 120), cz = rand(-195, -160);
    const g = new THREE.Group();
    for (let p = 0; p < 5; p++) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, rand(3, 6), 8), ruinMat);
      pil.position.set(Math.cos(p / 5 * 6.28) * 4, 1.5, Math.sin(p / 5 * 6.28) * 4);
      g.add(pil);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, 0.8, 10), ruinMat);
    top.position.y = 4.2; top.rotation.y = rand(0, 1); g.add(top);
    g.position.set(cx, terrainHeight(cx, cz), cz);
    scene.add(g);
  }
}
buildRuins();

/* ---------------- 生物 ---------------- */
const ANIMAL_DEFS = {
  wolf:   { name: "野狼", type: "combat",      hp: 6,  color: 0x8a8f9a, food: "meat",  biomes: ["grass", "snow"], size: 1.0 },
  sheep:  { name: "绵羊", type: "production",  hp: 4,  color: 0xf0ead8, food: "berry", biomes: ["grass"], size: 0.9, prod: "fiber" },
  cow:    { name: "野牛", type: "production",  hp: 8,  color: 0x7a5a42, food: "berry", biomes: ["grass"], size: 1.2, prod: "milk" },
  rabbit: { name: "玉兔", type: "ornamental",  hp: 2,  color: 0xffffff, food: "berry", biomes: ["grass", "snow"], size: 0.45 },
  fox:    { name: "灵狐", type: "ornamental",  hp: 3,  color: 0xe08a3c, food: "meat",  biomes: ["jungle", "snow"], size: 0.6 },
  turtle: { name: "海龟", type: "mount",       hp: 10, color: 0x3f7f5f, food: "coral", biomes: ["ocean"], size: 1.1 }
};
const animals = [];
function makeAnimalMesh(def) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: def.color });
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.8), mat));
  body.position.y = 0.8;
  const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), mat));
  head.position.set(0.85, 1.15, 0);
  g.add(body, head);
  for (let i = 0; i < 4; i++) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat);
    leg.position.set(i < 2 ? 0.45 : -0.45, 0.35, i % 2 ? 0.25 : -0.25);
    g.add(leg);
  }
  g.scale.setScalar(def.size);
  return g;
}
function spawnAnimals() {
  for (const key of Object.keys(ANIMAL_DEFS)) {
    const def = ANIMAL_DEFS[key];
    const n = key === "turtle" ? 5 : 9;
    let placed = 0, tries = 0;
    while (placed < n && tries++ < 400) {
      const x = rand(-180, 180), z = rand(-190, 180);
      const b = biomeAt(x, z);
      if (!def.biomes.includes(b)) continue;
      const y = terrainHeight(x, z);
      if (b !== "ocean" && y < WATER_Y + 0.3) continue;
      const mesh = makeAnimalMesh(def);
      mesh.position.set(x, y, z);
      scene.add(mesh);
      animals.push({
        kind: key, def, mesh, hp: def.hp, maxHp: def.hp,
        state: "wild", affinity: 0, wanderT: 0, dir: rand(0, 6.28),
        stunT: 0, prodT: 0, hostile: false, x, z, y
      });
      placed++;
    }
  }
}
spawnAnimals();
/* ---------------- 物品定义 ---------------- */
const ITEMS = {
  wood:   { name: "木材",   icon: "🪵" }, stone: { name: "石头", icon: "🪨" },
  fiber:  { name: "纤维",   icon: "🌿" }, iron:  { name: "铁矿", icon: "⛓️" },
  gem:    { name: "宝石",   icon: "💎" }, coral: { name: "珊瑚", icon: "🪸" },
  berry:  { name: "浆果",   icon: "🫐", eat: { hunger: 15 } },
  meat:   { name: "生肉",   icon: "🥩", eat: { hunger: 10 } },
  cooked: { name: "烤肉",   icon: "🍖", eat: { hunger: 40 } },
  milk:   { name: "牛奶",   icon: "🥛", eat: { hunger: 10, thirst: 20 } },
  bottle: { name: "水壶",   icon: "🍶", drink: { thirst: 50 } },
  axe:    { name: "石斧",   icon: "🪓", tool: "axe",   tier: 1 },
  pick:   { name: "石镐",   icon: "⛏️", tool: "pick",  tier: 1 },
  sword:  { name: "铁剑",   icon: "🗡️", tool: "weapon", tier: 2, dmg: 4 },
  club:   { name: "木棒",   icon: "🏏", tool: "club",  tier: 1, dmg: 1 },
  staff:  { name: "魔法杖", icon: "🪄", tool: "staff", tier: 3 },
  trap:   { name: "捕捉器", icon: "🪤" },
  collar: { name: "项圈",   icon: "📿" },
  petegg: { name: "宠物蛋", icon: "🥚" },
  workbench:{ name: "工作台", icon: "🗃️", place: "workbench" },
  campfire: { name: "营火",   icon: "🔥", place: "campfire" },
  wall:   { name: "木墙",   icon: "🧱", place: "wall" },
  rope:   { name: "绳子",   icon: "🪢" },
  gemwand:{ name: "宝石护符", icon: "🧿" }
};
const inv = {};   // itemKey -> count
function addItem(k, n = 1) {
  inv[k] = (inv[k] || 0) + n;
  refreshHotbar(); refreshInvPanel();
}
function takeItem(k, n = 1) {
  if ((inv[k] || 0) < n) return false;
  inv[k] -= n; if (inv[k] <= 0) delete inv[k];
  refreshHotbar(); refreshInvPanel();
  return true;
}
const hasItem = k => (inv[k] || 0) > 0;

/* ---------------- 玩家 ---------------- */
const player = {
  hp: 100, maxHp: 100, hunger: 100, thirst: 100, energy: 100,
  lv: 1, xp: 0, xpNext: 30,
  pos: new THREE.Vector3(0, 0, 40), vel: new THREE.Vector3(),
  yaw: 0, onGround: true, crouch: false, speedBoost: 0, riding: null,
  alive: true
};
const playerMesh = new THREE.Group();
{
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3f6fd8 });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xf0c8a0 });
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 10), bodyMat));
  body.position.y = 0.95; body.name = "body";
  const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), skinMat));
  head.position.y = 1.85;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshBasicMaterial({ color: 0x222222 }));
  eyeL.position.set(0.12, 1.9, 0.32);
  const eyeR = eyeL.clone(); eyeR.position.x = -0.12;
  const tool = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), new THREE.MeshLambertMaterial({ color: 0x9a7b4a }));
  tool.position.set(0.55, 1.1, 0.2); tool.rotation.z = 0.5; tool.name = "tool";
  playerMesh.add(body, head, eyeL, eyeR, tool);
}
scene.add(playerMesh);

/* 相机 */
const cam = { yaw: 0, pitch: 0.42, dist: 9 };
let dragging = false, lastMX = 0, lastMY = 0;
addEventListener("mousedown", e => { if (e.target === canvas) { dragging = true; lastMX = e.clientX; lastMY = e.clientY; } });
addEventListener("mousemove", e => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - lastMX) * 0.005;
  cam.pitch = clamp(cam.pitch + (e.clientY - lastMY) * 0.004, 0.05, 1.3);
  lastMX = e.clientX; lastMY = e.clientY;
});
addEventListener("mouseup", () => dragging = false);
addEventListener("wheel", e => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 4, 20); });

/* 键盘 */
const keys = {};
addEventListener("keydown", e => {
  keys[e.code] = true;
  if (!started) return;
  if (e.code === "Space") doJump();
  if (e.code === "KeyC") toggleCrouch();
  if (e.code === "KeyQ") doAttack();
  if (e.code === "KeyE") doGather();
  if (e.code === "KeyF") doFeed();
  if (e.code === "KeyG") doCapture();
  if (e.code === "KeyR") doRide();
  if (e.code === "KeyB") toggleCraft();
  if (e.code.startsWith("Digit")) {
    const i = +e.code.slice(5) - 1;
    if (i >= 0 && i < 8) selectSlot(i);
  }
});
addEventListener("keyup", e => keys[e.code] = false);

/* ---------------- 快捷栏 ---------------- */
const HOTBAR_ORDER = ["axe", "pick", "club", "sword", "staff", "trap", "berry", "cooked"];
let selectedSlot = 0;
const hotbarEl = document.getElementById("hotbar");
for (let i = 0; i < 8; i++) {
  const d = document.createElement("div");
  d.className = "slot"; d.dataset.i = i;
  d.innerHTML = `<span class="key">${i + 1}</span><span class="icon"></span><span class="name"></span><span class="count"></span>`;
  d.onclick = () => selectSlot(i);
  hotbarEl.appendChild(d);
}
function selectSlot(i) {
  selectedSlot = i;
  document.querySelectorAll(".slot").forEach((s, j) => s.classList.toggle("active", j === i));
  const k = HOTBAR_ORDER[i];
  if (k && hasItem(k)) msg(`已选中 ${ITEMS[k].icon} ${ITEMS[k].name}`);
}
function refreshHotbar() {
  document.querySelectorAll(".slot").forEach((s, i) => {
    const k = HOTBAR_ORDER[i];
    const has = k && hasItem(k);
    s.querySelector(".icon").textContent = has ? ITEMS[k].icon : "";
    s.querySelector(".name").textContent = has ? ITEMS[k].name : "";
    s.querySelector(".count").textContent = has && inv[k] > 1 ? inv[k] : "";
    s.style.opacity = has ? 1 : 0.45;
  });
}
function selectedItem() {
  const k = HOTBAR_ORDER[selectedSlot];
  return hasItem(k) ? k : null;
}
function bestTool() {
  const s = selectedItem();
  if (s && ITEMS[s].tool) return s;
  for (const t of ["sword", "axe", "pick", "club", "staff"]) if (hasItem(t)) return t;
  return null;
}

/* ---------------- 背包面板 ---------------- */
function refreshInvPanel() {
  const el = document.getElementById("inv-panel");
  el.innerHTML = Object.keys(inv).filter(k => inv[k] > 0)
    .map(k => `<span class="inv-item">${ITEMS[k].icon} ${ITEMS[k].name} <b>×${inv[k]}</b></span>`).join("");
}

/* ---------------- 消息 ---------------- */
const msgLog = document.getElementById("msg-log");
function msg(t) {
  const d = document.createElement("div");
  d.textContent = t;
  msgLog.appendChild(d);
  while (msgLog.children.length > 5) msgLog.removeChild(msgLog.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 6000);
}

/* ---------------- 经验/等级 ---------------- */
function gainXp(n) {
  player.xp += n;
  if (player.xp >= player.xpNext) {
    player.lv++; player.xp = 0; player.xpNext = Math.floor(player.xpNext * 1.6);
    player.maxHp += 10; player.hp = player.maxHp;
    msg(`🎉 升级！当前等级 Lv.${player.lv}，解锁新图纸`);
  }
}
/* ---------------- 建筑放置 ---------------- */
const buildings = [];  // {type, mesh, x, z}
function placeBuilding(kind) {
  const px = player.pos.x + Math.sin(player.yaw) * 3;
  const pz = player.pos.z + Math.cos(player.yaw) * 3;
  const py = terrainHeight(px, pz);
  let mesh;
  if (kind === "workbench") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), new THREE.MeshLambertMaterial({ color: 0x9a6b3f }));
    mesh.position.set(px, py + 0.5, pz);
  } else if (kind === "campfire") {
    mesh = new THREE.Group();
    const stones = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.22, 6, 10), MAT.rock);
    stones.rotation.x = Math.PI / 2; stones.position.y = 0.15;
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 7),
      new THREE.MeshBasicMaterial({ color: 0xff8c2e }));
    fire.position.y = 0.7; fire.name = "flame";
    const light = new THREE.PointLight(0xff9040, 1.2, 14);
    light.position.y = 1.2;
    mesh.add(stones, fire, light);
    mesh.position.set(px, py, pz);
  } else if (kind === "wall") {
    mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 2.2, 0.3), new THREE.MeshLambertMaterial({ color: 0xa07848 }));
    mesh.position.set(px, py + 1.1, pz);
    mesh.rotation.y = player.yaw;
  }
  shadowed(mesh);
  scene.add(mesh);
  buildings.push({ type: kind, mesh, x: px, z: pz });
  msg(`🏗️ 放置了 ${ITEMS[kind].name}`);
}
function nearBuilding(type, dist = 6) {
  return buildings.some(b => b.type === type &&
    Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < dist);
}

/* ---------------- 动作 ---------------- */
function useEnergy(n) {
  if (player.energy < n) { msg("⚡ 能量不足，休息一下！"); return false; }
  player.energy -= n; return true;
}
function doJump() {
  if (!player.onGround || !player.alive) return;
  if (!useEnergy(4)) return;
  player.vel.y = 8.5; player.onGround = false;
}
function toggleCrouch() {
  player.crouch = !player.crouch;
  document.getElementById("btn-crouch").classList.toggle("toggled", player.crouch);
}
function nearestAnimal(maxD) {
  let best = null, bd = maxD;
  for (const a of animals) {
    if (a.state === "dead") continue;
    const d = Math.hypot(a.mesh.position.x - player.pos.x, a.mesh.position.z - player.pos.z);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function doAttack() {
  if (!player.alive || !useEnergy(5)) return;
  const tool = bestTool();
  const dmg = tool === "sword" ? 4 : tool === "club" ? 2 : 1;
  const a = nearestAnimal(3.2);
  swingTool();
  if (!a) return;
  a.hp -= dmg;
  a.hostile = a.kind === "wolf";
  flashMesh(a.mesh);
  const stunLine = Math.max(1, Math.floor(a.maxHp * 0.35));
  if (a.state === "wild" && tool === "club" && a.hp <= stunLine) {
    a.hp = Math.max(a.hp, 1);
    a.state = "stunned"; a.stunT = 20;
    msg(`💫 ${a.def.name} 被击晕了！快投喂食物（F）`);
    return;
  }
  if (a.hp <= 0) {
    a.state = "dead";
    scene.remove(a.mesh);
    const drop = a.kind === "sheep" || a.kind === "rabbit" ? "meat" : a.kind === "turtle" ? "coral" : "meat";
    addItem(drop, 2);
    msg(`🥩 击败了 ${a.def.name}，获得 ${ITEMS[drop].name}×2`);
    gainXp(8);
  } else {
    msg(`⚔️ 攻击 ${a.def.name}（${Math.max(0, a.hp)}/${a.maxHp}）`);
  }
}
function nearestNode(maxD) {
  let best = null, bd = maxD;
  for (const n of nodes) {
    if (!n.alive) continue;
    const d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z);
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function doGather() {
  if (!player.alive) return;
  const n = nearestNode(3.4);
  if (!n) { msg("附近没有可采集的资源"); return; }
  const tool = bestTool();
  const toolType = tool ? ITEMS[tool].tool : null;
  if (n.needTool === "axe" && toolType !== "axe") { msg("🪓 需要装备石斧才能砍伐"); return; }
  if (n.needTool === "pick" && toolType !== "pick") { msg("⛏️ 需要装备石镐才能开采"); return; }
  if (!useEnergy(4)) return;
  swingTool();
  n.hp -= toolType ? 2 : 1;
  flashMesh(n.mesh);
  if (n.hp <= 0) {
    n.alive = false; n.respawn = 60;
    n.mesh.visible = false;
    const bonus = toolType ? 1 : 0;
    const amt = 2 + bonus;
    addItem(n.res, amt);
    if (n.type === "berry") addItem("berry", 1);
    if (n.type === "cactus") addItem("wood", 1);
    msg(`✅ 采集 ${NODE_DEFS[n.type].name}：${ITEMS[n.res].icon} ${ITEMS[n.res].name}×${amt}`);
    gainXp(4);
  } else {
    msg(`采集中… ${NODE_DEFS[n.type].name}（${n.hp}/${n.maxHp}）`);
  }
}
function doFeed() {
  const a = nearestAnimal(3.2);
  if (!a || a.state !== "stunned") {
    // 喝水/进食快捷
    const sel = selectedItem();
    if (sel && ITEMS[sel].eat) { eatItem(sel); return; }
    if (sel && ITEMS[sel].drink) { drinkItem(sel); return; }
    if (isInWater() || nearWater()) { player.thirst = clamp(player.thirst + 30, 0, 100); msg("💧 喝了水，口渴值 +30"); return; }
    msg("附近没有被击晕的生物（先选中食物可按 F 进食）");
    return;
  }
  const food = a.def.food;
  if (!hasItem(food)) { msg(`需要 ${ITEMS[food].icon} ${ITEMS[food].name} 来投喂 ${a.def.name}`); return; }
  takeItem(food, 1);
  a.affinity++;
  spawnHearts(a.mesh.position);
  msg(`💗 ${a.def.name} 亲密度 ${a.affinity}/3`);
  if (a.affinity >= 3) msg(`💞 ${a.def.name} 已信任你！按 G 使用捕捉器驯服`);
}
function doCapture() {
  const a = nearestAnimal(3.2);
  if (!a || a.state !== "stunned" || a.affinity < 3) { msg("需要亲密度满 3 的被击晕生物"); return; }
  if (!hasItem("trap") && !hasItem("collar")) { msg("🪤 需要捕捉器或项圈（可在合成台制作）"); return; }
  if (hasItem("trap")) takeItem("trap", 1); else takeItem("collar", 1);
  a.state = "tamed"; a.hostile = false;
  spawnHearts(a.mesh.position);
  msg(`🎊 成功驯服 ${a.def.name}！（${typeName(a.def.type)}）`);
  gainXp(15);
  refreshPetList();
}
function doRide() {
  if (player.riding) {
    player.riding = null; msg("已下坐骑"); return;
  }
  const a = nearestAnimal(3.5);
  if (a && a.state === "tamed" && a.def.type === "mount") {
    player.riding = a; msg(`🐢 骑上了 ${a.def.name}！移动速度提升`);
  } else msg("附近没有可骑乘的驯服坐骑");
}
function typeName(t) {
  return t === "combat" ? "战斗宠" : t === "production" ? "生产宠" : t === "mount" ? "坐骑" : "观赏宠";
}
function eatItem(k) {
  const e = ITEMS[k].eat;
  if (!takeItem(k, 1)) return;
  player.hunger = clamp(player.hunger + (e.hunger || 0), 0, 100);
  if (e.thirst) player.thirst = clamp(player.thirst + e.thirst, 0, 100);
  msg(`😋 吃掉了 ${ITEMS[k].name}`);
}
function drinkItem(k) {
  const d = ITEMS[k].drink;
  if (!takeItem(k, 1)) return;
  player.thirst = clamp(player.thirst + (d.thirst || 0), 0, 100);
  msg(`💧 使用了 ${ITEMS[k].name}`);
}
function hatchEgg() {
  if (!hasItem("petegg")) return;
  takeItem("petegg", 1);
  const kinds = ["turtle", "fox", "wolf"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const def = ANIMAL_DEFS[kind];
  const mesh = makeAnimalMesh(def);
  mesh.position.copy(player.pos).add(new THREE.Vector3(2, 0, 0));
  mesh.position.y = terrainHeight(mesh.position.x, mesh.position.z);
  scene.add(mesh);
  animals.push({ kind, def, mesh, hp: def.hp, maxHp: def.hp, state: "tamed", affinity: 3,
    wanderT: 0, dir: 0, stunT: 0, prodT: 0, hostile: false });
  msg(`🥚✨ 宠物蛋孵化出 ${def.name}！（${typeName(def.type)}）`);
  refreshPetList();
}

/* 特效 */
const effects = [];
function spawnHearts(pos) {
  for (let i = 0; i < 5; i++) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff5f8f }));
    h.position.copy(pos).add(new THREE.Vector3(rand(-1, 1), 1.5 + rand(0, 1), rand(-1, 1)));
    scene.add(h);
    effects.push({ mesh: h, t: 0, dur: 1.2, vy: 1.5 });
  }
}
function flashMesh(mesh) {
  mesh.traverse(o => { if (o.material && o.material.emissive) { o.material.emissive.setHex(0x884444); } });
  setTimeout(() => mesh.traverse(o => {
    if (o.material && o.material.emissive) o.material.emissive.setHex(o.material === MAT.gem ? 0x2277aa : o.material === MAT.egg ? 0x4422aa : 0x000000);
  }), 120);
}
let swingT = 0;
function swingTool() { swingT = 0.25; }
/* ---------------- 合成系统 ---------------- */
const RECIPES = [
  { out: "club",   name: "木棒",   mat: { wood: 2 },                lv: 1, bench: false, desc: "击晕生物的基础武器" },
  { out: "axe",    name: "石斧",   mat: { wood: 3, stone: 2 },      lv: 1, bench: false, desc: "砍伐树木" },
  { out: "pick",   name: "石镐",   mat: { wood: 3, stone: 3 },      lv: 1, bench: false, desc: "开采岩石与矿石" },
  { out: "campfire", name: "营火", mat: { wood: 4, stone: 2 },      lv: 1, bench: false, desc: "放置后取暖、烤肉" },
  { out: "workbench", name: "工作台", mat: { wood: 4 },             lv: 1, bench: false, desc: "解锁高级合成（放置生效）" },
  { out: "wall",   name: "木墙",   mat: { wood: 4 },                lv: 1, bench: true,  desc: "防御建筑" },
  { out: "trap",   name: "捕捉器", mat: { wood: 2, fiber: 2 },      lv: 1, bench: true,  desc: "驯服生物必备" },
  { out: "collar", name: "项圈",   mat: { fiber: 3, iron: 1 },      lv: 2, bench: true,  desc: "驯服生物（替代捕捉器）" },
  { out: "bottle", name: "水壶",   mat: { fiber: 2, stone: 1 },     lv: 1, bench: false, desc: "恢复口渴值 50" },
  { out: "cooked", name: "烤肉",   mat: { meat: 1 },                lv: 1, bench: "campfire", desc: "需在营火旁，饥饿 +40" },
  { out: "sword",  name: "铁剑",   mat: { wood: 2, iron: 3 },       lv: 2, bench: true,  desc: "强力武器，攻击 4" },
  { out: "staff",  name: "魔法杖", mat: { wood: 2, gem: 1 },        lv: 3, bench: true,  desc: "解锁魔法绘制" },
  { out: "rope",   name: "绳子",   mat: { fiber: 3 },               lv: 1, bench: false, desc: "自由合成常用材料" }
];
const craftPanel = document.getElementById("craft-panel");
let craftOpen = false;
function toggleCraft() {
  craftOpen = !craftOpen;
  craftPanel.style.display = craftOpen ? "block" : "none";
  if (craftOpen) renderRecipes();
}
document.getElementById("craft-close").onclick = toggleCraft;
document.querySelectorAll("#craft-panel .tab").forEach(t => {
  t.onclick = () => {
    document.querySelectorAll("#craft-panel .tab").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const free = t.dataset.tab === "free";
    document.getElementById("recipe-list").style.display = free ? "none" : "block";
    document.getElementById("free-craft").style.display = free ? "block" : "none";
    if (free) renderFreeCraft();
  };
});
function matText(mat) {
  return Object.entries(mat).map(([k, v]) => `${ITEMS[k].icon}${ITEMS[k].name}×${v}`).join(" + ");
}
function canCraft(r) {
  if (player.lv < r.lv) return { ok: false, why: `需要 Lv.${r.lv}` };
  if (r.bench === true && !nearBuilding("workbench")) return { ok: false, why: "需靠近工作台" };
  if (r.bench === "campfire" && !nearBuilding("campfire")) return { ok: false, why: "需靠近营火" };
  for (const [k, v] of Object.entries(r.mat)) if ((inv[k] || 0) < v) return { ok: false, why: "材料不足" };
  return { ok: true };
}
function renderRecipes() {
  const tip = document.getElementById("bench-tip");
  tip.textContent = nearBuilding("workbench") ? "🗃️ 已在工作台旁，高级配方可用"
    : nearBuilding("campfire") ? "🔥 已在营火旁，可以烤肉"
    : "💡 放置工作台/营火后可解锁对应配方";
  const el = document.getElementById("recipe-list");
  el.innerHTML = "";
  for (const r of RECIPES) {
    const chk = canCraft(r);
    const div = document.createElement("div");
    div.className = "recipe" + (player.lv < r.lv ? " locked" : "");
    div.innerHTML = `<div><span class="rname">${ITEMS[r.out].icon} ${r.name}</span>
      <span style="color:#7d93b8;font-size:11px">（Lv.${r.lv}）— ${r.desc}</span>
      <div class="rmat">${matText(r.mat)}</div></div>`;
    const btn = document.createElement("button");
    btn.textContent = chk.ok ? "合成" : chk.why;
    btn.disabled = !chk.ok;
    btn.onclick = () => {
      for (const [k, v] of Object.entries(r.mat)) takeItem(k, v);
      if (ITEMS[r.out].place) placeBuilding(r.out);
      else { addItem(r.out, 1); msg(`🛠️ 合成了 ${ITEMS[r.out].icon} ${r.name}`); }
      gainXp(6);
      renderRecipes();
    };
    div.appendChild(btn);
    el.appendChild(div);
  }
}
/* 自由合成：随机结果 */
const FREE_RESULTS = [
  { out: "rope",   w: 3, match: m => (m.fiber || 0) >= 2 },
  { out: "bottle", w: 2, match: m => m.fiber && m.stone },
  { out: "club",   w: 3, match: m => (m.wood || 0) >= 2 },
  { out: "axe",    w: 2, match: m => m.wood && m.stone },
  { out: "pick",   w: 2, match: m => m.wood && m.stone },
  { out: "collar", w: 1, match: m => m.fiber && m.iron },
  { out: "gemwand",w: 1, match: m => m.gem && m.fiber },
  { out: "trap",   w: 2, match: m => m.wood && m.fiber },
  { out: "cooked", w: 2, match: m => m.meat },
  { out: "stone",  w: 1, match: () => true }
];
function renderFreeCraft() {
  const sels = [document.getElementById("fc1"), document.getElementById("fc2"), document.getElementById("fc3")];
  sels.forEach((s, i) => {
    s.innerHTML = `<option value="">（空）</option>` +
      Object.keys(inv).filter(k => inv[k] > 0)
        .map(k => `<option value="${k}">${ITEMS[k].icon} ${ITEMS[k].name} ×${inv[k]}</option>`).join("");
  });
}
document.getElementById("fc-go").onclick = () => {
  const picks = ["fc1", "fc2", "fc3"].map(id => document.getElementById(id).value).filter(Boolean);
  if (picks.length < 2) { document.getElementById("fc-result").textContent = "至少选择 2 种材料"; return; }
  const matCount = {};
  for (const p of picks) {
    if (!takeItem(p, 1)) { renderFreeCraft(); return; }
    matCount[p] = (matCount[p] || 0) + 1;
  }
  const pool = FREE_RESULTS.filter(r => r.match(matCount));
  const total = pool.reduce((s, r) => s + r.w, 0);
  let roll = Math.random() * total, chosen = pool[pool.length - 1];
  for (const r of pool) { roll -= r.w; if (roll <= 0) { chosen = r; break; } }
  addItem(chosen.out, 1);
  document.getElementById("fc-result").textContent =
    `✨ 灵光一闪！合成了 ${ITEMS[chosen.out].icon} ${ITEMS[chosen.out].name}`;
  gainXp(5);
  renderFreeCraft();
};

/* ---------------- 魔法绘制 ---------------- */
const magicOverlay = document.getElementById("magic-overlay");
const magicCanvas = document.getElementById("magic-canvas");
const mctx = magicCanvas.getContext("2d");
let magicActive = false, stroke = [];
function openMagic() {
  if (!hasItem("staff")) { msg("🪄 需要魔法杖才能施法（Lv.3 工作台合成）"); return; }
  magicActive = true;
  magicOverlay.style.display = "block";
  mctx.clearRect(0, 0, 360, 360);
  stroke = [];
}
function closeMagic() { magicActive = false; magicOverlay.style.display = "none"; }
document.getElementById("btn-magic").onclick = openMagic;
magicOverlay.addEventListener("contextmenu", e => { e.preventDefault(); closeMagic(); });
function magicPos(e) {
  const r = magicCanvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return [p.clientX - r.left, p.clientY - r.top];
}
let drawing = false;
magicCanvas.addEventListener("pointerdown", e => { drawing = true; stroke = [magicPos(e)]; });
magicCanvas.addEventListener("pointermove", e => {
  if (!drawing) return;
  stroke.push(magicPos(e));
  mctx.strokeStyle = "#c99aff"; mctx.lineWidth = 5; mctx.lineCap = "round";
  mctx.beginPath();
  const n = stroke.length;
  mctx.moveTo(stroke[n - 2][0], stroke[n - 2][1]);
  mctx.lineTo(stroke[n - 1][0], stroke[n - 1][1]);
  mctx.stroke();
});
magicCanvas.addEventListener("pointerup", () => {
  drawing = false;
  if (stroke.length > 8) castSpell(recognize(stroke));
  closeMagic();
});
function recognize(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const first = pts[0], last = pts[pts.length - 1];
  const closed = Math.hypot(first[0] - last[0], first[1] - last[1]) < Math.max(w, h) * 0.35;
  if (closed && w > 40 && h > 40) {
    // 三角形检测：拐点数
    let corners = 0;
    for (let i = 10; i < pts.length - 10; i += 5) {
      const a1 = Math.atan2(pts[i][1] - pts[i - 10][1], pts[i][0] - pts[i - 10][0]);
      const a2 = Math.atan2(pts[i + 10][1] - pts[i][1], pts[i + 10][0] - pts[i][0]);
      let d = Math.abs(a1 - a2); if (d > Math.PI) d = 2 * Math.PI - d;
      if (d > 0.9) corners++;
    }
    if (corners >= 2 && corners <= 5 && Math.abs(w - h) < Math.max(w, h) * 0.7 && corners <= 3) return "bolt";
    return "fire";
  }
  if (h > w * 2 && h > 60) return "heal";
  if (w > h * 2 && w > 60) return "wind";
  return null;
}
function castSpell(kind) {
  if (!kind) { msg("🔮 图案无法识别，魔法消散了"); return; }
  if (!useEnergy(15)) return;
  if (kind === "fire") {
    let hit = 0;
    for (const a of animals) {
      if (a.state === "dead" || a.state === "tamed") continue;
      const d = Math.hypot(a.mesh.position.x - player.pos.x, a.mesh.position.z - player.pos.z);
      if (d < 8) { a.hp -= 3; hit++; flashMesh(a.mesh);
        if (a.hp <= 0) { a.state = "dead"; scene.remove(a.mesh); addItem("meat", 1); } }
    }
    burst(player.pos, 0xff7a2e);
    msg(`🔥 火球术！命中 ${hit} 个目标`);
  } else if (kind === "heal") {
    player.hp = clamp(player.hp + 30, 0, player.maxHp);
    burst(player.pos, 0x6effa8);
    msg("💚 治疗术！生命 +30");
  } else if (kind === "wind") {
    player.speedBoost = 10;
    burst(player.pos, 0x9adfff);
    msg("🌪️ 疾风术！移动速度提升 10 秒");
  } else if (kind === "bolt") {
    const a = nearestAnimal(12);
    if (a && a.state !== "tamed") {
      a.hp -= 5; flashMesh(a.mesh);
      if (a.hp <= 0) { a.state = "dead"; scene.remove(a.mesh); addItem("meat", 2); }
      burst(a.mesh.position, 0xfff06e);
      msg(`⚡ 落雷术击中 ${a.def.name}！`);
    } else msg("⚡ 落雷劈了个空…");
  }
}
function burst(pos, color) {
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.12, 5, 5), new THREE.MeshBasicMaterial({ color }));
    p.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
    scene.add(p);
    effects.push({ mesh: p, t: 0, dur: 0.8,
      vx: rand(-3, 3), vy: rand(1, 5), vz: rand(-3, 3) });
  }
}
/* ---------------- 宠物列表 ---------------- */
function refreshPetList() {
  const el = document.getElementById("pet-list");
  const tamed = animals.filter(a => a.state === "tamed");
  el.innerHTML = tamed.map(a =>
    `<div class="pet-chip">${a.def.type === "combat" ? "⚔️" : a.def.type === "production" ? "🏭" : a.def.type === "mount" ? "🐢" : "🎀"} ${a.def.name}</div>`).join("");
}

/* ---------------- 环境查询 ---------------- */
function isInWater() {
  return terrainHeight(player.pos.x, player.pos.z) < WATER_Y - 0.5 && player.pos.y < WATER_Y + 0.5;
}
function nearWater() {
  return terrainHeight(player.pos.x, player.pos.z) < WATER_Y + 1.2;
}
function temperature() {
  const b = biomeAt(player.pos.x, player.pos.z);
  if (b === "snow") return "cold";
  if (b === "desert") return "hot";
  if (isNight && b !== "ocean") return "cold";
  if (nearBuilding("campfire", 7)) return "warm";
  return "normal";
}

/* ---------------- 生存结算 ---------------- */
let statT = 0, isNight = false, dayT = 0.3;
function tickSurvival(dt) {
  statT += dt;
  if (statT < 1) return;
  statT = 0;
  const temp = temperature();
  let hungerDrain = 0.35, thirstDrain = 0.45;
  if (temp === "cold") hungerDrain *= 2.2;
  if (temp === "hot") thirstDrain *= 2.2;
  if (player.crouch) { hungerDrain *= 0.7; thirstDrain *= 0.7; }
  player.hunger = clamp(player.hunger - hungerDrain, 0, 100);
  player.thirst = clamp(player.thirst - thirstDrain, 0, 100);
  player.energy = clamp(player.energy + 2.2, 0, 100);
  if (player.hunger <= 0 || player.thirst <= 0) {
    player.hp -= 2;
    hurtFlash();
    if (player.hunger <= 0) msg("🍖 饥饿难耐，生命流失中！");
    if (player.thirst <= 0) msg("💧 严重脱水，生命流失中！");
  } else if (player.hunger > 60 && player.thirst > 60 && player.hp < player.maxHp) {
    player.hp = clamp(player.hp + 0.8, 0, player.maxHp);
  }
  if (player.hp <= 0 && player.alive) {
    player.alive = false;
    msg("💀 你倒下了… 5 秒后重生");
    setTimeout(() => {
      player.hp = player.maxHp; player.hunger = 70; player.thirst = 70; player.energy = 60;
      player.pos.set(0, terrainHeight(0, 40) + 1, 40);
      player.alive = true;
      msg("✨ 你在草原营地重生了");
    }, 5000);
  }
}
let hurtT = null;
function hurtFlash() {
  const v = document.getElementById("vignette");
  v.className = "hurt";
  clearTimeout(hurtT);
  hurtT = setTimeout(() => v.className = "", 400);
}

/* ---------------- HUD 刷新 ---------------- */
const $ = id => document.getElementById(id);
function refreshHUD() {
  $("hp-bar").firstElementChild.style.width = (player.hp / player.maxHp * 100) + "%";
  $("hunger-bar").firstElementChild.style.width = player.hunger + "%";
  $("thirst-bar").firstElementChild.style.width = player.thirst + "%";
  $("energy-bar").firstElementChild.style.width = player.energy + "%";
  $("lv").textContent = player.lv;
  $("xp").textContent = player.xp + "/" + player.xpNext;
  const b = biomeAt(player.pos.x, player.pos.z);
  $("biome").textContent = BIOME_NAME[b];
  $("clock").textContent = isNight ? "🌙 夜晚" : "☀️ 白天";
  const temp = temperature();
  const tw = $("temp-warn");
  if (temp === "cold") { tw.textContent = "❄️ 寒冷：饥饿消耗加快"; tw.className = "cold"; }
  else if (temp === "hot") { tw.textContent = "🔥 炎热：口渴消耗加快"; tw.className = "hot"; }
  else if (temp === "warm") { tw.textContent = "🔥 营火旁：温暖舒适"; tw.className = ""; }
  else tw.textContent = "";
  const v = $("vignette");
  if (v.className !== "hurt") v.className = temp === "cold" ? "colds" : temp === "hot" ? "hots" : "";
}

/* ---------------- 交互提示 ---------------- */
function refreshTip() {
  const tip = $("interact-tip");
  const a = nearestAnimal(3.2);
  if (a && a.state === "stunned") {
    tip.style.display = "block";
    tip.textContent = a.affinity >= 3 ? `💞 按 G 捕捉 ${a.def.name}` : `💫 ${a.def.name} 已击晕 — 按 F 投喂 ${ITEMS[a.def.food].name}（${a.affinity}/3）`;
    return;
  }
  if (a && a.state === "tamed" && a.def.type === "mount") {
    tip.style.display = "block"; tip.textContent = `🐢 按 R 骑乘 ${a.def.name}`; return;
  }
  const n = nearestNode(3.4);
  if (n) {
    tip.style.display = "block";
    const need = n.needTool === "axe" ? "（需石斧）" : n.needTool === "pick" ? "（需石镐）" : "";
    tip.textContent = `⛏️ 按 E 采集 ${NODE_DEFS[n.type].name}${need}`;
    return;
  }
  if (hasItem("petegg")) { tip.style.display = "block"; tip.textContent = "🥚 按 H 孵化宠物蛋"; return; }
  tip.style.display = "none";
}
addEventListener("keydown", e => { if (e.code === "KeyH") hatchEgg(); });

/* ---------------- 生物 AI ---------------- */
function tickAnimals(dt, t) {
  for (const a of animals) {
    if (a.state === "dead") continue;
    const m = a.mesh;
    if (a.state === "stunned") {
      a.stunT -= dt;
      m.rotation.z = Math.sin(t * 3) * 0.08;
      if (a.stunT <= 0) { a.state = "wild"; a.affinity = 0; a.hp = a.maxHp; m.rotation.z = 0; }
      continue;
    }
    if (a.state === "tamed") {
      const target = player.pos;
      const d = Math.hypot(m.position.x - target.x, m.position.z - target.z);
      if (player.riding === a) {
        m.position.set(player.pos.x, m.position.y, player.pos.z);
      } else if (d > 3.5) {
        const ang = Math.atan2(target.x - m.position.x, target.z - m.position.z);
        const sp = Math.min(6, d);
        m.position.x += Math.sin(ang) * sp * dt;
        m.position.z += Math.cos(ang) * sp * dt;
        m.rotation.y = ang;
      }
      // 生产宠产出
      if (a.def.prod) {
        a.prodT += dt;
        if (a.prodT > 30) { a.prodT = 0; addItem(a.def.prod, 1); msg(`🏭 ${a.def.name} 产出了 ${ITEMS[a.def.prod].name}`); }
      }
      // 战斗宠护主
      if (a.def.type === "combat") {
        for (const w of animals) {
          if (w.kind === "wolf" && w.hostile && w.state === "wild") {
            const dd = Math.hypot(w.mesh.position.x - m.position.x, w.mesh.position.z - m.position.z);
            if (dd < 6) { w.hp -= 2 * dt; flashMesh(w.mesh);
              if (w.hp <= 0) { w.state = "dead"; scene.remove(w.mesh); addItem("meat", 1); msg("⚔️ 你的战宠击退了野狼！"); } }
          }
        }
      }
    } else {
      // 野生游荡
      a.wanderT -= dt;
      if (a.wanderT <= 0) { a.wanderT = rand(2, 5); a.dir = rand(0, Math.PI * 2); }
      const sp = a.hostile ? 3.2 : 0.8;
      if (a.hostile) {
        a.dir = Math.atan2(player.pos.x - m.position.x, player.pos.z - m.position.z);
        const d = Math.hypot(player.pos.x - m.position.x, player.pos.z - m.position.z);
        if (d < 1.6) { player.hp -= 6 * dt; hurtFlash(); }
        if (d > 25) a.hostile = false;
      }
      m.position.x += Math.sin(a.dir) * sp * dt;
      m.position.z += Math.cos(a.dir) * sp * dt;
      m.rotation.y = a.dir;
    }
    const gy = terrainHeight(m.position.x, m.position.z);
    m.position.y += (gy - m.position.y) * Math.min(1, dt * 8);
  }
}

/* ---------------- 主循环 ---------------- */
const clock = new THREE.Clock();
let started = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (started && player.alive) {
    /* 移动 */
    const speed = (player.crouch ? 2.2 : 5.2) * (player.speedBoost > 0 ? 1.6 : 1) * (player.riding ? 1.8 : 1) * (isInWater() ? 0.45 : 1);
    let mx = 0, mz = 0;
    if (keys.KeyW) mz += 1; if (keys.KeyS) mz -= 1;
    if (keys.KeyA) mx += 1; if (keys.KeyD) mx -= 1;
    if (mx || mz) {
      const ang = Math.atan2(mx, mz) + cam.yaw;
      player.pos.x += Math.sin(ang) * speed * dt;
      player.pos.z += Math.cos(ang) * speed * dt;
      player.yaw = ang;
      player.pos.x = clamp(player.pos.x, -WORLD / 2 + 4, WORLD / 2 - 4);
      player.pos.z = clamp(player.pos.z, -WORLD / 2 + 4, WORLD / 2 - 4);
      player.energy = clamp(player.energy - dt * 1.2, 0, 100);
    }
    /* 重力 */
    player.vel.y -= 22 * dt;
    player.pos.y += player.vel.y * dt;
    const gy = terrainHeight(player.pos.x, player.pos.z);
    const floor = Math.max(gy, isInWater() ? gy : gy);
    if (player.pos.y <= floor) { player.pos.y = floor; player.vel.y = 0; player.onGround = true; }
    if (isInWater()) { player.pos.y = Math.min(player.pos.y, WATER_Y - 0.6); player.onGround = true; player.vel.y = 0; }
    if (player.speedBoost > 0) player.speedBoost -= dt;

    tickSurvival(dt);
    tickAnimals(dt, t);

    /* 节点重生 */
    for (const n of nodes) {
      if (!n.alive) { n.respawn -= dt; if (n.respawn <= 0) { n.alive = true; n.hp = n.maxHp; n.mesh.visible = true; } }
    }
    refreshHUD();
    refreshTip();
  }
  /* 玩家网格 */
  playerMesh.position.copy(player.pos);
  playerMesh.rotation.y = player.yaw;
  playerMesh.scale.y = player.crouch ? 0.65 : 1;
  const toolMesh = playerMesh.getObjectByName("tool");
  if (toolMesh) {
    if (swingT > 0) { swingT -= dt; toolMesh.rotation.x = -1.6 * (swingT / 0.25); }
    else toolMesh.rotation.x = 0;
    const sel = selectedItem();
    toolMesh.visible = !!sel;
  }
  /* 相机 */
  const cx = player.pos.x - Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cz = player.pos.z - Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const cy = player.pos.y + Math.sin(cam.pitch) * cam.dist + 1.5;
  camera.position.set(cx, Math.max(cy, terrainHeight(cx, cz) + 0.6), cz);
  camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
  /* 昼夜 */
  dayT = (dayT + dt / 240) % 1;
  const sunAng = dayT * Math.PI * 2 - Math.PI / 2;
  const sunH = Math.sin(sunAng);
  isNight = sunH < -0.05;
  sun.position.set(player.pos.x + Math.cos(sunAng) * 80, Math.max(sunH, 0.05) * 100 + 5, player.pos.z + 40);
  sun.target.position.copy(player.pos);
  sun.intensity = clamp(sunH + 0.25, 0.12, 1.15);
  hemi.intensity = clamp(sunH * 0.6 + 0.45, 0.18, 0.8);
  sunBall.position.set(player.pos.x + Math.cos(sunAng) * 180, sunH * 160, player.pos.z - 60);
  sunBall.visible = sunH > -0.1;
  const dayC = new THREE.Color(0x87b5e0), nightC = new THREE.Color(0x0a1030);
  const skyC = nightC.clone().lerp(dayC, clamp(sunH + 0.35, 0, 1));
  scene.background = skyC; scene.fog.color.copy(skyC);
  /* 水面波动 */
  const wp = water.geometry.attributes.position;
  for (let i = 0; i < wp.count; i++) {
    wp.setZ(i, Math.sin(t * 1.4 + waterBase[i * 3] * 0.15 + waterBase[i * 3 + 1] * 0.2) * 0.18);
  }
  wp.needsUpdate = true;
  /* 特效 */
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.t += dt;
    e.mesh.position.y += (e.vy || 0) * dt;
    if (e.vx) { e.mesh.position.x += e.vx * dt; e.mesh.position.z += e.vz * dt; e.vy -= 9 * dt; }
    e.mesh.scale.setScalar(Math.max(0.01, 1 - e.t / e.dur));
    if (e.t > e.dur) { scene.remove(e.mesh); effects.splice(i, 1); }
  }
  /* 营火火焰 */
  for (const b of buildings) {
    if (b.type === "campfire") {
      const f = b.mesh.getObjectByName("flame");
      if (f) f.scale.setScalar(1 + Math.sin(t * 9 + b.x) * 0.15);
    }
  }
  renderer.render(scene, camera);
}
animate();

/* ---------------- 按钮绑定 ---------------- */
document.getElementById("btn-attack").onclick = doAttack;
document.getElementById("btn-gather").onclick = doGather;
document.getElementById("btn-jump").onclick = doJump;
document.getElementById("btn-crouch").onclick = toggleCrouch;
document.getElementById("btn-craft").onclick = toggleCraft;

/* ---------------- 开始 ---------------- */
document.getElementById("start-btn").onclick = () => {
  document.getElementById("start-screen").style.display = "none";
  started = true;
  player.pos.set(0, terrainHeight(0, 40), 40);
  addItem("wood", 4); addItem("berry", 3);
  msg("🌍 欢迎来到沙盒世界！先采集木材和石头吧");
  msg("💡 按 B 打开合成，WASD 移动，鼠标拖拽转视角");
  refreshHotbar(); refreshInvPanel(); selectSlot(0);
};

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
/* 调试句柄（供自动化测试） */
window.G = { player, animals, nodes, inv, addItem, doGather, doAttack, doFeed, doCapture, placeBuilding, nearestNode, nearestAnimal, castSpell, hatchEgg, terrainHeight, biomeAt };