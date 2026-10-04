#!/usr/bin/env node
'use strict';

// Crawls a built copy of the site for broken internal links and missing
// assets: every href, src, srcset and CSS url() in the HTML and CSS must
// resolve to a file, and every #anchor on a page of this site must match
// an id there. External links are not fetched. Run by the Check workflow:
//
//   node scripts/check-links.js _site
//
// The site lives under /cellar (baseurl), so root-relative paths are
// resolved against that.

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || '_site');
const BASE = '/cellar';
const SITE = 'https://silviodirubbo.github.io';
// fragments handled by JavaScript (forms.js), not by an element id
const SCRIPT_ANCHORS = /^(join-|propose$)/;

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(root);

const problems = [];
const anchors = [];

function resolve(from, url) {
  url = url.trim();
  if (!url || /^(mailto:|tel:|data:|javascript:|#)/.test(url)) return null;
  if (url.startsWith(SITE + BASE)) url = url.slice(SITE.length);
  if (/^(https?:)?\/\//.test(url)) return null; // external
  const [p, hash] = url.split('#');
  const clean = decodeURIComponent(p.split('?')[0]);
  if (!clean) return null;
  let abs;
  if (clean.startsWith('/')) {
    if (clean !== BASE && !clean.startsWith(BASE + '/')) return { error: 'outside the site baseurl' };
    abs = path.join(root, clean.slice(BASE.length));
  } else {
    abs = path.join(path.dirname(from), clean);
  }
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) abs = path.join(abs, 'index.html');
  return { abs, hash };
}

function check(from, url) {
  const r = resolve(from, url);
  if (!r) return;
  const page = path.relative(root, from);
  if (r.error) { problems.push(`${page}: ${url} (${r.error})`); return; }
  if (!fs.existsSync(r.abs)) { problems.push(`${page}: ${url} (not found)`); return; }
  if (r.hash && r.abs.endsWith('.html') && !SCRIPT_ANCHORS.test(r.hash)) anchors.push([page, url, r.abs, r.hash]);
}

for (const f of files) {
  if (f.endsWith('.html')) {
    const s = fs.readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const m of s.matchAll(/\s(?:href|src|poster)\s*=\s*["']([^"']+)["']/g)) check(f, m[1]);
    for (const m of s.matchAll(/\ssrcset\s*=\s*["']([^"']+)["']/g)) m[1].split(',').forEach((x) => check(f, x.trim().split(/\s+/)[0]));
    for (const m of s.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(f, m[1]);
  } else if (f.endsWith('.css')) {
    const s = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of s.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) check(f, m[1]);
  }
}

const idCache = new Map();
for (const [page, url, abs, hash] of anchors) {
  if (!idCache.has(abs)) idCache.set(abs, new Set([...fs.readFileSync(abs, 'utf8').matchAll(/\sid=["']([^"']+)["']/g)].map((m) => m[1])));
  if (!idCache.get(abs).has(decodeURIComponent(hash))) problems.push(`${page}: ${url} (no element with id "${hash}")`);
}

const pages = files.filter((f) => f.endsWith('.html')).length;
for (const p of [...new Set(problems)]) console.log(`error: ${p}`);
console.log(`${pages} pages crawled: ${problems.length} broken link(s) or missing asset(s)`);
process.exit(problems.length ? 1 : 0);
