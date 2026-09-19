import { chromium } from 'playwright';
const EXE = 'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const browser = await chromium.launch({ headless: true, executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
await page.setContent('<canvas id="c" width="400" height="400"></canvas>');
await page.addScriptTag({ path: 'lib/three.module.js', type: 'module' });
await page.waitForTimeout(500);
const res = await page.evaluate(() => new Promise((resolve) => {
  import('/lib/three.module.js').then(THREE => {
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), preserveDrawingBuffer: true });
    renderer.setSize(400, 400);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 6, 0.01); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 1.2));
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const top = new THREE.MeshLambertMaterial({ color: 0x7db454 });
    const side = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    // 方案 A：材质数组 + InstancedMesh
    const im = new THREE.InstancedMesh(geo, [side, side, top, side, side, side], 3);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    [[-2,1,0],[0,1,0],[2,1,0]].forEach((p, i) => {
      d.position.set(p[0], 0.5, p[2]); d.scale.set(1, 1, 1); d.updateMatrix();
      im.setMatrixAt(i, d.matrix);
      im.setColorAt(i, col.setHex(0xffffff));
    });
    im.instanceColor.needsUpdate = true;
    scene.add(im);
    renderer.render(scene, camera);
    const px = new Uint8Array(4);
    const gl = renderer.getContext();
    gl.readPixels(200, 200, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    resolve([...px]);
  });
}));
console.log('TOP PIXEL:', res);
await browser.close();