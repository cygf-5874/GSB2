import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shot-01-start.png' });

// 点击开始
await page.click('#start-btn');
await page.waitForTimeout(3500);
await page.screenshot({ path: 'shot-02-world.png' });

// 模拟移动 2 秒
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.up('KeyW');
await page.waitForTimeout(500);
await page.screenshot({ path: 'shot-03-move.png' });

// 打开背包
await page.click('.menu-btn[data-panel="bag"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-04-bag.png' });
await page.click('#panel-bag .panel-close');

// 打开合成
await page.click('.menu-btn[data-panel="craft"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-05-craft.png' });
await page.click('#panel-craft .panel-close');

// 宠物面板
await page.click('.menu-btn[data-panel="pets"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-06-pets.png' });
await page.click('#panel-pets .panel-close');

// 地图
await page.click('.menu-btn[data-panel="map"]');
await page.waitForTimeout(600);
await page.screenshot({ path: 'shot-07-map.png' });
await page.click('#panel-map .panel-close');

// 采集动作
for (let i = 0; i < 5; i++) {
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(700);
}
await page.waitForTimeout(500);
await page.screenshot({ path: 'shot-08-gather.png' });

// 游戏内状态探测
const probe = await page.evaluate(() => {
  try {
    return {
      hotbar: JSON.parse(localStorage.getItem('wild-era-save-v1')) ? 'save exists' : 'no save',
      toast: document.querySelectorAll('.toast').length,
      hint: document.getElementById('interact-hint').textContent,
      hp: document.getElementById('num-hp').textContent,
    };
  } catch (e) { return { err: String(e) }; }
});

await browser.close();
console.log('PROBE:', JSON.stringify(probe));
console.log('ERRORS:', errors.length);
errors.slice(0, 20).forEach(e => console.log(e));
process.exit(errors.length ? 1 : 0);