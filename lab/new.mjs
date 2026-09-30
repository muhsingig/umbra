import { chromium } from 'playwright-core';
import fs from 'fs';
const CH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', URL = 'file://' + process.cwd() + '/dist/index.html';
const b = await chromium.launch({ executablePath: CH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
// A. Intro as a real visitor sees it (webdriver hidden so the arrival plays)
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('A ' + e.message));
  await p.goto(URL); const t0 = Date.now();
  for (const ms of [900, 1900, 2900, 4200]) { await p.waitForTimeout(Math.max(0, ms - (Date.now() - t0))); await p.screenshot({ path: `lab/new/intro-${ms}.png` }); }
  await ctx.close(); }
// B. Dissolve, picker, meteor, keepsake (automation: exact frames)
{ const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.__saved = null; window.claude = { use: async (n) => n === 'downloads' ? { save: async ({ filename, data }) => { const r = new FileReader(); r.onload = () => { window.__saved = { filename, url: r.result }; }; r.readAsDataURL(data); return { status: 'saved' }; } } : null }; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('B ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push('B ' + m.text()));
  await p.goto(URL); await p.waitForSelector('.scene.is-ready'); await p.waitForTimeout(1200);
  const go = async (t) => { await p.evaluate(v => window.scrollTo({ top: v * innerHeight, behavior: 'instant' }), t); await p.waitForTimeout(700); };
  for (const t of [0.15, 0.4, 0.7]) { await go(t); await p.screenshot({ path: `lab/new/dissolve-${t}.png` }); }
  // exposure: pick Polaris-adjacent bright star (Kochab or brightest visible)
  await go(4.6); await go(5.0);
  const target = await p.evaluate(() => { const api = UmbraScene.api, st = api.state, cam = api.camera(st); const N = JSON.parse(document.getElementById('umbra-named').textContent); let best = null; for (const s of N) { if (s[2] > 2.3) continue; const q = api.project(s[0], s[1], st, cam); if (q && q.alt > 8 && q.x > 100 && q.x < innerWidth - 100 && q.y > 120 && q.y < innerHeight - 200) { best = { name: s[3], x: q.x, y: q.y }; break; } } return best; });
  console.log('clicking', JSON.stringify(target));
  if (target) { await p.mouse.move(target.x + 3, target.y + 2); await p.waitForTimeout(300); await p.mouse.click(target.x + 3, target.y + 2); await p.waitForTimeout(900); }
  console.log('card:', await p.evaluate(() => [document.getElementById('pick').hidden, document.getElementById('pick-name').textContent, document.getElementById('pick-kind').textContent, document.getElementById('pick-dist').textContent, document.getElementById('pick-light').textContent].join(' | ')));
  await p.screenshot({ path: 'lab/new/pick.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // name-a-star button in Dark act
  await go(3.5); await p.click('[data-next-star]'); await p.waitForTimeout(700);
  console.log('next-star:', await p.evaluate(() => document.getElementById('pick-name').textContent + ' | ' + document.getElementById('pick-light').textContent));
  await p.screenshot({ path: 'lab/new/next.png' }); await p.keyboard.press('Escape');
  // meteor: scroll across 00:47 in steps
  for (let t = 5.9; t <= 6.25; t += 0.05) await go(t);
  await p.screenshot({ path: 'lab/new/meteor.png' });
  await go(7.3);
  await p.screenshot({ path: 'lab/new/end-exposure.png' });
  await go(8.0);
  console.log('keep visible:', await p.evaluate(() => !document.querySelector('[data-keep]').hidden));
  await p.click('[data-keep]');
  await p.waitForFunction(() => window.__saved, null, { timeout: 30000 }).catch(() => errs.push('no save'));
  const saved = await p.evaluate(() => window.__saved);
  if (saved) { fs.writeFileSync('lab/new/keepsake.png', Buffer.from(saved.url.split(',')[1], 'base64')); console.log('saved', saved.filename, await p.textContent('#keep-note')); }
  await ctx.close(); }
console.log(errs.join('\n') || 'no errors');
await b.close();
