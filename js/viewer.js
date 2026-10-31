/*
 * Full-screen photo viewer: opens any tile in a dark modal <dialog>, moves
 * through the current location's photos (swipe, arrow keys, buttons), and
 * closes via ✕, Esc, swipe down, a click outside the photo or the back button.
 * Each photo has a shareable address (#photo/<shoot>/<chapter>/<photo>).
 * History: one entry is pushed on open; moves replace it; close goes back.
 * Page history and scroll restoration belong to pages.js.
 * Opening from a tile grows the photo out of it; closing shrinks it back into
 * the tile of the photo last viewed (skipped when reduced motion is preferred).
 * The photo can be zoomed (up to 3x) and moved around: pinch, double-tap or a
 * one-finger drag on touch screens; double-click, mouse drag, trackpad pinch,
 * and Esc to zoom back out on computers. Swipes only move or close at the
 * normal size.
 */

import { words, placeName, onLanguageChange } from "./i18n.js";
import { parseHash, routeFor } from "./routes.js";

const READY_EVENT = "photobook:gallery-ready";
const HASH_PREFIX = "#photo/";
const SIZES = ["sm", "md", "lg"];
const SWIPE_MIN = 50;
const SWIPE_CLOSE = 80;
const FLY_MS = 380;
const FLY_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const MAX_ZOOM = 3;
const TAP_ZOOM = 2.5;
// The longest touch that still counts as a tap, and the longest gap between
// the two taps of a double-tap.
const TAP_MS = 300;
const TAP_SLOP = 10;
const DOUBLE_TAP_PX = 30;
const SETTLE_SCALE = 1.01;
const WHEEL_ZOOM_RATE = 0.01;
const WHEEL_SETTLE_MS = 150;

let sequence = [];
let byKey = new Map();
let current = -1;
let isOpen = false;
// True when this viewer's history entry was pushed by us (so closing goes back).
let pushed = false;
let savedThemeColor = null;
let dom = null;
// Ends a running shrink-back at once (e.g. reopened before it finished).
let finishClosing = null;
let growing = [];
// Zoom of the current photo (1 = fitted); offsets are px from its resting centre.
let zoom = { scale: 1, x: 0, y: 0 };
// The photo whose image was asked for a sharper file when it was zoomed.
let sharpFor = -1;
// Stage geometry, measured when a gesture starts.
let geom = null;
// Touch gestures: active fingers, the first finger's start, and pinch state.
let touches = new Map();
let gesture = null;
let pinch = null;
let multi = false;
let lastTap = null;
// Desktop: phones may follow a double-tap with a dblclick, which is ignored.
let lastPointerType = "";
let wheelSettle = null;
let gestureBase = 0;

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

function setup(manifest) {
  sequence = buildSequence(manifest);
  byKey = new Map(sequence.map((entry, index) => [entry.key, index]));
  dom = buildDialog();
  applyWords();
  onLanguageChange(applyWords);
  document.body.append(dom.dialog);

  document.getElementById("gallery")?.addEventListener("click", (event) => {
    const tile = event.target.closest("a.tile__link")?.closest(".tile");
    const key = tile?.dataset.photo;
    if (!byKey.has(key)) return;
    event.preventDefault();
    open(byKey.get(key), true, tile);
  });
  window.addEventListener("popstate", onPopState);
  window.addEventListener("resize", () => {
    if (!isOpen) return;
    resetZoom();
    fitCurrent();
  });

  // pages.js has already cleaned out dead photo links.
  const key = keyFromHash(location.hash);
  if (key !== null && byKey.has(key)) open(byKey.get(key), false);
}

// Every photo in book order; start/end bound each one's location, so moving
// stays within the page it was opened from.
function buildSequence(manifest) {
  const entries = [];
  for (const shoot of manifest.shoots) {
    for (const chapter of shoot.chapters) {
      const start = entries.length;
      const end = start + chapter.photos.length - 1;
      const route = routeFor(shoot.id, chapter.id, shoot.chapters.length === 1 && chapter.id === shoot.id);
      chapter.photos.forEach((photo, i) => {
        entries.push({
          key: `${shoot.id}/${chapter.id}/${photo.id}`,
          photo,
          shootId: shoot.id,
          chapterId: chapter.id,
          title: chapter.title, // English; the position line uses placeName()
          index: i + 1,
          count: chapter.photos.length,
          start,
          end,
          route,
        });
      });
    }
  }
  return entries;
}

function el(tag, className, attrs = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  return node;
}

function button(className, iconClass) {
  const node = el("button", className, { type: "button" });
  node.append(el("span", iconClass, { "aria-hidden": "true" }));
  return node;
}

function buildDialog() {
  // Labels are set by applyWords().
  const dialog = el("dialog", "viewer");
  const stage = el("div", "viewer__stage");
  const frame = el("figure", "viewer__frame");
  const img = el("img", "viewer__img", { alt: "", decoding: "async" });
  frame.append(img);
  stage.append(frame);

  const close = button("viewer__close", "viewer__icon viewer__icon--close");
  const prev = button("viewer__prev", "viewer__icon viewer__icon--prev");
  const next = button("viewer__next", "viewer__icon viewer__icon--next");
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

// Labels in the current language; runs at setup and on every language switch
// (the switches sit under the open viewer, so never while it's showing).
function applyWords() {
  const w = words();
  dom.dialog.setAttribute("aria-label", w.viewer);
  dom.close.setAttribute("aria-label", w.close);
  dom.prev.setAttribute("aria-label", w.previousPhoto);
  dom.next.setAttribute("aria-label", w.nextPhoto);
}

function keyFromHash(hash) {
  const route = parseHash(hash);
  return route.kind === "photo" ? route.photoKey : null;
}

function hashFor(index) {
  return HASH_PREFIX + sequence[index].key;
}

// A photo opened straight from a link (no entry of ours to go back to) leaves
// the address on its location page.
function restoreRoute() {
  history.replaceState(history.state, "", `#${sequence[current].route}`);
}

function themeMeta() {
  return document.querySelector('meta[name="theme-color"]');
}

function open(index, push, fromTile = null) {
  finishClosing?.();
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
      history.pushState({ viewer: true }, "", hashFor(index));
      pushed = true;
    } else {
      pushed = Boolean(history.state?.viewer);
    }
    show(index);
    if (fromTile && wantsMotion()) growing = fly(fromTile, true);
    return;
  }
  show(index);
}

function wantsMotion() {
  return !window.matchMedia(REDUCED_MOTION).matches && typeof dom.frame.animate === "function";
}

// Moves the photo between its tile and its full-screen place while the dark
// background and the controls fade, so it's clear the photo opens from the page.
function fly(tile, opening) {
  const from = tile.getBoundingClientRect();
  const to = dom.frame.getBoundingClientRect();
  if (!from.width || !to.width) return [];

  const atTile = {
    transformOrigin: "0 0",
    transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`,
  };
  const atFull = { transformOrigin: "0 0", transform: "none" };
  const backdrop = getComputedStyle(dom.dialog).backgroundColor;
  const order = (tileState, fullState) => (opening ? [tileState, fullState] : [fullState, tileState]);
  // A closing animation holds its end state until the dialog is closed.
  const timing = { duration: FLY_MS, easing: FLY_EASE, fill: opening ? "none" : "forwards" };

  return [
    dom.frame.animate(order(atTile, atFull), timing),
    dom.dialog.animate(order({ backgroundColor: "transparent" }, { backgroundColor: backdrop }), timing),
    ...[dom.close, dom.prev, dom.next, dom.position].map((node) =>
      node.animate(order({ opacity: 0 }, { opacity: getComputedStyle(node).opacity }), timing),
    ),
  ];
}

function srcsetFor(photo) {
  return SIZES.map((size) => `${photo.src[size].url} ${photo.src[size].width}w`).join(", ");
}

function show(index) {
  resetZoom();
  current = index;
  const entry = sequence[index];
  const { photo } = entry;

  const tileImg = tileImage(entry.key);
  dom.img.classList.remove("is-loaded", "is-broken");
  // The gallery builds the positional description; reuse it so both match.
  dom.img.alt = tileImg?.alt || photo.alt || "";
  dom.frame.style.backgroundColor = photo.color || "transparent";
  // The tile's already-downloaded image stands in while the larger one loads.
  dom.frame.style.backgroundImage = tileImg?.currentSrc ? `url("${tileImg.currentSrc}")` : "none";
  fitCurrent();
  dom.img.srcset = srcsetFor(photo);
  dom.img.src = photo.src.md.url;

  dom.position.textContent = `${placeName(entry.shootId, entry.chapterId, entry.title)} · ${entry.index} / ${entry.count}`;
  dom.prev.disabled = index === entry.start;
  dom.next.disabled = index === entry.end;

  if (location.hash !== hashFor(index)) history.replaceState(history.state, "", hashFor(index));
  if (dom.img.complete && dom.img.naturalWidth > 0) onImageLoad();
}

function tileFor(key) {
  return document.querySelector(`.tile[data-photo="${CSS.escape(key)}"]`);
}

function tileImage(key) {
  return tileFor(key)?.querySelector("img");
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
  const { start, end } = sequence[index];
  for (const i of [index + 1, index - 1]) {
    if (i < start || i > end) continue;
    const pre = new Image();
    pre.sizes = `${fitSize(sequence[i].photo).width}px`;
    pre.srcset = srcsetFor(sequence[i].photo);
  }
}

function move(delta) {
  if (!isOpen) return; // the photo is shrinking back into the page
  const { start, end } = sequence[current];
  const index = current + delta;
  if (index >= start && index <= end) show(index);
}

function onKeydown(event) {
  // Esc zooms back out first; cancelling the key keeps the dialog open.
  if (event.key === "Escape" && zoom.scale > 1) {
    event.preventDefault();
    setZoom(1, 0, 0, true);
    return;
  }
  if (event.key === "ArrowRight") {
    move(1);
    event.preventDefault();
  } else if (event.key === "ArrowLeft") {
    move(-1);
    event.preventDefault();
  }
}

// Mouse and pen swipe at the normal size and pan while zoomed; touch has its
// own path (pinch, pan, double-tap and the same swipes).
function wireGestures(stage) {
  let start = null;
  let swiped = false;

  // A sideways swipe moves; a downward one closes.
  function swipe(dx, dy) {
    if (Math.abs(dx) >= SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
      swiped = true;
      move(dx < 0 ? 1 : -1);
    } else if (dy >= SWIPE_CLOSE && dy > Math.abs(dx)) {
      swiped = true;
      requestClose();
    }
  }

  function touchDown(event) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    dom.frame.classList.remove("is-settling");
    if (touches.size === 1) {
      multi = false;
      geom = measureStage();
      gesture = { x: event.clientX, y: event.clientY, t: event.timeStamp, fromX: zoom.x, fromY: zoom.y };
    } else if (touches.size === 2) {
      multi = true;
      startPinch();
    }
  }

  function touchMove(event) {
    const point = touches.get(event.pointerId);
    if (!point) return;
    point.x = event.clientX;
    point.y = event.clientY;
    if (pinch && touches.size >= 2) {
      const [a, b] = touches.values();
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const scale = Math.min(Math.max((pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist, 1), MAX_ZOOM);
      // Keeps the point that started between the fingers under them as they move.
      const ratio = scale / pinch.scale;
      setZoom(
        scale,
        midX - geom.cx - ratio * (pinch.midX - geom.cx - pinch.x),
        midY - geom.cy - ratio * (pinch.midY - geom.cy - pinch.y),
      );
    } else if (touches.size === 1 && gesture && zoom.scale > 1) {
      setZoom(zoom.scale, gesture.fromX + (event.clientX - gesture.x), gesture.fromY + (event.clientY - gesture.y));
    }
  }

  function touchUp(event, cancelled) {
    if (!touches.delete(event.pointerId)) return;
    if (touches.size === 1) {
      // The pinch carries on as a pan from the finger still down.
      pinch = null;
      const [rest] = touches.values();
      gesture = { x: rest.x, y: rest.y, t: event.timeStamp, fromX: zoom.x, fromY: zoom.y };
      return;
    }
    if (touches.size > 1) return;

    const g = gesture;
    gesture = null;
    pinch = null;
    if (cancelled || !g) {
      settle();
      return;
    }
    const dx = event.clientX - g.x;
    const dy = event.clientY - g.y;
    const isTap =
      !multi && Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP && event.timeStamp - g.t <= TAP_MS;
    if (multi || zoom.scale > 1) {
      if (!isTap) swiped = true;
      settle();
      if (isTap) handleTap(event);
      return;
    }
    if (isTap) handleTap(event);
    else swipe(dx, dy);
  }

  stage.addEventListener("pointerdown", (event) => {
    if (!isOpen) return;
    lastPointerType = event.pointerType;
    if (event.pointerType === "touch") {
      touchDown(event);
      return;
    }
    geom = measureStage();
    dom.frame.classList.remove("is-settling");
    start = { x: event.clientX, y: event.clientY, fromX: zoom.x, fromY: zoom.y };
  });
  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") touchMove(event);
    else if (start && zoom.scale > 1 && event.buttons) {
      setZoom(zoom.scale, start.fromX + (event.clientX - start.x), start.fromY + (event.clientY - start.y));
    }
  });
  stage.addEventListener("pointercancel", (event) => {
    if (event.pointerType === "touch") touchUp(event, true);
    else start = null;
  });
  stage.addEventListener("pointerup", (event) => {
    if (event.pointerType === "touch") {
      touchUp(event, false);
      return;
    }
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (zoom.scale > 1) {
      // A drag while zoomed was a pan, not a click.
      if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) swiped = true;
      return;
    }
    swipe(dx, dy);
  });
  stage.addEventListener("click", (event) => {
    if (swiped) {
      swiped = false;
      return;
    }
    if (event.target === stage) requestClose();
  });
  stage.addEventListener("dblclick", onDoubleClick);
  stage.addEventListener("wheel", onWheel, { passive: false });
  // Safari reports a trackpad pinch as gesture events.
  stage.addEventListener("gesturestart", onGestureStart);
  stage.addEventListener("gesturechange", onGestureChange);
  stage.addEventListener("gestureend", onGestureEnd);
  // Dragging the photo pans or swipes rather than dragging a copy of the image.
  stage.addEventListener("dragstart", (event) => event.preventDefault());
}

function startPinch() {
  const [a, b] = touches.values();
  pinch = {
    dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    scale: zoom.scale,
    x: zoom.x,
    y: zoom.y,
  };
}

// A double-tap on the photo toggles zoom; any other tap is left to the click
// handler (a tap on the bare stage closes).
function handleTap(event) {
  if (!dom.frame.contains(event.target)) {
    lastTap = null;
    return;
  }
  if (
    lastTap &&
    event.timeStamp - lastTap.t <= TAP_MS &&
    Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) <= DOUBLE_TAP_PX
  ) {
    lastTap = null;
    toggleZoomAt(event.clientX, event.clientY);
  } else {
    lastTap = { t: event.timeStamp, x: event.clientX, y: event.clientY };
  }
}

function onDoubleClick(event) {
  if (!isOpen || lastPointerType === "touch" || !dom.frame.contains(event.target)) return;
  toggleZoomAt(event.clientX, event.clientY);
}

// Chrome, Edge and Firefox report a trackpad pinch as a wheel with ctrlKey.
function onWheel(event) {
  if (!isOpen || !event.ctrlKey) return;
  event.preventDefault();
  dom.frame.classList.remove("is-settling");
  geom = measureStage();
  zoomAround(zoom.scale * Math.exp(-event.deltaY * WHEEL_ZOOM_RATE), event.clientX, event.clientY, false);
  clearTimeout(wheelSettle);
  wheelSettle = setTimeout(settle, WHEEL_SETTLE_MS);
}

// iOS fires these alongside a touch pinch, which the touch path already handles.
function onGestureStart(event) {
  if (!isOpen || touches.size > 0) return;
  event.preventDefault();
  geom = measureStage();
  gestureBase = zoom.scale;
}

function onGestureChange(event) {
  if (!isOpen || touches.size > 0 || !gestureBase) return;
  event.preventDefault();
  zoomAround(gestureBase * event.scale, event.clientX, event.clientY, false);
}

function onGestureEnd(event) {
  if (!isOpen || touches.size > 0) return;
  event.preventDefault();
  gestureBase = 0;
  settle();
}

function toggleZoomAt(x, y) {
  geom = measureStage();
  if (zoom.scale > 1) setZoom(1, 0, 0, true);
  else zoomAround(TAP_ZOOM, x, y, true);
}

// A zoom that ends just above the normal size settles back to it.
function settle() {
  if (zoom.scale < SETTLE_SCALE) setZoom(1, 0, 0, true);
}

function resetZoom() {
  zoom = { scale: 1, x: 0, y: 0 };
  sharpFor = -1;
  if (dom) {
    dom.frame.style.transform = "";
    dom.frame.classList.remove("is-settling");
  }
  touches.clear();
  gesture = null;
  pinch = null;
  multi = false;
  lastTap = null;
  clearTimeout(wheelSettle);
  wheelSettle = null;
  gestureBase = 0;
}

// The frame's resting centre, its fitted size and the stage's edges.
function measureStage() {
  const rect = dom.stage.getBoundingClientRect();
  const style = getComputedStyle(dom.stage);
  const padLeft = parseFloat(style.paddingLeft);
  const padRight = parseFloat(style.paddingRight);
  const padTop = parseFloat(style.paddingTop);
  const padBottom = parseFloat(style.paddingBottom);
  return {
    cx: rect.left + padLeft + (rect.width - padLeft - padRight) / 2,
    cy: rect.top + padTop + (rect.height - padTop - padBottom) / 2,
    fw: parseFloat(dom.frame.style.width),
    fh: parseFloat(dom.frame.style.height),
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  };
}

// Larger than the stage: its edges can't come inside the stage's edges.
// Smaller: it stays centred in the stage.
function clampOffset(offset, size, centre, lo, hi) {
  if (size <= hi - lo) return (lo + hi) / 2 - centre;
  return Math.min(Math.max(offset, hi - centre - size / 2), lo - centre + size / 2);
}

function setZoom(scale, x, y, settling = false) {
  geom ??= measureStage();
  const s = Math.min(Math.max(scale, 1), MAX_ZOOM);
  zoom =
    s <= 1
      ? { scale: 1, x: 0, y: 0 }
      : {
          scale: s,
          x: clampOffset(x, s * geom.fw, geom.cx, geom.left, geom.right),
          y: clampOffset(y, s * geom.fh, geom.cy, geom.top, geom.bottom),
        };
  dom.frame.classList.toggle("is-settling", settling);
  dom.frame.style.transform =
    zoom.scale === 1 ? "" : `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
  if (zoom.scale > 1) ensureSharp();
}

// Zooms to `scale`, keeping the screen point (px, py) over the same spot of the photo.
function zoomAround(scale, px, py, settling) {
  const s = Math.min(Math.max(scale, 1), MAX_ZOOM);
  const ratio = s / zoom.scale;
  setZoom(s, px - geom.cx - ratio * (px - geom.cx - zoom.x), py - geom.cy - ratio * (py - geom.cy - zoom.y), settling);
}

// The first zoom of a photo asks for a file sharp enough at full zoom; the
// browser keeps showing the current one until it arrives.
function ensureSharp() {
  if (sharpFor === current) return;
  dom.img.sizes = `${Math.round(parseFloat(dom.frame.style.width) * MAX_ZOOM)}px`;
  sharpFor = current;
}

function requestClose() {
  if (!isOpen) return;
  if (pushed) {
    history.back(); // closeUI runs in the popstate handler
  } else {
    restoreRoute();
    closeUI();
  }
}

function onPopState() {
  const key = keyFromHash(location.hash);
  if (key !== null && byKey.has(key)) {
    if (isOpen) show(byKey.get(key));
    else open(byKey.get(key), false);
    return;
  }
  // pages.js has already sent dead photo links to the contents.
  if (isOpen) closeUI();
}

function closeUI() {
  isOpen = false;
  pushed = false;
  // The shrink back into the tile starts from the fitted, unzoomed photo.
  resetZoom();
  // Closed mid-grow: measure from the photo's resting place, not mid-flight.
  growing.forEach((animation) => animation.cancel());
  growing = [];
  document.documentElement.classList.remove("viewer-open");
  const meta = themeMeta();
  if (meta && savedThemeColor) meta.content = savedThemeColor;

  // Return to the photo the guest was last viewing.
  const tile = tileFor(sequence[current].key);
  if (tile) {
    showRowNow(tile);
    const navBottom = document.getElementById("page-bar")?.getBoundingClientRect().bottom || 0;
    const rect = tile.getBoundingClientRect();
    if (rect.top < navBottom || rect.bottom > window.innerHeight) {
      tile.scrollIntoView({ block: "center", behavior: "instant" });
    }
  }

  const animations = tile && wantsMotion() ? fly(tile, false) : [];
  let finished = false;
  finishClosing = () => {
    if (finished) return;
    finished = true;
    finishClosing = null;
    dom.dialog.close();
    animations.forEach((animation) => animation.cancel());
    tile?.querySelector(".tile__link")?.focus({ preventScroll: true });
  };
  if (animations.length) animations[0].finished.then(finishClosing, () => {});
  else finishClosing();
}

// A row still waiting for its scroll-in reveal (gallery.js) is invisible; show
// it at once so the photo has somewhere visible to land.
function showRowNow(tile) {
  const row = tile.closest(".spread__row.is-pending");
  if (!row) return;
  row.style.transition = "none";
  row.classList.remove("is-pending");
  row.getBoundingClientRect();
  row.style.transition = "";
}
