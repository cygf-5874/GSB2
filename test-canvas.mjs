import { chromium } from 'playwright';
const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const errors = [];
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
await page.goto('http://localhost:8123/index.html', { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForTimeout(3000);

// 采样 canvas 中心区域颜色，确认确实在渲染 3D 画面
const data = await page.evaluate(() => {
  const c = document.getElementById('game-canvas');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  const samples = [];
  // 用 2D 方式读不到 webgl；直接检查 gl 是否有绘制：读像素
  const px = new Uint8Array(4);
  gl.readPixels(c.width/2|0, c.height/2|0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  samples.push([...px]);
  gl.readPixels(100, 100, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  samples.push([...px]);
  return { w: c.width, h: c.height, samples };
});
console.log('CANVAS:', JSON.stringify(data));

// 走几步看位置变化
const p1 = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('wild-era-save-v1')); return s.pos; });
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
await page.waitForTimeout(300);
const p2 = await page.evaluate(() => JSON.parse(localStorage.getItem('wild-era-save-v1')).pos);
console.log('MOVE:', JSON.stringify(p1), '->', JSON.stringify(p2));

await browser.close();
console.log('ERRORS:', errors.length); errors.forEach(e => console.log(e));