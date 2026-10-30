/*
 * Location menu: on the contents page, a card per location (one of its
 * photos, its name, shoot and photo count) that opens that location's page
 * (pages.js handles the click). Built from the manifest once the gallery is
 * ready; hidden until then.
 */

const READY_EVENT = "photobook:gallery-ready";
// Two columns on phones, three on tablets, five in a row on wide screens.
const CARD_SIZES = "(min-width: 87.5rem) 17rem, (min-width: 64rem) 19vw, (min-width: 40rem) 31vw, 47vw";

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

  const photos = `${count} ${count === 1 ? "photo" : "photos"}`;
  const meta = solo ? photos : `${shoot.title} · ${photos}`;
  link.append(frame, el("span", "locations__name", chapter.title), el("span", "locations__meta", meta));
  // The name and meta are separate blocks; spell out the pause for screen readers.
  link.setAttribute("aria-label", `${chapter.title}, ${solo ? photos : `${shoot.title}, ${photos}`}`);

  const item = el("li");
  item.append(link);
  return item;
}
