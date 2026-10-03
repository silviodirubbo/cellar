#!/usr/bin/env node
'use strict';

// Records how many places are taken for one tasting in
// _data/availability.yml.
//
//   node scripts/update-availability.js <slug> <taken>
//   node scripts/update-availability.js <slug> clear
//
// Run by .github/workflows/update-availability.yml, which the Google
// Calendar sync (tools/calendar-sync/) triggers through repository_dispatch.
// `clear` removes the tasting's entry, so the site falls back to the plain
// "N spots" display.
//
// Idempotent: when the stored taken and capacity already match, the file
// is left byte for byte unchanged (updated_at included), so the workflow
// finds nothing to commit. Capacity is read from the tasting's `capacity`
// field in _data/tastings.yml and defaults to 6.
//
// The file is read and written with a small line format of its own rather
// than a YAML library, as scripts/ has no dependencies; the comment header
// is kept as is.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '_data');
const TASTINGS_PATH = path.join(DATA_DIR, 'tastings.yml');
const AVAILABILITY_PATH = path.join(DATA_DIR, 'availability.yml');
const DEFAULT_CAPACITY = 6;

function fail(message) {
  console.error(`update-availability: ${message}`);
  process.exit(1);
}

function tastingCapacity(slug) {
  const text = fs.readFileSync(TASTINGS_PATH, 'utf8');
  const starts = [...text.matchAll(/^- slug: (\S+)\s*$/gm)];
  const i = starts.findIndex((m) => m[1] === slug);
  if (i === -1) return null;
  const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
  const block = text.slice(starts[i].index, end);
  const m = block.match(/^ {2}capacity:\s*(\d+)\s*$/m);
  return m ? Number(m[1]) : DEFAULT_CAPACITY;
}

function readAvailability() {
  const text = fs.existsSync(AVAILABILITY_PATH) ? fs.readFileSync(AVAILABILITY_PATH, 'utf8') : '';
  const lines = text.split('\n');
  const firstKey = lines.findIndex((l) => /^[a-z0-9-]+:\s*$/.test(l));
  const headerLines = firstKey === -1 ? lines : lines.slice(0, firstKey);
  const header = headerLines.join('\n').replace(/\n*$/, '\n');
  const entries = new Map();
  let current = null;
  for (const line of firstKey === -1 ? [] : lines.slice(firstKey)) {
    const key = line.match(/^([a-z0-9-]+):\s*$/);
    if (key) {
      current = {};
      entries.set(key[1], current);
      continue;
    }
    const field = line.match(/^ {2}(\w+):\s*"?([^"]*)"?\s*$/);
    if (field && current) current[field[1]] = field[2];
  }
  return { header, entries };
}

function writeAvailability(header, entries) {
  let out = header;
  for (const [slug, e] of entries) {
    out += `\n${slug}:\n  taken: ${e.taken}\n  capacity: ${e.capacity}\n  updated_at: "${e.updated_at}"\n`;
  }
  fs.writeFileSync(AVAILABILITY_PATH, out, 'utf8');
}

function main() {
  const [slug, rawTaken] = process.argv.slice(2);
  if (!slug || rawTaken === undefined) fail('usage: update-availability.js <slug> <taken|clear>');
  if (!/^[a-z0-9-]+$/.test(slug)) fail(`invalid slug "${slug}"`);

  const capacity = tastingCapacity(slug);
  if (capacity === null) fail(`no tasting with slug "${slug}" in _data/tastings.yml`);

  const { header, entries } = readAvailability();

  if (String(rawTaken).trim().toLowerCase() === 'clear') {
    if (!entries.has(slug)) {
      console.log(`availability.yml: ${slug} has no entry, nothing to clear`);
      return;
    }
    entries.delete(slug);
    writeAvailability(header, entries);
    console.log(`availability.yml: ${slug} cleared`);
    return;
  }

  if (!/^-?\d+$/.test(String(rawTaken).trim())) fail(`taken must be a whole number or "clear", got "${rawTaken}"`);
  const taken = Math.max(0, parseInt(rawTaken, 10));

  const existing = entries.get(slug);
  if (existing && Number(existing.taken) === taken && Number(existing.capacity) === capacity) {
    console.log(`availability.yml: ${slug} already at ${taken}/${capacity}, no change`);
    return;
  }

  entries.set(slug, {
    taken,
    capacity,
    updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
  writeAvailability(header, entries);
  console.log(`availability.yml: ${slug} -> ${taken} taken of ${capacity}`);
}

main();
