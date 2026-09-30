import { chromium } from 'playwright-core';
const CH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', URL = 'file://' + process.cwd() + '/dist/index.html';
const out = [];
// 1. No WebGL: poster fallback
{ const b = await chromium.launch({ executablePath: CH, args: ['--disable-3d-apis', '--disable-webgl'] });
  const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(2500);
  out.push('no-gl: class=' + await p.evaluate(() => document.getElementById('scene').className) + ' posterVisible=' + await p.evaluate(() => getComputedStyle(document.querySelector('.poster')).display) + ' errors=' + errs.length);
  await p.screenshot({ path: 'lab/func-nogl.png' }); await b.close(); }
// 2. Planner, form, nav, keyboard
{ const b = await chromium.launch({ executablePath: CH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(URL); await p.waitForSelector('.scene.is-ready');
  out.push('moons: ' + (await p.$$eval('.moon', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))).join(' | '));
  out.push('summary: ' + await p.textContent('#moon-summary'));
  // nav jump to Exposure
  await p.click('[data-go="3"]'); await p.waitForTimeout(2500);
  out.push('after nav Exposure: y/vh=' + (await p.evaluate(() => scrollY / innerHeight)).toFixed(2) + ' clock=' + await p.textContent('#clock-time'));
  // CTA to dawn
  await p.click('.bar__cta'); await p.waitForTimeout(3000);
  out.push('after CTA: y/vh=' + (await p.evaluate(() => scrollY / innerHeight)).toFixed(2) + ' dawnOpacity=' + await p.evaluate(() => document.getElementById('cp-dawn').style.opacity));
  await p.click('#moon-1'); out.push('pick Nov: ' + await p.textContent('#moon-summary'));
  await p.keyboard.press('ArrowRight'); out.push('arrow -> ' + await p.evaluate(() => document.activeElement.id) + ' ' + await p.textContent('#moon-summary'));
  await p.click('#hold .btn'); out.push('empty submit: ' + await p.textContent('#hold-status'));
  await p.fill('#f-name', 'Asha Rao'); await p.fill('#f-email', 'asha@'); await p.click('#hold .btn'); out.push('bad email: ' + await p.textContent('#hold-status') + ' focus=' + await p.evaluate(() => document.activeElement.id));
  await p.fill('#f-email', 'asha@example.com'); await p.selectOption('#f-guests', '3'); await p.click('#hold .btn');
  out.push('good submit: ' + await p.textContent('#hold-status') + ' url=' + p.url().split('/').pop());
  // keyboard tab order from top
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(500);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  const order = []; for (let i = 0; i < 10; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => { const a = document.activeElement; return (a.id || a.className || a.tagName) + ':' + (a.textContent || '').trim().slice(0, 12); })); }
  out.push('tab: ' + order.join(' > '));
  out.push('horizontal overflow: ' + await p.evaluate(() => document.documentElement.scrollWidth - innerWidth));
  out.push('errors: ' + (errs.join(' ; ') || 'none'));
  await b.close(); }
// 3. Exposure timing on a real scroll
{ const b = await chromium.launch({ executablePath: CH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
  await p.goto(URL); await p.waitForSelector('.scene.is-ready');
  for (let y = 3.9; y <= 8.0; y += 0.25) { await p.evaluate(v => window.scrollTo({ top: v * innerHeight, behavior: 'instant' }), y); await p.waitForTimeout(250); }
  out.push('exposure line: ' + await p.textContent('#exp-result'));
  await b.close(); }
console.log(out.join('\n'));
