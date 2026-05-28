#!/usr/bin/env node
/**
 * generate-all-pdfs.js
 *
 * Reads _data/tastings.yml, finds every tasting with slides: true,
 * and generates a PDF for each one using Puppeteer.
 *
 * Run from the repo root:
 *   node scripts/generate-all-pdfs.js
 *
 * Requires:
 *   - Jekyll already serving on http://localhost:4000
 *   - npm install puppeteer  (inside scripts/)
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml'); // installed below if needed

// ── Config ───────────────────────────────────────────────────────────────────

const JEKYLL_BASE = 'http://localhost:4000';
const TASTINGS_YML = path.resolve(__dirname, '../_data/tastings.yml');
const ASSETS_ROOT = path.resolve(__dirname, '../assets/tastings');
const VIEWPORT = { width: 1920, height: 1080 };
const LOAD_WAIT_MS = 3000; // wait for fonts + images

// ── Parse YAML without js-yaml (keep deps minimal) ──────────────────────────
// We do a simple regex extraction rather than pulling in js-yaml
function parseTastingsYml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const tastings = [];
  
  // Split on top-level list items (lines starting with "- ")
  const blocks = content.split(/\n(?=- )/);
  
  for (const block of blocks) {
    const slugMatch = block.match(/slug:\s*(.+)/);
    const slidesMatch = block.match(/slides:\s*(true|false)/);
    
    if (!slugMatch) continue;
    
    const slug = slugMatch[1].trim();
    const slides = slidesMatch ? slidesMatch[1].trim() === 'true' : false;
    
    tastings.push({ slug, slides });
  }
  
  return tastings;
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function generatePdf(browser, slug) {
  const url = `${JEKYLL_BASE}/tastings/${slug}/`;
  const outputDir = path.join(ASSETS_ROOT, slug);
  const outputPath = path.join(outputDir, 'presentation.pdf');

  // Skip if PDF already exists and HTML hasn't changed
  // (GitHub Action only runs when _tastings/ changes, so this is just a safety check)
  console.log(`\n📄 ${slug}`);
  console.log(`   URL: ${url}`);

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  } catch (e) {
    console.log(`   ⚠️  Could not load ${url} — skipping (tasting may not have a presentation page yet)`);
    await page.close();
    return;
  }

  // Wait for Google Fonts and lazy assets
  await new Promise(r => setTimeout(r, LOAD_WAIT_MS));

  const slideCount = await page.evaluate(() =>
    document.querySelectorAll('.slide').length
  );

  if (slideCount === 0) {
    console.log(`   ⚠️  No .slide elements found — skipping`);
    await page.close();
    return;
  }

  console.log(`   Found ${slideCount} slides`);

  // Screenshot each slide
  const screenshots = [];
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate((index) => {
      document.querySelectorAll('.slide').forEach((s, j) => {
        s.style.display = j === index ? 'flex' : 'none';
      });
      // Hide nav UI
      const nav = document.querySelector('.pres-nav');
      if (nav) nav.style.display = 'none';
      const exit = document.getElementById('deckExit');
      if (exit) exit.style.display = 'none';
    }, i);

    await new Promise(r => setTimeout(r, 150));

    const shot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height },
    });
    screenshots.push(shot);
    process.stdout.write(`   Slide ${i + 1}/${slideCount}\r`);
  }

  await page.close();

  // Build a single-page-per-slide HTML and print to PDF
  const pdfPage = await browser.newPage();
  await pdfPage.setViewport(VIEWPORT);

  const dataUris = screenshots.map(b => 'data:image/png;base64,' + b.toString('base64'));
  const html = `<!DOCTYPE html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000}
    .page{width:1920px;height:1080px;page-break-after:always;overflow:hidden}
    .page:last-child{page-break-after:avoid}
    img{width:1920px;height:1080px;display:block}
  </style></head><body>
  ${dataUris.map(uri => `<div class="page"><img src="${uri}"></div>`).join('\n')}
  </body></html>`;

  await pdfPage.setContent(html, { waitUntil: 'load' });

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  await pdfPage.pdf({
    path: outputPath,
    width: '338mm',
    height: '190mm',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await pdfPage.close();

  const sizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
  console.log(`\n   ✅ Saved: ${outputPath} (${sizeMb} MB)`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🍷 Silvio\'s Cellar — PDF Generator\n');

  // Parse tastings
  const tastings = parseTastingsYml(TASTINGS_YML);
  const withSlides = tastings.filter(t => t.slides);

  if (withSlides.length === 0) {
    console.log('No tastings with slides: true found. Nothing to generate.');
    process.exit(0);
  }

  console.log(`Found ${withSlides.length} tasting(s) with slides: true`);
  withSlides.forEach(t => console.log(`  · ${t.slug}`));

  // Launch browser once, reuse for all tastings
  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--allow-file-access-from-files',
    ],
  });

  for (const tasting of withSlides) {
    await generatePdf(browser, tasting.slug);
  }

  await browser.close();

  console.log('\n✅ All done.\n');
})().catch(err => {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
});
