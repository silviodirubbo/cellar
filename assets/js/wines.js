/* ============================================================
   wines.js: filters, search, shuffle and touch behaviour for /wines/.

   Every wine is one <li class="wine"> in a single grid (#wineGrid),
   rendered by wines/index.html with these attributes:
   data-status, data-colour, data-country, data-region, data-chapter,
   data-chapter-title, data-chapter-order, data-search.
   Filter groups and their chips are built here from that data, so new
   wines or chapters appear without touching the template. The chips sit
   in a dropdown (a full-screen sheet on phones), the same pattern as the
   Tastings filter; active filters are echoed as tokens beside the count.

   Shuffle reorders every card (visible or filtered out) with a
   Fisher-Yates pass, so the order holds when filters change later. The
   visible cards on screen glide to their new places (FLIP with the Web
   Animations API), dealt one after another; with reduced motion the
   grid simply reorders. A reload restores the default order.
   ============================================================ */
(function () {
  'use strict';

  const grid = document.getElementById('wineGrid');
  if (!grid) return;

  let cards        = Array.from(grid.querySelectorAll('.wine'));
  const shuffleEl  = document.getElementById('wineShuffle');
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

  // ── Shuffle ─────────────────────────────────────────────────
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DURATION = 950;
  const STAGGER  = 22;     // ms between cards, in their new visual order
  const STAGGER_CAP = 40;  // after this many cards the delay stops growing
  const MARGIN   = 50;     // px around the viewport that still counts as on screen
  let busy = false;

  function onScreen(r) {
    return r.bottom > -MARGIN && r.top < window.innerHeight + MARGIN;
  }

  function shuffle() {
    if (busy) return;
    cards.forEach(c => c.classList.remove('is-open'));

    // Fisher-Yates over every card, shown or filtered out
    const order = cards.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const animate = !reduceMotion.matches && typeof grid.animate === 'function';
    const visible = cards.filter(c => !c.hidden);
    const before = new Map();
    if (animate) visible.forEach(c => before.set(c, c.getBoundingClientRect()));

    // Reorder the DOM in one move
    const frag = document.createDocumentFragment();
    order.forEach(c => frag.appendChild(c));
    grid.appendChild(frag);
    cards = order;
    if (!animate) return;

    // FLIP: invert each card that lands on screen back to where it was,
    // then let it play. A card coming from far off screen starts from a
    // short way out in the same direction and fades in, so the visible
    // grid refills instead of waiting on long trips. Cards that leave the
    // screen just move.
    const reach = window.innerHeight * 0.4;
    const moves = [];
    let dealt = 0;
    order.forEach(c => {
      if (c.hidden) return;
      const from = before.get(c);
      const to = c.getBoundingClientRect();
      if (!onScreen(to)) return;
      let dx = from.left - to.left;
      let dy = from.top - to.top;
      if (!dx && !dy) return;
      let start = 1;
      if (!onScreen(from) || Math.abs(dy) > reach) {
        dy = Math.sign(dy) * Math.min(Math.abs(dy), reach);
        start = 0;
      }
      const delay = Math.min(dealt, STAGGER_CAP) * STAGGER;
      dealt++;
      const anim = c.animate([
        { transform: `translate(${dx}px, ${dy}px)`, opacity: start },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 14}px) scale(0.93)`, opacity: 0.55, offset: 0.45 },
        { transform: 'none', opacity: 1 }
      ], { duration: DURATION, delay, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'backwards' });
      moves.push(anim.finished.catch(() => {}));
    });
    if (!moves.length) return;

    busy = true;
    grid.classList.add('is-shuffling');
    shuffleEl.setAttribute('aria-disabled', 'true');
    Promise.all(moves).then(() => {
      busy = false;
      grid.classList.remove('is-shuffling');
      shuffleEl.removeAttribute('aria-disabled');
    });
  }
  shuffleEl.addEventListener('click', shuffle);

  buildGroups();
  apply();
})();
