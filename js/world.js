// ===== 体素世界：地形 / 水面 / 资源节点 / 工作台·营火 =====
import * as THREE from '../lib/three.module.js';
import { BIOMES, NODES, WORLD } from './config.js';
import { makeNoise2D, mulberry32, rand, randInt, clamp } from './utils.js';

export const TILE = 1;
const HALF = WORLD.half;
const SIZE = HALF * 2;

export const world = {
  group: null,
  nodeGroup: null,
  water: null,
  waterY: WORLD.waterLevel + 0.35,
  nodes: [],
  benches: [],   // 工作台位置
  fires: [],     // 营火位置（也用于烹饪与孵化加速）
  fireLights: [],
  noiseH: null, noiseD: null,
  seed: 1234,
  spawn: new THREE.Vector3(HALF * 0.5, 10, HALF * 0.5),
};

export function biomeAtXZ(x, z) {
  const gx = clamp(Math.floor((x + HALF) / WORLD.sectorSize), 0, WORLD.sectors - 1);
  const gy = clamp(Math.floor((z + HALF) / WORLD.sectorSize), 0, WORLD.sectors - 1);
  return BIOMES.find(b => b.gx === gx && b.gy === gy) || BIOMES[1];
}
export function isOcean(x, z) { return biomeAtXZ(x, z).key === 'ocean'; }

// 地形高度函数
export function heightAt(x, z) {
  const n1 = world.noiseH(x * 0.08, z * 0.08);
  const n2 = world.noiseH(x * 0.2 + 90, z * 0.2 + 90);
  let h = 6 + (n1 - 0.5) * 7 + (n2 - 0.5) * 2.4;
  const b = biomeAtXZ(x, z);
  if (b.key === 'ocean') h = 3.2 + (n1 - 0.5) * 2.2;           // 海床
  if (b.key === 'beach') h = 5.4 + (n1 - 0.5) * 1.6;
  if (b.key === 'snow') h += 2.2;
  if (b.key === 'jungle') h += 1.2;
  if (b.key === 'desert') h += 0.6 + (n2 - 0.5) * 3.4;         // 沙丘
  return Math.floor(h);
}

const MAT = {};
function mat(color, rough = 0.95) {
  return new THREE.MeshLambertMaterial({ color, roughness: rough });
}

const boxGeo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
const boxGeoT = new THREE.BoxGeometry(0.9, 0.9, 0.9);

function shadeColor(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

// ===== 主构建 =====
export function buildWorld(scene, seed) {
  world.seed = seed;
  world.noiseH = makeNoise2D(seed);
  world.noiseD = makeNoise2D(seed + 777);

  world.group = new THREE.Group();
  world.nodeGroup = new THREE.Group();
  scene.add(world.group);
  scene.add(world.nodeGroup);

  MAT.grass = mat(0x7db454); MAT.sand = mat(0xe8d29a); MAT.snow = mat(0xf4faff);
  MAT.jungle = mat(0x4c9442); MAT.desert = mat(0xe0bd76); MAT.seabed = mat(0xc9a86a);
  MAT.dirt = mat(0x7a5636); MAT.stone = mat(0x8a8a92); MAT.deep = mat(0x5d5d66);
  MAT.trunk = mat(0x7a5230); MAT.leaf = mat(0x3d8b45); MAT.leafD = mat(0x2f7238);
  MAT.rock = mat(0x90909a); MAT.iron = mat(0xb08860); MAT.crystalM = new THREE.MeshLambertMaterial({ color: 0x66e0ff, emissive: 0x1a6f88 });
  MAT.cactus = mat(0x4a9e50); MAT.wheat = mat(0xd9c24b); MAT.coralM = mat(0xff6f8f);
  MAT.coralB = mat(0xff9a4b); MAT.shellM = mat(0xffd8e2); MAT.oyster = mat(0x8a6f5a);
  MAT.palm = mat(0xc8a060); MAT.benchM = mat(0x9c6b3f); MAT.fireM = new THREE.MeshLambertMaterial({ color: 0xff7a20, emissive: 0xff5000 });
  MAT.log = mat(0x6e4a28); MAT.ruin = mat(0x8e9aa4); MAT.gold = new THREE.MeshLambertMaterial({ color: 0xffd24b, emissive: 0x8a5f00 });
  MAT.pine = mat(0x2e6b3c);

  buildTerrain();
  buildOcean(scene);
  scatterNodes();
  buildCamp(scene);
  buildRuin();

  // 出生点：草原中心，修正到地面
  const sx = HALF + WORLD.sectorSize * 0.5, sz = HALF + WORLD.sectorSize * 0.5;
  world.spawn.set(sx + rand(-6, 6), heightAt(sx, sz) + 2, sz + rand(-6, 6));
}
// ===== 地形柱体：每群系一种顶部材质，侧面统一泥土色，合并 BufferGeometry =====
function buildTerrain() {
  // key -> {topColor, sideColor}
  const conf = {
    grass:  [0x7db454, 0x6b4a2e], sand: [0xe8d29a, 0x8a7042],
    snow:   [0xf4faff, 0x9aaab8], jungle: [0x4c9442, 0x54402c],
    desert: [0xe0bd76, 0x9c7848], seabed: [0xc9a86a, 0x6e5a3e],
  };
  const keyOf = (b) => ({ plains: 'grass', beach: 'sand', snow: 'snow', jungle: 'jungle', desert: 'desert', ocean: 'seabed' }[b.key] || 'grass');
  const groups = {};
  for (const k in conf) groups[k] = [];
  for (let x = -HALF; x < HALF; x++) {
    for (let z = -HALF; z < HALF; z++) {
      const h = heightAt(x, z);
      groups[keyOf(biomeAtXZ(x, z))].push([x + 0.5, h + 1, z + 0.5, h + 1]);
    }
  }
  const rnd = mulberry32(world.seed + 5);
  const box = new THREE.BoxGeometry(1, 1, 1); // 单位盒，随后矩阵缩放定位
  for (const key in groups) {
    const arr = groups[key];
    if (!arr.length) continue;
    const topMat = new THREE.MeshLambertMaterial({ color: conf[key][0] });
    const sideMat = new THREE.MeshLambertMaterial({ color: conf[key][1] });
    const im = new THREE.InstancedMesh(box, [sideMat, topMat, sideMat, sideMat, sideMat, sideMat], arr.length);
    const dummy = object3D();
    const col = new THREE.Color();
    arr.forEach((p, i) => {
      dummy.position.set(p[0], p[3] / 2, p[2]);
      dummy.scale.set(1, p[3], 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      im.setColorAt(i, col.setHex(0xffffff).multiplyScalar(0.88 + rnd() * 0.24));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    world.group.add(im);
  }
}
function object3D() { return new THREE.Object3D(); }
// ===== 海洋水面（半透明）+ 海底光 =====
function buildOcean(scene) {
  const geo = new THREE.PlaneGeometry(WORLD.sectorSize, WORLD.sectorSize, 1, 1);
  const wm = new THREE.MeshLambertMaterial({ color: 0x2f9fd0, transparent: true, opacity: 0.62 });
  world.water = new THREE.Mesh(geo, wm);
  world.water.rotation.x = -Math.PI / 2;
  // 海洋区块位于 gx=1,gy=2，世界坐标 x∈[0,40], z∈[40,80] → 中心(20,60)
  world.water.position.set(HALF / 2, world.waterY, HALF + WORLD.sectorSize / 2);
  scene.add(world.water);
}
// ===== 资源节点散布 =====
function scatterNodes() {
  const rnd = mulberry32(world.seed + 31);
  for (const b of BIOMES) {
    const x0 = -HALF + b.gx * WORLD.sectorSize;
    const z0 = -HALF + b.gy * WORLD.sectorSize;
    const area = WORLD.sectorSize * WORLD.sectorSize;
    for (const type in b.nodes) {
      const count = Math.floor(area * b.density * 0.13 * b.nodes[type]);
      for (let i = 0; i < count; i++) {
        const x = x0 + 2 + rnd() * (WORLD.sectorSize - 4);
        const z = z0 + 2 + rnd() * (WORLD.sectorSize - 4);
        // 出生安全区不放攻击性阻挡（草原中心 10 格内少放树）
        if (b.key === 'plains' && Math.hypot(x - world.spawn.x, z - world.spawn.z) < 7) continue;
        createNode(type, Math.floor(x) + 0.5, Math.floor(z) + 0.5);
      }
    }
  }
}

let nodeUid = 1;
function createNode(type, x, z) {
  const def = NODES[type];
  const y = heightAt(x - 0.5, z - 0.5) + 1;
  const g = new THREE.Group();
  g.position.set(x, y, z);
  buildNodeMesh(type, g);
  g.userData = { isNode: true, uid: nodeUid++, type, hp: def.hp, maxHp: def.hp, alive: true, respawnAt: 0 };
  world.nodeGroup.add(g);
  world.nodes.push(g);
}

function v(m, w, h, d, x, y, z, parent) {
  const mesh = new THREE.Mesh(boxGeoT, m);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2 - 0.45, z);
  parent.add(mesh);
  return mesh;
}

function buildNodeMesh(type, g) {
  const trunkTop = () => {};
  if (type === 'tree') {
    v(MAT.trunk, 0.7, 3, 0.7, 0, 0, 0, g);
    v(MAT.leaf, 2.4, 1.6, 2.4, 0, 2.4, 0, g);
    v(MAT.leafD, 1.8, 1.4, 1.8, 0, 3.4, 0, g);
  } else if (type === 'pinetree') {
    v(MAT.trunk, 0.6, 2.4, 0.6, 0, 0, 0, g);
    v(MAT.pine, 2.6, 1.2, 2.6, 0, 2, 0, g);
    v(MAT.pine, 2, 1.2, 2, 0, 3, 0, g);
    v(MAT.snow, 1.5, 0.7, 1.5, 0, 3.9, 0, g);
  } else if (type === 'bigtree') {
    v(MAT.trunk, 1, 5, 1, 0, 0, 0, g);
    v(MAT.leafD, 3.2, 2, 3.2, 0, 4.4, 0, g);
    v(MAT.leaf, 2.6, 1.8, 2.6, 0, 5.8, 0, g);
  } else if (type === 'palm') {
    v(MAT.palm, 0.7, 4, 0.7, 0, 0, 0, g);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = v(MAT.leafD, 1.8, 0.3, 0.8, Math.cos(a) * 1, 3.9, Math.sin(a) * 1, g);
      leaf.rotation.y = -a;
    }
  } else if (type === 'cactus') {
    v(MAT.cactus, 0.8, 3, 0.8, 0, 0, 0, g);
    v(MAT.cactus, 0.6, 1.2, 0.6, 0.8, 1.2, 0, g);
    v(MAT.cactus, 0.5, 1, 0.5, -0.8, 1.8, 0, g);
  } else if (type === 'bush') {
    v(MAT.leaf, 1.6, 1.1, 1.6, 0, 0.2, 0, g);
    v(MAT.coralB, 0.4, 0.4, 0.4, 0.4, 0.6, 0.3, g);
  } else if (type === 'wheat') {
    for (let i = 0; i < 5; i++) {
      const w = v(MAT.wheat, 0.18, 1.1, 0.18, rand(-0.5, 0.5), 0, rand(-0.5, 0.5), g);
      w.rotation.z = rand(-0.15, 0.15);
    }
  } else if (type === 'herb') {
    v(MAT.leafD, 1, 0.7, 1, 0, 0.1, 0, g);
    v(MAT.crystalM, 0.25, 0.3, 0.25, 0.3, 0.6, 0.2, g);
  } else if (type === 'rock' || type === 'oyster') {
    const m = type === 'oyster' ? MAT.oyster : MAT.rock;
    v(m, 1.8, 1.2, 1.6, 0, 0, 0, g);
    v(m, 0.9, 0.7, 0.9, 0.6, 0.1, 0.4, g);
  } else if (type === 'ironrock') {
    v(MAT.rock, 1.8, 1.3, 1.8, 0, 0, 0, g);
    v(MAT.iron, 0.5, 0.5, 0.5, 0.4, 0.7, 0.3, g);
    v(MAT.iron, 0.4, 0.4, 0.4, -0.5, 0.4, -0.2, g);
  } else if (type === 'crystalrock') {
    v(MAT.ruin, 1.6, 1.1, 1.6, 0, 0, 0, g);
    v(MAT.crystalM, 0.35, 1.2, 0.35, 0.4, 0.6, 0, g).rotation.z = 0.2;
    v(MAT.crystalM, 0.3, 1.6, 0.3, -0.4, 0.5, 0.3, g).rotation.z = -0.25;
    v(MAT.crystalM, 0.25, 0.9, 0.25, 0, 0.4, -0.5, g);
  } else if (type === 'coral') {
    v(MAT.coralM, 0.4, 2, 0.4, 0, 0, 0, g);
    v(MAT.coralB, 0.35, 1.2, 0.35, 0.5, 0, 0.2, g);
    v(MAT.coralM, 0.3, 0.9, 0.3, -0.4, 0, -0.3, g);
  } else if (type === 'ruinegg') {
    v(MAT.ruin, 1.2, 0.9, 1.2, 0, 0, 0, g);
    v(MAT.gold, 0.5, 0.6, 0.5, 0, 0.7, 0, g);
  }
}
// ===== 出生营地：工作台 + 营火 =====
function buildCamp(scene) {
  // 放在草原中心附近
  const cx = HALF + WORLD.sectorSize * 0.5 + 4;
  const cz = HALF + WORLD.sectorSize * 0.5 + 4;
  const gy0 = heightAt(cx, cz) + 1;

  // 工作台
  const bench = new THREE.Group();
  bench.position.set(cx, gy0, cz);
  v(MAT.benchM, 3, 0.4, 1.6, 0, 1, 0, bench);
  v(MAT.log, 0.35, 1.2, 0.35, -1.2, 0, -0.5, bench);
  v(MAT.log, 0.35, 1.2, 0.35, 1.2, 0, -0.5, bench);
  v(MAT.log, 0.35, 1.2, 0.35, -1.2, 0, 0.5, bench);
  v(MAT.log, 0.35, 1.2, 0.35, 1.2, 0, 0.5, bench);
  v(MAT.iron, 0.7, 0.25, 0.7, 0.7, 1.4, 0, bench);
  world.nodeGroup.add(bench);
  world.benches.push(new THREE.Vector3(cx, gy0, cz));

  // 营火
  const fx = cx - 3, fz = cz + 1;
  const fy = heightAt(fx, fz) + 1;
  const fire = new THREE.Group();
  fire.position.set(fx, fy, fz);
  v(MAT.rock, 0.5, 0.4, 0.5, 0.7, 0, 0, fire);
  v(MAT.rock, 0.5, 0.4, 0.5, -0.7, 0, 0, fire);
  v(MAT.rock, 0.5, 0.4, 0.5, 0, 0, 0.7, fire);
  v(MAT.rock, 0.5, 0.4, 0.5, 0, 0, -0.7, fire);
  v(MAT.log, 1.6, 0.3, 0.3, 0, 0.3, 0, fire).rotation.y = 0.6;
  v(MAT.log, 1.6, 0.3, 0.3, 0, 0.3, 0, fire).rotation.y = -0.6;
  const flame = v(MAT.fireM, 0.7, 1, 0.7, 0, 0.5, 0, fire);
  flame.userData.flame = true;
  world.nodeGroup.add(fire);
  world.fires.push(new THREE.Vector3(fx, fy + 0.5, fz));

  const light = new THREE.PointLight(0xff8a30, 1.4, 16);
  light.position.set(fx, fy + 2, fz);
  scene.add(light);
  world.fireLights.push(light);
}

// ===== 海底遗迹：几根残破石柱 =====
function buildRuin() {
  const rnd = mulberry32(world.seed + 901);
  const cx = HALF / 2, cz = HALF + WORLD.sectorSize / 2;
  for (let i = 0; i < 7; i++) {
    const x = cx + rand(-15, 15);
    const z = cz + rand(-15, 15);
    const h = randInt(2, 5);
    const y = heightAt(x, z) + 1;
    const p = new THREE.Group();
    p.position.set(x, y, z);
    v(MAT.ruin, 1.1, h, 1.1, 0, 0, 0, p);
    if (rnd() > 0.5) v(MAT.ruin, 1.5, 0.4, 1.5, 0, h, 0, p);
    world.nodeGroup.add(p);
  }
}

// ===== 节点查询 / 破坏 / 重生 =====
export function nearestNode(pos, range = 2.6, requireUnderwater = null) {
  let best = null, bd = range;
  for (const n of world.nodes) {
    if (!n.userData.alive) continue;
    if (requireUnderwater === true && !NODES[n.userData.type].underwater) continue;
    const d = Math.hypot(n.position.x - pos.x, n.position.z - pos.z);
    if (d < bd) {
      const dy = Math.abs(n.position.y - pos.y);
      if (dy < 4) { bd = d; best = n; }
    }
  }
  return best;
}

export function breakNode(node) {
  const def = NODES[node.userData.type];
  node.userData.alive = false;
  node.visible = false;
  if (def.respawn > 0) node.userData.respawnAt = performance.now() / 1000 + def.respawn;
  const drops = {};
  for (const id in def.drops) {
    const [a, b] = def.drops[id];
    const n = randInt(a, b);
    if (n > 0) drops[id] = n;
  }
  return drops;
}

export function updateNodes(now) {
  for (const n of world.nodes) {
    if (!n.userData.alive && n.userData.respawnAt && now >= n.userData.respawnAt) {
      n.userData.alive = true; n.visible = true;
      n.userData.hp = NODES[n.userData.type].hp;
      n.userData.respawnAt = 0;
    }
  }
  // 营火火焰闪烁
  const t = now;
  world.fireLights.forEach((l, i) => { l.intensity = 1.2 + Math.sin(t * 9 + i * 2) * 0.25; });
}

// 附近是否有工作台 / 营火
export function nearStation(pos, list, range = 4.5) {
  for (const p of list) if (Math.hypot(p.x - pos.x, p.z - pos.z) < range && Math.abs(p.y - pos.y) < 4) return true;
  return false;
}