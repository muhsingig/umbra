import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
p.on('console', m => console.log('c:', m.text()));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForSelector('.scene.is-ready');
await p.evaluate(() => document.addEventListener('umbra:exposed', e => console.log('exposed', e.detail.seconds)));
for (let y = 3.9; y <= 8.0; y += 0.25) { await p.evaluate(v => window.scrollTo({ top: v * innerHeight, behavior: 'instant' }), y); await p.waitForTimeout(250); console.log(y.toFixed(2), await p.evaluate(() => document.getElementById('scene').getAttribute('data-sc-verify-state'))); }
console.log(await p.textContent('#exp-result'));
await b.close();
