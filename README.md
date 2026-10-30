# May & Jerrold — Pre-wedding Photobook

A static, single-page photobook of our pre-wedding shoots, hosted on GitHub Pages. It's designed for phones and desktops.

## Structure

```
index.html          the page: cover, photo gallery, footer
css/styles.css      design tokens (ivory/dark themes, Cormorant Garamond + Jost) and layout
js/main.js          entry point that starts each feature
js/gallery.js       renders data/photos.json as editorial spreads
js/spreads.js       layout rules (full-width, pairs, trios) by photo shape
data/photos.json    generated photo list: shoots → locations → photos
images/             generated WebP images in three sizes (sm/md/lg)
```

There's no build step and there are no dependencies. Everything is served as-is, using relative paths only.

## Preview locally

```bash
python -m http.server 8000
```

Open http://localhost:8000. Opening `index.html` directly from disk won't load the photos.

## Photos

`images/` and `data/photos.json` are generated from the original photos by a local preparation script. Never edit them by hand. Originals are never committed.

## Privacy

The site is unlisted: it's marked `noindex, nofollow`, so search engines leave it out. Anyone with the link can view it.
