#!/usr/bin/env node
// Renders the Pilot social-card pages under pilot-social/*.html to PNG.
// Usage: node scripts/render-pilot.js <base-url> <built-site-dir> <output-dir>
// e.g.:  node scripts/render-pilot.js http://127.0.0.1:8123/cellar _site out/
//
// Same approach as render-stories.js and render-linkedin.js: expects the
// built site served over HTTP (baseurl-prefixed asset links won't resolve
// over file://), device_scale_factor 3, a screenshot of the .pilot element
// only, and a wait_for_timeout for Google Fonts. The .pilot canvas is
// 720x900 CSS px, so at 3x that lands on the 2160x2700 (4:5) export size
// assets/Pilot/*.png already use.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  const siteDir = path.resolve(process.argv[3] || '_site');
  const outDir = path.resolve(process.argv[4] || 'pilot-out');
  fs.mkdirSync(outDir, { recursive: true });

  const pilotDir = path.join(siteDir, 'pilot-social');
  const files = fs.readdirSync(pilotDir)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({
    viewport: { width: 1000, height: 1200 },
    deviceScaleFactor: 3,
  });

  for (const file of files) {
    const url = `${baseUrl}/pilot-social/${file}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2000); // let Google Fonts (and the countdown script) settle
    const el = await page.$('.pilot');
    const outName = file.replace(/\.html$/, '.png');
    const outPath = path.join(outDir, outName);
    await el.screenshot({ path: outPath });
    console.log('rendered', outName);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
