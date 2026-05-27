/* ============================================================
   main.js — Global JavaScript
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // ── Share buttons ────────────────────────────────────────
  document.querySelectorAll('.share-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const slug   = btn.dataset.slug;
      const slides = btn.dataset.slides === 'true';
      const base   = 'https://silviodirubbo.github.io/cellar';
      const url    = slides
        ? `${base}/tastings/${slug}/`   // links directly to the presentation
        : `${base}/tastings/`;          // links to the tastings page when no slides yet

      if (navigator.share) {
        try {
          await navigator.share({ url });
        } catch (e) {
          // User cancelled — do nothing
        }
      } else {
        // Fallback: copy to clipboard
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

  // ── Nav scroll state ─────────────────────────────────────
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

  // ── Tasting filter (Tastings page) ───────────────────────
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
          const tags = banner.dataset.tags ? banner.dataset.tags.split(',') : [];
          const show = filter === 'all' || tags.includes(filter);
          banner.style.display = show ? '' : 'none';
        });
      });
    });
  }
});
