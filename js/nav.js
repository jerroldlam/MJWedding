/*
 * Shoot & location navigation: a pinned two-row bar (shoots, then the active
 * shoot's locations) built once the gallery is ready. Highlights the section
 * under the bar while scrolling and switches the page theme with the shoot.
 * Never changes the URL or history (the back button belongs to the viewer).
 */

const READY_EVENT = "photobook:gallery-ready";
// The active section is the last one whose top is above this fraction of the viewport below the bar.
const SPY_OFFSET = 0.25;
const THEME_COLOR_TOKENS = { light: "--ivory", dark: "--ink" };

export function init() {
  document.addEventListener(READY_EVENT, (event) => buildNav(event.detail.manifest), { once: true });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function navLink(target, title, className) {
  const link = el("a", className, title);
  link.href = `#${target.id}`;
  link.dataset.target = target.id;
  return link;
}

function buildNav(manifest) {
  const nav = document.getElementById("shoot-nav");
  const gallery = document.getElementById("gallery");
  if (!nav || !gallery) return;

  const shootList = el("ul", "shoot-nav__shoots");
  const locations = el("div", "shoot-nav__locations");
  const shoots = [];

  for (const shoot of manifest.shoots) {
    const section = gallery.querySelector(`.shoot[data-shoot="${CSS.escape(shoot.id)}"]`);
    if (!section) continue;

    const link = navLink(section, shoot.title, "shoot-nav__link shoot-nav__link--shoot");
    const item = el("li");
    item.append(link);
    shootList.append(item);

    const multi = shoot.chapters.length > 1;
    const chapterList = multi ? el("ul", "shoot-nav__chapters") : null;
    if (chapterList) {
      chapterList.dataset.shoot = shoot.id;
      chapterList.hidden = true;
      locations.append(chapterList);
    }

    const chapters = shoot.chapters
      .map((chapter, index) => {
        const chapterEl = section.querySelector(`.chapter[data-chapter="${CSS.escape(chapter.id)}"]`);
        if (!chapterEl) return null;
        let chapterLink = null;
        if (chapterList) {
          chapterLink = navLink(chapterEl, chapter.title, "shoot-nav__link");
          const chapterItem = el("li");
          chapterItem.append(chapterLink);
          chapterList.append(chapterItem);
        }
        // A shoot's first chapter starts at the shoot heading, so the heading counts.
        return { id: chapter.id, section: chapterEl, spyTarget: index === 0 ? section : chapterEl, link: chapterLink };
      })
      .filter(Boolean);

    if (chapters.length > 0) {
      shoots.push({ id: shoot.id, theme: shoot.theme, section, link, chapterList, chapters });
    }
  }

  if (shoots.length === 0) return;

  nav.replaceChildren(shootList, locations);
  nav.hidden = false;
  trackHeight(nav);
  nav.addEventListener("click", onClick);
  startSpy(nav, shoots);
}

function trackHeight(nav) {
  const update = () => document.documentElement.style.setProperty("--nav-height", `${nav.offsetHeight}px`);
  update();
  if ("ResizeObserver" in window) new ResizeObserver(update).observe(nav);
}

function onClick(event) {
  const link = event.target.closest("a[data-target]");
  if (!link) return;
  event.preventDefault();

  const target = document.getElementById(link.dataset.target);
  if (!target) return;
  target.scrollIntoView({ block: "start" });

  const heading = target.matches(".shoot")
    ? target.querySelector(".shoot__title")
    : target.querySelector(".chapter__title") || target.closest(".shoot")?.querySelector(".shoot__title");
  if (heading) {
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}

function startSpy(nav, shoots) {
  const targets = shoots.flatMap((shoot) => shoot.chapters.map((chapter) => ({ shoot, chapter })));
  let current = null;
  let queued = false;

  const update = () => {
    queued = false;
    // Clamped so spying still works when the bar isn't pinned (short screens) and has scrolled away.
    const navBottom = Math.max(0, nav.getBoundingClientRect().bottom);
    const threshold = navBottom + window.innerHeight * SPY_OFFSET;
    let active = targets[0];
    for (const target of targets) {
      if (target.chapter.spyTarget.getBoundingClientRect().top <= threshold) active = target;
    }
    if (active !== current) {
      current = active;
      setActive(shoots, active);
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  update();
}

function markActive(link, active) {
  link.classList.toggle("is-active", active);
  if (active) link.setAttribute("aria-current", "location");
  else link.removeAttribute("aria-current");
}

function setActive(shoots, { shoot, chapter }) {
  for (const s of shoots) {
    markActive(s.link, s === shoot);
    if (s.chapterList) s.chapterList.hidden = s !== shoot;
    for (const c of s.chapters) {
      if (c.link) markActive(c.link, c === chapter);
    }
  }
  if (chapter.link) centreInRow(chapter.link);
  applyTheme(shoot.theme);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function centreInRow(link) {
  const row = link.closest(".shoot-nav__chapters");
  if (!row || row.scrollWidth <= row.clientWidth) return;
  const left = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
  row.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

function applyTheme(theme) {
  if (!(theme in THEME_COLOR_TOKENS) || document.body.dataset.theme === theme) return;
  document.body.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = getComputedStyle(document.documentElement).getPropertyValue(THEME_COLOR_TOKENS[theme]).trim();
  }
}
