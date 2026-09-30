import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [w, h, name] of [[1600, 1000, 'wide'], [430, 932, 'tall']]) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + process.cwd() + '/dist/index.html');
  await page.waitForSelector('.scene.is-ready');
  await page.evaluate(() => window.scrollTo({ top: 4.0 * innerHeight, behavior: 'instant' }));
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: '.bar,[data-sc-world-copy]{visibility:hidden!important}' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `src/data/poster-${name}.jpg`, type: 'jpeg', quality: 72 });
}
await browser.close();
