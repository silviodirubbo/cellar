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
// nothing clips), and a screenshot of the .story element only.
//
// Fonts: before each capture the script waits for document.fonts.ready and
// then checks that Cormorant Garamond and DM Mono actually loaded. If they
// did not (for example Google Fonts was unreachable), it stops with an error
// instead of writing a PNG set in a fallback font.
//
// Optional environment:
//   FONTSOURCE_DIR  path to a node_modules/@fontsource folder. When set, the
//                   Google Fonts stylesheet the pages request is answered
//                   from the matching local @fontsource files, for machines
//                   without access to fonts.googleapis.com.
//   CHROMIUM_PATH   Chromium executable to use instead of Playwright's own.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const REQUIRED_FAMILIES = ['Cormorant Garamond', 'DM Mono'];
const LOCAL_FONT_HOST = 'https://fonts.gstatic.com/__fontsource/';

// Builds the @font-face CSS for a css2 URL from local @fontsource packages,
// keeping every unicode subset, the way Google's own stylesheet does.
function localFontCss(fontsourceDir, cssUrl) {
  const url = new URL(cssUrl);
  const parts = [];
  for (const spec of url.searchParams.getAll('family')) {
    const [name, axes = ''] = spec.split(':');
    const pkg = name.trim().toLowerCase().replace(/\s+/g, '-');
    let styles = [['400', false]];
    const m = axes.match(/^(ital,)?wght@(.+)$/);
    if (m) {
      styles = m[2].split(';').map((t) => {
        const v = t.split(',');
        return m[1] ? [v[1], v[0] === '1'] : [v[0], false];
      });
    }
    for (const [weight, italic] of styles) {
      const file = path.join(fontsourceDir, pkg, `${weight}${italic ? '-italic' : ''}.css`);
      if (!fs.existsSync(file)) throw new Error(`missing local font CSS ${file}`);
      parts.push(fs.readFileSync(file, 'utf8')
        .replace(/url\(\.\/files\//g, `url(${LOCAL_FONT_HOST}${pkg}/files/`));
    }
  }
  return parts.join('\n');
}

async function useLocalFonts(context, fontsourceDir) {
  await context.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/css',
                    body: localFontCss(fontsourceDir, route.request().url()) }));
  await context.route(`${LOCAL_FONT_HOST}**`, (route) => {
    const rel = route.request().url().slice(LOCAL_FONT_HOST.length);
    route.fulfill({ status: 200, contentType: 'font/woff2',
                    body: fs.readFileSync(path.join(fontsourceDir, rel)) });
  });
}

// Waits for fonts, then checks them. document.fonts.ready alone is not
// enough: if the stylesheet never arrives there are no faces to wait for and
// it resolves at once. So both families must be declared (the stylesheet
// arrived), no face may have failed, and every family the story's text is
// set in must have loaded. A family the slide never uses (e.g. no mono text)
// is legitimately left unloaded by the browser.
async function assertFontsLoaded(page, file) {
  const { faces, used } = await page.evaluate(async () => {
    await document.fonts.ready;
    const faces = [...document.fonts].map((f) => ({
      family: f.family.replace(/["']/g, ''), status: f.status,
    }));
    const used = new Set();
    for (const el of document.querySelectorAll('.story, .story *')) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (hasText) used.add(getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/["']/g, ''));
    }
    return { faces, used: [...used] };
  });
  for (const family of REQUIRED_FAMILIES) {
    const mine = faces.filter((f) => f.family === family);
    const loaded = mine.filter((f) => f.status === 'loaded').length;
    const failed = mine.filter((f) => f.status === 'error').length;
    const missing = !mine.length || failed || (used.includes(family) && !loaded);
    if (missing) {
      throw new Error(`${file}: ${family} did not load (${mine.length} declared, ${loaded} loaded, ${failed} failed); not rendering in a fallback font`);
    }
  }
}

async function main() {
  const baseUrl = (process.argv[2] || '').replace(/\/$/, '');
  const siteDir = path.resolve(process.argv[3] || '_site');
  const outDir = path.resolve(process.argv[4] || 'stories-out');
  fs.mkdirSync(outDir, { recursive: true });

  const storiesDir = path.join(siteDir, 'stories');
  const files = fs.readdirSync(storiesDir)
    .filter((f) => f.endsWith('.html'))
    .sort();

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 2200 },
    deviceScaleFactor: 3,
  });
  if (process.env.FONTSOURCE_DIR) await useLocalFonts(context, path.resolve(process.env.FONTSOURCE_DIR));
  const page = await context.newPage();

  for (const file of files) {
    const url = `${baseUrl}/stories/${file}`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await assertFontsLoaded(page, file);
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
