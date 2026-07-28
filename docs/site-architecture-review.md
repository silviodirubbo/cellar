# Cellar: site architecture review and proposals

Scoping document. No code changes. Everything below is from reading source at
commit on `claude/cellar-architecture-scoping-wkz3ln`, 15 tastings across 3 chapters
(6 held, 9 upcoming, of which 8 have no date yet).

One caveat up front: `bundle exec jekyll build` does not run in this container
(gems are not installed), so every finding is from source reading rather than a
rendered page. Worth a local build before implementing.

---

## 0. One correction to the brief

The brief describes `tastings/index.html` as "a two-column vertical split
(Upcoming left, Archive right)". That is no longer true. The page is already a
single vertical timeline: a date gutter, a 1px spine, a dark poster card for the
next tasting, collapsible `<details>` rows for past tastings, and a tag filter
panel (`assets/css/main.css:967-1224`).

The two-column CSS is still in the stylesheet but has zero uses in any HTML file:
`.tastings-grid`, `.tastings-rule`, `.tastings-col--upcoming`,
`.tastings-col--archive`, `.container-col` (`main.css:455-482`).

So item 2 is a rework of the timeline, not a rework of a two-column split, and the
style note that describes it that way is stale.

---

## 1. Full site check (item 4)

### 1.1 Data integrity

**F1. Deck front matter contradicts the data file.**
`_tastings/condrieu-horizontal.html:4` says `date: 2026-07-18`.
`_data/tastings.yml:76` says `2026-07-30`. The wrong value is Southern Rhône
Overview's date, so this is a copy-paste that was never updated.

It is harmless today because `_layouts/presentation.html` only reads `page.title`
and never `page.date`. But it means all 7 decks carry an unvalidated duplicate of
the single source of truth. Recommend deleting `date:` from every deck's front
matter. `title:` is genuinely used (`presentation.html:6`) so it either stays or
becomes a lookup against `site.data.tastings`.

**F2. `spots_remaining` is a phantom field.**
Referenced at `index.html:64-65` and `_includes/tasting-banner.html:38-39`.
Present in zero entries of `_data/tastings.yml`. So the homepage's
"N / M spots available" block never renders. The site implies live availability
and only ever shows `spots_total`.

**F3. `featured` is dead.** All 15 entries are `featured: false`, nothing sets it
true. It drives `.tasting-banner--featured` (never rendered),
`.signup-block--featured` (`planner/index.html:28`), and `.card--featured`
(0 uses). Note that `.preview-event--featured` at `index.html:57` is hardcoded
in the markup rather than driven by the field, so even the one place it looks
used is not actually using it.

**F4. `_includes/tasting-banner.html` is never included anywhere.**
47 lines of dead template, plus roughly 60 lines of `.tasting-banner*` CSS
(`main.css:292-358`) that exist only to support it. It is also the last place
using the old "View tasting →" idiom and the `spots_remaining` phantom.

**F5. `_layouts/tasting.html` is dead.** `_config.yml:23-28` sets it as the
default layout for the `tastings` collection, but all 7 decks override with
`layout: presentation`. Harmless, but it looks like the collection's layout when
it is not.

**F6. The YAML's own section comments have gone stale, permanently.**
`_data/tastings.yml:22` reads `# ── Upcoming ──`, and the first entry under it is
`southern-rhone-overview`, which has been `status: past` since 2026-07-18.
`# ── Past ──` is at line 456.

This is by design and will keep happening: `scripts/sync-tasting-status.js` runs
daily via `.github/workflows/sync-tasting-status.yml` and flips `status` in place
without moving the block (the script says so at lines 16-19). Recommend dropping
both comments, since every template filters on `status` and never on file
position. With one exception, which is the next finding.

**F7. Curriculum order currently depends on undeclared YAML document order.**
This is the most important schema gap for the Chapters work.

All 6 Loire tastings have `date: null`, so `sort: "date"` cannot order them. Every
page builds its list as `upcoming_fixed | concat: upcoming_tbd`
(`index.html:7-9`, `tastings/index.html:8-10`, `planner/index.html:8-10`) and
relies on Liquid's `where` filter preserving document order for the TBD half.

There *is* an intended sequence. The Loire descriptions spell it out:
"We open the Loire at its western edge" (Muscadet), "From Muscadet we move east
into Anjou" (Savennières), "We close the Loire where Sauvignon Blanc settled in
for good" (Sancerre). That sequence is real curriculum data currently encoded as
line numbers.

Recommend adding an explicit integer `chapter_order:` to every entry.

### 1.2 Style-guide drift

**F8. The palette is in good shape.** No hardcoded palette hexes anywhere in
`main.css` outside the `:root` block, and all 7 decks declare an identical
8-value `:root`. Two exceptions worth cleaning: the SVG logos hardcode `#1A1814`
and `#2C4A3E` (`_includes/nav.html:6-8`, `_includes/footer.html:9-10`), which
could use `currentColor` and `var(--green)`; and `_includes/footer.html:12`
carries an inline `style="color:rgba(253,252,250,0.3);"` that wants a class.

**F9. `--chapter-loire: #4F5F66` (`main.css:21`) is the only off-palette colour
in the codebase.** It is the leading edge of the scaling problem: 8 chapters
cannot be colour-coded out of a palette with 2 accent colours. See section 2.

**F10. Em dashes: 2 occurrences, both in code comments.**
`assets/js/supabase.js:2` and `:17`. Nothing user-facing. The rest of the site
correctly uses `·` (`&middot;`) and commas. If Supabase goes (F20), these go
with it.

**F11. One gradient, at `tastings/index.html:136`.**
`linear-gradient(110deg, rgba(20,17,13,0.95) 35%, rgba(20,17,13,0.6) 100%)`
as a legibility scrim over the feature card's cover photo. Three problems:

1. It violates "no gradients" literally, though it is functional rather than
   decorative.
2. `rgba(20,17,13,...)` is **not** `--ink`, which is `#1A1814` = `rgb(26,24,20)`.
   The scrim colour is a near-miss on the palette.
3. It lives inside a Liquid-built inline `style` attribute, so it is invisible to
   anyone reading the stylesheet.

Recommend moving it to a `.tl-card--feature::before` overlay in `main.css` using
`--ink`, and keeping only `--chapter-accent` and `background-image: url(...)`
inline.

**F12. Inline styles doing typography.** These want two or three small classes:

| Location | Inline style |
|---|---|
| `tastings/index.html:282` | `font-size:0.6rem` on a `.label` |
| `planner/index.html:99,103,137,170` | `font-size:0.55rem` on optional-field hints |
| `planner/index.html:117,150` | `margin-bottom:0` on `.col-label` |
| `planner/index.html:120,153` | `margin-top:1rem` on `.propose-intro` |

**F13. Hardcoded `display:none` in markup rather than CSS.**
`tastings/index.html:215,290` (`.filter-empty`), `planner/index.html:107,141,174`
(`.form-success`), `planner/index.html:114,147` (`.avail-overlay`). The better
pattern already exists in the repo: `.filter-panel[hidden]` at `main.css:837`.

**F14. There are three competing vertical rhythms.**
`--section-pad: 7rem` is respected by `.section`, `.page-header` and
`.home-hero`. But `.timeline` opts out with `padding: 3rem 0 5rem`
(`main.css:968`), and the column panels each hardcode `padding: 3rem 2.5rem`:
`.preview-col` (`:512`), `.planner-main` (`:551`), `.planner-aside` (`:552`),
`.container-col` (`:460`). Worth a `--panel-pad` variable instead of four
literals.

**F15. `--col-gap: 4rem` is used exactly once, on a class with zero uses.**
It appears only in `.grid-2` (`main.css:121`), and `.grid-2` is never used in any
HTML. Meanwhile every real two-column layout re-declares `2fr 1fr` independently:
`.hero-grid` (`:490`), `.planner-grid` (`:550`), `.page-header__inner` (`:286`).
So the documented "2fr/1fr grid" primitive exists but the site does not use it.

**F16. Dead CSS, measured: roughly 150 of 1253 lines, about 12% of the
stylesheet.** Zero HTML uses for all of:

- `.tastings-grid`, `.tastings-rule`, `.tastings-col--*`, `.container-col` (`:455-482`, the old two-column tastings page)
- `.grid-2`, `.grid-2--equal` (`:121-122`)
- `.card--featured` (`:126`)
- `.filter-bar`, `.filter-bar__tags`, `.filter-label`, `.filter-btn` (`:376-404`, superseded by `.chip`)
- `.page-header__inner` (`:285-290`), `.page-header__filters` (`:401-404`)
- `.btn--cancel` (`:179-192`), `.tag--gold` (`:139`)
- `.tasting-banner__btns` (`:345`), `.tasting-banner__cost` (`:346`)
- `.mt-6`, `.mb-6`, `.planner-header` (`:581`)
- the auth hide-block (`:578-580`)
- plus all of `.tasting-banner*` (`:292-358`), used only by the dead include in F4

This should be cleared **before** Chapters CSS is added, not after.

### 1.3 Accessibility

**F17. Every date on the Tastings page is hidden from assistive technology.**
Highest-severity finding on the site.

`tastings/index.html:115` and `:230` put `aria-hidden="true"` on
`.tl-row__date`, and there is no `<time>` element anywhere in the timeline. A
screen-reader user gets titles, regions and wine lists with **no dates at all**,
on a page whose entire premise is chronology.

The homepage does it correctly (`<time datetime>` at `index.html:59, 73, 95, 103`),
so the fix is a known pattern: either drop `aria-hidden` and let the gutter read,
or keep the gutter decorative and add a visually-hidden `<time datetime="...">`
per row.

**F18. Contrast failures, all of them on dark backgrounds.**
Measured in sRGB against WCAG 2.x:

| Pair | Ratio | AA normal | Where |
|---|---|---|---|
| `--ink-light` on `--ink` | **3.52** | FAIL | `.footer__copy` (`:426`, 0.6rem), `.th-stat__label` (`:688`, 0.6rem), `.page-header .section-label` (`:282`) |
| `--gold` on `--ink` | **3.48** | FAIL | `.th-title__dot` (`:663`, decorative so acceptable), any gold-on-ink text |
| `rgba(253,252,250,0.3)` on `--ink` | **2.66** | FAIL | footer wordmark (`footer.html:12`), and it is inside a link |
| `rgba(253,252,250,0.45)` on `--ink` | 4.43 | n/a | footer logo strokes, non-text so passes at 3:1 |

Everything on light backgrounds passes: `--ink-light` on `--warm-white` 4.91,
on `--off-white` 4.62, `--gold` on `--warm-white` 4.96, `--green` on
`--warm-white` 9.50. Chapter tag text also passes: white on gold 4.96, on green
9.50, on the Loire slate 6.48.

So the palette itself is fine. The problem is narrowly `--ink-light` and `--gold`
used as *text* on `--ink`. Fix is one token: an `--ink-light-on-dark` around
`#9A948F` (about 5.5:1) applied at the three sites above.

**F19. Type is very small at the low end.**
`html` is 18px desktop, 16px at 640px and below (`main.css:34, 607`). So:

| Token | Desktop | Mobile |
|---|---|---|
| `0.55rem` | 9.9px | **8.8px** |
| `0.58rem` | 10.4px | 9.3px |
| `0.60rem` | 10.8px | 9.6px |
| `0.65rem` | 11.7px | 10.4px |

`0.55rem` carries `.wine-menu__label` (`:719`), `.wine-line__detail` (`:750`),
`.chapter-tag` (`:941`), `.past-entry__where` (`:1199`),
`.tl-row__dow` / `.tl-row__mon` (`:992`), `.tl-card__flag` (`:1079`).
`0.58rem` carries `.chip` (`:917`).

Contrast passes, but 9px uppercase mono at 0.1em+ tracking is at the edge of
legible, and it is the layer carrying appellation and region data. Suggest a
floor of `0.62rem` for anything conveying information, reserving `0.55rem` for
pure decoration.

**F20. No visible focus indicator anywhere.**
There is no `:focus-visible` rule in `main.css`. The only focus styling is
`.form-input:focus { border-color: var(--ink-mid) }` (`:567`), and `.form-input`
explicitly sets `outline: none` (`:566`).

Nav links, every `.btn`, `.chip`, `.share-btn`, `.filter-toggle` and every
`<summary>` rely entirely on the UA default ring. That works in Firefox and
Safari today and disappears the moment anyone adds a reset. Since the design
forbids shadows, a 1px `--green` outline with `outline-offset: 2px` is the
on-brand answer. Worth landing before Chapters adds more interactive surfaces.

**F21. The Planner modals are not dialogs.**
`planner/index.html:114` and `:147`: no `role="dialog"`, no `aria-modal`, no
`aria-labelledby`, no focus move on open, no focus restore on close, no Escape
handler, no background scroll lock, and the page behind is not inert. A keyboard
user tabs straight out of the modal into the page underneath.

Notably the newer Tastings filter panel *does* handle Escape
(`main.js:169-171`) and *does* lock scroll (`body.filter-open`,
`main.css:879`). So the pattern to copy already exists in the repo, and the
older page is the less accessible one.

**F22. Filter chips do not expose state.**
`.chip--active` is purely visual (`main.js:117-118` toggles a class). The buttons
carry no `aria-pressed`, filtering is `style.display` on rows, and the
`.filter-empty` messages (`tastings/index.html:215, 290`) are revealed by inline
style with no live region. A screen-reader user filtering the list gets silence.

**F23. No skip link,** and `<main>` (`_layouts/default.html:27`) has no `id` or
focus target. With a `position: fixed` nav (`main.css:195`) and a long timeline
that is a real cost.

**F24. `scroll-behavior: smooth` (`main.css:37`) with no reduced-motion guard,**
and no `prefers-reduced-motion` block anywhere in the codebase. There are card
lifts (`translateY(-2px)`, `:1061`), 0.6s image scale-and-filter transitions
(`:1073-1075`), and burger rotations (`:266`). One media block covers all of it.

**F25. Presentation decks block pinch-zoom.**
`_layouts/presentation.html:5` sets `user-scalable=no`, a WCAG 1.4.4 failure.
Combined with the fixed 1280x720 scaled stage, a phone in portrait gets a scale
factor of about `min(390/1280, 844/720)` = 0.30, so 20px slide text renders at
roughly 6px and **cannot be zoomed**.

The decks are effectively desktop and landscape only. That is defensible for a
projector deck, but the Tastings page links to them as "Presentation →" from a
page most visitors will open on a phone. Options: drop `user-scalable=no`, add a
"rotate your phone" hint, or link `presentation.pdf` where one exists (only 2 of
7 slugs have one: `chardonnay-across-countries`, `northern-rhone-whites`).

**F26. Slide changes are not announced.** `#nav-count` updates at
`presentation.html:163` with no `aria-live`, so keyboard users get no position
feedback. Inactive slides are `display: none`, which is correct.

### 1.4 Mobile and responsive

**F27. Three breakpoints that do not agree: 640, 700, 768.**
Section padding and grid collapse at 768 (`main.css:588`), the nav burger appears
at 640 (`:613`), the timeline reflows at 700 (`:1228`).

So between 641px and 700px you get stacked grids, a desktop nav, and a desktop
timeline gutter (`padding-left: 10.5rem`, `:969`) inside a roughly 660px
viewport, where the date gutter eats a third of the width. Worth unifying on two
breakpoints.

**F28. The nav has room for a 4th item, but the squeeze zone gets worse.**
`.nav__links { gap: 2.5rem }` (`:231`) with 4 items at 0.65rem mono fits inside
960px comfortably. The risk is 641-768px, where the burger has not appeared yet.
Raising the burger breakpoint to 768 is the safe move when "Chapters" lands.

**F29. The feature card's scrim is unreliable on small screens.**
The `110deg` gradient (`tastings/index.html:136`) leaves the right side at only
0.6 opacity, so on a short mobile card the title can sit over an unpredictably
bright part of the photo. Separately, `.tl-card__ghost` at `13rem`
(`main.css:1131`) is not scaled down in the 700px block and can overflow behind
the text.

**F30. Wine lines can break awkwardly.**
`.wine-line__main` (`:728`) is a flex row with a dotted leader that collapses to
`min-width: 1.5rem` (`:735`) and no `flex-wrap`. Long strings like
"Thierry Germain / Domaine des Roches Neuves · Clos de l'Echelier" will push the
vintage around on narrow screens.

**F31. 58 asset files have double extensions.**
`bottle1.png.png`, `map_france.jpg.png`, and notably
`northern-rhone-whites/cover.jpg.png` and `syrah-rhone-cortona/cover.jpg.png`,
which are PNGs named `.jpg.png`.

It works because the cover lookup (`tastings/index.html:111`) matches on
`f.path contains "/assets/tastings/<slug>/cover"` rather than an exact filename,
and browsers sniff content type. Two consequences: nothing can rely on the
extension, and the `contains` match would also catch a future `cover_notes.txt`.
Cosmetic, but cheap to normalize at 58 files rather than 300.

**F32. 8 of 15 tastings have no cover image,** including the pilot
(`chardonnay-across-countries`). Today that means a dashed placeholder
(`.past-entry__thumb--empty`, `:1182`) for the pilot and no cover at all for the
7 upcoming Loire and Châteauneuf entries. So the "road ahead" is entirely
coverless while the archive is mostly illustrated. If the archive becomes a card
grid (section 3), missing covers get much more visible. Either commit to a cover
per tasting, or design a typographic fallback (chapter numeral plus region)
instead of a dashed box.

### 1.5 Build and infrastructure

**F33. Could not build to verify.** `bundle exec jekyll build` fails here
(`command not found: jekyll`). Run a local build before implementing.

**F34. The filter-chip Liquid is O(tags x tag-instances) and runs twice.**
`tastings/index.html:70-91` loops the roughly 60 entries of `tags.yml` and, for
each one, scans the flattened `all_tags` array (about 120 entries at 15
tastings): once to compute `group_count`, once to emit chips. That is roughly
14k Liquid iterations today. At 50 tastings (about 400 tag instances) it is
roughly 48k, and it grows as the product of both files.

GitHub Pages will still build it, but this is the one piece of Liquid that will
visibly slow the build. Worth restructuring into a single count pass when the
chapter filter is added as a fourth group.

**F35. `jekyll-feed` and `jekyll-seo-tag` are in the Gemfile but not in
`plugins:`,** and `_layouts/default.html` never calls `{% seo %}` or links a
feed. Both gems are inert. Meanwhile `default.html:6-7` hand-rolls `<title>` and
`<meta name="description">`, and there is **no Open Graph or Twitter card markup
at all**.

That last point matters more than it looks: the site ships its own share button
(`main.js:37-54`) built for pasting links into chat apps, where they currently
render with no image, no title and no description. Adding `jekyll-seo-tag` to
`plugins:` (it is on the GitHub Pages allowlist) plus a default share image is a
cheap, high-visibility win.

**F36. Two different title suffixes.** `presentation.html:6` hardcodes
`{{ page.title }} · Silvio di Rubbo` while `default.html:6` uses
`{{ site.title }}`, which is "Silvio's Cellar".

**F37. The deck back-link is not chapter-aware.** `presentation.html:127` and the
Escape handler at `:186` both go to `/tastings/`. Once Chapters exists, a deck
opened from a chapter page dumps the visitor on the calendar.

---

## 2. Proposal: the Chapters section (item 1)

### 2.1 The actual problem to solve

Chapter identity is currently hardcoded in **5 places**, and every new chapter
needs all 5 edited:

| Location | What |
|---|---|
| `tastings/index.html:129-134` | `{% case %}` mapping slug to label and colour, for upcoming cards |
| `tastings/index.html:245-250` | the same `{% case %}` again, for past entries |
| `main.css:19-21` | `--chapter-pilot`, `--chapter-rhone`, `--chapter-loire` |
| `main.css:950-952` | `.chapter-tag--pilot/rhone/loire` |
| `main.css:963-965` | `.chapter-dot--pilot/rhone/loire` |
| `_data/tastings.yml:13` | the schema comment listing valid values |

There is no `_data/chapters.yml` and no chapter metadata of any kind: no title,
no blurb, no ordering, no status. Going from 3 to 8 chapters this way means about
12 lines of duplicated edits per chapter across 3 files, forever.

### 2.2 Recommendation: a `_chapters` collection

Not a data file. Use a Jekyll collection, mirroring the `_tastings` collection
the repo already declares at `_config.yml:18-21`.

```yaml
collections:
  chapters:
    output: true
    permalink: /chapters/:name/
```

Then one file per chapter, `_chapters/rhone.md`, whose front matter *is* the
chapter metadata:

```yaml
---
layout: chapter
slug: rhone
title: Rhône
numeral: II
order: 2
state: current        # complete | current | planned
planned_total: 8      # optional denominator, see 2.5
blurb: >
  North to south down the valley, from Syrah on granite
  to Grenache on galets.
---
```

Why a collection rather than `_data/chapters.yml` plus manual page stubs:

- GitHub Pages builds with `--safe`, so no custom generator plugin can create
  per-chapter pages. A collection is the only mechanism that gives real
  per-chapter URLs without one stub file per chapter.
- `site.chapters` is iterable and sortable by `order` for the index page, so the
  index is genuinely data-driven.
- It matches the pattern already in the repo, so it needs no new mental model.
- Adding a chapter becomes exactly one new file, with zero edits to CSS or to
  `tastings/index.html`.

`_layouts/chapter.html` then renders one chapter by filtering the data file:

```liquid
{% assign items = site.data.tastings | where: "chapter", page.slug | sort: "chapter_order" %}
```

**This collapses all 5 hardcode sites.** The two `{% case %}` blocks become a
lookup:

```liquid
{% assign ch = site.chapters | where: "slug", tasting.chapter | first %}
```

and then `{{ ch.title }}`, `{{ ch.numeral }}`, `{{ ch.url }}`.

### 2.3 Drop chapter colour-coding, use numerals

This is the strongest single recommendation in this document.

There are 2 accent colours in the palette (`--green`, `--gold`). Chapter 3
already had to invent an off-palette slate (`--chapter-loire: #4F5F66`, F9). With
8 chapters you need 8 distinguishable accents, which means either inventing 6 more
off-palette colours or abandoning the documented palette.

Instead identify chapters typographically: **"Chapter II · Rhône"**, serif
numeral plus DM Mono label. This is on-brand, scales to any number of chapters,
and removes the colour problem entirely.

Keep exactly one accent rule, tied to *state* rather than identity:

| State | Accent |
|---|---|
| current chapter | `--green` |
| complete | `--ink-light` |
| planned | `--rule` |

Then `.chapter-tag--pilot/rhone/loire` and `.chapter-dot--pilot/rhone/loire`
(6 rules) collapse into a single generic `.chapter-tag` and `.chapter-dot` that
read an inline `--chapter-accent` custom property.

The mechanism already exists in the codebase and just needs extending:
`tastings/index.html:136` already sets `--chapter-accent` inline, and `.tl-card`
at `main.css:1054` already consumes
`var(--chapter-accent, var(--rule))`.

### 2.4 Both an index and per-chapter pages

**`chapters/index.html`** is a directory, not a duplicate of the content. One
screen, one row per chapter, ordered by `order`:

```
CHAPTER I    Pilot         1 of 1 poured    ────────────────  complete
CHAPTER II   Rhône         5 of 8 poured    ██████────────    current
CHAPTER III  Loire         0 of 6 poured    ──────────────    next
CHAPTER IV   Jura          planned
```

Each row: numeral, title, one-line blurb, progress, link. Uses the existing
1px-rule divider idiom.

**`/chapters/rhone/`** is the full chapter: title, blurb, progress, then the
tasting sequence in curriculum order.

Why not one long page with sections instead: at 8 chapters times about 6
tastings that is 48 entries on one page, which is a worse version of the Tastings
page. And it gives no shareable per-chapter URL, which you will want ("here is
the Loire chapter") the moment a chapter is announced.

### 2.5 Ordering within a chapter: curriculum, not chronological

Curriculum order, using the explicit `chapter_order` field from F7.

Two reasons this is not a judgement call:

1. Chronological ordering is **impossible** for Loire right now. All 6 entries
   have `date: null`, so `sort: "date"` has nothing to sort on.
2. The data already describes a designed arc. The Loire descriptions read as a
   west-to-east journey and say so explicitly.

This is also what makes Chapters and Tastings genuinely complementary rather than
redundant: **Chapters is ordered by curriculum, Tastings is ordered by calendar.**
Same 15 items, two different questions.

### 2.6 Held, scheduled and TBD in one sequence

Render one continuous numbered list, each row carrying a state marker. Do not
split into held-versus-planned columns: the whole point of a chapter is that it
is a single arc, and splitting it destroys that.

| State | Row shows | Node |
|---|---|---|
| held | date, N wines, "Presentation →" | filled, `--ink-light` |
| scheduled | date, "I'm coming" | filled, `--green` |
| TBD | "date to be set", "My availability" | dashed, `--gold` |

Reuse the existing `.tl-node` vocabulary (`main.css:1017-1030`) so the visual
language matches the timeline, including `.tl-node--tbd`'s dashed gold ring which
already means exactly this.

### 2.7 Progress indicator: yes, derived where possible

Count from the data:

```liquid
{% assign held = items | where: "status", "past" | size %}
```

Current values: Pilot 1 of 1, Rhône 5 of 8, Loire 0 of 6.

The one subtlety: for a chapter still being designed the denominator is only what
has been entered. Bordeaux with 0 entries would read "0 of 0". Hence the optional
`planned_total:` in the chapter front matter, used as the denominator when it
exceeds the entered count. So a freshly announced chapter can honestly say
"0 of 6 planned" before any tasting is written up.

Render it on-brand as a **1px rule that is partially green**: a full-width
`--rule` line with a `--green` overlay at N% width. No gradients, no shadows, no
new shapes, consistent with the "1px rule dividers" rule.

### 2.8 Navigation and homepage entry points

**Nav:** add Chapters as the second item.

```
Home · Chapters · Tastings · Planner
```

Chapters is the curriculum (what this series is), Tastings is the calendar (when
it happens), so Chapters sits closer to Home. Two mechanical notes:
`_includes/nav.html:21` uses `page.url contains '/tastings'` for the active
state and needs a `'/chapters'` sibling; and see F28 on raising the burger
breakpoint to 768px.

**Homepage:** do **not** add a third column to `.preview-grid`
(`index.html:50-116`), which is a `1fr 1px 1fr` split with a rule between and
would break.

Instead insert a full-width **"The curriculum"** band between `.home-hero` and
`.preview-grid`: a horizontal row of chapter markers (numeral, name, "5 of 8"),
each linking to its chapter page. That gives Chapters a real homepage presence
without disturbing the existing two-column preview, and reading left to right it
reads as a spine, which is exactly the message.

---

## 3. Proposal: the Tastings page rework (item 2)

### 3.1 What is actually weak today

Given the correction in section 0, here is what fails as the archive grows from
6 entries to 40:

1. **Past tastings are collapsed by default.** Each is a `<details>` with a 52px
   thumb and one line (`tastings/index.html:237-287`). You cannot see the wines,
   the region, or the chapter without opening it. Six clicks today, forty later.
2. **The rhythm breaks at the divider.** Upcoming rows have
   `margin-bottom: 2.5rem` (`main.css:979`), past rows have `0` (`:1158`).
3. **No year grouping.** At 40 entries across 4 years the date gutter repeats
   `%b %Y` forty times with no anchors to jump between.
4. **Chapter is nearly invisible and not filterable.** On past entries it is a
   `0.4rem` dot (`.chapter-dot`, `main.css:955`) with `aria-hidden="true"`, no
   label and no tooltip. The filter panel offers Region, Denomination and Grape
   (`tastings/index.html:68-69`) but **not chapter**.
5. **Filtering leaves visual artifacts.** `main.js:120-133` hides whole
   `.tl-row` elements with `style.display`, but the spine `.tl::before`
   (`main.css:970-978`) spans the full height of `.tl`, so a filtered timeline is
   a long line with gaps in it.
6. **The masthead stat links are weak.** `#coming-up`
   (`tastings/index.html:99`) is on the Today row at the very top, so "Coming up
   ↓" scrolls essentially nowhere.
7. **The timeline is mostly not a timeline.** 8 of 9 upcoming tastings have no
   date, so "The road ahead" (line 104) is largely a list of undated items each
   showing a `?` glyph. This is the overlap with Chapters, and it is the thing
   worth fixing structurally.

### 3.2 Options

**Option A (recommended): timeline for the future, year-grouped archive grid for
the past.**

- Keep the masthead (`.page-header--tastings`) and `.th-stats`.
- Keep `.tl` but **scope it to upcoming only**. It stays small forever, because
  the daily cron flips entries to `past`. The timeline is the right metaphor for
  "the road ahead" and the page already says so.
- Replace the collapsed past register with an **archive section below**: `<h2>`
  per year, then a 2 or 3 column grid of compact cards (cover thumb, chapter
  label, title, region, N wines, date, "Presentation →"). Reuse the existing 1px
  `--rule` bordered card idiom from `.tl-card` minus the timeline positioning.
  Past tastings become primary browsable content.
- Keep `<details>` for the **wine list inside** each archive card (the `.lineup`
  pattern, `main.css:764-791`) rather than for the whole entry, so the card is
  always readable and only the lineup expands.
- Add a **year jump-nav** in the archive header, styled as `.chip` links.
- **Add chapter as a 4th `.chip-group`** in the filter panel. Cheapest big win on
  the page.

**Option B: one unified chronological card grid,** upcoming and past together,
with chips for status and chapter. Simpler and more uniform, but loses the next
tasting poster, which is the best-looking thing on the site.

**Option C: keep one continuous timeline,** expand past rows by default, add
year markers on the spine. Least work, but does not fix browsability at 40
entries. It defers the problem rather than solving it.

Recommend **A**.

### 3.3 The key structural move: hand the TBD backlog to Chapters

On the Tastings timeline, show only **fixed-date** upcoming tastings, plus a
single summary row:

> 6 more Loire evenings, dates to be set → see the Loire chapter

Today that turns a 9-row timeline (1 dated, 8 undated) into 1 dated row plus one
pointer. Three things this buys:

1. The timeline becomes an actual timeline instead of a backlog with `?` glyphs.
2. It removes the only real content overlap between the two pages.
3. It gives Chapters a job that Tastings cannot do: presenting undated tastings
   as a designed sequence rather than an unscheduled pile.

### 3.4 Complementary, not redundant, if the axis split is enforced

They are genuinely complementary on one condition: neither may be "a list of all
tastings grouped by something". Enforce it by axis and by ownership.

| | Tastings | Chapters |
|---|---|---|
| **Axis** | date | curriculum |
| **Answers** | what is next, what happened when | what is this series teaching, where are we in the Loire |
| **Order** | chronological | `chapter_order` within `order` |
| **Owns** | next-tasting poster, RSVP entry, `.ics` download, year archive, tag and chapter filters | chapter blurbs, progress, the pedagogical arc, TBD tastings as a designed sequence |

Cross-link both ways: every chapter tag on Tastings links to
`/chapters/<slug>/`; every chapter-page row links to that tasting's presentation
and to `/tastings/#<slug>`.

---

## 4. Assessment: the Planner (item 3)

**Verdict: adjust, do not rebuild.** The page works. But it has one bug worth
fixing immediately, one structural problem that gets worse the moment more
tastings are entered, and one decision that should be made before the other
sessions start.

### 4.1 It does not scale, and this bites now rather than later

`planner/index.html:27-72` renders **every** upcoming tasting as a full
`.signup-block`. That is 9 blocks today, of which **8 are TBD** and only 1
(Condrieu, 2026-07-30) can actually be reserved. So the page is a wall of nine
near-identical blocks with one actionable item. Enter Loire, Jura and Alsace and
it is 20 or more.

Recommend splitting into two sections:

- **"Reserve your spot"**: fixed-date tastings only, at the top, full blocks with
  cost and date.
- **"Help me pick a date"**: TBD tastings as a compact list, one availability
  button each, **grouped by chapter**, reusing the vocabulary from section 2 so
  Planner stays consistent with the new IA.

### 4.2 Highest-priority bug: the forms fail silently

All three submit handlers (`planner/index.html:199-212`, `233-246`, `249-261`)
check `if (res.ok)` and have **no else branch and no catch**. If Formspree
returns an error, if the monthly free-tier quota is hit, or if the fetch throws
offline, the form does nothing at all: no message, no error, the modal just sits
there. The user has no way to know their RSVP did not send.

This is the single most user-visible defect on the site.

### 4.3 Three Formspree endpoints for three near-identical payloads

`xwvgwdgn` (signup), `mqergvrv` (availability), `xvzevjeq` (proposal). All three
collect name, email and people count; the only real differences are the free-text
`availability` and `suggestion` fields.

Three endpoints means three inboxes to check and three IDs to maintain, against a
shared free-tier submission cap. And the mechanism to consolidate **already
exists**: every form already posts a hidden `type` field
(`planner/index.html:85`, `122`, `155`) with values `proposal`, `signup`,
`availability`. That field exists precisely so one endpoint can serve all three.
Not urgent, but the current split is redundant by the page's own design.

### 4.4 Decide the Supabase question before anything else is built

`assets/js/supabase.js` is 102 lines implementing Google OAuth, an auth-state
listener, a `signups` upsert and a `getSignupsForTasting` reader. **It never
loads.** `_layouts/default.html:21-23` gates it on `page.supabase`, and no page
sets that. On top of that, `main.css:578-580` exists solely to force-hide the UI
for that dead flow, and `README.md:35` advertises "Supabase (reserved)".

The anon key at `assets/js/supabase.js:6` is designed to be public, so this is
not a credential leak. It is dead weight with a misleading footprint.

Recommend **deleting it now**: the JS file, the two `page.supabase` branches in
`default.html`, the hide-rules at `main.css:578-581`, and the README claim. About
30 lines plus a whole conceptual dependency.

The counter-argument is that Supabase would unlock live spot counts
("3 of 6 spots left"), which Formspree cannot do. But note that this is exactly
the feature currently **faked**: `spots_remaining` is referenced at
`index.html:64-65` and `_includes/tasting-banner.html:38-39` and exists in **no**
tasting entry (F2). So the site already promises availability and delivers only
`spots_total`. If live counts matter, that is a deliberate project to scope, not
something to leave half-wired. Recommend deleting now and revisiting as its own
piece of work.

### 4.5 Accessibility gap, and it is the older page that is worse

See F21. The modals have no `role="dialog"`, no focus management, no Escape
handler and no scroll lock, while the newer Tastings filter panel has Escape and
scroll lock. Closing that gap while touching Planner is cheap and makes the two
pages consistent.

### 4.6 Deep links will break silently as the archive grows

`index.html:110` and `tastings/index.html:194, 196, 201` all link to
`/planner/#<slug>`. Once a tasting is past it is not rendered on Planner, so the
anchor resolves to nothing and the visitor lands at the top of the page with no
explanation. Shared links accumulate and rot. Worth a small fallback ("that
evening has already been poured, see the archive") or at minimum a conscious
decision about it.

### 4.7 Two smaller notes

- **Reduce duplication with the reworked Tastings page.** Tastings already
  renders "I'm coming" and "My availability" buttons per card
  (`tastings/index.html:194-204`) that only jump to Planner. Planner then repeats
  the title, region, cost and meta. Keep enough context that people can commit
  (date and cost matter), but the description can go, since it is on both
  Tastings and Chapters.
- **The propose-a-topic form should acknowledge chapters.** Once Chapters exists,
  the mental model shifts from "suggest an evening" to "suggest an evening within
  a chapter, or suggest a whole new chapter". That is a copy change to
  `planner/index.html:82` and possibly one extra field. Worth doing in the same
  session.

---

## 5. Suggested sequencing

Foundations before features. Sessions 1 and 2 both write new CSS and new Liquid
on top of a stylesheet that is 12% dead and a data schema missing the ordering
field they both need. Doing the cleanup first means Chapters and the Tastings
rework get built once instead of twice.

### Session 0: Foundations (no visible change, low risk)

- Delete dead CSS (F16, about 150 lines), `_includes/tasting-banner.html` (F4),
  `_layouts/tasting.html` (F5).
- Resolve Supabase (4.4) and the `spots_remaining` / `featured` phantoms
  (F2, F3).
- Add `chapter_order:` to all 15 entries; drop the stale section comments
  (F6, F7).
- Fix the Condrieu deck date and strip `date:` from all deck front matter (F1).
- Add `--ink-light-on-dark` and fix the 3 contrast sites (F18).
- Add `:focus-visible` (F20), a skip link (F23), a `prefers-reduced-motion`
  block (F24).
- Add the visually-hidden `<time>` to timeline rows (F17).

Verify with a local `bundle exec jekyll build` (F33).

### Session 1: Chapters

Create the `_chapters` collection, `_layouts/chapter.html`, `chapters/index.html`.
Replace the two `{% case %}` blocks and the 6 `.chapter-*--<slug>` rules with
data-driven lookup plus `--chapter-accent`. Switch to numerals over colour-coding.
Add the nav item and the homepage curriculum band.

Additive and mostly independent of the timeline's structure, and it establishes
the chapter vocabulary that session 2 consumes.

### Session 2: Tastings rework

Scope the timeline to fixed-date upcoming plus a TBD summary row pointing at
Chapters. Build the year-grouped archive grid. Add chapter as a 4th filter group
and restructure the O(n*m) chip Liquid (F34). Move the feature-card scrim into
`main.css` using `--ink` (F11).

Depends on session 1's chapter lookup and session 0's `chapter_order`. Its central
move (hand the TBD backlog to Chapters) only makes sense once Chapters exists.

### Session 3: Planner

Split fixed-date from TBD, grouped by chapter. Add failure handling to the three
fetch handlers (4.2). Make the modals real dialogs (F21). Consolidate the
Formspree endpoints (4.3). Add the stale-anchor fallback (4.6). Update the
propose-a-topic copy for chapters (4.7).

Least broken of the three pages, and its grouping should mirror the IA the earlier
sessions establish.

### Session 4: Polish

`jekyll-seo-tag` plus Open Graph plus a default share image (F35). Unify
breakpoints on two values (F27). Normalize the 58 double-extension filenames
(F31). Decide the cover-image strategy for the 8 tastings without one (F32).
Decide the presentation-deck mobile and zoom question (F25). Fix the deck
back-link and title suffix (F36, F37).

### If only one session happens

Do session 0. It is invisible to visitors and it is the only one whose absence
makes all three of the others more expensive.
