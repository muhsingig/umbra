// Quick look: screenshot the page at given track positions (in viewport-heights).
import { chromium } from 'playwright-core';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : d; };
const W = +opt('--w', 1440), H = +opt('--h', 900), out = opt('--out', 'lab/peek'), ts = opt('--t', '0').split(',').map(Number);
const reduced = args.includes('--reduced');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: W < 700, hasTouch: W < 700 });
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForFunction(() => document.querySelector('.scene.is-ready') || document.querySelector('.no-gl'), null, { timeout: 30000 }).catch(() => errs.push('never ready'));
await page.waitForTimeout(800);
const fs = await import('fs'); fs.mkdirSync(out, { recursive: true });
for (const t of ts) {
  await page.evaluate(t => window.scrollTo({ top: t * innerHeight, behavior: 'instant' }), t);
  await page.waitForTimeout(1600);
  const st = await page.evaluate(() => document.getElementById('scene').getAttribute('data-sc-verify-state'));
  await page.screenshot({ path: `${out}/t${String(t).replace('.', '_')}.png` });
  console.log('t', t, st);
}
console.log(errs.join('\n') || 'no console errors');
await browser.close();
