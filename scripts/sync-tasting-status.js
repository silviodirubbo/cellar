#!/usr/bin/env node
'use strict';

// Keeps _data/tastings.yml's `status` field in sync with the calendar.
//
// GitHub Pages builds this site with Jekyll in --safe mode, which disables
// custom Ruby plugins, so this can't run as a Jekyll generator at build
// time. Instead it runs out-of-band via a daily GitHub Actions cron
// (.github/workflows/sync-tasting-status.yml) and commits any change back.
//
// For every entry with `date_tbd: false` and a `date` before today
// (Europe/Zurich) but still `status: upcoming`, flips it to
// `status: past` and drops `spots_total`/`cost_estimate`, matching how
// already-past entries are formatted. Entries already `status: past`, or
// with `date_tbd: true`, are left untouched.
//
// Edits are applied as targeted line replacements within each entry's
// own block rather than a full YAML parse/dump, so the file's comments
// and formatting elsewhere are preserved exactly.

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '_data', 'tastings.yml');

function todayInZurich() {
  // en-CA formats as YYYY-MM-DD, which sorts identically to a real
  // date comparison, so entries can be compared as plain strings.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
}

function splitEntries(text) {
  const entryRe = /^- slug: (\S+)\s*$/gm;
  const matches = [...text.matchAll(entryRe)];
  return matches.map((m, i) => ({
    slug: m[1],
    start: m.index,
    end: i + 1 < matches.length ? matches[i + 1].index : text.length,
  }));
}

function getField(block, name) {
  const m = block.match(new RegExp(`^ {2}${name}:\\s*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

function needsFlip(block, today) {
  if (getField(block, 'status') !== 'upcoming') return false;
  if (getField(block, 'date_tbd') !== 'false') return false;
  const date = getField(block, 'date');
  if (!date || date === 'null') return false;
  return date < today;
}

function flipBlock(block) {
  block = block.replace(/^( {2}status:)\s*upcoming\s*$/m, '$1 past');
  block = block.replace(/^ {2}spots_total:.*\n/m, '');
  block = block.replace(/^ {2}cost_estimate:.*\n/m, '');
  return block;
}

function main() {
  const today = todayInZurich();
  let text = fs.readFileSync(DATA_PATH, 'utf8');
  const entries = splitEntries(text);
  const changed = [];

  // Walk back to front so earlier offsets stay valid as blocks shrink.
  for (let i = entries.length - 1; i >= 0; i--) {
    const { slug, start, end } = entries[i];
    const block = text.slice(start, end);
    if (needsFlip(block, today)) {
      const newBlock = flipBlock(block);
      if (newBlock !== block) {
        text = text.slice(0, start) + newBlock + text.slice(end);
        changed.push(slug);
      }
    }
  }

  if (changed.length > 0) {
    fs.writeFileSync(DATA_PATH, text, 'utf8');
    changed.reverse().forEach((slug) => console.log(`tastings.yml: ${slug} -> status: past`));
  } else {
    console.log('tastings.yml: no changes needed');
  }
}

main();
