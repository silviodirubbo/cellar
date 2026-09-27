// Captures the /chapters and /tastings frames for the Rhône carousel, framed
// the way assets/Pilot/slide-4-chapters.png and slide-5-tastings.png are:
// 1080x1350 viewport at device scale 2 (2160x2700 out), warm-white page,
// 76px side margins, the page's own eyebrow and title set in ink at the top,
// the live section below, and a caption plus underlined URL at the bottom.
// Everything between header and footer is the site's own rendered markup.
// Usage: build the site (bundle exec jekyll build -d <dir>/cellar), serve
// <dir> on 127.0.0.1:8123, then run with VENUES set to the JSON list of
// tastings.yml locations and OUT_DIR set to this folder's parent.
const { chromium } = require('playwright');
const path = require('path');
const { setup } = require('./shots_common');
const BASE = process.env.SITE_BASE || 'http://127.0.0.1:8123/cellar';
const OUT = process.env.OUT_DIR || '.';
// Venue names are stripped from the archive's "region · venue · N wines"
// lines, since the post must not name a venue. Read from tastings.yml.
const VENUES = JSON.parse(process.env.VENUES || '[]');

const FRAME_CSS = `
  .skip-link, nav.nav, main > header.page-header, footer.footer { display: none !important; }
  html, body { background: #FDFCFA !important; }
  body { width: 1080px; height: 1350px; overflow: hidden; position: relative; }
  main > section { padding: 0 !important; margin: 0 !important; }
  main > section > .container { max-width: none !important; padding: 0 76px !important; margin: 0 !important; }
  .frame-head { padding-top: 88px; margin-bottom: 44px; }
  .frame-head .eyebrow { font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: .2em;
    text-transform: uppercase; color: #8A8480; }
  .frame-head h1 { font-family: 'Cormorant Garamond', serif; font-weight: 300; font-size: 72px; line-height: 1;
    color: #1A1814; margin: 34px 0 0; }
  .frame-foot { position: absolute; left: 76px; right: 76px; bottom: 76px; display: flex;
    justify-content: space-between; align-items: baseline; z-index: 10; background: #FDFCFA; padding-top: 18px; }
  .frame-foot .cap { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 300; font-size: 26px; color: #4A4640; }
  .frame-foot .url { font-family: 'DM Mono', monospace; font-size: 15px; letter-spacing: .14em; text-transform: uppercase;
    color: #2C4A3E; border-bottom: 1px solid #2C4A3E; padding-bottom: 6px; }
`;

async function frame(page, { eyebrow, title, caption, insertBefore }) {
  await page.addStyleTag({ content: FRAME_CSS });
  await page.evaluate(({ eyebrow, title, caption, insertBefore }) => {
    const head = document.createElement('div');
    head.className = 'frame-head';
    head.innerHTML = `<div class="eyebrow"></div><h1></h1>`;
    head.querySelector('.eyebrow').textContent = eyebrow;
    head.querySelector('h1').textContent = title;
    const anchor = document.querySelector(insertBefore);
    anchor.parentNode.insertBefore(head, anchor);
    const foot = document.createElement('div');
    foot.className = 'frame-foot';
    foot.innerHTML = `<span class="cap"></span><span class="url">silviodirubbo.github.io/cellar</span>`;
    foot.querySelector('.cap').textContent = caption;
    document.body.appendChild(foot);
    window.scrollTo(0, 0);
  }, { eyebrow, title, caption, insertBefore });
}

async function liveHeader(page) {
  // The page's own eyebrow and title, read before the hero is hidden.
  return page.evaluate(() => {
    const h = document.querySelector('main > header.page-header');
    const eb = h.querySelector('.section-label');
    const h1 = h.querySelector('h1');
    return { eyebrow: eb ? eb.textContent.trim() : '', title: h1.textContent.replace(/\s+/g, ' ').trim().replace(/\.$/, '') };
  });
}

async function settle(page) {
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach(i => i.loading = 'eager'));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await setup(ctx);
  const page = await ctx.newPage();

  // a. /chapters: the chapters list as the site renders it.
  await page.goto(`${BASE}/chapters/`, { waitUntil: 'networkidle' });
  const ch = await liveHeader(page);
  const rhone = await page.evaluate(() => {
    const t = document.querySelector('.chapters-list').innerText;
    const i = t.indexOf('Rhône');
    return t.slice(i, i + 400).split('\n').filter(Boolean).slice(0, 6);
  });
  console.log('chapters header:', ch, '\nRhône block:', rhone);
  await frame(page, { ...ch, caption: 'See the full curriculum', insertBefore: '.chapters-list' });
  await settle(page);
  await page.screenshot({ path: path.join(OUT, 'slide-6-chapters-screenshot.png'), clip: { x: 0, y: 0, width: 1080, height: 1350 } });

  // b. /tastings: the archive, with the site's own Rhône chapter chip applied.
  await page.goto(`${BASE}/tastings/`, { waitUntil: 'networkidle' });
  const tt = await liveHeader(page);
  await page.evaluate(() => document.querySelector('#chipbar .chip[data-chapter="rhone"]').click());
  const rows = await page.evaluate((VENUES) => {
    const out = [];
    document.querySelectorAll('.tl-row--past').forEach(r => {
      if (r.style.display === 'none') return;
      const w = r.querySelector('.past-entry__where');
      let txt = w.textContent.replace(/\s+/g, ' ').trim();
      for (const v of VENUES) txt = txt.split(' · ' + v).join('');
      w.textContent = txt;
      out.push(r.querySelector('.tl-row__date').getAttribute('datetime') + ' ' + r.querySelector('.past-entry__title').textContent.trim() + ' | ' + txt);
    });
    // Frame starts at the archive: upcoming rows, today line, filter
    // toolbar, the unfiltered "previously poured" count and the terminus
    // line are outside the crop.
    document.querySelectorAll('.tl-row--upcoming, .tl-row--today, .tl-row--divider, .tl-row--end, .filter-toolbar, .filter-empty').forEach(e => e.style.display = 'none');
    return out;
  }, VENUES);
  console.log('tastings header:', tt, '\narchive rows shown:\n  ' + rows.join('\n  '));
  await frame(page, { ...tt, caption: 'Every evening, on the website', insertBefore: '.tl' });
  await settle(page);
  const fit = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.tl-row--past')].filter(r => r.style.display !== 'none');
    return { lastBottom: Math.round(rows[rows.length - 1].getBoundingClientRect().bottom), footTop: Math.round(document.querySelector('.frame-foot').getBoundingClientRect().top) };
  });
  console.log('archive bottom vs footer top:', fit);
  if (fit.lastBottom > fit.footTop - 24) throw new Error('archive overlaps the footer');
  await page.screenshot({ path: path.join(OUT, 'slide-7-tastings-screenshot.png'), clip: { x: 0, y: 0, width: 1080, height: 1350 } });
  await browser.close();
})();
