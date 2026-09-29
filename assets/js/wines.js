/* ============================================================
   wines.js: filters, search and touch behaviour for /wines/.

   Cards are rendered by wines/index.html with these attributes:
   data-status, data-colour, data-country, data-region, data-chapter,
   data-chapter-title, data-chapter-order, data-search.
   Filter groups and their chips are built here from that data, so new
   wines or chapters appear without touching the template. The chips sit
   in a dropdown (a full-screen sheet on phones), the same pattern as the
   Tastings filter; active filters are echoed as tokens beside the count.
   ============================================================ */
(function () {
  'use strict';

  const grid = document.getElementById('wineGrid');
  if (!grid) return;

  const cards      = Array.from(grid.querySelectorAll('.wine'));
  const sections   = Array.from(grid.querySelectorAll('.wine-section'));
  const groupsEl   = document.getElementById('wineFilterGroups');
  const panelEl    = document.getElementById('wineFilterPanel');
  const closeEl    = document.getElementById('wineFilterClose');
  const doneEl     = document.getElementById('wineFilterDone');
  const searchEl   = document.getElementById('wineSearch');
  const toggleEl   = document.getElementById('wineFilterToggle');
  const toggleLbl  = toggleEl.querySelector('.filter-toggle__label');
  const countText  = document.getElementById('wineCountText');
  const activeEl   = document.getElementById('wineActive');
  const activeRow  = document.getElementById('wineActiveRow');
  const resetBtn   = document.getElementById('wineReset');
  const emptyEl    = document.getElementById('wineEmpty');

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  // "pepiere" finds "Pépière": compare without accents
  const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  cards.forEach(c => { c.dataset.search = fold(c.dataset.search); });

  // Which filters exist, and how each one reads and sorts.
  const GROUPS = [
    { key: 'status',  label: 'Status',
      label_for: v => (v === 'poured' ? 'Poured' : 'Coming up'),
      order: ['poured', 'upcoming'] },
    { key: 'colour',  label: 'Colour',
      label_for: cap,
      order: ['red', 'white', 'rosé', 'sparkling'] },
    { key: 'country', label: 'Country',
      label_for: v => v },
    { key: 'region',  label: 'Region',
      label_for: v => v,
      sort: 'count' },
    { key: 'chapter', label: 'Chapter',
      label_for: (v, sample) => sample.dataset.chapterTitle || v,
      sort: 'chapter' }
  ];

  const labels = {};   // group key -> value -> chip text
  const state = { q: '' };
  GROUPS.forEach(g => { state[g.key] = null; });

  // ── Matching ────────────────────────────────────────────────
  function matches(card, ignoreKey) {
    if (state.q && card.dataset.search.indexOf(state.q) === -1) return false;
    return GROUPS.every(g => {
      if (g.key === ignoreKey || !state[g.key]) return true;
      return card.dataset[g.key] === state[g.key];
    });
  }

  // ── Build the chips ─────────────────────────────────────────
  const chipsByGroup = {};

  function buildGroups() {
    GROUPS.forEach(g => {
      const seen = new Map();   // value -> first card carrying it
      const totals = {};
      cards.forEach(c => {
        const v = c.dataset[g.key];
        if (!v) return;
        if (!seen.has(v)) seen.set(v, c);
        totals[v] = (totals[v] || 0) + 1;
      });
      if (seen.size < 2) return;   // a one-option filter filters nothing

      let values = Array.from(seen.keys());
      if (g.order) {
        values.sort((a, b) => {
          const ia = g.order.indexOf(a), ib = g.order.indexOf(b);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
      } else if (g.sort === 'count') {
        values.sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
      } else if (g.sort === 'chapter') {
        values.sort((a, b) =>
          Number(seen.get(a).dataset.chapterOrder) - Number(seen.get(b).dataset.chapterOrder));
      } else {
        values.sort((a, b) => a.localeCompare(b));
      }

      const wrap = document.createElement('div');
      wrap.className = 'wine-filter';
      const label = document.createElement('span');
      label.className = 'wine-filter__label';
      label.textContent = g.label;
      const items = document.createElement('div');
      items.className = 'wine-filter__items';

      chipsByGroup[g.key] = [];
      labels[g.key] = {};
      values.forEach(v => {
        labels[g.key][v] = g.label_for(v, seen.get(v));
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.dataset.group = g.key;
        chip.dataset.value = v;
        chip.setAttribute('aria-pressed', 'false');
        chip.appendChild(document.createTextNode(g.label_for(v, seen.get(v)) + ' '));
        const n = document.createElement('span');
        n.className = 'chip__n';
        chip.appendChild(n);
        items.appendChild(chip);
        chipsByGroup[g.key].push(chip);
      });

      wrap.appendChild(label);
      wrap.appendChild(items);
      groupsEl.appendChild(wrap);
    });
  }

  // ── Apply ───────────────────────────────────────────────────
  function apply() {
    let shown = 0;
    cards.forEach(c => {
      const ok = matches(c, null);
      c.hidden = !ok;
      if (ok) shown++;
    });

    // Each chip's number is how many wines it would give with the OTHER
    // filters as they are now, so a click never lands on an empty grid.
    Object.keys(chipsByGroup).forEach(key => {
      chipsByGroup[key].forEach(chip => {
        const n = cards.filter(c => matches(c, key) && c.dataset[key] === chip.dataset.value).length;
        chip.querySelector('.chip__n').textContent = n;
        const active = state[key] === chip.dataset.value;
        chip.classList.toggle('chip--active', active);
        chip.classList.toggle('chip--empty', n === 0 && !active);
        chip.setAttribute('aria-pressed', active);
      });
    });

    const active = GROUPS.filter(g => state[g.key]);
    const filtered = !!state.q || active.length > 0;
    countText.textContent = filtered
      ? shown + ' of ' + cards.length + ' wines'
      : cards.length + ' wines';
    resetBtn.hidden = !filtered;
    activeRow.hidden = !filtered;
    emptyEl.hidden = shown !== 0;

    // Active filters, readable while the panel is closed
    activeEl.textContent = '';
    active.forEach(g => {
      const tok = document.createElement('button');
      tok.type = 'button';
      tok.className = 'wine-active__tok';
      tok.dataset.group = g.key;
      tok.setAttribute('aria-label', 'Remove filter ' + labels[g.key][state[g.key]]);
      tok.textContent = labels[g.key][state[g.key]];
      activeEl.appendChild(tok);
    });
    toggleLbl.textContent = active.length ? 'Filter · ' + active.length : 'Filter';
    toggleEl.classList.toggle('filter-toggle--active', active.length > 0);
    doneEl.textContent = shown === 1 ? 'Show 1 wine' : 'Show ' + shown + ' wines';

    // Each section (poured, coming up) shows its own count, or hides when empty
    sections.forEach(sec => {
      const n = sec.querySelectorAll('.wine:not([hidden])').length;
      sec.hidden = n === 0;
      const num = sec.querySelector('.wine-section__n');
      if (num) num.textContent = n;
    });

    // A card that got filtered out must not stay open on touch screens.
    cards.forEach(c => { if (c.hidden) c.classList.remove('is-open'); });
  }

  // ── Events ──────────────────────────────────────────────────
  groupsEl.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const key = chip.dataset.group;
    state[key] = state[key] === chip.dataset.value ? null : chip.dataset.value;
    apply();
  });

  searchEl.addEventListener('input', () => {
    state.q = fold(searchEl.value.trim());
    apply();
  });

  activeEl.addEventListener('click', e => {
    const tok = e.target.closest('.wine-active__tok');
    if (!tok) return;
    state[tok.dataset.group] = null;
    apply();
    toggleEl.focus();
  });

  resetBtn.addEventListener('click', () => {
    GROUPS.forEach(g => { state[g.key] = null; });
    state.q = '';
    searchEl.value = '';
    apply();
  });

  // Filters panel: a dropdown on desktop, a full-screen sheet on phones.
  function setPanel(open) {
    panelEl.hidden = !open;
    toggleEl.setAttribute('aria-expanded', open);
    toggleEl.classList.toggle('filter-toggle--open', open);
    document.body.classList.toggle('filter-open', open);
  }
  toggleEl.addEventListener('click', e => {
    e.stopPropagation();
    setPanel(panelEl.hidden);
  });
  closeEl.addEventListener('click', () => { setPanel(false); toggleEl.focus(); });
  doneEl.addEventListener('click', () => { setPanel(false); toggleEl.focus(); });
  document.addEventListener('click', e => {
    if (panelEl.hidden) return;
    if (!panelEl.contains(e.target) && !toggleEl.contains(e.target)) setPanel(false);
  });

  // Touch screens have no hover: a tap opens a bottle's details, a tap
  // elsewhere closes them. Links inside the details work as usual.
  const canHover = window.matchMedia('(hover: hover)').matches;
  if (!canHover) {
    grid.addEventListener('click', e => {
      if (e.target.closest('.wine__more a')) return;
      const card = e.target.closest('.wine');
      cards.forEach(c => { if (c !== card) c.classList.remove('is-open'); });
      if (card) card.classList.toggle('is-open');
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.wine')) cards.forEach(c => c.classList.remove('is-open'));
    });
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    cards.forEach(c => c.classList.remove('is-open'));
    if (!panelEl.hidden) { setPanel(false); toggleEl.focus(); }
  });

  buildGroups();
  apply();
})();
