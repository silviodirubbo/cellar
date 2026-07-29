#!/usr/bin/env node
// Renders the Instagram Story slides under stories/ to PNG.
// Usage: node scripts/render-stories.js <base-url> <built-site-dir> <output-dir>
// e.g.:  node scripts/render-stories.js http://127.0.0.1:8123/cellar _site out/
//
// Expects the built site to be served over HTTP at <base-url> (the site
// uses baseurl-prefixed asset links, so file:// won't resolve main.css).
//
// Matches the settings already proven for this project's IG exports:
// device_scale_factor 3, a viewport wider than the story itself (so
// nothing clips), a screenshot of the .story element only, and a
// wait_for_timeout for Google Fonts to finish loading.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  const siteDir = path.resolve(process.argv[3] || '_site');
  const outDir = path.resolve(process.argv[4] || 'stories-out');
  fs.mkdirSync(outDir, { recursive: true });

  const storiesDir = path.join(siteDir, 'stories');
  const files = fs.readdirSync(storiesDir)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({
    viewport: { width: 1400, height: 2200 },
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
