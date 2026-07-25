/* ============================================================
   main.js: Global JavaScript
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

  // ── Tastings: live "today" marker ─────────────────────────
  document.querySelectorAll('.js-today').forEach(el => {
    el.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  });

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

  // ── Tastings: add to calendar (.ics download) ─────────────
  document.querySelectorAll('.js-ics').forEach(btn => {
    btn.addEventListener('click', () => {
      const { date, title, location } = btn.dataset;
      if (!date || !title) return;
      const d   = date.replace(/-/g, '');
      const esc = s => (s || '').replace(/[\\;,]/g, m => '\\' + m);
      // evenings start at 19:00 local time
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cellar//Tastings//EN',
        'BEGIN:VEVENT',
        'UID:' + date + '-' + title.replace(/\W+/g, '') + '@cellar',
        'DTSTAMP:' + d + 'T000000Z',
        'DTSTART:' + d + 'T190000',
        'DTEND:' + d + 'T220000',
        'SUMMARY:' + esc('Wine tasting: ' + title),
        'LOCATION:' + esc(location),
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      const a = document.createElement('a');
      a.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
      a.download = title.toLowerCase().replace(/\W+/g, '-') + '.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
      const original = btn.textContent;
      btn.textContent = 'Saved ✓';
      setTimeout(() => btn.textContent = original, 2000);
    });
  });

  // ── Tastings: one-tap tag chips ───────────────────────────
  const chipbar = document.getElementById('chipbar');
  if (chipbar) {
    const rows = document.querySelectorAll('[data-tags]');
    chipbar.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // tapping the active chip resets to All
        const isActive = chip.classList.contains('chip--active');
        const target = isActive ? chipbar.querySelector('[data-tag=""]') : chip;
        const tag = target.dataset.tag;
        chipbar.querySelectorAll('.chip').forEach(c =>
          c.classList.toggle('chip--active', c === target));

        rows.forEach(row => {
          const tags = (row.dataset.tags || '').split(',').map(t => t.trim());
          row.style.display = (!tag || tags.includes(tag)) ? '' : 'none';
        });

        const anyUp = [...document.querySelectorAll('.tl-row--upcoming')]
          .some(r => r.style.display !== 'none');
        const anyPast = [...document.querySelectorAll('.tl-row--past')]
          .some(r => r.style.display !== 'none');
        const eu = document.querySelector('.filter-empty--upcoming');
        const ep = document.querySelector('.filter-empty--past');
        if (eu) eu.style.display = anyUp ? 'none' : '';
        if (ep) ep.style.display = anyPast ? 'none' : '';
      });
    });
  }

  // ── Tastings: filter panel toggle ─────────────────────────
  const filterToggle = document.getElementById('filterToggle');
  const filterPanel  = document.getElementById('filterPanel');
  if (filterToggle && filterPanel) {
    const labelEl  = filterToggle.querySelector('.filter-toggle__label');
    const closeBtn = document.getElementById('filterClose');

    const openPanel = () => {
      filterPanel.hidden = false;
      filterToggle.setAttribute('aria-expanded', 'true');
      filterToggle.classList.add('filter-toggle--open');
      document.body.classList.add('filter-open');
    };
    const closePanel = () => {
      filterPanel.hidden = true;
      filterToggle.setAttribute('aria-expanded', 'false');
      filterToggle.classList.remove('filter-toggle--open');
      document.body.classList.remove('filter-open');
    };

    filterToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      filterPanel.hidden ? openPanel() : closePanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    // click outside the panel closes it (desktop dropdown)
    document.addEventListener('click', (e) => {
      if (filterPanel.hidden) return;
      if (!filterPanel.contains(e.target) && !filterToggle.contains(e.target)) closePanel();
    });
    // Esc closes it
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !filterPanel.hidden) closePanel();
    });

    // reflect the active filter on the button, so it reads even when closed
    filterPanel.addEventListener('click', (e) => {
      if (!e.target.closest('.chip')) return;
      const active = filterPanel.querySelector('.chip.chip--active');
      const tag = active ? active.dataset.tag : '';
      if (labelEl) labelEl.textContent = tag ? 'Filter · ' + tag : 'Filter';
      filterToggle.classList.toggle('filter-toggle--active', !!tag);
    });
  }

});
