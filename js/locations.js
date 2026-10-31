/*
 * Location menu: on the contents page, a card per location (the couple's
 * favourite photo, held by album corners with a light line drawn inside it, a
 * chapter numeral, its name, a short caption and an invitation to view its
 * photos) that opens
 * that location's page
 * (pages.js handles the click). Each card wears its location page's colours:
 * it carries the same data-location and data-theme the page puts on <body>.
 * Its words follow the language (i18n.js), relabelled when the guest switches.
 * Built from the manifest once the gallery is ready; hidden until then.
 */

import { words, placeName, caption, onLanguageChange } from "./i18n.js";

const READY_EVENT = "photobook:gallery-ready";
// Two columns on phones, three on tablets, five in a row on wide screens.
const CARD_SIZES = "(min-width: 87.5rem) 17rem, (min-width: 64rem) 19vw, (min-width: 40rem) 31vw, 47vw";
const THEMES = ["light", "dark"];
// Chapter numerals above the card names, in card order
const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// The couple's favourite (cardPhoto, set in the photo script) represents a
// location; otherwise its first portrait photo, which fills a portrait frame
// uncropped, or else its first photo. The end panel's next card uses it too.
export function cardPhoto(chapter) {
  return (
    chapter.photos.find((p) => p.id === chapter.cardPhoto) ??
    chapter.photos.find((p) => p.height > p.width) ??
    chapter.photos[0]
  );
}

// The chapter numeral for a location's position in the book (decorative)
export function numeral(position) {
  return NUMERALS[position] ?? "";
}

// What applyWords() labels: each card's name, caption, count and spoken label.
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

  let position = 0;
  const items = manifest.shoots.flatMap((shoot) =>
    shoot.chapters
      .map((chapter) => {
        const section = gallery.querySelector(
          `.chapter[data-shoot="${CSS.escape(shoot.id)}"][data-chapter="${CSS.escape(chapter.id)}"]`,
        );
        return section ? createCard(shoot, chapter, section, position++) : null;
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

function createCard(shoot, chapter, section, position) {
  const photo = cardPhoto(chapter);
  const count = chapter.photos.length;

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
  // A light line drawn inside the print, and album corners holding it (decorative)
  const line = el("span", "locations__line");
  const corners = el("span", "locations__corners");
  line.setAttribute("aria-hidden", "true");
  corners.setAttribute("aria-hidden", "true");
  frame.append(line, corners);

  // A chapter numeral (decorative); the name, caption, count and spoken label
  // are filled in by applyWords().
  const number = el("span", "locations__number", numeral(position));
  number.setAttribute("aria-hidden", "true");
  const name = el("span", "locations__name");
  const captionEl = el("span", "locations__caption");
  const meta = el("span", "locations__meta");
  link.append(frame, number, name, captionEl, meta);
  cards.push({ shoot, chapter, count, link, name, captionEl, meta });

  const item = el("li");
  item.append(link);
  return item;
}

// Labels in the current language; runs at build and on every language switch.
function applyWords() {
  const w = words();
  for (const { shoot, chapter, count, link, name, captionEl, meta } of cards) {
    const place = placeName(shoot.id, chapter.id, chapter.title);
    const photos = w.photoCount(count);
    name.textContent = place;
    captionEl.textContent = caption(shoot.id, chapter.id);
    captionEl.hidden = !captionEl.textContent;
    meta.textContent = w.viewPhotos(photos);
    // The name and meta are separate blocks; spell out the pause for screen readers.
    link.setAttribute("aria-label", w.cardLabel(place, photos));
  }
}
