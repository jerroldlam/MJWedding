/*
 * Quiz: "Which of our locations are you?" Seven questions whose answers each
 * count towards one location, ending on that location as the guest's result:
 * its card photo, numeral and colours, a few lines in the couple's voice and a
 * link into its photos. An invite under the location cards opens it.
 *
 * Addresses: "#/quiz" is the quiz (its start, or the question in progress) and
 * "#/quiz/<slug>" a result, so a result can be shared. pages.js shows the page
 * (with the pinned bar) and owns history; this module owns the steps, which
 * add no history entries, so back always leaves the quiz. Finishing rewrites
 * the current entry to the result's address with quizOwn in its state: the
 * guest's own result says "You're most like…", while a friend's link (no
 * quizOwn) invites them to take it. The attempt lives in memory only.
 * Words follow the language (i18n.js, quiz-content.js), relabelled on a switch.
 */

import { words, lang, placeName, onLanguageChange } from "./i18n.js";
import { cardPhoto, numeral } from "./locations.js";
import { QUESTIONS, RESULTS } from "./quiz-content.js";

const READY_EVENT = "photobook:gallery-ready";
export const QUIZ_PATH = "/quiz";
const SITE_TITLE = "Jerrold & May";
// How long the chosen answer shows before the next question
const CHOSEN_MS = 280;
const STATUS_MS = 3000;
const RESULT_SIZES = "(min-width: 52rem) 18rem, min(18rem, 72vw)";
const KEYS = Object.keys(RESULTS);

let page = null; // the page object pages.js shows; null until built
const spots = new Map(); // location key → its place in the book and card photo
const dom = {};
let attempt = null; // { order: each question's shuffled keys, answers, step }
let view = "start"; // "start" | "question" | "result"
let result = null; // { key, own }
let busy = false; // the chosen answer is showing
let tint = () => {}; // from pages.js: tints the page for a location (null = none)
let statusTimer = null;

export function isQuizPath(path) {
  return path === QUIZ_PATH || path.startsWith(`${QUIZ_PATH}/`);
}

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

// The quiz as a page for pages.js; null when it couldn't be built.
export function quizPage() {
  return page;
}

// pages.js calls this each time the quiz page shows: a result for a known
// slug, otherwise the question in progress or the start.
export function showQuiz(path, own, tintPage) {
  if (!page) return;
  tint = tintPage;
  const slug = path.slice(QUIZ_PATH.length + 1);
  const key = KEYS.find((k) => RESULTS[k].slug === slug);
  if (key) {
    showResult(key, own, { moved: false });
    return;
  }
  // A mangled or unknown result address shows the start instead
  if (slug) replaceAddress(QUIZ_PATH, false);
  tint(null);
  showStep(view === "question" ? "question" : "start", { moved: false });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function decorative(node) {
  node.setAttribute("aria-hidden", "true");
  return node;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setup(manifest) {
  const gallery = document.getElementById("gallery");
  const menu = document.getElementById("locations");
  if (!gallery || !menu) return;

  // Each location's place in the book (its numeral), as locations.js counts it
  let position = 0;
  for (const shoot of manifest.shoots) {
    for (const chapter of shoot.chapters) {
      const section = gallery.querySelector(
        `.chapter[data-shoot="${CSS.escape(shoot.id)}"][data-chapter="${CSS.escape(chapter.id)}"]`,
      );
      if (!section) continue;
      const key = `${shoot.id}/${chapter.id}`;
      const photo = cardPhoto(chapter);
      if (key in RESULTS && photo) {
        spots.set(key, {
          shoot,
          chapter,
          sectionId: section.id,
          route: section.dataset.route,
          position,
          count: chapter.photos.length,
          photo,
        });
      }
      position++;
    }
  }
  // All five or none: every result needs its location, every question an answer for each
  const complete = KEYS.every((key) => spots.has(key)) && QUESTIONS.every((q) => KEYS.every((key) => q.answers[key]));
  if (!complete) return;

  attempt = newAttempt();
  menu.append(buildInvite());
  gallery.after(buildSection());
  page = {
    kind: "quiz",
    route: QUIZ_PATH,
    section: dom.section,
    title: "", // set by pages.js
    get heading() {
      return currentHeading();
    },
  };
  applyWords();
  onLanguageChange(applyWords);
  // iOS Safari only applies :active (the press dip) when a touch listener exists.
  for (const node of [dom.invite, dom.section]) node.addEventListener("touchstart", () => {}, { passive: true });
}

// A small fan of the five card prints, in book order (decorative)
function fan(size) {
  const prints = decorative(el("span", "quiz-fan"));
  for (const { photo } of spots.values()) {
    const print = el("span", "quiz-fan__print");
    print.style.backgroundColor = photo.color || "transparent";
    const img = new Image();
    img.addEventListener("load", () => img.classList.add("is-loaded"));
    img.alt = "";
    img.width = photo.src.sm.width;
    img.height = photo.src.sm.height;
    img.loading = "lazy";
    img.decoding = "async";
    img.sizes = size;
    img.srcset = ["sm", "md"].map((s) => `${photo.src[s].url} ${photo.src[s].width}w`).join(", ");
    img.src = photo.src.sm.url;
    print.append(img);
    prints.append(print);
  }
  return prints;
}

// Under the location cards: an ivory mat like the next-location card.
// The words are filled in by applyWords().
function buildInvite() {
  const invite = el("a", "quiz-invite");
  invite.href = `#${QUIZ_PATH}`;
  invite.dataset.pageLink = QUIZ_PATH;
  const text = el("span", "quiz-invite__text");
  dom.inviteLabel = el("span", "quiz-invite__label");
  dom.inviteTitle = el("span", "quiz-invite__title");
  dom.inviteCaption = el("span", "quiz-invite__caption");
  dom.inviteCta = el("span", "quiz-invite__cta");
  text.append(dom.inviteLabel, dom.inviteTitle, dom.inviteCaption, dom.inviteCta);
  invite.append(fan("3.5rem"), text);
  dom.invite = invite;
  return invite;
}

// The quiz page: the start, a question, or the result, one at a time.
// The words are filled in by applyWords() and render().
function buildSection() {
  const section = el("section", "quiz");
  section.id = "quiz";
  section.hidden = true;
  section.setAttribute("aria-labelledby", "quiz-title");

  const start = el("div", "quiz__step quiz__start");
  dom.title = el("h2", "quiz__title");
  dom.title.id = "quiz-title";
  dom.title.tabIndex = -1;
  dom.intro = el("p", "quiz__intro");
  dom.begin = el("button", "quiz__button");
  dom.begin.type = "button";
  dom.begin.addEventListener("click", begin);
  start.append(dom.title, decorative(el("span", "quiz__divider")), dom.intro, fan("4.5rem"), dom.begin);

  const ask = el("div", "quiz__step quiz__ask");
  const progress = decorative(el("div", "quiz__progress"));
  dom.count = el("span", "quiz__count");
  dom.meter = el("span", "quiz__meter");
  progress.append(dom.count, dom.meter);
  // "Question 2 of 7:" is spoken, not shown (the count shows "2 / 7")
  dom.question = el("h2", "quiz__question");
  dom.question.tabIndex = -1;
  dom.questionOf = el("span", "visually-hidden");
  dom.questionText = el("span", "quiz__question-text");
  dom.question.append(dom.questionOf, dom.questionText);
  const list = el("ul", "quiz__answers");
  dom.answers = KEYS.map((_, index) => {
    const button = el("button", "quiz__answer");
    button.type = "button";
    button.addEventListener("click", () => choose(index));
    const item = el("li");
    item.append(button);
    list.append(item);
    return button;
  });
  dom.back = el("button", "quiz__back");
  dom.back.type = "button";
  dom.backLabel = el("span");
  dom.back.append(decorative(el("span", "", "‹")), " ", dom.backLabel);
  dom.back.addEventListener("click", previous);
  ask.append(progress, dom.question, list, dom.back);

  const end = el("div", "quiz__step quiz__result");
  dom.number = decorative(el("span", "quiz__number"));
  dom.heading = el("h2", "quiz__heading");
  dom.heading.tabIndex = -1;
  dom.label = el("span", "quiz__label");
  dom.name = el("span", "quiz__name");
  dom.heading.append(dom.label, dom.name);
  dom.tagline = el("p", "quiz__tagline");
  const body = el("div", "quiz__result-body");
  // The photo opens the location, like its card; "View N photos" is the same
  // link for keyboards and screen readers, so this one stays out of their way.
  dom.print = decorative(el("a", "quiz__print"));
  dom.print.tabIndex = -1;
  dom.photo = new Image();
  dom.photo.alt = ""; // decorative: the heading names the location
  dom.photo.decoding = "async";
  dom.photo.addEventListener("load", () => dom.photo.classList.add("is-loaded"));
  dom.print.append(dom.photo, decorative(el("span", "locations__line")), decorative(el("span", "locations__corners")));
  const textBlock = el("div", "quiz__result-text");
  dom.text = el("p", "quiz__text");
  const actions = el("div", "quiz__actions");
  dom.view = el("a", "quiz__view");
  dom.takeIt = el("button", "quiz__button");
  dom.share = el("button", "quiz__button");
  dom.retake = el("button", "quiz__quiet");
  for (const button of [dom.takeIt, dom.share, dom.retake]) button.type = "button";
  dom.takeIt.addEventListener("click", restart);
  dom.share.addEventListener("click", share);
  dom.retake.addEventListener("click", restart);
  actions.append(dom.view, dom.takeIt, dom.share, dom.retake);
  dom.status = el("p", "quiz__status");
  dom.status.setAttribute("role", "status");
  textBlock.append(dom.text, actions, dom.status);
  body.append(dom.print, textBlock);
  end.append(dom.number, dom.heading, dom.tagline, body);

  dom.steps = { start, question: ask, result: end };
  for (const step of [ask, end]) step.hidden = true;
  section.append(start, ask, end);
  dom.section = section;
  return section;
}

function newAttempt() {
  return { order: QUESTIONS.map(() => shuffle([...KEYS])), answers: QUESTIONS.map(() => null), step: 0 };
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function currentHeading() {
  return { start: dom.title, question: dom.question, result: dom.heading }[view];
}

// Shows one step. Arriving on the page (moved: false), pages.js scrolls and
// focuses; within the quiz, the step fades in at the top with its heading focused.
function showStep(name, { moved = true } = {}) {
  view = name;
  for (const [key, step] of Object.entries(dom.steps)) step.hidden = key !== name;
  render();
  if (!moved) return;
  const step = dom.steps[name];
  step.classList.remove("is-entering");
  void step.offsetWidth; // restarts the entrance
  step.classList.add("is-entering");
  window.scrollTo({ top: 0, behavior: "instant" });
  currentHeading().focus({ preventScroll: true });
}

function begin() {
  attempt = newAttempt();
  showStep("question");
}

function choose(index) {
  if (busy || view !== "question") return;
  const { step, order } = attempt;
  attempt.answers[step] = order[step][index];
  dom.answers.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  busy = true;
  setTimeout(
    () => {
      busy = false;
      // Left the page during the pause: the answer waits for their return
      if (dom.section.hidden) return;
      if (step + 1 < QUESTIONS.length) {
        attempt.step = step + 1;
        showStep("question");
      } else {
        finish();
      }
    },
    prefersReducedMotion() ? 0 : CHOSEN_MS,
  );
}

function previous() {
  if (attempt.step === 0) return;
  attempt.step -= 1;
  showStep("question");
}

function finish() {
  const key = score(attempt.answers);
  replaceAddress(`${QUIZ_PATH}/${RESULTS[key].slug}`, true);
  attempt = newAttempt(); // back at "#/quiz" later, it starts afresh
  showResult(key, true);
}

// "Take the quiz again", and a friend's "Which are you?"
function restart() {
  replaceAddress(QUIZ_PATH, false);
  tint(null);
  begin();
}

function showResult(key, own, options) {
  result = { key, own };
  const { photo, route, sectionId } = spots.get(key);
  dom.print.style.backgroundColor = photo.color || "transparent";
  dom.print.href = `#${route}`;
  dom.print.dataset.pageLink = route;
  // A new photo fades in when it loads, as on the cards
  if (dom.photo.getAttribute("src") !== photo.src.md.url) dom.photo.classList.remove("is-loaded");
  dom.photo.width = photo.src.md.width;
  dom.photo.height = photo.src.md.height;
  dom.photo.sizes = RESULT_SIZES;
  dom.photo.srcset = ["sm", "md", "lg"].map((s) => `${photo.src[s].url} ${photo.src[s].width}w`).join(", ");
  dom.photo.src = photo.src.md.url;
  dom.view.href = `#${route}`;
  dom.view.dataset.pageLink = route;
  dom.share.hidden = !own || !canShare();
  dom.retake.hidden = !own;
  dom.takeIt.hidden = own;
  dom.status.textContent = "";
  tint(sectionId);
  showStep("result", options);
}

// One point per answer to its location; a tie goes to the tied location
// chosen latest, so question 7 has the last word whenever it's tied.
function score(answers) {
  const counts = new Map();
  for (const key of answers) counts.set(key, (counts.get(key) || 0) + 1);
  const best = Math.max(...counts.values());
  for (let i = answers.length - 1; i >= 0; i--) {
    if (counts.get(answers[i]) === best) return answers[i];
  }
  return answers[answers.length - 1];
}

// Rewrites the current history entry's address (and its own-result flag);
// the entry's other state (depth, scroll) and ?lang= stay.
function replaceAddress(path, own) {
  const state = { ...(history.state || {}) };
  delete state.quizOwn;
  if (own) state.quizOwn = true;
  history.replaceState(state, "", `#${path}`);
}

function canShare() {
  return typeof navigator.share === "function" || typeof navigator.clipboard?.writeText === "function";
}

// The phone's own share sheet, or else the link copied
async function share() {
  if (!result) return;
  const { shoot, chapter } = spots.get(result.key);
  const text = words().quizShareText(placeName(shoot.id, chapter.id, chapter.title));
  const url = location.href;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: SITE_TITLE, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    dom.status.textContent = words().quizCopied;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      dom.status.textContent = "";
    }, STATUS_MS);
  } catch (error) {
    // Closing the share sheet isn't a failure
    if (error?.name !== "AbortError") console.error("[photobook] quiz share failed", error);
  }
}

// The current step's words: the question with its answers in this attempt's
// order, or the result. Shared by the steps and the language switch.
function render() {
  const w = words();
  const language = lang();
  if (view === "question") {
    const { step, order, answers } = attempt;
    const question = QUESTIONS[step];
    dom.count.textContent = `${step + 1} / ${QUESTIONS.length}`;
    dom.meter.style.setProperty("--progress", String((step + 1) / QUESTIONS.length));
    dom.questionOf.textContent = w.quizQuestionOf(step + 1, QUESTIONS.length);
    dom.questionText.textContent = question[language];
    order[step].forEach((key, index) => {
      dom.answers[index].textContent = question.answers[key][language];
      dom.answers[index].setAttribute("aria-pressed", String(answers[step] === key));
    });
    dom.back.classList.toggle("is-first", step === 0);
  } else if (view === "result" && result) {
    const { shoot, chapter, position, count } = spots.get(result.key);
    const content = RESULTS[result.key];
    dom.number.textContent = numeral(position);
    dom.label.textContent = result.own ? w.quizYouAre : w.quizFriendIs;
    dom.name.textContent = placeName(shoot.id, chapter.id, chapter.title);
    dom.tagline.textContent = content.tagline[language];
    dom.text.textContent = content.text[language];
    dom.view.textContent = w.viewPhotos(w.photoCount(count));
  }
}

// Labels in the current language; runs at setup and on every language switch.
function applyWords() {
  const w = words();
  dom.inviteLabel.textContent = w.quizInviteLabel;
  dom.inviteTitle.textContent = w.quizTitle;
  dom.inviteCaption.textContent = w.quizInviteCaption;
  dom.inviteCta.textContent = w.quizInviteCta;
  dom.invite.setAttribute("aria-label", w.quizInviteSpoken);
  dom.title.textContent = w.quizTitle;
  dom.intro.textContent = w.quizIntro;
  dom.begin.textContent = w.quizBegin;
  dom.backLabel.textContent = w.quizPrevious;
  dom.takeIt.textContent = w.quizTakeIt;
  dom.share.textContent = w.quizShare;
  dom.retake.textContent = w.quizRetake;
  dom.status.textContent = "";
  render();
}
