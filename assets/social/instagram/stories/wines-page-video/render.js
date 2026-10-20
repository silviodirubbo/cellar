#!/usr/bin/env node
// Renders wines-page.mp4: a 15 s Instagram Story (1080x1920, 30 fps, H.264,
// no audio) of the real /wines/ page in use, ending on a Story end card.
// Usage (from the repo root): node assets/social/instagram/stories/wines-page-video/render.js
//
// How it works:
//  1. Builds the site with Jekyll into a temporary folder, with an extra
//     config that lets this folder's end-card.html back in (assets/social
//     is excluded from the site build), and serves it locally under the
//     site's baseurl. Only 127.0.0.1 is reachable from the page; every
//     other request (the Supabase CDN script) is aborted.
//  2. Opens /wines/ in Playwright's Chromium on a phone profile: 390x693
//     viewport, device scale factor 1920/693 (about 2.77), touch, no hover.
//     Math.random is replaced by a seeded generator before the page runs,
//     so wines.js shuffles exactly as on the site but the same way on every
//     render (SEED was picked so bottle photos, not "To be announced"
//     placeholders, fill the rows on screen).
//  3. Drives the page on a fixed timeline and takes one screenshot per
//     frame. Time is virtual: every Web Animation and CSS transition is
//     paused as soon as it starts and set to the frame's time before each
//     screenshot, and scrolling is set per frame with an easing curve, so
//     frames are evenly timed however long a screenshot takes.
//  4. Screenshots end-card.html (the Story layout's head, partials and
//     classes) at its native 1080x1920 canvas.
//  5. ffmpeg crops the page frames to 1080x1920, cross-fades into the end
//     card and encodes H.264 yuv420p with faststart and no audio track.
//
// Needs the site's Ruby toolchain (bundle exec jekyll), ffmpeg, and the
// Playwright install in scripts/ (cd scripts && npm ci).
// Optional environment: CHROMIUM_PATH, a Chromium executable to use instead
// of Playwright's own. KEEP_FRAMES=1 keeps the temporary folder and prints it.

const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawnSync } = require('child_process');

const HERE = __dirname;
const REPO = path.resolve(HERE, '../../../../..');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(REPO, 'scripts')] }));

const OUT = path.join(HERE, 'wines-page.mp4');
const END_CARD = '/stories/wines-page-video-end-card.html';
const FPS = 30;
const VIEWPORT = { width: 390, height: 693 };
const SCALE = 1920 / 693;            // 390 x 693 CSS px -> 1080(.5) x 1920 device px
const PAGE_END = 12.5;               // s: cross-fade into the end card starts here
const FADE = 0.6;                    // s
const TOTAL = 15;                    // s
const SEED = 41;
const REQUIRED_FAMILIES = ['Cormorant Garamond', 'DM Mono'];

// ── Build and serve ──────────────────────────────────────────────

// Same idea as scripts/render-stories.js: the site's excludes, with the
// assets/social entry replaced by every sibling on the way down to this
// folder, and everything in this folder but end-card.html.
function renderExcludes(config) {
  const m = config.match(/^exclude:[ \t]*\n((?:[ \t]+-[^\n]*\n?)+)/m);
  const site = m ? m[1].split('\n').map((l) => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean) : [];
  const social = 'assets/social';
  const out = site.filter((e) => e.replace(/\/$/, '') !== social);
  let dir = social;
  for (const next of path.relative(path.join(REPO, social), HERE).split(path.sep)) {
    for (const entry of fs.readdirSync(path.join(REPO, dir))) if (entry !== next) out.push(`${dir}/${entry}`);
    dir = `${dir}/${next}`;
  }
  for (const entry of fs.readdirSync(HERE)) if (entry !== 'end-card.html') out.push(`${dir}/${entry}`);
  return out;
}

function buildSite(tmp) {
  const config = fs.readFileSync(path.join(REPO, '_config.yml'), 'utf8');
  const baseurl = ((config.match(/^baseurl:[ \t]*["']?([^"'\n]*)/m) || [])[1] || '').replace(/\/$/, '');
  const override = path.join(tmp, 'render-config.yml');
  fs.writeFileSync(override, 'exclude:\n' + renderExcludes(config).map((e) => `  - "${e}"`).join('\n') + '\n');
  const env = { ...process.env, LANG: process.env.LANG || 'C.UTF-8', LC_ALL: process.env.LC_ALL || 'C.UTF-8',
    JEKYLL_ENV: process.env.JEKYLL_ENV || 'production' };
  const res = spawnSync('bundle', ['exec', 'jekyll', 'build', '--source', REPO,
    '--destination', path.join(tmp, 'site', baseurl), '--config', `${path.join(REPO, '_config.yml')},${override}`],
  { cwd: REPO, env, stdio: 'inherit' });
  if (res.status !== 0) throw new Error('jekyll build failed');
  return { root: path.join(tmp, 'site'), baseurl };
}

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.json': 'application/json' };

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

// ── In-page helpers ──────────────────────────────────────────────

// mulberry32, replacing Math.random before any page script runs
const seedScript = (seed) => `(() => {
  let a = ${seed} >>> 0;
  Math.random = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

// Waits for the two families and checks they really loaded (see
// assertFontsLoaded in scripts/render-stories.js for why ready alone is not enough).
async function assertFonts(page, what) {
  const faces = await page.evaluate(async (families) => {
    await Promise.all(families.flatMap((f) => [`300 16px "${f}"`, `400 16px "${f}"`, `italic 300 16px "${f}"`]
      .map((spec) => document.fonts.load(spec).catch(() => {}))));
    await document.fonts.ready;
    return [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ''), status: f.status }));
  }, REQUIRED_FAMILIES);
  for (const family of REQUIRED_FAMILIES) {
    const mine = faces.filter((f) => f.family === family);
    if (!mine.some((f) => f.status === 'loaded') || mine.some((f) => f.status === 'error')) {
      throw new Error(`${what}: ${family} did not load; not rendering in a fallback font`);
    }
  }
}

// Virtual clock for animations: __vt.adopt(t) pauses every animation not
// seen before and pins its start to t (seconds); __vt.seek(t) sets every
// adopted animation to t, finishing it once past its end.
const clockScript = `(() => {
  const start = new WeakMap();
  const done = new WeakSet();
  window.__vt = {
    adopt(t) {
      for (const a of document.getAnimations()) {
        if (start.has(a) || done.has(a)) continue;
        a.pause();
        start.set(a, t);
      }
    },
    seek(t) {
      this.adopt(t);
      for (const a of document.getAnimations()) {
        if (!start.has(a) || done.has(a)) continue;
        const ms = (t - start.get(a)) * 1000;
        const end = a.effect ? a.effect.getComputedTiming().endTime : 0;
        if (ms >= end) { a.finish(); done.add(a); } else { a.currentTime = Math.max(0, ms); }
      }
    }
  };
})();`;

// ── Timeline ─────────────────────────────────────────────────────

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

// Scroll keyframes [t0, t1, from, to, ease]; between them the page holds.
function scrollAt(t, moves) {
  let y = moves[0][2];
  for (const [t0, t1, from, to, ease] of moves) {
    if (t >= t1) y = to;
    else if (t > t0) { y = from + (to - from) * ease((t - t0) / (t1 - t0)); break; } else break;
  }
  return Math.round(y * SCALE) / SCALE;   // whole device pixels: no shimmer
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cellar-wines-video-'));
  const frames = path.join(tmp, 'frames');
  fs.mkdirSync(frames);
  let server; let browser;
  try {
    const { root, baseurl } = buildSite(tmp);
    server = await serve(root);
    const base = `http://127.0.0.1:${server.address().port}${baseurl}`;
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

    // End card first: a ready PNG at the Story canvas size.
    const cardCtx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    const cardPage = await cardCtx.newPage();
    const resp = await cardPage.goto(base + END_CARD, { waitUntil: 'networkidle' });
    if (!resp || !resp.ok()) throw new Error('end card not found in the build');
    await assertFonts(cardPage, 'end card');
    const endCard = path.join(tmp, 'end-card.png');
    await (await cardPage.$('.story')).screenshot({ path: endCard });
    await cardCtx.close();

    // The Wines page on a phone.
    const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE,
      isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
    await ctx.route('**', (r) => (new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort()));
    await ctx.addInitScript(seedScript(SEED));
    const page = await ctx.newPage();
    await page.goto(base + '/wines/', { waitUntil: 'load' });
    await assertFonts(page, '/wines/');
    // every bottle photo loaded and decoded before frame 1: no pop-in
    await page.evaluate(async () => {
      const imgs = [...document.querySelectorAll('img')];
      imgs.forEach((i) => { i.loading = 'eager'; });
      await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
      if (imgs.some((i) => !i.complete || !i.naturalWidth)) throw new Error('an image did not load');
      if (document.documentElement.classList.contains('wines-pending')) throw new Error('grid still pending');
    });
    // Chromium's default touch flash (a blue box) is a browser default the
    // site never sets: hide it so taps read through the page's own states.
    await page.addStyleTag({ content: '* { -webkit-tap-highlight-color: transparent !important; }' });
    await page.addScriptTag({ content: clockScript });
    await page.evaluate(() => { window.__vt.seek(0); });

    // Layout, in page coordinates (CSS px)
    const L = await page.evaluate(() => {
      const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + scrollY, w: r.width, h: r.height }; };
      const nav = document.querySelector('.nav').getBoundingClientRect().height;
      const cards = [...document.querySelectorAll('#wineGrid .wine')].map((c) => box(c.querySelector('.wine__tile')));
      return { nav, bar: box(document.getElementById('wineShuffle')), cards };
    });
    const tileView = (i) => L.cards[i];
    // Grid at rest: the toolbar just under the nav, as wines.js scrolls to
    // before a shuffle (so wines.js itself never needs to scroll).
    const yTools = L.bar.y - L.nav - 16 - 56;
    const yRow1 = tileView(0).y - L.nav - 14;
    const yRow3 = tileView(4).y - L.nav - 14;
    const moves = [
      [0.0, 2.6, 0, yRow1, easeInOutSine],     // gentle start, down to the first row
      [3.2, 3.95, yRow1, yRow3, easeInOut],    // further down the grid
      [5.0, 5.75, yRow3, yTools, easeInOut],   // back up to the toolbar
    ];

    // Taps happen on the frame at their time, at the element's centre (or a
    // tile's upper middle) in viewport coordinates.
    const tapAt = async (t, sel, fy = 0.5) => {
      const p = await page.evaluate(([s, f]) => {
        const el = typeof s === 'number' ? document.querySelectorAll('#wineGrid .wine__tile')[s] : document.querySelector(s);
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height * f };
      }, [sel, fy]);
      if (p.y < L.nav || p.y > VIEWPORT.height) throw new Error(`tap target ${sel} off screen at ${t}s`);
      await page.touchscreen.tap(p.x, p.y);
    };
    const chip = (group, value) => `#wineFilterGroups .chip[data-group="${group}"][data-value="${value}"]`;
    // The filter sheet is taller than the screen: once it is open, scroll
    // it so the Chapter group sits in view before Loire is tapped.
    const sheetMoves = [[0, 0, 0, 0, easeInOut]];
    const measureSheet = () => page.evaluate((sel) => {
      const panel = document.getElementById('wineFilterPanel');
      const c = document.querySelector(sel).getBoundingClientRect();
      const max = panel.scrollHeight - panel.clientHeight;
      return Math.max(0, Math.min(max, c.top - innerHeight * 0.45));
    }, chip('chapter', 'loire'));
    const events = [
      [2.85, () => tapAt(2.85, 1, 0.4)],
      [4.1, () => tapAt(4.1, 4, 0.4)],
      [4.55, () => tapAt(4.55, 5, 0.4)],
      [5.9, () => tapAt(5.9, '#wineShuffle')],
      [6.4, () => tapAt(6.4, '#wineShuffle')],
      [6.9, () => tapAt(6.9, '#wineShuffle')],
      [7.4, () => tapAt(7.4, '#wineShuffle')],
      [7.9, () => tapAt(7.9, '#wineShuffle')],
      [9.0, async () => {
        await tapAt(9.0, '#wineFilterToggle');
        sheetMoves.push([9.7, 10.2, 0, await measureSheet(), easeInOut]);
      }],
      [9.45, () => tapAt(9.45, chip('colour', 'red'))],
      [10.35, () => tapAt(10.35, chip('chapter', 'loire'))],
      [10.9, () => tapAt(10.9, '#wineFilterDone')],
      [11.7, () => tapAt(11.7, '#wineReset')],
    ];

    const nFrames = Math.round((PAGE_END + FADE) * FPS);
    let next = 0;
    for (let f = 0; f < nFrames; f++) {
      const t = f / FPS;
      const y = scrollAt(t, moves);
      const sy = scrollAt(t, sheetMoves);
      await page.evaluate(([v, s]) => {
        document.scrollingElement.scrollTop = v;
        const panel = document.getElementById('wineFilterPanel');
        if (!panel.hidden) panel.scrollTop = s;
      }, [y, sy]);
      while (next < events.length && events[next][0] <= t + 1e-6) {
        await events[next][1]();
        await page.evaluate((v) => window.__vt.adopt(v), events[next][0]);
        next++;
      }
      await page.evaluate((v) => window.__vt.seek(v), t);
      await page.screenshot({ path: path.join(frames, String(f).padStart(4, '0') + '.png') });
      if (f % 30 === 0) process.stdout.write(`frame ${f}/${nFrames}\r`);
    }
    if (next !== events.length) throw new Error('not every event ran');
    console.log(`captured ${nFrames} frames`);

    // Assemble: page frames cropped to 1080x1920, cross-fade into the end card.
    const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', path.join(frames, '%04d.png'),
      '-loop', '1', '-framerate', String(FPS), '-t', String(TOTAL - PAGE_END), '-i', endCard,
      '-filter_complex',
      `[0]crop=1080:1920:0:0,setsar=1,format=yuv420p,settb=AVTB[a];` +
      `[1]scale=1080:1920,setsar=1,format=yuv420p,settb=AVTB[b];` +
      `[a][b]xfade=transition=fade:duration=${FADE}:offset=${PAGE_END},format=yuv420p[v]`,
      '-map', '[v]', '-an', '-r', String(FPS), '-frames:v', String(TOTAL * FPS),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', OUT], { stdio: 'inherit' });
    if (ff.status !== 0) throw new Error('ffmpeg failed');
    console.log('wrote', path.relative(REPO, OUT));
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
    if (process.env.KEEP_FRAMES) console.log('kept', tmp);
    else fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
