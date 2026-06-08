/* ============================================================
   main.js — Global JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Hamburger nav ─────────────────────────────────────────
  const burger = document.getElementById('nav-burger');
  const navLinks = document.getElementById('nav-links');
  if (burger && navLinks) {
    burger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('nav__links--open');
      burger.setAttribute('aria-expanded', open);
      burger.classList.toggle('nav__burger--open', open);
    });
    // Close on link click
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('nav__links--open');
        burger.classList.remove('nav__burger--open');
        burger.setAttribute('aria-expanded', false);
      });
    });
    // Close on outside click
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
        ? 'var(--rule)'
        : 'transparent';
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
      const url    = slides
        ? `${base}/tastings/${slug}/`
        : `${base}/tastings/`;
      if (navigator.share) {
        try {
          await navigator.share({ url });
        } catch (e) {
          // User cancelled — do nothing
        }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          const original = btn.textContent;
          btn.textContent = 'Copied';
          setTimeout(() => btn.textContent = original, 2000);
        } catch (e) {
          console.warn('Could not copy to clipboard');
        }
      }
    });
  });

  // ── Tasting tag filter ────────────────────────────────────
  const filterBtns = document.querySelectorAll('.filter-btn');
  const banners    = document.querySelectorAll('[data-tags]');

  if (filterBtns.length && banners.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        // Update active state
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Filter banners
        banners.forEach(banner => {
          const tags = banner.dataset.tags
            ? banner.dataset.tags.split(',').map(t => t.trim())
            : [];
          const show = filter === 'all' || tags.includes(filter);
          banner.style.display = show ? '' : 'none';
        });

        // Show/hide empty column messages
        ['tastings-col--upcoming', 'tastings-col--archive'].forEach(cls => {
          const col = document.querySelector('.' + cls);
          if (!col) return;
          const visible = [...col.querySelectorAll('[data-tags]')]
            .some(b => b.style.display !== 'none');
          let empty = col.querySelector('.filter-empty');
          if (!visible) {
            if (!empty) {
              empty = document.createElement('p');
              empty.className = 'filter-empty text-light';
              empty.style.paddingTop = '1rem';
              empty.textContent = 'No tastings match this filter.';
              col.querySelector('.container-col').appendChild(empty);
            }
            empty.style.display = '';
          } else if (empty) {
            empty.style.display = 'none';
          }
        });
      });
    });
  }

});
