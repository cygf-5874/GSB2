import { chromium } from 'playwright';
const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
await page.goto('http://localhost:8123/test-mat.html');
await page.waitForFunction('window.__done === true');
console.log(await page.evaluate('JSON.stringify(window.__grid)'));
console.log(await page.evaluate('JSON.stringify(window.__center)'));
await browser.close();