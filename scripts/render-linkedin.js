#!/usr/bin/env node
// Renders the LinkedIn square slides under stories/linkedin-*.html to PNG.
// Usage: node scripts/render-linkedin.js <base-url> <built-site-dir> <output-dir>
// e.g.:  node scripts/render-linkedin.js http://127.0.0.1:8123/cellar _site out/
//
// Same approach as render-stories.js (the Instagram export): expects the
// built site served over HTTP (baseurl-prefixed asset links won't resolve
// over file://), device_scale_factor 3, a screenshot of the .story element
// only, and a wait_for_timeout for Google Fonts. Only the viewport and the
// file filter differ, since these slides render at 1080x1080 instead of
// 1080x1920.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  const siteDir = path.resolve(process.argv[3] || '_site');
  const outDir = path.resolve(process.argv[4] || 'linkedin-out');
  fs.mkdirSync(outDir, { recursive: true });

  const storiesDir = path.join(siteDir, 'stories');
  const files = fs.readdirSync(storiesDir)
    .filter((f) => f.startsWith('linkedin-') && f.endsWith('.html'))
    .sort();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1400 },
    deviceScaleFactor: 3,
  });

  for (const file of files) {
    const url = `${baseUrl}/stories/${file}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2000); // let Google Fonts settle
    const el = await page.$('.story');
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
