/*
 * Full-screen photo viewer: opens any tile in a dark modal <dialog>, moves
 * through the whole book in page order (swipe, arrow keys, buttons), and
 * closes via ✕, Esc, swipe down, a click outside the photo or the back button.
 * Each photo has a shareable address (#photo/<shoot>/<chapter>/<photo>).
 * History: one entry is pushed on open; moves replace it; close goes back.
 */

const READY_EVENT = "photobook:gallery-ready";
const HASH_PREFIX = "#photo/";
const SIZES = ["sm", "md", "lg"];
const SWIPE_MIN = 50;
const SWIPE_CLOSE = 80;

let sequence = [];
let byKey = new Map();
let current = -1;
let isOpen = false;
// True when this viewer's history entry was pushed by us (so closing goes back).
let pushed = false;
let savedThemeColor = null;
let dom = null;

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

function setup(manifest) {
  sequence = buildSequence(manifest);
  byKey = new Map(sequence.map((entry, index) => [entry.key, index]));
  dom = buildDialog();
  document.body.append(dom.dialog);

  document.getElementById("gallery")?.addEventListener("click", (event) => {
    const link = event.target.closest("a.tile__link");
    const key = link?.closest(".tile")?.dataset.photo;
    if (!byKey.has(key)) return;
    event.preventDefault();
    open(byKey.get(key), true);
  });
  window.addEventListener("popstate", onPopState);
  window.addEventListener("resize", () => {
    if (isOpen) fitCurrent();
  });

  const key = keyFromHash(location.hash);
  if (key !== null) {
    if (byKey.has(key)) open(byKey.get(key), false);
    else clearHash();
  }
}

function buildSequence(manifest) {
  return manifest.shoots.flatMap((shoot) =>
    shoot.chapters.flatMap((chapter) =>
      chapter.photos.map((photo, i) => ({
        key: `${shoot.id}/${chapter.id}/${photo.id}`,
        photo,
        title: chapter.title,
        index: i + 1,
        count: chapter.photos.length,
      })),
    ),
  );
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function button(className, label, iconClass) {
  const node = el("button", className, { type: "button", "aria-label": label });
  node.append(el("span", iconClass, { "aria-hidden": "true" }));
  return node;
}

function buildDialog() {
  const dialog = el("dialog", "viewer", { "aria-label": "Photo viewer" });
  const stage = el("div", "viewer__stage");
  const frame = el("figure", "viewer__frame");
  const img = el("img", "viewer__img", { alt: "", decoding: "async" });
  frame.append(img);
  stage.append(frame);

  const close = button("viewer__close", "Close", "viewer__icon viewer__icon--close");
  const prev = button("viewer__prev", "Previous photo", "viewer__icon viewer__icon--prev");
  const next = button("viewer__next", "Next photo", "viewer__icon viewer__icon--next");
  const position = el("p", "viewer__position", { "aria-live": "polite" });
  dialog.append(stage, prev, next, close, position);

  close.addEventListener("click", requestClose);
  prev.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  dialog.addEventListener("keydown", onKeydown);
  img.addEventListener("load", onImageLoad);
  img.addEventListener("error", () => img.classList.add("is-broken"));
  wireGestures(stage);

  return { dialog, stage, frame, img, close, prev, next, position };
}

function keyFromHash(hash) {
  return hash.startsWith(HASH_PREFIX) ? decodeURIComponent(hash.slice(HASH_PREFIX.length)) : null;
}

function hashFor(index) {
  return HASH_PREFIX + sequence[index].key;
}

function clearHash() {
  history.replaceState(null, "", location.pathname + location.search);
}

function themeMeta() {
  return document.querySelector('meta[name="theme-color"]');
}

function open(index, push) {
  if (!isOpen) {
    const meta = themeMeta();
    if (meta) {
      savedThemeColor = meta.content;
      meta.content = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    }
    document.documentElement.classList.add("viewer-open");
    dom.dialog.showModal();
    isOpen = true;
    if (push) {
      // Otherwise history.back() on close would restore the old scroll position
      // and undo the return-to-photo scroll.
      history.scrollRestoration = "manual";
      history.pushState({ viewer: true }, "", hashFor(index));
      pushed = true;
    } else {
      pushed = Boolean(history.state?.viewer);
    }
  }
  show(index);
}

function srcsetFor(photo) {
  return SIZES.map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
}

function show(index) {
  current = index;
  const entry = sequence[index];
  const { photo } = entry;

  dom.img.classList.remove("is-loaded", "is-broken");
  dom.img.alt = photo.alt || "";
  dom.frame.style.backgroundColor = photo.color || "transparent";
  fitCurrent();
  dom.img.srcset = srcsetFor(photo);
  dom.img.src = photo.src.md.url;

  dom.position.textContent = `${entry.title} · ${entry.index} / ${entry.count}`;
  dom.prev.disabled = index === 0;
  dom.next.disabled = index === sequence.length - 1;

  if (location.hash !== hashFor(index)) history.replaceState(history.state, "", hashFor(index));
  if (dom.img.complete && dom.img.naturalWidth > 0) onImageLoad();
}

function availableBox() {
  const style = getComputedStyle(dom.stage);
  return {
    width: dom.stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    height: dom.stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
  };
}

function fitSize(photo) {
  const { width, height } = availableBox();
  const aspect = photo.width / photo.height;
  const fitted = Math.min(width, height * aspect);
  return { width: Math.floor(fitted), height: Math.floor(fitted / aspect) };
}

function fitCurrent() {
  const size = fitSize(sequence[current].photo);
  dom.frame.style.width = `${size.width}px`;
  dom.frame.style.height = `${size.height}px`;
  dom.img.sizes = `${size.width}px`;
}

function onImageLoad() {
  // Ignore late loads from a photo the guest has already moved past.
  if (dom.img.srcset !== srcsetFor(sequence[current].photo)) return;
  dom.img.classList.add("is-loaded");
  preloadNeighbours(current);
}

function preloadNeighbours(index) {
  for (const i of [index + 1, index - 1]) {
    if (i < 0 || i >= sequence.length) continue;
    const pre = new Image();
    pre.sizes = `${fitSize(sequence[i].photo).width}px`;
    pre.srcset = srcsetFor(sequence[i].photo);
  }
}

function move(delta) {
  const index = current + delta;
  if (index >= 0 && index < sequence.length) show(index);
}

function onKeydown(event) {
  if (event.key === "ArrowRight") {
    move(1);
    event.preventDefault();
  } else if (event.key === "ArrowLeft") {
    move(-1);
    event.preventDefault();
  }
}

function wireGestures(stage) {
  let start = null;
  let swiped = false;

  stage.addEventListener("pointerdown", (event) => {
    start = { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener("pointercancel", () => {
    start = null;
  });
  stage.addEventListener("pointerup", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      move(dx < 0 ? 1 : -1);
    } else if (dy >= SWIPE_CLOSE && dy > Math.abs(dx)) {
      swiped = true;
      requestClose();
    }
  });
  stage.addEventListener("click", (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (event.target === stage) requestClose();
  });
}

function requestClose() {
  if (!isOpen) return;
  if (pushed) {
    history.back(); // closeUI runs in the popstate handler
  } else {
    clearHash();
    closeUI();
  }
}

function onPopState() {
  const key = keyFromHash(location.hash);
  if (key !== null && byKey.has(key)) {
    if (isOpen) show(byKey.get(key));
    else open(byKey.get(key), false);
  } else if (isOpen) {
    closeUI();
  }
}

function closeUI() {
  isOpen = false;
  pushed = false;
  dom.dialog.close();
  document.documentElement.classList.remove("viewer-open");
  const meta = themeMeta();
  if (meta && savedThemeColor) meta.content = savedThemeColor;

  // Return to the photo the guest was last viewing.
  const tile = document.querySelector(`.tile[data-photo="${CSS.escape(sequence[current].key)}"]`);
  if (tile) {
    const navBottom = document.getElementById("shoot-nav")?.getBoundingClientRect().bottom || 0;
    const rect = tile.getBoundingClientRect();
    if (rect.top < navBottom || rect.bottom > window.innerHeight) {
      tile.scrollIntoView({ block: "center", behavior: "instant" });
    }
    tile.querySelector(".tile__link")?.focus({ preventScroll: true });
  }
  requestAnimationFrame(() => {
    history.scrollRestoration = "auto";
  });
}
