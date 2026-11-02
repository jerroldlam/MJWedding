/*
 * Couple quiz: "Who's more likely to…?" Ten questions about Jerrold and May,
 * in a fresh random order on every attempt. The guest picks Jerrold or May
 * (each shown with their Studio portrait), sees the couple's answer straight
 * away, and ends on a score out of 10 with a playful title. An invite beside
 * the location quiz's opens it.
 *
 * Addresses: "#/who" is the quiz (its start, or the question in progress) and
 * "#/who/<0–10>" a score, so a score can be shared. pages.js shows the page
 * (with the pinned bar) through the page object's owns() and show(), and owns
 * history; this module owns the steps, which add no history entries, so back
 * always leaves the quiz. Finishing rewrites the current entry to the score's
 * address with quizOwn in its state: the guest's own score says "You scored",
 * while a friend's link (no quizOwn) invites them to take it. The attempt
 * lives in memory only. Words follow the language (i18n.js,
 * couple-quiz-content.js), relabelled on a switch.
 */

import { words, lang, onLanguageChange } from "./i18n.js";
import { PEOPLE, QUESTIONS, BANDS } from "./couple-quiz-content.js";
import { shuffle, replaceAddress, canShare, share, inviteRow } from "./quiz-common.js";

const READY_EVENT = "photobook:gallery-ready";
const WHO_PATH = "/who";
const SITE_TITLE = "Jerrold & May";
const ORDER = ["jerrold", "may"]; // the choices, always in this order
const SCORE = /^(?:10|[0-9])$/;

let page = null; // the page object pages.js shows; null until built
const dom = { ors: [] };
const photos = {}; // person → their portrait in the manifest (null if missing)
let attempt = null; // { order: question indexes, picks: "jerrold" | "may" | null, step }
let view = "start"; // "start" | "question" | "result"
let result = null; // { score, own }
let tint = () => {}; // from pages.js: tints the page for a location (null = none)

function isWhoPath(path) {
  return path === WHO_PATH || path.startsWith(`${WHO_PATH}/`);
}

export function init() {
  document.addEventListener(READY_EVENT, (event) => setup(event.detail.manifest), { once: true });
}

// The quiz as a page for pages.js; null when it couldn't be built.
export function whoPage() {
  return page;
}

// pages.js calls this (the page's show()) each time the quiz page shows: a
// score for a plain 0–10, otherwise the question in progress or the start.
function showWho(path, own, tintPage) {
  if (!page) return;
  tint = tintPage;
  tint(null);
  const part = path.slice(WHO_PATH.length + 1);
  if (SCORE.test(part)) {
    showResult(Number(part), own, { moved: false });
    return;
  }
  // A mangled score address shows the start instead
  if (part) replaceAddress(WHO_PATH, false);
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

function findPhoto(manifest, id) {
  for (const shoot of manifest.shoots) {
    for (const chapter of shoot.chapters) {
      const photo = chapter.photos.find((p) => p.id === id);
      if (photo) return photo;
    }
  }
  return null;
}

function setup(manifest) {
  const gallery = document.getElementById("gallery");
  const menu = document.getElementById("locations");
  if (!gallery || !menu) return;

  attempt = newAttempt();
  for (const person of ORDER) photos[person] = findPhoto(manifest, PEOPLE[person].photo);
  inviteRow(menu).append(buildInvite());
  // After the location quiz's page, when there is one
  (document.getElementById("quiz") ?? gallery).after(buildSection());
  page = {
    kind: "quiz",
    route: WHO_PATH,
    section: dom.section,
    owns: isWhoPath,
    show: showWho,
    get title() {
      return words().whoPageTitle;
    },
    get heading() {
      return currentHeading();
    },
  };
  applyWords();
  onLanguageChange(applyWords);
  // iOS Safari only applies :active (the press dip) when a touch listener exists.
  for (const node of [dom.invite, dom.section]) node.addEventListener("touchstart", () => {}, { passive: true });
}

// "J or M", echoing the site's monogram (decorative)
function mark() {
  const or = el("span", "who-mark__or");
  dom.ors.push(or);
  const node = decorative(el("span", "who-mark"));
  node.append(el("span", "who-mark__letter", "J"), or, el("span", "who-mark__letter", "M"));
  return node;
}

// Under the location quiz's invite: the same linen mat, with the mark in
// place of the photos. The words are filled in by applyWords().
function buildInvite() {
  const invite = el("a", "quiz-invite quiz-invite--who");
  invite.href = `#${WHO_PATH}`;
  invite.dataset.pageLink = WHO_PATH;
  const text = el("span", "quiz-invite__text");
  dom.inviteLabel = el("span", "quiz-invite__label");
  dom.inviteTitle = el("span", "quiz-invite__title");
  dom.inviteCaption = el("span", "quiz-invite__caption");
  dom.inviteCta = el("span", "quiz-invite__cta");
  text.append(dom.inviteLabel, dom.inviteTitle, dom.inviteCaption, dom.inviteCta);
  invite.append(mark(), text);
  dom.invite = invite;
  return invite;
}

// The quiz page: the start, a question (with its reveal), or the score, one
// at a time. The words are filled in by applyWords() and render().
function buildSection() {
  const section = el("section", "quiz quiz--who");
  section.id = "who";
  section.hidden = true;
  section.setAttribute("aria-labelledby", "who-title");

  const start = el("div", "quiz__step quiz__start");
  dom.title = el("h2", "quiz__title");
  dom.title.id = "who-title";
  dom.title.tabIndex = -1;
  dom.intro = el("p", "quiz__intro");
  const bigMark = mark();
  bigMark.classList.add("who-mark--large");
  dom.begin = el("button", "quiz__button");
  dom.begin.type = "button";
  dom.begin.addEventListener("click", begin);
  start.append(dom.title, decorative(el("span", "quiz__divider")), dom.intro, bigMark, dom.begin);

  const ask = el("div", "quiz__step quiz__ask");
  const progress = decorative(el("div", "quiz__progress"));
  dom.count = el("span", "quiz__count");
  dom.meter = el("span", "quiz__meter");
  progress.append(dom.count, dom.meter);
  // "Question 3 of 10:" is spoken, not shown (the count shows "3 / 10")
  dom.question = el("h2", "quiz__question");
  dom.question.tabIndex = -1;
  dom.questionOf = el("span", "visually-hidden");
  dom.lead = el("span", "who__lead");
  dom.questionText = el("span", "quiz__question-text");
  dom.question.append(dom.questionOf, dom.lead, dom.questionText);
  const list = el("ul", "who__choices");
  dom.choices = ORDER.map((person) => {
    const button = el("button", "quiz__answer who__choice");
    button.type = "button";
    button.dataset.person = person;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => choose(person));
    if (photos[person]) button.append(portrait(photos[person], PEOPLE[person].crop));
    // After a guess, a tag says which card is the answer and which the guess
    const tag = el("span", "who__choice-tag");
    tag.hidden = true;
    button.append(el("span", "who__choice-name"), tag);
    const item = el("li");
    item.append(button);
    list.append(item);
    return button;
  });
  dom.reveal = el("div", "who__reveal");
  dom.reveal.hidden = true;
  dom.verdict = el("p", "who__verdict");
  dom.verdict.tabIndex = -1;
  dom.next = el("button", "quiz__button");
  dom.next.type = "button";
  dom.next.addEventListener("click", next);
  dom.reveal.append(dom.verdict, dom.next);
  ask.append(progress, dom.question, list, dom.reveal);

  const end = el("div", "quiz__step quiz__result");
  // The Our story pieces, cloned so their shared seam stays in index.html
  const puzzle = document.querySelector(".about__puzzle")?.cloneNode(true);
  if (puzzle) {
    puzzle.setAttribute("class", "who__puzzle");
    end.append(puzzle);
  }
  dom.heading = el("h2", "quiz__heading");
  dom.heading.tabIndex = -1;
  dom.label = el("span", "quiz__label");
  const score = decorative(el("span", "who__score"));
  dom.scoreN = el("span", "who__score-n");
  dom.scoreOf = el("span", "who__score-of");
  score.append(dom.scoreN, dom.scoreOf);
  dom.scoreSpoken = el("span", "visually-hidden");
  dom.heading.append(dom.label, score, dom.scoreSpoken);
  dom.band = el("p", "who__band");
  const actions = el("div", "quiz__actions");
  dom.share = el("button", "quiz__button");
  dom.retake = el("button", "quiz__quiet");
  dom.takeIt = el("button", "quiz__button");
  for (const button of [dom.share, dom.retake, dom.takeIt]) button.type = "button";
  dom.share.addEventListener("click", shareScore);
  dom.retake.addEventListener("click", restart);
  dom.takeIt.addEventListener("click", restart);
  dom.home = el("a", "quiz__quiet");
  dom.home.href = "./";
  dom.home.dataset.pageLink = "contents";
  actions.append(dom.share, dom.retake, dom.takeIt, dom.home);
  dom.status = el("p", "quiz__status");
  dom.status.setAttribute("role", "status");
  end.append(dom.heading, dom.band, actions, dom.status);

  dom.steps = { start, question: ask, result: end };
  for (const step of [ask, end]) step.hidden = true;
  section.append(start, ask, end);
  dom.section = section;
  return section;
}

// A choice's portrait (decorative: the name labels the button), zoomed in on
// the face; its sizes grow with the zoom so a sharp enough file loads. Lazy,
// so it loads only once the quiz page shows; it fades in when loaded, as the
// cards do.
function portrait(photo, { zoom, x, y }) {
  const frame = decorative(el("span", "who__choice-photo"));
  frame.style.backgroundColor = photo.color || "transparent";
  const img = new Image();
  img.addEventListener("load", () => img.classList.add("is-loaded"));
  img.alt = "";
  img.width = photo.src.sm.width;
  img.height = photo.src.sm.height;
  img.loading = "lazy";
  img.decoding = "async";
  img.style.scale = String(zoom);
  img.style.transformOrigin = `${x} ${y}`;
  img.sizes = `(min-width: 34rem) ${14 * zoom}rem, ${42 * zoom}vw`;
  img.srcset = ["sm", "md", "lg"].map((s) => `${photo.src[s].url} ${photo.src[s].width}w`).join(", ");
  img.src = photo.src.md.url;
  frame.append(img);
  return frame;
}

function newAttempt() {
  return { order: shuffle(QUESTIONS.map((_, i) => i)), picks: QUESTIONS.map(() => null), step: 0 };
}

function question() {
  return QUESTIONS[attempt.order[attempt.step]];
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

// A guess is final: the couple's answer shows and the verdict is read out
function choose(person) {
  if (view !== "question" || attempt.picks[attempt.step]) return;
  attempt.picks[attempt.step] = person;
  render();
  dom.verdict.focus();
}

function next() {
  if (attempt.step + 1 < QUESTIONS.length) {
    attempt.step += 1;
    showStep("question");
  } else {
    finish();
  }
}

function finish() {
  const { order, picks } = attempt;
  const score = picks.filter((pick, i) => pick === QUESTIONS[order[i]].answer).length;
  replaceAddress(`${WHO_PATH}/${score}`, true);
  attempt = newAttempt(); // back at "#/who" later, it starts afresh
  showResult(score, true);
}

// "Take the quiz again", and a friend's "Think you can beat it?"
function restart() {
  replaceAddress(WHO_PATH, false);
  begin();
}

function showResult(score, own, options) {
  result = { score, own };
  dom.share.hidden = !own || !canShare();
  dom.retake.hidden = !own;
  dom.takeIt.hidden = own;
  dom.status.textContent = "";
  showStep("result", options);
}

function band(score) {
  return BANDS.find((b) => score >= b.min && score <= b.max);
}

function shareScore() {
  if (!result) return;
  const text = words().whoShareText(result.score, QUESTIONS.length);
  share({ title: SITE_TITLE, text, url: location.href }, dom.status, words().quizCopied);
}

// The current step's words: the question with its reveal, or the score.
// Shared by the steps and the language switch.
function render() {
  const w = words();
  const language = lang();
  if (view === "question") {
    const { step, picks } = attempt;
    const { answer } = question();
    const pick = picks[step];
    dom.count.textContent = `${step + 1} / ${QUESTIONS.length}`;
    dom.meter.style.setProperty("--progress", String((step + 1) / QUESTIONS.length));
    dom.questionOf.textContent = w.quizQuestionOf(step + 1, QUESTIONS.length);
    dom.lead.textContent = w.whoLead;
    dom.questionText.textContent = question()[language];
    for (const button of dom.choices) {
      const person = button.dataset.person;
      button.querySelector(".who__choice-name").textContent = PEOPLE[person][language];
      button.setAttribute("aria-pressed", String(pick === person));
      if (pick) button.setAttribute("aria-disabled", "true");
      else button.removeAttribute("aria-disabled");
      const isAnswer = Boolean(pick) && person === answer;
      const isMissed = Boolean(pick) && person === pick && pick !== answer;
      button.classList.toggle("is-answer", isAnswer);
      button.classList.toggle("is-missed", isMissed);
      const tag = button.querySelector(".who__choice-tag");
      tag.hidden = !isAnswer && !isMissed;
      tag.className = `who__choice-tag who__choice-tag--${isAnswer ? "answer" : "guess"}`;
      tag.textContent = isAnswer ? w.whoTagAnswer : isMissed ? w.whoTagGuess : "";
    }
    dom.reveal.hidden = !pick;
    if (pick) {
      const name = PEOPLE[answer][language];
      dom.verdict.textContent = pick === answer ? w.whoRight(name) : w.whoWrong(name);
      dom.next.textContent = step + 1 < QUESTIONS.length ? w.whoNext : w.whoSeeScore;
    }
  } else if (view === "result" && result) {
    dom.label.textContent = result.own ? w.whoYouScored : w.whoFriendScored;
    dom.scoreN.textContent = String(result.score);
    dom.scoreOf.textContent = `/ ${QUESTIONS.length}`;
    dom.scoreSpoken.textContent = ` ${w.whoScoreSpoken(result.score, QUESTIONS.length)}`;
    dom.band.textContent = band(result.score)[language];
  }
}

// Labels in the current language; runs at setup and on every language switch.
function applyWords() {
  const w = words();
  dom.inviteLabel.textContent = w.whoInviteLabel;
  dom.inviteTitle.textContent = w.whoTitle;
  dom.inviteCaption.textContent = w.whoInviteCaption;
  dom.inviteCta.textContent = w.quizInviteCta;
  dom.invite.setAttribute("aria-label", w.whoInviteSpoken);
  for (const or of dom.ors) or.textContent = w.whoOr;
  dom.title.textContent = w.whoTitle;
  dom.intro.textContent = w.whoIntro;
  dom.begin.textContent = w.quizBegin;
  dom.share.textContent = w.whoShare;
  dom.retake.textContent = w.quizRetake;
  dom.takeIt.textContent = w.whoTakeIt;
  dom.home.textContent = w.backToContents;
  dom.status.textContent = "";
  render();
}
