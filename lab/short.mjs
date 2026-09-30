import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h] of [[360, 640], [1280, 680]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 700, hasTouch: w < 700 })).newPage();
  await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForSelector('.scene.is-ready');
  await p.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' })); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const d = document.getElementById('cp-dawn'); d.scrollTop = 9999; const btn = document.querySelector('#hold .btn').getBoundingClientRect(); return { scrollH: d.scrollHeight, clientH: d.clientHeight, btnBottom: Math.round(btn.bottom), vh: innerHeight }; });
  console.log(w + 'x' + h, JSON.stringify(r));
  await p.waitForTimeout(300); await p.screenshot({ path: `lab/short-${w}.png` });
}
await b.close();
