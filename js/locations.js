/*
 * Location menu: on the contents page, a card per location (one of its
 * photos, its name, shoot and photo count) that opens that location's page
 * (pages.js handles the click). Each card wears its location page's colours:
 * it carries the same data-location and data-theme the page puts on <body>.
 * Its words follow the language (i18n.js), relabelled when the guest switches.
 * Built from the manifest once the gallery is ready; hidden until then.
 */

import { words, placeName, shootName, onLanguageChange } from "./i18n.js";

const READY_EVENT = "photobook:gallery-ready";
// Two columns on phones, three on tablets, five in a row on wide screens.
const CARD_SIZES = "(min-width: 87.5rem) 17rem, (min-width: 64rem) 19vw, (min-width: 40rem) 31vw, 47vw";
const THEMES = ["light", "dark"];

// What applyWords() labels: each card's name, count and spoken label.
const cards = [];

export function init() {
  document.addEventListener(READY_EVENT, (event) => buildMenu(event.detail.manifest), { once: true });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildMenu(manifest) {
  const menu = document.getElementById("locations");
  const list = menu?.querySelector(".locations__list");
  const gallery = document.getElementById("gallery");
  if (!list || !gallery) return;

  const items = manifest.shoots.flatMap((shoot) =>
    shoot.chapters
      .map((chapter) => {
        const section = gallery.querySelector(
          `.chapter[data-shoot="${CSS.escape(shoot.id)}"][data-chapter="${CSS.escape(chapter.id)}"]`,
        );
        return section ? createCard(shoot, chapter, section) : null;
      })
      .filter(Boolean),
  );
  if (items.length === 0) return;

  list.replaceChildren(...items);
  // Text colours follow the location, as pages.js does for the page: its
  // --location-theme, or else the shoot's theme (already set)
  for (const card of list.querySelectorAll(".locations__card")) {
    const theme = getComputedStyle(card).getPropertyValue("--location-theme").trim();
    if (THEMES.includes(theme)) card.dataset.theme = theme;
  }
  applyWords();
  onLanguageChange(applyWords);
  menu.hidden = false;
  // iOS Safari only applies :active (the press dip) when a touch listener exists.
  menu.addEventListener("touchstart", () => {}, { passive: true });
}

function createCard(shoot, chapter, section) {
  // The first photo in the location's (fixed, shuffled) order represents it.
  const photo = chapter.photos[0];
  const count = chapter.photos.length;
  const solo = shoot.chapters.length === 1;

  const link = el("a", "locations__card");
  link.href = `#${section.dataset.route}`;
  link.dataset.pageLink = section.dataset.route;
  // The card wears its location page's colours (the same CSS rules as the page)
  link.dataset.location = section.id;
  link.dataset.theme = shoot.theme;

  const frame = el("span", "locations__photo");
  frame.style.backgroundColor = photo.color || "transparent";
  const img = new Image();
  img.addEventListener("load", () => img.classList.add("is-loaded"));
  img.alt = ""; // decorative: the card's text names the location
  img.width = photo.src.sm.width;
  img.height = photo.src.sm.height;
  img.loading = "lazy";
  img.decoding = "async";
  img.sizes = CARD_SIZES;
  img.srcset = ["sm", "md"].map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
  img.src = photo.src.sm.url;
  frame.append(img);

  // The name, count and spoken label are filled in by applyWords().
  const name = el("span", "locations__name");
  const meta = el("span", "locations__meta");
  link.append(frame, name, meta);
  cards.push({ shoot, chapter, solo, count, link, name, meta });

  const item = el("li");
  item.append(link);
  return item;
}

// Labels in the current language; runs at build and on every language switch.
function applyWords() {
  const w = words();
  for (const { shoot, chapter, solo, count, link, name, meta } of cards) {
    const place = placeName(shoot.id, chapter.id, chapter.title);
    const shootTitle = shootName(shoot.id, shoot.title);
    const photos = w.photoCount(count);
    name.textContent = place;
    meta.textContent = solo ? photos : `${shootTitle} · ${photos}`;
    // The name and meta are separate blocks; spell out the pause for screen readers.
    link.setAttribute("aria-label", w.cardLabel(place, solo ? null : shootTitle, photos));
  }
}
