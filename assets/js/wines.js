/* ============================================================
   wines.js: filters, search and touch behaviour for /wines/.

   Cards are rendered by wines/index.html with these attributes:
   data-status, data-colour, data-country, data-region, data-chapter,
   data-chapter-title, data-chapter-order, data-search.
   Filter groups and their chips are built here from that data, so new
   wines or chapters appear without touching the template.
   ============================================================ */
(function () {
  'use strict';

  const grid = document.getElementById('wineGrid');
  if (!grid) return;

  const cards      = Array.from(grid.querySelectorAll('.wine'));
  const groupsEl   = document.getElementById('wineFilterGroups');
  const searchEl   = document.getElementById('wineSearch');
  const toggleEl   = document.getElementById('wineFilterToggle');
  const countText  = document.getElementById('wineCountText');
  const resetBtn   = document.getElementById('wineReset');
  const emptyEl    = document.getElementById('wineEmpty');

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

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
      values.forEach(v => {
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

    const filtered = !!state.q || GROUPS.some(g => state[g.key]);
    countText.textContent = filtered
      ? 'Showing ' + shown + ' of ' + cards.length + ' wines'
      : cards.length + ' wines';
    resetBtn.hidden = !filtered;
    emptyEl.hidden = shown !== 0;

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
    state.q = searchEl.value.trim().toLowerCase();
    apply();
  });

  resetBtn.addEventListener('click', () => {
    GROUPS.forEach(g => { state[g.key] = null; });
    state.q = '';
    searchEl.value = '';
    apply();
  });

  // Filters panel: open on desktop, folded away on phones.
  function setPanel(open) {
    groupsEl.hidden = !open;
    toggleEl.setAttribute('aria-expanded', open);
    toggleEl.classList.toggle('filter-toggle--open', open);
  }
  toggleEl.addEventListener('click', () => setPanel(groupsEl.hidden));

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
    if (e.key === 'Escape') cards.forEach(c => c.classList.remove('is-open'));
  });

  buildGroups();
  setPanel(window.matchMedia('(min-width: 769px)').matches);
  apply();
})();
