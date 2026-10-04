# Silvio's Cellar

A personal wine tasting site built with Jekyll, hosted on GitHub Pages.

**→ [silviodirubbo.github.io/cellar](https://silviodirubbo.github.io/cellar)**

---

## What it is

A lightweight site that tracks private wine tasting evenings in Geneva. Each event has a dedicated presentation with maps, bottle images, and producer QR codes. Upcoming tastings are listed with sign-up and availability forms.

## Structure

```
_data/tastings.yml      - single source of truth for all events
_data/tags.yml          - tag categories for the tastings filter
_data/availability.yml  - live places taken per tasting, written by the calendar sync
_tastings/              - one HTML presentation file per tasting
_chapters/              - one file per curriculum chapter
chapters/               - chapters index page
assets/tastings/        - images, maps, QR codes, and PDFs per tasting
assets/social/          - off-site post assets, not used by the site
  instagram/feed/       - Instagram feed posts, one folder per post (src/ rebuilds it)
  instagram/stories/    - Instagram Stories, one PNG per story (src/ rebuilds them via scripts/render-stories.js)
  linkedin/             - LinkedIn carousels, one folder per post
_layouts/               - chapter, default, presentation, and story layouts
_includes/              - nav, footer, chapter progress, story/ slide partials
assets/css/main.css     - full site styles
assets/js/              - main.js (site-wide), forms.js (dialogs), wines.js (Wines page), supabase.js (reserved)
scripts/                - Story PNG renderer, daily tasting status sync, availability updater
tools/calendar-sync/    - Google Apps Script that sends invite counts to GitHub (not built into the site; setup in its README)
wines/                  - wine grid with filters and hover details (built from _data/tastings.yml)
planner/                - redirect stub to /tastings/ (old shared links); sign-up and proposals now live on the Tastings page
tastings/               - public tastings index
```

## Adding a tasting

The schedule, the Wines page, the chapter pages, the cover date of each deck and the link previews all read `_data/tastings.yml`. The deck's wine slides are the one thing written by hand.

1. **Chapter.** Pick the curriculum chapter in `_chapters/` (`grape-studies`, `loire`, `rhone`; a new chapter is a new file there with `slug`, `title`, `order` and `color`). Note the next free `chapter_order` in that chapter: it is the position in the curriculum, not the date.
2. **Data.** Add an entry to `_data/tastings.yml` (the schema is at the top of the file):
   - `slug`: lowercase words joined by hyphens. It becomes the URL, the deck filename and the assets folder name, so choose it once.
   - `title`, `date` (YYYY-MM-DD, or `date: null` with `date_tbd: true`), `location`, `region`, `description`.
   - `tags`: each one must already exist in `_data/tags.yml`.
   - `chapter` and `chapter_order` from step 1.
   - `status: upcoming` (the daily sync turns it to `past` the day after).
   - `capacity`: places at the table, 6 if left out.
   - `cost_estimate`, for example `"38 CHF"`.
   - `slides: false` until the deck exists.
   - `wines`: `name`, `producer`, `vintage`, `appellation`, `blend`, `colour`, `country`, `region`, `image`, and optionally `url`.
3. **Assets.** Create `assets/tastings/<slug>/`:
   - the cover: a file whose name starts with `cover` (`cover.jpg` or `cover.png`). It is found by that prefix and used on the schedule card, the feature card and as the link preview image.
   - bottle pictures (`bottle_<name>.png`), maps (`map_<area>.jpg`) and QR codes (`qr_<producer>.png`). Each wine's `image` field points to its bottle, relative to `assets/tastings/`.
   - then run `node scripts/image-sizes.js`: it records the pixel size of the cover and bottles in `_data/image_sizes.yml`, which the pages use for the `width` and `height` of those images. The Check workflow fails when this file is out of date.
4. **Deck.** Copy the most recent deck (for example `_tastings/sancerre-pouilly-fume.html`) to `_tastings/<slug>.html`:
   - set `title` in the front matter to the tasting title;
   - keep the `{% assign this_tasting = ... %}` line, which fills in the cover date from the data;
   - keep the cover title as `<h1 class="cover-title">`;
   - rewrite the wine slides, copying names, producers and vintages exactly from `tastings.yml`;
   - then set `slides: true` in the data.
5. **Check locally.** `bundle exec jekyll serve`, then look at `/cellar/tastings/` and `/cellar/tastings/<slug>/`. The Check workflow runs the same build, the data checks and a link crawl on every push.
6. **Calendar invite.** In the Cellar calendar (cellar.geneve@gmail.com), create the event on the tasting date and paste the tasting link into its description, for example `https://silviodirubbo.github.io/cellar/tastings/<slug>/`. The calendar sync matches events by date and this link (the title is only a fallback). Then invite guests as usual.
7. **Availability, automatic from here.** On every invite change, and hourly, the calendar sync counts guests who have not declined (the organiser account excluded) and sends the count to the Update availability workflow, which writes `_data/availability.yml`. Pages redeploys, the card shows "N places available" or "Fully booked", and the sign-up form shows "N places available out of C". Do not edit `availability.yml` by hand; to remove a count, run Update availability from the Actions tab with `taken` set to `clear`. Setup and troubleshooting: `tools/calendar-sync/README.md`.
8. **After the evening.** The daily Sync tasting status workflow sets `status: past` and removes `capacity` and `cost_estimate`. Nothing to do.
9. **Instagram Stories (optional).** Add a page to `assets/social/instagram/stories/src/` with `layout: story`, a `story_type`, a `permalink`, `sitemap: false` and `tasting_slug: <slug>` (see the existing files). Render the PNGs with:
   ```
   cd scripts && npm install && npx playwright install chromium
   node render-stories.js
   ```
   It needs the Ruby toolchain as well (it runs its own Jekyll build). Set `FONTSOURCE_DIR` to `scripts/node_modules/@fontsource` on a machine without access to Google Fonts.

## Renaming a slug

A slug appears in several places. Change all of them in one commit:

1. `slug:` in `_data/tastings.yml`, and every wine `image:` path of that tasting.
2. The deck file: `_tastings/<old>.html` becomes `_tastings/<new>.html`. The URL changes too, and GitHub Pages has no redirects, so links already shared to the old URL will break.
3. The folder `assets/tastings/<old>/` becomes `assets/tastings/<new>/`, and every `/assets/tastings/<old>/` path inside the deck.
4. The availability key: do not edit `_data/availability.yml` by hand. Run Update availability from the Actions tab with the old slug and `taken` set to `clear`, then run `forceResend` in the Apps Script editor (or wait for the next invite change) to write the count under the new key.
5. Story front matter in `assets/social/instagram/stories/src/`: `tasting_slug`, `tasting_slug_a`, `tasting_slug_b`. The feed post builders in `assets/social/instagram/feed/*/src/` match wines by slug too.
6. The link in the calendar invite description, so guests get the new URL (matching still works with the old one, since it uses the date and the link prefix).
7. Build locally, or push and watch the Check workflow: it flags a deck without a matching slug, missing images and availability keys without a tasting.

## Stack

Jekyll · GitHub Pages · Formspree · Supabase (reserved)

---

*Cost = bottles only. Nothing on top.*
