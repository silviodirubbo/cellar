#!/usr/bin/env node
'use strict';

// Writes _data/image_sizes.yml: the pixel size of every tasting cover and
// every wine bottle image, so the templates can give those <img> tags real
// width and height attributes (the browser then reserves the right shape
// before the image arrives). Jekyll cannot read image sizes on GitHub Pages
// (safe mode, no custom plugins), hence this file.
//
//   node scripts/image-sizes.js          rewrite the file
//   node scripts/image-sizes.js --check  exit 1 if the file is out of date
//
// Run it after adding or replacing a cover or a bottle image. The Check
// workflow runs the --check form on every push.
//
// Keys are paths relative to assets/tastings/, as in the wines' `image`
// fields. Sizes are read from the PNG, JPEG or WebP header (no
// dependencies); the file extension is ignored, so double extensions work.

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const ASSETS = path.join(REPO, 'assets', 'tastings');
const DATA = path.join(REPO, '_data', 'tastings.yml');
const OUT = path.join(REPO, '_data', 'image_sizes.yml');

function size(file) {
  const b = fs.readFileSync(file);
  // PNG: width and height in the IHDR chunk
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  // JPEG: walk the markers to the first SOFn frame header
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  // WebP: lossy (VP8), lossless (VP8L) or extended (VP8X)
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1];
    }
    if (kind === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  }
  throw new Error(`unknown image format: ${file}`);
}

function wanted() {
  const keys = new Set();
  // covers: any file whose name starts with "cover" in a tasting folder
  for (const dir of fs.readdirSync(ASSETS)) {
    const full = path.join(ASSETS, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const f of fs.readdirSync(full)) if (f.startsWith('cover')) keys.add(`${dir}/${f}`);
  }
  // bottles: every wine `image` field in _data/tastings.yml
  for (const m of fs.readFileSync(DATA, 'utf8').matchAll(/^\s+image:\s*"?([^"\n]+?)"?\s*$/gm)) keys.add(m[1]);
  return [...keys].sort();
}

function render() {
  let out = '# _data/image_sizes.yml: written by scripts/image-sizes.js, do not edit by hand.\n' +
            '# Pixel size [width, height] of each tasting cover and wine bottle image,\n' +
            '# keyed by path under assets/tastings/.\n';
  for (const key of wanted()) {
    const file = path.join(ASSETS, key);
    if (!fs.existsSync(file)) continue; // a missing image is reported by validate-data.js
    const [w, h] = size(file);
    out += `"${key}": [${w}, ${h}]\n`;
  }
  return out;
}

const text = render();
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error('_data/image_sizes.yml is out of date: run node scripts/image-sizes.js');
    process.exit(1);
  }
  console.log('_data/image_sizes.yml is up to date');
} else {
  fs.writeFileSync(OUT, text, 'utf8');
  console.log(`_data/image_sizes.yml: ${text.split('\n').filter((l) => l.startsWith('"')).length} images`);
}
