// Renders each slide HTML to PNG: viewport 1080x1350, device scale factor 2.
const { chromium } = require('playwright');
const path = require('path');
// HTML sources live in src/, PNGs are written one level up.
const SRC = __dirname;
const OUT = path.join(__dirname, '..');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  for (const name of ['slide-a-four-bottles', 'slide-b-closing']) {
    await page.goto('file://' + path.join(SRC, name + '.html'), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight + ' ' + f.style));
    await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    console.log(name, 'fonts loaded:', loaded.join(', '));
  }
  await browser.close();
})();
