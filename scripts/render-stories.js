#!/usr/bin/env node
// Renders the Instagram Story slides to PNG.
// Usage: node scripts/render-stories.js [output-dir]
// Run from anywhere; output defaults to assets/social/instagram/stories/.
//
// Sources live in assets/social/instagram/stories/src/, one page per story.
// They are Jekyll pages (layout: story, _includes/story/*, _data, main.css)
// but sit under assets/social/, which the site build excludes. So this script
// runs its own Jekyll build into a temporary folder, with an extra config
// that lets only that src/ folder back in, serves the result locally under
// the site's baseurl, and captures each story at its front-matter permalink.
// Needs the site's Ruby toolchain (bundle exec jekyll) as well as Playwright.
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
const os = require('os');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');

const REPO = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO, 'assets/social/instagram/stories/src');
const DEFAULT_OUT = path.join(REPO, 'assets/social/instagram/stories');
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

// Reads a top-level scalar or simple "- item" list from _config.yml. The file
// only uses plain values for these keys, so no YAML library is needed.
function configValue(text, key) {
  const scalar = text.match(new RegExp(`^${key}:[ \\t]*["']?([^"'\\n]*)["']?[ \\t]*$`, 'm'));
  if (scalar && scalar[1].trim()) return scalar[1].trim();
  const block = text.match(new RegExp(`^${key}:[ \\t]*\\n((?:[ \\t]+-[^\\n]*\\n?)+)`, 'm'));
  return block ? block[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : null;
}

// Exclude list for the render build: the site's own excludes, with the
// assets/social entry replaced by every sibling along the way to SRC_DIR, so
// the story sources are built and nothing else under assets/social is.
function renderExcludes(siteExcludes) {
  const social = 'assets/social';
  const out = siteExcludes.filter((e) => e.replace(/\/$/, '') !== social);
  const chain = path.relative(path.join(REPO, social), SRC_DIR).split(path.sep);
  let dir = social;
  for (const next of chain) {
    for (const entry of fs.readdirSync(path.join(REPO, dir))) {
      if (entry !== next) out.push(`${dir}/${entry}`);
    }
    dir = `${dir}/${next}`;
  }
  return out;
}

function buildSite(tmp, baseurl) {
  const config = fs.readFileSync(path.join(REPO, '_config.yml'), 'utf8');
  const excludes = renderExcludes(configValue(config, 'exclude') || []);
  const override = path.join(tmp, 'render-config.yml');
  fs.writeFileSync(override, 'exclude:\n' + excludes.map((e) => `  - "${e}"`).join('\n') + '\n');
  const dest = path.join(tmp, 'site', baseurl);
  const env = { ...process.env };
  env.LANG = env.LANG || 'C.UTF-8';
  env.LC_ALL = env.LC_ALL || 'C.UTF-8';
  env.JEKYLL_ENV = env.JEKYLL_ENV || 'production';
  const res = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', REPO, '--destination', dest,
    '--config', `${path.join(REPO, '_config.yml')},${override}`], { cwd: REPO, env, stdio: 'inherit' });
  if (res.status !== 0) throw new Error('jekyll build for the story pages failed');
  return path.join(tmp, 'site');
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2' };

function serve(root) {
  const server = http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function permalinkOf(file) {
  const fm = fs.readFileSync(path.join(SRC_DIR, file), 'utf8').match(/^---\n([\s\S]*?)\n---/);
  const m = fm && fm[1].match(/^permalink:\s*(\S+)\s*$/m);
  if (!m) throw new Error(`${file}: no permalink in front matter`);
  return m[1];
}

async function main() {
  const outDir = path.resolve(process.argv[2] || DEFAULT_OUT);
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.html')).sort();

  const config = fs.readFileSync(path.join(REPO, '_config.yml'), 'utf8');
  const baseurl = (configValue(config, 'baseurl') || '').replace(/\/$/, '');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cellar-stories-'));
  let server, browser;
  try {
    const root = buildSite(tmp, baseurl);
    server = await serve(root);
    const base = `http://127.0.0.1:${server.address().port}${baseurl}`;

    browser = await chromium.launch({
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
      const resp = await page.goto(base + permalinkOf(file), { waitUntil: 'networkidle' });
      if (!resp || !resp.ok()) throw new Error(`${file}: not found in the render build`);
      await assertFontsLoaded(page, file);
      const el = await page.$('.story');
      const outName = file.replace(/\.html$/, '.png');
      await el.screenshot({ path: path.join(outDir, outName) });
      console.log('rendered', outName);
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
