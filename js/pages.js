/*
 * Pages: the photobook shows one page at a time, either the contents (cover,
 * About us, location cards) or a single location. Each location has its own
 * address (see routes.js), a pinned bar ("‹ Contents" plus every location) and
 * an end panel that leads back to the contents or on to the next location.
 *
 * History: every page change the guest makes is an entry whose state records
 * `depth` (photobook entries above the contents entry), so "Back to contents"
 * can go straight back without growing history. Each entry remembers its
 * scroll position. A direct visit to a location or photo gets a contents entry
 * underneath, so back always leads home. The viewer layers its own entry on top.
 */

import { parseHash } from "./routes.js";

const READY_EVENT = "photobook:gallery-ready";
const THEMES = ["light", "dark"];
const SITE_TITLE = "May & Jerrold";
const SCROLL_SETTLE_MS = 300;

let pages = [];
let byPath = new Map();
let current = null; // null = the contents page
const dom = {};

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
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
          theme: shoot.theme,
          sectionId: section.id,
          route: section.dataset.route,
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
    page.next = pages[index + 1] || null;
  });
  byPath = new Map(pages.map((page) => [page.route, page]));
  history.scrollRestoration = "manual";

  pages.forEach((page) => page.section.append(buildEndPanel(page)));
  dom.bar = bar;
  dom.list = bar.querySelector(".page-bar__locations");
  buildSwitcher();
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
  pages.forEach((page, index) => {
    // A thin divider between shoots (the Outdoor locations, then Studio).
    if (index > 0 && page.shootId !== pages[index - 1].shootId) {
      const sep = el("li", "page-bar__sep");
      sep.setAttribute("aria-hidden", "true");
      items.push(sep);
    }
    const link = el("a", "page-bar__link", page.title);
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
  const home = el("a", "chapter__home", "Back to contents");
  home.href = "./";
  home.dataset.pageLink = "contents";
  panel.append(el("p", "chapter__end-label", `End of ${page.title}`), divider, home);

  if (page.next) {
    const next = el("a", "chapter__next");
    next.href = `#${page.next.route}`;
    next.dataset.pageLink = page.next.route;
    next.setAttribute("aria-label", `Next location: ${page.next.title}`);
    next.append(el("span", "chapter__next-label", "Next location"), el("span", "chapter__next-title", `${page.next.title} ›`));
    panel.append(next);
  }
  return panel;
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
  show(page, { scroll: "top", focus: true });
}

function backToContents() {
  const depth = history.state?.depth || 0;
  if (depth > 0) {
    history.go(-depth); // onPopState shows the contents and restores its scroll
  } else {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    show(null, { scroll: "cards", focus: true });
  }
}

function onPopState() {
  let { page, valid } = resolve(location.hash);
  if (!valid) {
    history.replaceState({ page: "contents" }, "", contentsUrl());
    page = null;
  }
  // Same page: a photo opening or closing (the viewer's business), or an anchor.
  if (page === current) return;
  const saved = history.state?.scroll;
  show(page, { scroll: typeof saved === "number" ? saved : page ? "top" : "cards", focus: true });
}

function show(page, { scroll, focus }) {
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

// Tints the page for a location (null = untinted, e.g. the contents). The
// stylesheet's --location-theme picks light or dark text, falling back to the
// shoot's theme; the browser bar colour follows the page background.
function applyTheme(shootTheme, location) {
  const body = document.body;
  if (location) body.dataset.location = location;
  else delete body.dataset.location;

  const styles = getComputedStyle(body);
  const locationTheme = styles.getPropertyValue("--location-theme").trim();
  const theme = THEMES.includes(locationTheme) ? locationTheme : shootTheme;
  if (THEMES.includes(theme)) body.dataset.theme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  const background = styles.getPropertyValue("--color-bg").trim();
  if (meta && background) meta.content = background;
}
