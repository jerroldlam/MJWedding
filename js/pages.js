/*
 * Pages: the photobook shows one page at a time, either the contents (cover,
 * Our story, location cards) or a single location. Each location has its own
 * address (see routes.js), a pinned bar ("‹ Contents" plus every location) and
 * an end panel that leads with a card for the next location (its photo,
 * numeral, name and caption, in its colours), with "Back to contents" as a
 * quiet link (the last location ends with the couple's closing note).
 *
 * History: every page change the guest makes is an entry whose state records
 * `depth` (photobook entries above the contents entry), so "Back to contents"
 * can go straight back without growing history. Each entry remembers its
 * scroll position. A direct visit to a location or photo gets a contents entry
 * underneath, so back always leads home. The viewer layers its own entry on top.
 *
 * Guest page changes cross-fade (a view transition around show(); the look is
 * in css/styles.css); first loads, reduced motion and older browsers swap instantly.
 * Labels follow the language (i18n.js) and are relabelled when the guest switches.
 * The bar's location list fades only at the edges where names are hidden.
 */

import { words, placeName, caption, onLanguageChange } from "./i18n.js";
import { cardPhoto, numeral } from "./locations.js";
import { parseHash } from "./routes.js";

const READY_EVENT = "photobook:gallery-ready";
const THEMES = ["light", "dark"];
const SITE_TITLE = "Jerrold & May";
const SCROLL_SETTLE_MS = 300;
// Classes on <html> while a page fade runs (styled in css/styles.css)
const FADING_CLASS = "page-fading";
const STEADY_BAR_CLASS = "bar-steady";
const VIEWER_OPEN_CLASS = "viewer-open"; // set by viewer.js

let pages = [];
let byPath = new Map();
let current = null; // null = the contents page
let fade = null; // the latest page fade still running, if any
let coverAtTop = true; // the cover overlaps the top of the screen (contents only)
const dom = {};
// The closing notes (end of the last location, foot of the contents): their
// line and signature, labelled by applyWords().
const closings = [];

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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

function setup(manifest) {
  const gallery = document.getElementById("gallery");
  const bar = document.getElementById("page-bar");
  if (!gallery || !bar) return;

  pages = manifest.shoots.flatMap((shoot) =>
    shoot.chapters
      .map((chapter) => {
        const section = gallery.querySelector(
          `.chapter[data-shoot="${CSS.escape(shoot.id)}"][data-chapter="${CSS.escape(chapter.id)}"]`,
        );
        if (!section) return null;
        return {
          shootId: shoot.id,
          chapterId: chapter.id,
          chapter,
          theme: shoot.theme,
          sectionId: section.id,
          route: section.dataset.route,
          chapterTitle: chapter.title, // English; title (set by applyWords) is in the current language
          title: chapter.title,
          section,
          heading: section.querySelector(".chapter__title"),
        };
      })
      .filter(Boolean),
  );
  // Nothing found (e.g. "Photos coming soon"): leave the page as it is.
  if (pages.length === 0) return;

  pages.forEach((page, index) => {
    page.index = index;
    page.next = pages[index + 1] || null;
  });
  byPath = new Map(pages.map((page) => [page.route, page]));
  history.scrollRestoration = "manual";

  pages.forEach((page) => page.section.append(buildEndPanel(page)));
  // Each next card wears its location's colours: its --location-theme picks
  // the text set, as on the contents cards
  for (const page of pages) {
    if (!page.nextLink) continue;
    const theme = getComputedStyle(page.nextLink).getPropertyValue("--location-theme").trim();
    page.nextLink.dataset.theme = THEMES.includes(theme) ? theme : page.next.theme;
  }
  // The same note at the foot of the contents, after the location cards
  // (unsigned: the footer just below names the couple)
  const contentsClosing = el("div", "contents-closing");
  contentsClosing.append(buildClosing());
  document.getElementById("locations")?.after(contentsClosing);
  dom.bar = bar;
  dom.list = bar.querySelector(".page-bar__locations");
  dom.cover = document.querySelector(".cover");
  watchCover();
  buildSwitcher();
  dom.list.addEventListener("scroll", rafThrottle(updateFades), { passive: true });
  window.addEventListener("resize", rafThrottle(updateFades));
  applyWords();
  onLanguageChange(applyWords);
  bar.hidden = false;

  document.addEventListener("click", onLinkClick);
  window.addEventListener("popstate", onPopState);
  // Phones often unload a background tab and reload it later, and a reload
  // ignores history changes made while the page unloads. Remember the guest's
  // place when scrolling settles and when the page is hidden instead.
  let settle = null;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(settle);
      settle = setTimeout(saveScroll, SCROLL_SETTLE_MS);
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveScroll();
  });
  initialRoute();
}

function buildSwitcher() {
  const items = [];
  pages.forEach((page) => {
    const link = el("a", "page-bar__link");
    link.href = `#${page.route}`;
    link.dataset.pageLink = page.route;
    page.barLink = link;
    const item = el("li");
    item.append(link);
    items.push(item);
  });
  dom.list.replaceChildren(...items);
}

function buildEndPanel(page) {
  const panel = el("div", "chapter__end");
  const divider = el("span", "chapter__divider");
  divider.setAttribute("aria-hidden", "true");
  // The words are filled in by applyWords().
  const home = el("a", "chapter__home");
  home.href = "./";
  home.dataset.pageLink = "contents";
  page.endLabel = el("p", "chapter__end-label");
  page.homeLink = home;
  // The last location ends the photobook with the couple's closing note
  // instead of "End of …"; the label is still built so applyWords() stays uniform.
  if (page.next) {
    home.classList.add("chapter__home--quiet");
    panel.append(page.endLabel, divider, buildNextCard(page), home);
  } else {
    panel.append(buildClosing({ signed: true }), home);
  }
  return panel;
}

// The next location as a small card: the same photo and numeral as its
// contents card, in its colours (data-location; data-theme is set in setup).
// The words are filled in by applyWords().
function buildNextCard(page) {
  const next = el("a", "chapter__next");
  next.href = `#${page.next.route}`;
  next.dataset.pageLink = page.next.route;
  next.dataset.location = page.next.sectionId;

  const photo = cardPhoto(page.next.chapter);
  const frame = el("span", "chapter__next-photo");
  frame.style.backgroundColor = photo.color || "transparent";
  const img = new Image();
  img.alt = ""; // decorative: the card's words name the location
  img.width = photo.src.sm.width;
  img.height = photo.src.sm.height;
  img.loading = "lazy";
  img.decoding = "async";
  img.sizes = "5.5rem";
  img.srcset = ["sm", "md"].map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
  img.src = photo.src.sm.url;
  const corners = el("span", "locations__corners");
  corners.setAttribute("aria-hidden", "true");
  frame.append(img, corners);

  const text = el("span", "chapter__next-text");
  page.nextLabel = el("span", "chapter__next-label");
  const number = el("span", "chapter__next-number", numeral(page.next.index));
  number.setAttribute("aria-hidden", "true");
  page.nextTitle = el("span", "chapter__next-title");
  page.nextCaption = el("span", "chapter__next-caption");
  text.append(page.nextLabel, number, page.nextTitle, page.nextCaption);
  next.append(frame, text);
  page.nextLink = next;
  return next;
}

// The closing note: the Our story jigsaw pair (cloned, so its shared seam
// stays in one place), a line of thanks, a rule and, when signed, the
// couple's names (the contents leaves them to the footer just below).
function buildClosing({ signed = false } = {}) {
  const closing = el("div", "chapter__closing");
  const puzzle = document.querySelector(".about__puzzle")?.cloneNode(true);
  if (puzzle) {
    puzzle.setAttribute("class", "chapter__closing-puzzle");
    closing.append(puzzle);
  }
  const rule = el("span", "chapter__divider");
  rule.setAttribute("aria-hidden", "true");
  const line = el("p", "chapter__closing-line");
  closing.append(line, rule);
  const sign = signed ? el("p", "chapter__closing-sign") : null;
  if (sign) closing.append(sign);
  closings.push({ line, sign });
  return closing;
}

// Labels in the current language; runs at setup and on every language switch.
function applyWords() {
  const w = words();
  for (const page of pages) page.title = placeName(page.shootId, page.chapterId, page.chapterTitle);
  for (const page of pages) {
    page.barLink.textContent = page.title;
    page.endLabel.textContent = w.endOf(page.title);
    page.homeLink.textContent = w.backToContents;
    if (page.next) {
      page.nextLink.setAttribute("aria-label", w.nextLocationLabel(page.next.title));
      page.nextLabel.textContent = w.nextLocation;
      page.nextTitle.textContent = `${page.next.title} ›`;
      page.nextCaption.textContent = caption(page.next.shootId, page.next.chapterId);
      page.nextCaption.hidden = !page.nextCaption.textContent;
    }
  }
  for (const { line, sign } of closings) {
    line.textContent = w.closingLine;
    if (sign) sign.textContent = w.closingSign;
  }
  document.title = current ? `${current.title} · ${SITE_TITLE}` : SITE_TITLE;
  // The names change width with the language
  if (dom.list) updateFades();
}

// Which page an address shows. Invalid routes and dead photo links are
// reported so they can be cleaned out of the address bar.
function resolve(hash) {
  const route = parseHash(hash);
  if (route.kind === "invalid") return { page: null, valid: false };
  if (route.kind === "location") {
    const page = byPath.get(route.path);
    return page ? { page, valid: true } : { page: null, valid: false };
  }
  if (route.kind === "photo") {
    const [shootId, chapterId] = route.photoKey.split("/");
    const page = pages.find((p) => p.shootId === shootId && p.chapterId === chapterId);
    const exists = document.querySelector(`.tile[data-photo="${CSS.escape(route.photoKey)}"]`);
    return page && exists ? { page, photoKey: route.photoKey, valid: true } : { page: null, valid: false };
  }
  return { page: null, valid: true };
}

function contentsUrl() {
  return location.pathname + location.search;
}

function initialRoute() {
  const { page, photoKey, valid } = resolve(location.hash);
  if (!valid) {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    show(null, { scroll: "top", focus: false });
  } else if (history.state?.page || history.state?.viewer) {
    // A reload or restored tab: the entries beneath are already there.
    const saved = history.state.scroll;
    show(page, { scroll: typeof saved === "number" ? saved : page ? "top" : "none", focus: false });
  } else if (page) {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    history.pushState({ page: "location", depth: 1 }, "", `#${page.route}`);
    if (photoKey) history.pushState({ viewer: true }, "", `#photo/${photoKey}`);
    // No focus on arrival: the page starts at the heading, and focusing it
    // would draw a focus box before the guest has done anything.
    show(page, { scroll: "top", focus: false });
  } else {
    // A plain contents load; the browser handles any "#about"-style anchor.
    // Marking the entry as ours lets a reload return to the saved place.
    history.replaceState({ page: "contents" }, "");
    show(null, { scroll: "none", focus: false });
  }
}

function onLinkClick(event) {
  const link = event.target.closest("a[data-page-link]");
  if (!link || event.defaultPrevented || event.button !== 0) return;
  // Let Ctrl/⌘/Shift/Alt-clicks open a new tab or window as usual.
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (link.dataset.pageLink === "contents") backToContents();
  else goTo(byPath.get(link.dataset.pageLink));
}

function saveScroll() {
  history.replaceState({ ...(history.state || {}), scroll: window.scrollY }, "");
}

function goTo(page) {
  if (!page) return;
  if (page === current) {
    window.scrollTo({ top: 0, behavior: "instant" });
    page.heading?.focus({ preventScroll: true });
    return;
  }
  const depth = current ? (history.state?.depth || 0) + 1 : 1;
  saveScroll();
  history.pushState({ page: "location", depth }, "", `#${page.route}`);
  changePage(page, { scroll: "top", focus: true });
}

function backToContents() {
  const depth = history.state?.depth || 0;
  if (depth > 0) {
    history.go(-depth); // onPopState shows the contents and restores its scroll
  } else {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    changePage(null, { scroll: "cards", focus: true });
  }
}

function onPopState() {
  let { page, photoKey, valid } = resolve(location.hash);
  if (!valid) {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    page = null;
    photoKey = undefined;
  }
  // Same page: a photo opening or closing (the viewer's business), or an anchor.
  if (page === current) return;
  const saved = history.state?.scroll;
  const options = { scroll: typeof saved === "number" ? saved : page ? "top" : "cards", focus: true };
  // The viewer moves its own photo: no fade into a photo address or out of an
  // open viewer (this listener runs before the viewer's).
  if (photoKey || document.documentElement.classList.contains(VIEWER_OPEN_CLASS)) show(page, options);
  else changePage(page, options);
}

// A page change the guest made: the old page dissolves into the new one.
// History is already updated; only the swap itself runs inside the fade.
function changePage(page, options) {
  if (!canFade()) {
    show(page, options);
    return;
  }
  const root = document.documentElement;
  root.classList.add(FADING_CLASS);
  // Between two locations the bar holds still; to or from the contents it fades with the page.
  root.classList.toggle(STEADY_BAR_CLASS, Boolean(page && current));
  // History has already moved, so the page being shown changes now too: a tap
  // before the swap runs must see it (for depth and same-page checks).
  current = page;
  const transition = document.startViewTransition(() => show(page, options));
  fade = transition;
  // Skipped (a newer tap, a hidden tab): the swap still happens, without the fade.
  transition.ready.catch(() => {});
  const done = () => {
    if (fade !== transition) return; // a newer fade owns the classes
    fade = null;
    root.classList.remove(FADING_CLASS, STEADY_BAR_CLASS);
  };
  transition.finished.then(done, done);
}

function canFade() {
  return typeof document.startViewTransition === "function" && !prefersReducedMotion();
}

function show(page, { scroll, focus }) {
  // Leaving the contents ends the cover's entrance for this visit, so coming
  // back shows the cover complete instead of replaying it.
  if (page && document.body.dataset.page === "contents") dom.cover?.classList.add("is-entered");
  current = page;
  document.body.dataset.page = page ? "location" : "contents";
  for (const p of pages) {
    p.section.hidden = p !== page;
    p.barLink.classList.toggle("is-active", p === page);
    if (p === page) p.barLink.setAttribute("aria-current", "page");
    else p.barLink.removeAttribute("aria-current");
  }
  dom.bar.hidden = !page;
  if (page) centreInRow(page.barLink);

  applyTheme(page ? page.theme : "light", page ? page.sectionId : null);
  document.title = page ? `${page.title} · ${SITE_TITLE}` : SITE_TITLE;

  // Location pages start at the top: the bar, then the location's heading.
  if (typeof scroll === "number") window.scrollTo({ top: scroll, behavior: "instant" });
  else if (scroll === "top") window.scrollTo({ top: 0, behavior: "instant" });
  else if (scroll === "cards") document.getElementById("locations")?.scrollIntoView({ block: "start", behavior: "instant" });

  if (focus) {
    const target = page ? page.heading : document.getElementById("locations-title");
    if (target && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }
  updateFades();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Keeps the current location fully visible when the switcher scrolls sideways.
function centreInRow(link) {
  const row = dom.list;
  if (row.scrollWidth <= row.clientWidth) return;
  const rowRect = row.getBoundingClientRect();
  const linkRect = link.getBoundingClientRect();
  const left = row.scrollLeft + (linkRect.left - rowRect.left) - (row.clientWidth - linkRect.width) / 2;
  row.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

// Fades only the bar's edges that hide names: the start once scrolled, the
// end until it's reached (styled in css/styles.css).
function updateFades() {
  const row = dom.list;
  const max = row.scrollWidth - row.clientWidth;
  row.classList.toggle("is-scrolled", row.scrollLeft > 1);
  row.classList.toggle("is-at-end", row.scrollLeft >= max - 1);
}

// Tints the page for a location (null = untinted, e.g. the contents). The
// stylesheet's --location-theme picks light or dark text, falling back to the
// shoot's theme; the browser bar follows (updateBarColour).
function applyTheme(shootTheme, location) {
  const body = document.body;
  if (location) body.dataset.location = location;
  else delete body.dataset.location;

  const styles = getComputedStyle(body);
  const locationTheme = styles.getPropertyValue("--location-theme").trim();
  const theme = THEMES.includes(locationTheme) ? locationTheme : shootTheme;
  if (THEMES.includes(theme)) body.dataset.theme = theme;

  updateBarColour();
}

// The browser bar follows the top of the screen: the cover's shaded top
// edge while the cover is there, otherwise the page's background.
function updateBarColour() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const onCover = !current && coverAtTop && dom.cover;
  const colour = onCover
    ? getComputedStyle(dom.cover).getPropertyValue("--cover-top").trim()
    : getComputedStyle(document.body).getPropertyValue("--color-bg").trim();
  if (colour) meta.content = colour;
}

// Watches whether the cover overlaps the top 1% of the screen (hidden on
// location pages, so false there). The bar changes only on the contents
// with the viewer closed (the viewer keeps its own bar colour).
function watchCover() {
  if (!dom.cover || !("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      coverAtTop = entry.isIntersecting;
      if (current || document.documentElement.classList.contains(VIEWER_OPEN_CLASS)) return;
      updateBarColour();
    },
    { rootMargin: "0px 0px -99% 0px" },
  );
  observer.observe(dom.cover);
  window.matchMedia("(orientation: portrait)").addEventListener("change", updateBarColour);
}
