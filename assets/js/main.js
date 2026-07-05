/* ============================================================
   main.js — Global JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Hamburger nav ─────────────────────────────────────────
  const burger   = document.getElementById('nav-burger');
  const navLinks = document.getElementById('nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('nav__links--open');
      burger.setAttribute('aria-expanded', open);
      burger.classList.toggle('nav__burger--open', open);
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('nav__links--open');
        burger.classList.remove('nav__burger--open');
        burger.setAttribute('aria-expanded', false);
      });
    });
  }

  // ── Nav scroll state ──────────────────────────────────────
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.style.borderBottomColor = window.scrollY > 20
        ? 'var(--rule)' : 'transparent';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ── Share buttons ─────────────────────────────────────────
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug   = btn.dataset.slug;
      const slides = btn.dataset.slides === 'true';
      const base   = 'https://silviodirubbo.github.io/cellar';
      const url    = slides ? `${base}/tastings/${slug}/` : `${base}/tastings/`;
      if (navigator.share) {
        try { await navigator.share({ url }); } catch (e) {}
      } else {
        try {
          await navigator.clipboard.writeText(url);
          const original = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(() => btn.textContent = original, 2000);
        } catch (e) {}
      }
    });
  });

  // ── Tastings: mobile tab switcher ─────────────────────────
  const tabsWrap = document.getElementById('tastings-tabs');
  const tastingsGrid = document.getElementById('tastings-grid');
  if (tabsWrap && tastingsGrid) {
    tabsWrap.querySelectorAll('.tastings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        tastingsGrid.dataset.active = tab.dataset.tab;
        tabsWrap.querySelectorAll('.tastings-tab').forEach(t =>
          t.classList.toggle('tastings-tab--active', t === tab));
      });
    });
  }

  // ── Tastings: "in N days" countdown ───────────────────────
  document.querySelectorAll('.js-countdown[data-date]').forEach(el => {
    const target = new Date(el.dataset.date + 'T00:00:00');
    if (isNaN(target)) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((target - today) / 86400000);
    if (days < 0) return;
    el.textContent = days === 0 ? 'tonight'
                   : days === 1 ? 'tomorrow'
                   : 'in ' + days + ' days';
  });

  // ── A2 Tag filter ─────────────────────────────────────────
  if (!window.CELLAR) return;

  const allTags    = window.CELLAR.tags;
  const allTastings = window.CELLAR.tastings;
  const banners    = document.querySelectorAll('[data-tags]');
  const catEl      = document.getElementById('filter-categories');
  const expEl      = document.getElementById('filter-expansion');
  const expLbl     = document.getElementById('filter-expansion-label');
  const expTags    = document.getElementById('filter-expansion-tags');
  const resetBtn   = document.getElementById('filter-reset');
  const chipsEl    = document.getElementById('filter-active-chips');

  if (!catEl) return;

  // State
  const activeFilters = {}; // { category: tagName }
  let openCat = null;

  // Get unique categories
  const categories = [];
  allTags.forEach(t => {
    if (!categories.includes(t.category)) categories.push(t.category);
  });

  // Build static category buttons once
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-cat-btn';
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (openCat === cat) {
        closePicker();
      } else {
        openPicker(cat);
      }
    });
    catEl.appendChild(btn);
  });

  function openPicker(cat) {
    openCat = cat;

    // Update pill styles
    catEl.querySelectorAll('.filter-cat-btn').forEach(b => {
      b.classList.toggle('filter-cat-btn--open', b.dataset.category === cat);
    });

    // Build tag buttons
    expLbl.textContent = cat;
    expTags.innerHTML = '';
    const tagsInCat = allTags.filter(t => t.category === cat);

    tagsInCat.forEach(({ name }) => {
      const isActive = activeFilters[cat] === name;
      const canMatch = wouldMatch(cat, name);

      const btn = document.createElement('button');
      btn.className = 'filter-tag-btn' +
        (isActive ? ' filter-tag-btn--active' : '') +
        (!canMatch && !isActive ? ' filter-tag-btn--unavailable' : '');
      btn.textContent = name;
      if (!canMatch && !isActive) btn.disabled = true;

      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isActive) {
          delete activeFilters[cat];
        } else {
          activeFilters[cat] = name;
        }
        closePicker();
        applyAll();
      });

      expTags.appendChild(btn);
    });

    expEl.style.display = '';
  }

  function closePicker() {
    openCat = null;
    expEl.style.display = 'none';
    catEl.querySelectorAll('.filter-cat-btn').forEach(b => {
      b.classList.remove('filter-cat-btn--open');
    });
  }

  function wouldMatch(cat, tagName) {
    const testFilters = Object.assign({}, activeFilters, { [cat]: tagName });
    const active = Object.values(testFilters).filter(Boolean);
    return allTastings.some(t =>
      active.every(tag => t.tags && t.tags.includes(tag))
    );
  }

  function applyAll() {
    const active = Object.values(activeFilters).filter(Boolean);
    const hasFilters = active.length > 0;

    // Reset button
    resetBtn.classList.toggle('active', !hasFilters);

    // Update pill labels
    catEl.querySelectorAll('.filter-cat-btn').forEach(b => {
      const cat = b.dataset.category;
      const sel = activeFilters[cat];
      b.classList.toggle('filter-cat-btn--active', !!sel);
      if (sel) {
        b.innerHTML = cat + ': <em>' + sel + '</em>';
      } else {
        b.textContent = cat;
      }
    });

    // Chips
    chipsEl.innerHTML = '';
    Object.entries(activeFilters).forEach(([cat, tag]) => {
      if (!tag) return;
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = tag + ' <button class="filter-chip__remove" aria-label="Remove">×</button>';
      chip.querySelector('button').addEventListener('click', function(e) {
        e.stopPropagation();
        delete activeFilters[cat];
        applyAll();
      });
      chipsEl.appendChild(chip);
    });

    // Filter banners
    banners.forEach(banner => {
      const tags = (banner.dataset.tags || '').split(',').map(t => t.trim());
      const show = !hasFilters || active.every(tag => tags.includes(tag));
      banner.style.display = show ? '' : 'none';
    });

    // Empty messages
    ['tastings-col--upcoming', 'tastings-col--archive'].forEach(cls => {
      const col = document.querySelector('.' + cls);
      if (!col) return;
      const anyVisible = [...col.querySelectorAll('[data-tags]')]
        .some(b => b.style.display !== 'none');
      const empty = col.querySelector('.filter-empty');
      if (empty) empty.style.display = anyVisible ? 'none' : '';
    });
  }

  // Reset
  resetBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    Object.keys(activeFilters).forEach(k => delete activeFilters[k]);
    closePicker();
    applyAll();
  });

  // Close on outside click
  document.addEventListener('click', function() {
    if (openCat) closePicker();
  });

  // Prevent expansion panel clicks from closing
  expEl.addEventListener('click', function(e) {
    e.stopPropagation();
  });

  // Init
  applyAll();

});
