import { chromium } from 'playwright';
const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:8123/index.html?debug', { waitUntil: 'networkidle' });
await page.click('#start-btn');
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const { THREE, camera, player } = window.__G;
  camera.up.set(0, 0, -1);
  camera.position.set(0, 130, 0.01);
  camera.lookAt(0, 0, 0);
  player.group.visible = false;
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'shot-overview.png' });
await browser.close();