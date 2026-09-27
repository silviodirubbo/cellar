# Silvio's Cellar

A personal wine tasting site built with Jekyll, hosted on GitHub Pages.

**→ [silviodirubbo.github.io/cellar](https://silviodirubbo.github.io/cellar)**

---

## What it is

A lightweight site that tracks private wine tasting evenings in Geneva. Each event has a dedicated presentation with maps, bottle images, and producer QR codes. Upcoming tastings are listed with sign-up and availability forms.

## Structure

```
_data/tastings.yml      - single source of truth for all events
_tastings/              - one HTML presentation file per tasting
assets/tastings/        - images, maps, QR codes, and PDFs per tasting
assets/social/          - off-site post assets, not used by the site
  instagram/feed/       - Instagram feed posts, one folder per post (src/ rebuilds it)
  instagram/stories/    - rendered Instagram Story PNGs (sources in stories/)
  linkedin/             - LinkedIn carousels, one folder per post
_layouts/               - default, presentation, and tasting layouts
_includes/              - nav, footer, tasting banner
assets/css/main.css     - full site styles
planner/                - sign-up and topic proposal page
tastings/               - public tastings index
```

## Adding a tasting

1. Add the event to `_data/tastings.yml`
2. Upload assets to `assets/tastings/[slug]/`
3. Create `_tastings/[slug].html` using the `presentation` layout
4. Set `slides: true` in the YAML entry to activate the presentation link

## Stack

Jekyll · GitHub Pages · Formspree · Supabase (reserved)

---

*Cost = bottles only. Nothing on top.*
