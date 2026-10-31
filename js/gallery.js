/*
 * Gallery feature: loads data/photos.json, renders each location as its own
 * page section (heading, then editorial spreads), reveals rows as they first
 * scroll into view, recomposes rows when crossing the phone/wide breakpoint,
 * and announces "photobook:gallery-ready" for later features (locations,
 * pages, viewer). Which page is visible is up to pages.js.
 */

import { words, placeName, caption, onLanguageChange } from "./i18n.js";
import { routeFor } from "./routes.js";
import { classifyShape, composeRows } from "./spreads.js";

const MANIFEST_URL = "data/photos.json";
const WIDE_QUERY = "(min-width: 40rem)";
const GALLERY_MAX_PX = 1400;
// Mirror the stylesheet's height caps (90% of the screen, 80% for lone portraits).
const ROW_CAP_VH = 90;
const SINGLE_CAP_VH = 80;
const READY_EVENT = "photobook:gallery-ready";
const SIZES = ["sm", "md", "lg"];
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

// What applyWords() labels: each location's heading, caption, count and photo descriptions.
const labelled = [];
let emptyNote = null;

export async function init() {
  const gallery = document.getElementById("gallery");
  if (!gallery) return;

  const manifest = await loadManifest();
  if (!manifest) {
    renderEmpty(gallery);
    return;
  }

  const chapters = renderManifest(gallery, manifest);
  const media = window.matchMedia(WIDE_QUERY);
  layoutAll(chapters, media.matches, createRevealer());
  observeTiles(chapters.flatMap((chapter) => chapter.tiles));
  // iOS Safari only applies :active (the press dip) when a touch listener exists.
  gallery.addEventListener("touchstart", () => {}, { passive: true });
  const anchor = trackAnchor(gallery);
  media.addEventListener("change", (event) => relayout(chapters, event.matches, anchor));

  document.dispatchEvent(new CustomEvent(READY_EVENT, { detail: { manifest } }));
}

async function loadManifest() {
  try {
    const response = await fetch(MANIFEST_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validateManifest(await response.json());
  } catch (error) {
    console.info("[photobook] photo list unavailable", error.message);
    return null;
  }
}

function isValidPhoto(photo) {
  return photo?.width > 0 && photo?.height > 0 && SIZES.every((size) => photo.src?.[size]?.url);
}

function validateManifest(data) {
  if (data?.version !== 1 || !Array.isArray(data.shoots)) return null;

  const shoots = data.shoots
    .map((shoot) => {
      const chapters = (Array.isArray(shoot.chapters) ? shoot.chapters : [])
        .map((chapter) => {
          const photos = (Array.isArray(chapter.photos) ? chapter.photos : []).filter((photo) => {
            if (isValidPhoto(photo)) return true;
            console.warn("[photobook] skipped photo", `${shoot.id}/${chapter.id}/${photo?.id}`);
            return false;
          });
          return { ...chapter, photos };
        })
        .filter((chapter) => chapter.photos.length > 0);
      return { ...shoot, chapters };
    })
    .filter((shoot) => shoot.chapters.length > 0);

  return shoots.length > 0 ? { version: 1, shoots } : null;
}

function el(tag, { className, text } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEmpty(gallery) {
  emptyNote = el("p", { className: "gallery__empty" });
  gallery.replaceChildren(emptyNote);
  applyWords();
  onLanguageChange(applyWords);
}

// Labels in the current language; runs at build and on every language switch.
function applyWords() {
  const w = words();
  if (emptyNote) emptyNote.textContent = w.photosComingSoon;
  for (const { shoot, chapter, count, title, captionEl, meta, images } of labelled) {
    const place = placeName(shoot.id, chapter.id, chapter.title);
    const photos = w.photoCount(count);
    title.textContent = place;
    captionEl.textContent = caption(shoot.id, chapter.id);
    captionEl.hidden = !captionEl.textContent;
    meta.textContent = photos;
    for (const { img, photo, index } of images) img.alt = w.photoAlt(photo.alt, place, index + 1, count);
  }
}

// One page section per location, each with its own heading block (the page's
// h1 while it's showing; the cover is hidden then).
function renderManifest(gallery, manifest) {
  const chapters = [];
  const sections = manifest.shoots.flatMap((shoot) =>
    shoot.chapters.map((chapter) => {
      // A shoot whose only chapter is itself (Studio) is a single location.
      const solo = shoot.chapters.length === 1 && chapter.id === shoot.id;
      const section = el("section", { className: "chapter" });
      section.id = solo ? shoot.id : `${shoot.id}-${chapter.id}`;
      section.dataset.shoot = shoot.id;
      section.dataset.chapter = chapter.id;
      section.dataset.route = routeFor(shoot.id, chapter.id, solo);
      section.setAttribute("aria-labelledby", `${section.id}-title`);

      const count = chapter.photos.length;
      const header = el("header", { className: "chapter__header" });
      // The heading, caption, count and photo descriptions are filled in by applyWords().
      const title = el("h1", { className: "chapter__title" });
      title.id = `${section.id}-title`;
      title.tabIndex = -1;
      const meta = el("p", { className: "chapter__meta" });
      const captionEl = el("p", { className: "chapter__caption" });
      const divider = el("span", { className: "chapter__divider" });
      divider.setAttribute("aria-hidden", "true");
      header.append(title, captionEl, meta, divider);

      const spread = el("div", { className: "spread" });
      section.append(header, spread);
      const tiles = chapter.photos.map((photo, index) => createTile(shoot, chapter, photo, index));
      chapters.push({ spread, tiles });
      labelled.push({
        shoot,
        chapter,
        count,
        title,
        captionEl,
        meta,
        images: tiles.map((tile, index) => ({ img: tile.img, photo: chapter.photos[index], index })),
      });
      return section;
    }),
  );

  gallery.replaceChildren(...sections);
  applyWords();
  onLanguageChange(applyWords);
  return chapters;
}

function createTile(shoot, chapter, photo, index) {
  const figure = el("figure", { className: "tile" });
  figure.dataset.photo = `${shoot.id}/${chapter.id}/${photo.id}`;
  figure.style.setProperty("--ar", String(photo.width / photo.height));
  figure.style.setProperty("--tile-color", photo.color || "transparent");

  const img = new Image();
  img.addEventListener("load", () => img.classList.add("is-loaded"));
  img.addEventListener("error", () => img.classList.add("is-broken"));
  // The description (set by applyWords) includes the position, so each is
  // distinct for screen readers; the viewer reuses it.
  img.width = photo.width;
  img.height = photo.height;
  img.loading = "lazy";
  img.decoding = "async";
  // Sources are assigned by loadTileImage when the tile nears the viewport.
  img.dataset.srcset = SIZES.map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
  img.dataset.src = photo.src.md.url;

  // A real link makes the tile focusable and shareable; the viewer intercepts it.
  const link = el("a", { className: "tile__link" });
  link.href = `#photo/${figure.dataset.photo}`;
  link.append(img);
  figure.append(link);

  return {
    figure,
    img,
    aspect: photo.width / photo.height,
    shape: classifyShape(photo.width, photo.height),
  };
}

function loadTileImage(img) {
  if (!img.dataset.src) return;
  img.srcset = img.dataset.srcset;
  img.src = img.dataset.src;
  delete img.dataset.srcset;
  delete img.dataset.src;
}

// Native loading="lazy" alone looks 1250–2500px ahead in Chrome, which on a
// phone fetches ~30 photos while the guest is still on the cover; load about
// one screen ahead instead.
function observeTiles(tiles) {
  if (!("IntersectionObserver" in window)) {
    tiles.forEach((tile) => loadTileImage(tile.img));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        loadTileImage(entry.target.querySelector("img"));
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "100% 0px" },
  );
  tiles.forEach((tile) => observer.observe(tile.figure));
}

// Rows rise into place the first time they scroll into view. Returns null (no
// reveal) when the guest prefers reduced motion or the browser can't observe.
function createRevealer() {
  if (!("IntersectionObserver" in window) || window.matchMedia(REDUCED_MOTION).matches) return null;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("is-pending");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  return (row) => {
    row.classList.add("is-pending");
    observer.observe(row);
  };
}

function layoutChapter({ spread, tiles }, wide, reveal) {
  const rowEls = composeRows(tiles.map((tile) => tile.shape), wide).map(({ kind, indices }) => {
    const row = el("div", { className: `spread__row spread__row--${kind}` });
    const members = indices.map((index) => tiles[index]);
    const totalAspect = members.reduce((sum, tile) => sum + tile.aspect, 0);

    for (const tile of members) {
      const share = kind === "group" ? tile.aspect / totalAspect : 1;
      tile.img.sizes = tileSizes(tile.aspect, share, kind);
      row.append(tile.figure);
    }
    if (kind === "group") {
      // Lets CSS cap the row's height (e.g. two tall portraits on a wide screen).
      row.style.setProperty("--row-ar", String(totalAspect));
      row.style.setProperty("--row-gaps", String(members.length - 1));
    }
    reveal?.(row);
    return row;
  });

  // Moving existing figures keeps already-loaded images (no re-download).
  spread.replaceChildren(...rowEls);
}

// A tile's width is its share of the row, unless the row's height cap makes it
// narrower (e.g. a pair of portraits on a laptop), so the browser doesn't fetch
// a larger photo than it shows. Browsers that can't read min() here skip those
// entries and use the plain share.
function tileSizes(aspect, share, kind) {
  const cap = Math.round(aspect * (kind === "single" ? SINGLE_CAP_VH : ROW_CAP_VH));
  const px = Math.round(share * GALLERY_MAX_PX);
  const vw = Math.round(share * 100);
  return [
    `(min-width: 87.5rem) min(${px}px, ${cap}vh)`,
    `(min-width: 87.5rem) ${px}px`,
    `min(${vw}vw, ${cap}vh)`,
    `${vw}vw`,
  ].join(", ");
}

// Only the first layout reveals; rows rebuilt on a breakpoint change show at once.
function layoutAll(chapters, wide, reveal = null) {
  chapters.forEach((chapter) => layoutChapter(chapter, wide, reveal));
}

function rafThrottle(fn) {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      fn();
    });
  };
}

// A viewport resize (e.g. rotating a phone) reflows the page before the
// breakpoint change fires, so the guest's place is remembered while they
// scroll and restored after any resize or recomposition.
function trackAnchor(gallery) {
  let anchor = null;

  function remember() {
    if (gallery.getBoundingClientRect().top >= 0) {
      anchor = null;
      return;
    }
    const figure = [...gallery.querySelectorAll(".tile")].find((tile) => tile.getBoundingClientRect().bottom > 0);
    anchor = figure ? { figure, offset: figure.getBoundingClientRect().top } : null;
  }

  function restore() {
    if (!anchor) return;
    const delta = anchor.figure.getBoundingClientRect().top - anchor.offset;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
  }

  window.addEventListener("scroll", rafThrottle(remember), { passive: true });
  window.addEventListener("resize", rafThrottle(restore));
  remember();
  return { restore };
}

function relayout(chapters, wide, anchor) {
  layoutAll(chapters, wide);
  anchor.restore();
}
