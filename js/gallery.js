/*
 * Gallery feature: loads data/photos.json, renders each shoot and location as
 * editorial spreads, recomposes rows when crossing the phone/wide breakpoint,
 * and announces "photobook:gallery-ready" for later features (nav, viewer).
 */

import { classifyShape, composeRows } from "./spreads.js";

const MANIFEST_URL = "data/photos.json";
const WIDE_QUERY = "(min-width: 40rem)";
const GALLERY_MAX_PX = 1400;
const READY_EVENT = "photobook:gallery-ready";
const SIZES = ["sm", "md", "lg"];

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
  layoutAll(chapters, media.matches);
  observeTiles(chapters.flatMap((chapter) => chapter.tiles));
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
  gallery.replaceChildren(el("p", { className: "gallery__empty", text: "Photos coming soon" }));
}

function renderManifest(gallery, manifest) {
  const chapters = [];
  const sections = manifest.shoots.map((shoot) => {
    const section = el("section", { className: "shoot" });
    section.id = `shoot-${shoot.id}`;
    section.dataset.shoot = shoot.id;
    section.dataset.shootTheme = shoot.theme;
    section.setAttribute("aria-labelledby", `shoot-${shoot.id}-title`);

    const header = el("header", { className: "shoot__header" });
    const title = el("h2", { className: "shoot__title", text: shoot.title });
    title.id = `shoot-${shoot.id}-title`;
    const divider = el("span", { className: "shoot__divider" });
    divider.setAttribute("aria-hidden", "true");
    header.append(title, divider);
    section.append(header);

    for (const chapter of shoot.chapters) {
      // A shoot whose only chapter is itself (Studio) shows its heading once.
      const solo = shoot.chapters.length === 1 && chapter.id === shoot.id;
      const chapterEl = el("section", { className: "chapter" });
      chapterEl.id = solo ? shoot.id : `${shoot.id}-${chapter.id}`;
      chapterEl.dataset.chapter = chapter.id;

      if (solo) {
        chapterEl.setAttribute("aria-labelledby", `shoot-${shoot.id}-title`);
      } else {
        const heading = el("h3", { className: "chapter__title", text: chapter.title });
        heading.id = `${chapterEl.id}-title`;
        chapterEl.setAttribute("aria-labelledby", heading.id);
        chapterEl.append(heading);
      }

      const spread = el("div", { className: "spread" });
      chapterEl.append(spread);
      section.append(chapterEl);
      chapters.push({ spread, tiles: chapter.photos.map((photo) => createTile(shoot, chapter, photo)) });
    }
    return section;
  });

  gallery.replaceChildren(...sections);
  return chapters;
}

function createTile(shoot, chapter, photo) {
  const figure = el("figure", { className: "tile" });
  figure.dataset.photo = `${shoot.id}/${chapter.id}/${photo.id}`;
  figure.style.setProperty("--ar", String(photo.width / photo.height));
  figure.style.setProperty("--tile-color", photo.color || "transparent");

  const img = new Image();
  img.addEventListener("load", () => img.classList.add("is-loaded"));
  img.addEventListener("error", () => img.classList.add("is-broken"));
  img.alt = photo.alt || "";
  img.width = photo.width;
  img.height = photo.height;
  img.loading = "lazy";
  img.decoding = "async";
  // Sources are assigned by loadTileImage when the tile nears the viewport.
  img.dataset.srcset = SIZES.map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
  img.dataset.src = photo.src.md.url;
  figure.append(img);

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

function layoutChapter({ spread, tiles }, wide) {
  const rowEls = composeRows(tiles.map((tile) => tile.shape), wide).map(({ kind, indices }) => {
    const row = el("div", { className: `spread__row spread__row--${kind}` });
    const members = indices.map((index) => tiles[index]);
    const totalAspect = members.reduce((sum, tile) => sum + tile.aspect, 0);

    for (const tile of members) {
      const share = kind === "group" ? tile.aspect / totalAspect : 1;
      tile.img.sizes = `(min-width: 87.5rem) ${Math.round(share * GALLERY_MAX_PX)}px, ${Math.round(share * 100)}vw`;
      row.append(tile.figure);
    }
    if (kind === "group") {
      // Lets CSS cap the row's height (e.g. two tall portraits on a wide screen).
      row.style.setProperty("--row-ar", String(totalAspect));
      row.style.setProperty("--row-gaps", String(members.length - 1));
    }
    return row;
  });

  // Moving existing figures keeps already-loaded images (no re-download).
  spread.replaceChildren(...rowEls);
}

function layoutAll(chapters, wide) {
  chapters.forEach((chapter) => layoutChapter(chapter, wide));
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
