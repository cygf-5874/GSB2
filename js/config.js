// ===== 全局静态配置：物品 / 节点 / 配方 / 群系 / 动物 =====

// 物品表：type = material(材料) | tool(工具) | weapon(武器) | food(食物) | misc(杂项/蛋/捕捉器)
// tool 含 toolKind: axe/pick/rod, tier；weapon 含 dmg
export const ITEMS = {
  wood:        { name: '木材',     icon: '🪵', type: 'material', desc: '砍伐树木获得，万物之基' },
  stick:       { name: '木棍',     icon: '🥢', type: 'material', desc: '木材加工而成' },
  stone:       { name: '石头',     icon: '🪨', type: 'material', desc: '随处可见的岩石' },
  fiber:       { name: '纤维',     icon: '🌾', type: 'material', desc: '采集草本植物获得，可做绳索' },
  berry:       { name: '浆果',     icon: '🫐', type: 'food', hunger: 14, thirst: 6,  desc: '酸甜的野果，少量充饥解渴' },
  fruit:       { name: '丛林果',   icon: '🥭', type: 'food', hunger: 18, thirst: 12, desc: '丛林特产，甜美多汁' },
  cactusfruit: { name: '仙人掌果', icon: '🌵', type: 'food', hunger: 8,  thirst: 26, desc: '沙漠里的补水神器' },
  coconut:     { name: '椰子',     icon: '🥥', type: 'food', hunger: 12, thirst: 22, desc: '海滩椰树的馈赠' },
  wheat:       { name: '野麦',     icon: '🌾', type: 'material', desc: '草原上的野生麦束' },
  herb:        { name: '草药',     icon: '🌿', type: 'material', desc: '治愈药剂的材料' },
  rawmeat:     { name: '生肉',     icon: '🥩', type: 'food', hunger: 12, desc: '生肉不顶饿，建议烤熟' },
  cookedmeat:  { name: '烤肉',     icon: '🍖', type: 'food', hunger: 42, desc: '营火烤制，香气四溢' },
  fish:        { name: '鲜鱼',     icon: '🐟', type: 'food', hunger: 30, thirst: 6, desc: '海底捕获的高蛋白' },
  ironore:     { name: '铁矿石',   icon: '⛏️', type: 'material', desc: '需要铁镐开采' },
  iron:        { name: '铁锭',     icon: '🔩', type: 'material', desc: '铁矿石烧炼而成' },
  crystal:     { name: '能量水晶', icon: '💎', type: 'material', desc: '深海溶洞中的稀有晶体' },
  gem:         { name: '宝石',     icon: '💍', type: 'material', desc: '自由合成的珍贵辅料' },
  shell:       { name: '贝壳',     icon: '🐚', type: 'material', desc: '海滩与海底的漂亮贝壳' },
  coral:       { name: '珊瑚枝',   icon: '🪸', type: 'material', desc: '海底珊瑚，色彩绚丽' },
  waterskin:   { name: '水袋',     icon: '🧪', type: 'food', thirst: 55, reusable: true, desc: '装满淡水的皮囊，喝完变空袋' },
  emptybottle: { name: '空水袋',   icon: '🍶', type: 'misc', desc: '在水源处打水即可装满' },
  potion:      { name: '治疗药水', icon: '🧪', type: 'misc', heal: 50, desc: '瞬间回复 50 点生命' },

  // 工具/武器
  woodaxe:  { name: '木斧',   icon: '🪓', type: 'tool', toolKind: 'axe',  tier: 1, dmg: 8,  dur: 60,  desc: '入门伐木工具，也能防身' },
  pick:     { name: '石镐',   icon: '⛏️', type: 'tool', toolKind: 'pick', tier: 1, dmg: 7,  dur: 70,  desc: '开采石头与煤矿' },
  rod:      { name: '木棒',   icon: '🏏', type: 'weapon', dmg: 4, dur: 50, stun: true, desc: '伤害低，但能把野兽敲晕以便驯服' },
  stoneaxe: { name: '石斧',   icon: '🪓', type: 'tool', toolKind: 'axe',  tier: 2, dmg: 14, dur: 100, desc: '更锋利的斧子' },
  ironpick: { name: '铁镐',   icon: '⛏️', type: 'tool', toolKind: 'pick', tier: 2, dmg: 16, dur: 140, desc: '可开采铁矿石' },
  sword:    { name: '铁剑',   icon: '🗡️', type: 'weapon', dmg: 28, dur: 160, desc: '可靠的主战武器' },
  crystalpick:{ name:'水晶镐', icon:'⛏️', type: 'tool', toolKind:'pick', tier: 3, dmg: 22, dur: 220, desc: '可开采能量水晶' },
  wand:     { name: '魔法杖', icon: '🪄', type: 'weapon', dmg: 3, dur: 999, magic: true, desc: '绘制法阵释放元素魔法' },
  armor:    { name: '铁甲',   icon: '🛡️', type: 'armor', defense: 8, dur: 200, desc: '减少受到的伤害' },

  // 驯服 / 宠物
  trap:    { name: '捕捉器', icon: '🪤', type: 'misc', desc: '对冒爱心的眩晕野兽使用即可驯服' },
  collar:  { name: '宠物项圈', icon: '⭕', type: 'misc', desc: '更精致的捕捉道具，成功率更高' },
  egg:     { name: '宠物蛋', icon: '🥚', type: 'egg', rarity: 1, desc: '放置在宠物面板中孵化，可得战斗宠' },
  rare_egg:{ name: '稀有宠物蛋', icon: '🪺', type: 'egg', rarity: 2, desc: '海底遗迹的稀有蛋，可孵出强力坐骑' },
};

// 资源节点：harvest 需要 toolKind + tier(0=徒手)
export const NODES = {
  tree:     { name: '树木', icon: '🌳', hp: 3, tool: 'axe', tier: 0, drops: { wood: [2,4], stick: [0,2] }, respawn: 40, color: 0x3d8b45 },
  pinetree: { name: '松树', icon: '🌲', hp: 4, tool: 'axe', tier: 1, drops: { wood: [3,5], fiber: [0,1] }, respawn: 45 },
  bigtree:  { name: '巨木', icon: '🌴', hp: 6, tool: 'axe', tier: 1, drops: { wood: [4,7], fruit: [1,3] }, respawn: 60 },
  rock:     { name: '石块', icon: '🪨', hp: 3, tool: 'pick', tier: 0, drops: { stone: [2,4] }, respawn: 50 },
  ironrock: { name: '铁矿脉', icon: '⛰️', hp: 5, tool: 'pick', tier: 2, drops: { ironore: [1,3], stone: [1,2] }, respawn: 80 },
  crystalrock:{ name: '水晶矿', icon: '💠', hp: 7, tool: 'pick', tier: 3, drops: { crystal: [1,2] }, respawn: 110 },
  bush:     { name: '浆果丛', icon: '🫐', hp: 1, tool: null, tier: 0, drops: { berry: [2,4], fiber: [0,1] }, respawn: 35 },
  wheat:    { name: '野麦', icon: '🌾', hp: 1, tool: null, tier: 0, drops: { wheat: [2,3], fiber: [1,2] }, respawn: 30 },
  herb:     { name: '药草', icon: '🌿', hp: 1, tool: null, tier: 0, drops: { herb: [1,3] }, respawn: 40 },
  cactus:   { name: '仙人掌', icon: '🌵', hp: 2, tool: null, tier: 0, drops: { cactusfruit: [1,2], fiber: [1,2] }, respawn: 45 },
  palm:     { name: '椰树', icon: '🌴', hp: 3, tool: 'axe', tier: 0, drops: { wood: [2,3], coconut: [1,2] }, respawn: 50 },
  coral:    { name: '珊瑚礁', icon: '🪸', hp: 2, tool: null, tier: 0, drops: { coral: [1,3], shell: [0,1] }, respawn: 40, underwater: true },
  oyster:   { name: '深海贝', icon: '🦪', hp: 1, tool: null, tier: 0, drops: { shell: [1,2], gem: [0,1] }, respawn: 55, underwater: true },
  ruinegg:  { name: '遗迹宝箱', icon: '🏺', hp: 2, tool: null, tier: 0, drops: { rare_egg: [1,1], gem: [1,2], crystal: [1,2] }, respawn: 0, underwater: true },
};

// 生物群系（2×3 区块布局：东西两块各 3 行）
// 0,0 雪原 | 1,0 草原(出生)
// 0,1 丛林 | 1,1 海滩
// 0,2 沙漠 | 1,2 海洋
export const BIOMES = [
  { key: 'snow',    name: '雪原', gx: 0, gy: 0, ground: 0xe8f2f7, top: 0xf4faff, temp: -8, density: 0.10,
    nodes: { pinetree: 3, rock: 3, ironrock: 1.2, herb: 1 }, ambient: 0xbfd8e8, fog: 0xdceaf2 },
  { key: 'plains',  name: '草原', gx: 1, gy: 0, ground: 0x6b9e4a, top: 0x7db454, temp: 20, density: 0.12,
    nodes: { tree: 2.5, bush: 3, wheat: 3, rock: 2, herb: 1.5 }, ambient: 0xbfe0c0, fog: 0xcfe8d8 },
  { key: 'jungle',  name: '丛林', gx: 0, gy: 1, ground: 0x3f7a38, top: 0x4c9442, temp: 27, density: 0.20,
    nodes: { bigtree: 4, tree: 2, herb: 2.5, bush: 1.5, ironrock: 0.6 }, ambient: 0xa0d0a0, fog: 0xb8dcc0 },
  { key: 'beach',   name: '海滩', gx: 1, gy: 1, ground: 0xe6d29a, top: 0xf0dfa8, temp: 26, density: 0.08,
    nodes: { palm: 2.5, rock: 1.5, bush: 1, cactus: 0.5 }, ambient: 0xe0e0b0, fog: 0xe8eed0 },
  { key: 'desert',  name: '沙漠', gx: 0, gy: 2, ground: 0xd9b36c, top: 0xe8c884, temp: 42, density: 0.07,
    nodes: { cactus: 2.5, rock: 2, ironrock: 0.5 }, ambient: 0xe8d0a0, fog: 0xf0e0c0 },
  { key: 'ocean',   name: '海底秘境', gx: 1, gy: 2, ground: 0xc9a86a, top: 0xd9bd82, temp: 18, density: 0.14,
    nodes: { coral: 3, oyster: 2, crystalrock: 1, ruinegg: 0.25 }, ambient: 0x80c8e0, fog: 0x60b8d8, ocean: true },
];

export const WORLD = {
  sectors: 2,        // 东西区块数
  sectorSize: 40,    // 每区块边长（格）
  half: 40,          // 世界半径 = sectors*sectorSize/2
  waterLevel: 6,     // 海洋区水面高度
};

// 按坐标取群系（含跨区平滑）
export function biomeAt(x, z) {
  const gx = THREE_clamp(Math.floor((x + WORLD.half) / WORLD.sectorSize), 0, WORLD.sectors - 1);
  const gy = THREE_clamp(Math.floor((z + WORLD.half) / WORLD.sectorSize), 0, WORLD.sectors - 1);
  return BIOMES.find(b => b.gx === gx && b.gy === gy) || BIOMES[1];
}
function THREE_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
// 图纸配方：station=null 徒手，'bench' 工作台，'fire' 营火；level 解锁等级
export const RECIPES = [
  { out: 'stick',    n: 2, cost: { wood: 1 },             level: 1, station: null,  name: '木棍' },
  { out: 'woodaxe',  n: 1, cost: { wood: 3, stick: 2, stone: 2 }, level: 1, station: null, name: '木斧' },
  { out: 'pick',     n: 1, cost: { wood: 2, stick: 2, stone: 3 }, level: 1, station: null, name: '石镐' },
  { out: 'rod',      n: 1, cost: { wood: 2, fiber: 2 },   level: 1, station: null,  name: '木棒（驯服用）' },
  { out: 'trap',     n: 1, cost: { stick: 4, fiber: 3, stone: 2 }, level: 2, station: null, name: '捕捉器' },
  { out: 'waterskin',n: 1, cost: { fiber: 5, shell: 1 },  level: 2, station: null,  name: '水袋（先备好再去打水）' },
  { out: 'cookedmeat', n: 1, cost: { rawmeat: 1 },        level: 1, station: 'fire', name: '烤肉' },
  { out: 'potion',   n: 1, cost: { herb: 3, berry: 2, coconut: 1 }, level: 2, station: 'bench', name: '治疗药水' },
  { out: 'stoneaxe', n: 1, cost: { wood: 3, stone: 5, stick: 2 }, level: 2, station: 'bench', name: '石斧' },
  { out: 'ironpick', n: 1, cost: { wood: 3, stick: 2, iron: 4 }, level: 3, station: 'bench', name: '铁镐' },
  { out: 'sword',    n: 1, cost: { wood: 2, stick: 1, iron: 5 }, level: 3, station: 'bench', name: '铁剑' },
  { out: 'armor',    n: 1, cost: { iron: 8, fiber: 5 },   level: 4, station: 'bench', name: '铁甲' },
  { out: 'iron',     n: 1, cost: { ironore: 1 },          level: 3, station: 'fire', name: '铁锭' },
  { out: 'collar',   n: 1, cost: { fiber: 4, iron: 2, gem: 1 }, level: 4, station: 'bench', name: '宠物项圈' },
  { out: 'crystalpick', n: 1, cost: { iron: 4, crystal: 3, stick: 2 }, level: 5, station: 'bench', name: '水晶镐' },
  { out: 'wand',     n: 1, cost: { wood: 3, crystal: 2, gem: 1 }, level: 5, station: 'bench', name: '魔法杖' },
];

// 自由合成：投入 2~5 件材料，按稀有度权重随机产出
export const FREE_CRAFT = {
  min: 2, max: 5,
  // 材料稀有度分（用于决定档位）
  rarity: { wood: 1, stick: 1, fiber: 1, wheat: 1, stone: 1, berry: 1, fruit: 1, cactusfruit: 1,
            coconut: 1, herb: 2, rawmeat: 1, shell: 2, coral: 3, ironore: 3, iron: 4,
            gem: 6, crystal: 7 },
  common:  { stick: 3, stone: 2, fiber: 2, berry: 2, waterskin: 1, potion: 1 },
  uncommon:{ stoneaxe: 2, trap: 2, cookedmeat: 2, potion: 2, gem: 1, waterskin: 2 },
  rare:    { sword: 2, ironpick: 2, armor: 1, collar: 1, wand: 1, crystal: 2, egg: 2 },
  epic:    { wand: 2, crystalpick: 1, armor: 2, rare_egg: 2 },
};

// 野生动物表
// kind: fight 战斗宠 / prod 生产宠 / beauty 观赏宠 / mount 坐骑（蛋孵出）
export const ANIMALS = {
  rabbit:  { name: '野兔', icon: '🐰', hp: 14, dmg: 0,  food: 'berry',      kind: 'beauty', tame: 1, xp: 4,  drop: { rawmeat: [1,2] }, biomes: ['plains','snow'], speed: 2.2, flee: true },
  sheep:   { name: '绵羊', icon: '🐑', hp: 26, dmg: 2,  food: 'wheat',      kind: 'prod', tame: 2, xp: 6,  drop: { rawmeat: [2,3], fiber: [1,2] }, biomes: ['plains'], speed: 1.4, produce: { fiber: [0,1] }, produceTime: 50 },
  chicken: { name: '野鸡', icon: '🐔', hp: 12, dmg: 0,  food: 'wheat',      kind: 'prod', tame: 1, xp: 4,  drop: { rawmeat: [1,1] }, biomes: ['plains','jungle'], speed: 1.8, flee: true, produce: { egg: [0,1] }, produceTime: 45 },
  pig:     { name: '野猪', icon: '🐗', hp: 34, dmg: 8,  food: 'berry',      kind: 'mount', tame: 3, xp: 8,  drop: { rawmeat: [2,4] }, biomes: ['plains','beach'], speed: 2.0, charge: true },
  wolf:    { name: '荒狼', icon: '🐺', hp: 40, dmg: 12, food: 'rawmeat',    kind: 'fight', tame: 3, xp: 10, drop: { rawmeat: [2,3] }, biomes: ['snow','plains','jungle'], speed: 2.8, hostile: true, power: 12 },
  leopard: { name: '丛林豹', icon: '🐆', hp: 46, dmg: 16, food: 'fish',    kind: 'fight', tame: 4, xp: 14, drop: { rawmeat: [2,4] }, biomes: ['jungle'], speed: 3.2, hostile: true, power: 18 },
  parrot:  { name: '彩鹦鹉', icon: '🦜', hp: 10, dmg: 0, food: 'fruit',    kind: 'beauty', tame: 2, xp: 6,  drop: { fiber: [0,1] }, biomes: ['jungle'], speed: 2.4, flee: true, fly: true },
  crab:    { name: '沙滩蟹', icon: '🦀', hp: 16, dmg: 4, food: 'fish',      kind: 'prod', tame: 2, xp: 5,  drop: { fish: [1,2] }, biomes: ['beach'], speed: 1.2, produce: { shell: [0,1] }, produceTime: 60 },
  turtle:  { name: '海龟', icon: '🐢', hp: 30, dmg: 3,  food: 'coconut',    kind: 'mount', tame: 3, xp: 9,  drop: { shell: [1,2] }, biomes: ['beach','ocean'], speed: 1.3, swims: true },
  jelly:   { name: '水母', icon: '🎐', hp: 12, dmg: 8,  food: 'fish',       kind: 'beauty', tame: 3, xp: 8,  drop: { potion: [0,1] }, biomes: ['ocean'], speed: 1.0, swims: true },
  octopus: { name: '章鱼', icon: '🐙', hp: 34, dmg: 12, food: 'fish',       kind: 'fight', tame: 4, xp: 14, drop: { fish: [1,3] }, biomes: ['ocean'], speed: 2.2, swims: true, power: 15 },
  // 坐骑由稀有蛋孵出（不在野外直接刷）
  horsespirit: { name: '精灵马', icon: '🦄', hp: 70, dmg: 14, food: 'fruit', kind: 'mount', tame: 0, xp: 0, drop: {}, biomes: [], speed: 4.6, power: 14, fromEgg: 'rare_egg' },
};

// 蛋孵化表（秒）
export const EGGS = {
  egg:      { time: 90,  pool: { rabbit: 3, sheep: 2, chicken: 2, wolf: 2, parrot: 1, crab: 1, pig: 1, leopard: 1, jelly: 1, octopus: 1, turtle: 1 } },
  rare_egg: { time: 180, pool: { horsespirit: 3, leopard: 2, octopus: 2, wolf: 2 } },
};

export const XP_LEVELS = [0, 0, 60, 150, 300, 500, 800]; // 升到 Lv.n 所需累计经验；>=6 全解锁