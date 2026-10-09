#!/usr/bin/env node
'use strict';

// Checks that the site's data and the files it points to agree. Run by
// the Check workflow on every push, or locally:
//
//   cd scripts && npm install && node validate-data.js
//
// Errors (exit 1): a broken reference that shows on the site or would
// break a build, a page or a sync. Warnings: worth a look, never fail.
//
//   - slugs: unique, lowercase words joined by hyphens
//   - chapter: one of _chapters/*.md
//   - tags: each one listed in _data/tags.yml
//   - wine images: the file exists under assets/tastings/
//   - decks: _tastings/<slug>.html exists when slides: true, and every
//     deck file matches a tasting slug; a deck without slides: true (staged
//     for review before activation) is a warning
//   - availability: every key in _data/availability.yml is a tasting
//   - capacity: a whole number above 0 when present; an upcoming tasting
//     without one gets a warning (the site then assumes 6)
//   - Story pages: tasting_slug, tasting_slug_a and tasting_slug_b point
//     to existing tastings
//   - status: a dated tasting in the past still marked upcoming (the daily
//     sync fixes it) is a warning

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const REPO = path.join(__dirname, '..');
const rel = (...p) => path.join(REPO, ...p);
const load = (f) => yaml.load(fs.readFileSync(rel(f), 'utf8')) || {};

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const tastings = load('_data/tastings.yml');
const tags = new Set(load('_data/tags.yml').map((t) => t.name));
const availability = load('_data/availability.yml');
const chapters = new Set(fs.readdirSync(rel('_chapters')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)));
const decks = new Set(fs.readdirSync(rel('_tastings')).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)));

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d) : null);

const slugs = new Set();
for (const t of tastings) {
  const s = t.slug;
  const where = `tastings.yml ${s || '(no slug)'}`;
  if (!s || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) err(`${where}: slug must be lowercase words joined by hyphens`);
  if (slugs.has(s)) err(`${where}: duplicate slug`);
  slugs.add(s);

  if (!chapters.has(t.chapter)) err(`${where}: chapter "${t.chapter}" has no _chapters/${t.chapter}.md`);
  for (const tag of t.tags || []) if (!tags.has(tag)) err(`${where}: tag "${tag}" is not in _data/tags.yml`);

  (t.wines || []).forEach((w, i) => {
    if (w.image && !fs.existsSync(rel('assets/tastings', w.image))) err(`${where}: wine ${i + 1} image not found: assets/tastings/${w.image}`);
  });

  if (t.slides === true && !decks.has(s)) err(`${where}: slides: true but _tastings/${s}.html does not exist`);
  if (t.slides !== true && decks.has(s)) warn(`${where}: _tastings/${s}.html exists but slides is not true (a deck staged for review, unlinked until activated)`);

  if (t.capacity !== undefined && !(Number.isInteger(t.capacity) && t.capacity > 0)) err(`${where}: capacity must be a whole number above 0`);
  if (t.status === 'upcoming' && t.capacity === undefined) warn(`${where}: upcoming without capacity (the site assumes 6)`);

  const d = iso(t.date);
  if (t.status === 'upcoming' && !t.date_tbd && d && d < today) warn(`${where}: dated ${d} but still upcoming (the daily sync will mark it past)`);
}

for (const d of decks) if (!slugs.has(d)) err(`_tastings/${d}.html: no tasting with slug "${d}" (deck filename and slug must match)`);
for (const k of Object.keys(availability)) if (!slugs.has(k)) err(`availability.yml: key "${k}" has no tasting`);

const storyDir = rel('assets/social/instagram/stories/src');
if (fs.existsSync(storyDir)) {
  for (const f of fs.readdirSync(storyDir).filter((x) => x.endsWith('.html'))) {
    const fm = (fs.readFileSync(path.join(storyDir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/) || [])[1];
    if (!fm) continue;
    const meta = yaml.load(fm) || {};
    for (const key of ['tasting_slug', 'tasting_slug_a', 'tasting_slug_b']) {
      if (meta[key] && !slugs.has(meta[key])) err(`stories/src/${f}: ${key} "${meta[key]}" has no tasting`);
    }
  }
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error: ${e}`);
console.log(`${tastings.length} tastings checked: ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
