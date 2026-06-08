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
    document.addEventListener('click', e => {
      if (!burger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('nav__links--open');
        burger.classList.remove('nav__burger--open');
        burger.setAttribute('aria-expanded', false);
      }
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
        } catch (e) { console.warn('Could not copy to clipboard'); }
      }
    });
  });

  // ── A2 Tag filter ─────────────────────────────────────────
  if (!window.CELLAR) return;

  const { tags, tastings } = window.CELLAR;

  // State
  let activeFilters = {}; // { category: tagName }
  let openCategory  = null;

  // DOM refs
  const categoriesEl  = document.getElementById('filter-categories');
  const chipsEl       = document.getElementById('filter-active-chips');
  const expansionEl   = document.getElementById('filter-expansion');
  const expansionLbl  = document.getElementById('filter-expansion-label');
  const expansionTags = document.getElementById('filter-expansion-tags');
  const resetBtn      = document.getElementById('filter-reset');
  const banners       = document.querySelectorAll('[data-tags]');

  if (!categoriesEl) return;

  // Get unique categories in order
  const categories = [...new Set(tags.map(t => t.category))];

  // ── Helpers ───────────────────────────────────────────────

  // Returns tastings matching ALL active filters
  function matchingTastings(extraFilter) {
    const filters = { ...activeFilters };
    if (extraFilter) filters[extraFilter.category] = extraFilter.tag;
    const activeTags = Object.values(filters).filter(Boolean);
    if (!activeTags.length) return tastings;
    return tastings.filter(t =>
      activeTags.every(tag => t.tags && t.tags.includes(tag))
    );
  }

  // Does adding this tag produce at least one result?
  function wouldMatch(category, tagName) {
    return matchingTastings({ category, tag: tagName }).length > 0;
  }

  // ── Render category pills ─────────────────────────────────
  function renderCategories() {
    categoriesEl.innerHTML = '';
    categories.forEach(cat => {
      const hasActive = !!activeFilters[cat];
      const btn = document.createElement('button');
      btn.className = 'filter-cat-btn' +
        (hasActive ? ' filter-cat-btn--active' : '') +
        (openCategory === cat ? ' filter-cat-btn--open' : '');
      btn.dataset.category = cat;
      btn.innerHTML = hasActive
        ? `${cat}: <em>${activeFilters[cat]}</em>`
        : cat;
      btn.addEventListener('click', () => toggleCategory(cat));
      categoriesEl.appendChild(btn);
    });
  }

  // ── Render active chips ───────────────────────────────────
  function renderChips() {
    chipsEl.innerHTML = '';
    Object.entries(activeFilters).forEach(([cat, tag]) => {
      if (!tag) return;
      const chip = document.createElement('span');
      chip.className = 'filter-chip';
      chip.innerHTML = `${tag} <button class="filter-chip__remove" aria-label="Remove ${tag}">×</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        delete activeFilters[cat];
        if (openCategory === cat) closeExpansion();
        applyFilters();
      });
      chipsEl.appendChild(chip);
    });
  }

  // ── Toggle category expansion ─────────────────────────────
  function toggleCategory(cat) {
    if (openCategory === cat) {
      closeExpansion();
      return;
    }
    openCategory = cat;
    renderCategoryExpansion(cat);
    renderCategories();
  }

  function closeExpansion() {
    openCategory = null;
    expansionEl.style.display = 'none';
    renderCategories();
  }

  // ── Render expanded tag list for a category ───────────────
  function renderCategoryExpansion(cat) {
    const catTags = tags.filter(t => t.category === cat);

    expansionLbl.textContent = cat;
    expansionTags.innerHTML = '';

    catTags.forEach(({ name }) => {
      const isActive  = activeFilters[cat] === name;
      const available = isActive || wouldMatch(cat, name);

      const btn = document.createElement('button');
      btn.className = 'filter-tag-btn' +
        (isActive    ? ' filter-tag-btn--active'      : '') +
        (!available  ? ' filter-tag-btn--unavailable' : '');
      btn.textContent = name;
      btn.disabled = !available && !isActive;

      btn.addEventListener('click', () => {
        if (isActive) {
          delete activeFilters[cat];
        } else {
          activeFilters[cat] = name;
        }
        closeExpansion();
        applyFilters();
      });

      expansionTags.appendChild(btn);
    });

    expansionEl.style.display = '';
  }

  // ── Apply filters to banners ──────────────────────────────
  function applyFilters() {
    const activeTags = Object.values(activeFilters).filter(Boolean);
    const hasFilters = activeTags.length > 0;

    // Reset button state
    resetBtn.classList.toggle('active', !hasFilters);

    banners.forEach(banner => {
      const bannerTags = (banner.dataset.tags || '')
        .split(',').map(t => t.trim());
      const show = !hasFilters ||
        activeTags.every(tag => bannerTags.includes(tag));
      banner.style.display = show ? '' : 'none';
    });

    // Show/hide empty messages per column
    ['tastings-col--upcoming', 'tastings-col--archive'].forEach(cls => {
      const col = document.querySelector('.' + cls);
      if (!col) return;
      const anyVisible = [...col.querySelectorAll('[data-tags]')]
        .some(b => b.style.display !== 'none');
      const empty = col.querySelector('.filter-empty');
      if (empty) empty.style.display = anyVisible ? 'none' : '';
    });

    renderCategories();
    renderChips();
  }

  // ── Reset ─────────────────────────────────────────────────
  resetBtn.addEventListener('click', () => {
    activeFilters = {};
    closeExpansion();
    applyFilters();
  });

  // Close expansion on outside click
  document.addEventListener('click', e => {
    if (openCategory &&
        !expansionEl.contains(e.target) &&
        !categoriesEl.contains(e.target)) {
      closeExpansion();
    }
  });

  // ── Init ──────────────────────────────────────────────────
  renderCategories();
  applyFilters();

});
