import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[1440, 900], [390, 844]]) {
const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 })).newPage();
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForSelector('.scene.is-ready');
await p.evaluate(() => window.scrollTo({ top: 3.6 * innerHeight, behavior: 'instant' })); await p.waitForTimeout(1000);
const before = await p.evaluate(() => UmbraScene.api.land.tubeAngle.toFixed(1));
const t = await p.evaluate(() => { const api = UmbraScene.api, st = api.state, cam = api.camera(st); const N = JSON.parse(document.getElementById('umbra-named').textContent); for (const s of N) { if (s[2] > st.limit - 0.5) continue; const q = api.project(s[0], s[1], st, cam); if (q && q.alt > 10 && q.x > 60 && q.x < innerWidth - 60 && q.y > 150 && q.y < innerHeight * 0.6) return { n: s[3], x: q.x, y: q.y }; } });
if (w < 700) await p.tap('#scene', { position: { x: t.x, y: t.y } }); else await p.mouse.click(t.x, t.y);
for (let i = 0; i < 40; i++) { await p.evaluate(() => UmbraScene.api.wake(500)); await p.waitForTimeout(150); }
console.log(w, 'picked', t.n, 'card', await p.evaluate(() => !document.getElementById('pick').hidden && document.getElementById('pick-name').textContent), 'tube', before, '->', await p.evaluate(() => UmbraScene.api.land.tubeAngle.toFixed(1)));
await p.screenshot({ path: `lab/new/tube-${w}.png` });
}
await b.close();
