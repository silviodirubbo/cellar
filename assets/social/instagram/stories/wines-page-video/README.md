# Wines page Story video

`wines-page.mp4`: a 15 s Instagram Story (1080x1920, H.264 yuv420p, 30 fps,
faststart, no audio track) of the real Wines page in use on a phone, ending
on an invitation to the next tastings.

| Time | What happens |
| --- | --- |
| 0.0 to 2.6 s | Top of the Wines page (grid already shuffled), gentle scroll down to the first row |
| 2.85 to 5.0 s | Down the grid, three bottles tapped open for the wine and tasting card |
| 5.0 to 9.0 s | Back up to the toolbar, Shuffle tapped five times, then a pause on the new order |
| 9.0 to 11.7 s | Filter opened, Red, then the Loire chapter, Show 5 wines |
| 11.7 to 12.5 s | Clear filters, all 75 wines back |
| 12.5 to 15.0 s | Cross-fade to the end card (`end-card.html`) |

## Files

- `render.js`: builds the site, drives `/wines/` in Playwright and assembles the clip with ffmpeg. The header comment explains each step.
- `end-card.html`: the end card, a Jekyll page using the Story head, partials (`_includes/story/dots.html`, `linkbar.html`) and `assets/css/story.css`, like the stories in `../src/`.
- `wines-page.mp4`: the render.

This folder sits under `assets/social`, which `_config.yml` excludes, so none of it reaches the site.

## Rebuild

From the repository root, with the site's Ruby toolchain (`bundle install`),
ffmpeg, and the Playwright install in `scripts/` (`cd scripts && npm ci`):

```sh
node assets/social/instagram/stories/wines-page-video/render.js
```

It overwrites `wines-page.mp4` in this folder. The page's own `wines.js`
does every shuffle; `Math.random` is seeded (`SEED` in `render.js`) so each
rebuild gives the same orders. If the data changes, a different seed may
give a better opening grid. Set `CHROMIUM_PATH` to use another Chromium, and
`KEEP_FRAMES=1` to keep the captured frames for inspection.
