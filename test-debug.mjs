import { chromium } from 'playwright';
const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8123/index.html?debug', { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForTimeout(2500);

// 俯拍全景
await page.evaluate(() => window.__G.overview());
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-overview.png' });

// 统计世界
const info = await page.evaluate(() => {
  const { world, mobs, state, player } = window.__G;
  return {
    nodes: world.nodes.length,
    aliveNodes: world.nodes.filter(n => n.userData.alive).length,
    mobs: mobs.length,
    playerPos: [player.group.position.x.toFixed(1), player.group.position.y.toFixed(1), player.group.position.z.toFixed(1)],
    spawn: [world.spawn.x.toFixed(1), world.spawn.y.toFixed(1), world.spawn.z.toFixed(1)],
    benches: world.benches.length, fires: world.fires.length,
    hotbar: state.hotbar.filter(Boolean).map(s => s.id),
  };
});
console.log('INFO:', JSON.stringify(info, null, 1));

// 第三人称正常视角（看向营地一侧）
await page.evaluate(() => {
  const { player, THREE, camera } = window.__G;
  player.group.visible = true;
  player.yaw = Math.PI; // 转向草原内陆
});
await page.waitForTimeout(800);
await page.screenshot({ path: 'shot-normal.png' });

await browser.close();
console.log('ERR:', errors.length); errors.forEach(e => console.log(e));