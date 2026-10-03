/* ============================================================
   forms.js: the sign-up, availability and proposal dialogs. Markup lives
   in _includes/forms-modals.html, included on the Tastings page (all three
   dialogs) and on the home page (where only the proposal dialog has an
   opener: the green Propose card).

   A .js-open-propose element opens the proposal dialog in place. When it
   is a link (the home card), its href is kept as the no-JavaScript
   fallback and the navigation is cancelled here.

   Deep links (from chapter pages and old shared links):
     /tastings/#propose        opens the proposal dialog
     /tastings/#join-<slug>    opens the sign-up dialog for that evening,
                               or the availability dialog if it has no date;
                               for a past evening it scrolls to its entry
   ============================================================ */
(function () {
  'use strict';

  const signupOverlay  = document.getElementById('signup-overlay');
  const availOverlay   = document.getElementById('avail-overlay');
  const proposeOverlay = document.getElementById('propose-overlay');
  const overlays = [signupOverlay, availOverlay, proposeOverlay].filter(Boolean);
  if (!overlays.length) return;

  // ── Dialog helpers: focus, Escape, scroll lock ─────────────
  let lastTrigger = null;

  function openModal(overlay, trigger) {
    lastTrigger = trigger || null;
    overlay.hidden = false;
    document.body.classList.add('modal-open');
    const target = overlay.querySelector('.form-input') || overlay.querySelector('.avail-close');
    if (target) target.focus();
  }

  function closeModal(overlay) {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    document.body.classList.remove('modal-open');
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
    lastTrigger = null;
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    overlays.forEach(o => { if (!o.hidden) closeModal(o); });
  });

  overlays.forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) closeModal(o); });
    const close = o.querySelector('.avail-close');
    if (close) close.addEventListener('click', () => closeModal(o));
  });

  // ── Form submit: shows a clear error on a failed or offline
  //    submission instead of doing nothing ────────────────────
  async function submitForm(form, successId, errorId, onSuccess) {
    const errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.hidden = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('Form submission failed: ' + res.status);
      form.reset();
      document.getElementById(successId).hidden = false;
      if (onSuccess) onSuccess();
    } catch (err) {
      if (errorEl) errorEl.hidden = false;
    }
  }

  // ── Openers ────────────────────────────────────────────────
  // full: the tasting has no places left (data-full on its button, set
  // from _data/availability.yml); the dialog then opens with a note.
  function openSignup(slug, title, trigger, full) {
    document.getElementById('signup-success').hidden = true;
    const fullNote = document.getElementById('signup-full');
    if (fullNote) fullNote.hidden = !full;
    document.getElementById('signup-tasting-name').textContent = title;
    document.getElementById('signup-tasting-field').value = title;
    openModal(signupOverlay, trigger);
  }

  function openAvail(slug, title, trigger) {
    document.getElementById('avail-success').hidden = true;
    document.getElementById('avail-tasting-name').textContent = title + ' · availability';
    document.getElementById('avail-tasting-field').value = title;
    openModal(availOverlay, trigger);
  }

  function openPropose(trigger) {
    document.getElementById('propose-success').hidden = true;
    openModal(proposeOverlay, trigger);
  }

  document.querySelectorAll('.signup-btn').forEach(btn => {
    btn.addEventListener('click', () => openSignup(btn.dataset.slug, btn.dataset.title, btn, btn.dataset.full === 'true'));
  });
  document.querySelectorAll('.avail-btn').forEach(btn => {
    btn.addEventListener('click', () => openAvail(btn.dataset.slug, btn.dataset.title, btn));
  });
  document.querySelectorAll('.js-open-propose').forEach(btn => {
    btn.addEventListener('click', e => {
      if (btn.tagName === 'A') e.preventDefault();   // stay on this page
      openPropose(btn);
    });
  });

  // ── Submits ────────────────────────────────────────────────
  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(e.target, 'signup-success', 'signup-error', () => {
      setTimeout(() => closeModal(signupOverlay), 2500);
    });
  });

  const availForm = document.getElementById('avail-form');
  if (availForm) availForm.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(e.target, 'avail-success', 'avail-error', () => {
      setTimeout(() => closeModal(availOverlay), 2500);
    });
  });

  const proposeForm = document.getElementById('propose-form');
  if (proposeForm) proposeForm.addEventListener('submit', e => {
    e.preventDefault();
    submitForm(e.target, 'propose-success', 'propose-error');
  });

  // ── Deep links ─────────────────────────────────────────────
  function handleHash() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash === 'propose') { openPropose(null); return; }
    if (hash.indexOf('join-') !== 0) return;

    const slug = hash.slice(5);
    const cssSlug = window.CSS && CSS.escape ? CSS.escape(slug) : slug;
    const signup = document.querySelector('.signup-btn[data-slug="' + cssSlug + '"]');
    const avail  = document.querySelector('.avail-btn[data-slug="' + cssSlug + '"]');
    if (signup) { openSignup(slug, signup.dataset.title, null, signup.dataset.full === 'true'); return; }
    if (avail)  { openAvail(slug, avail.dataset.title, null); return; }

    // No dialog for this one (it has already happened): show its entry.
    const entry = document.getElementById(slug);
    if (entry) entry.scrollIntoView({ block: 'start' });
  }

  handleHash();
  window.addEventListener('hashchange', handleHash);
})();
