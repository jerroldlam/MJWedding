/*
 * Helpers both quizzes share (quiz.js, couple-quiz.js): shuffling, rewriting
 * the current history entry's address, and sharing a link.
 */

const STATUS_MS = 3000;
const statusTimers = new WeakMap(); // status line → its clearing timer

export function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Rewrites the current history entry's address (and its own-result flag);
// the entry's other state (depth, scroll) and ?lang= stay.
export function replaceAddress(path, own) {
  const state = { ...(history.state || {}) };
  delete state.quizOwn;
  if (own) state.quizOwn = true;
  history.replaceState(state, "", `#${path}`);
}

// The row under the location cards that holds the quiz invites side by side;
// whichever quiz builds first adds it.
export function inviteRow(menu) {
  let row = menu.querySelector(":scope > .quiz-invites");
  if (!row) {
    row = document.createElement("div");
    row.className = "quiz-invites";
    menu.append(row);
  }
  return row;
}

export function canShare() {
  return typeof navigator.share === "function" || typeof navigator.clipboard?.writeText === "function";
}

// The phone's own share sheet, or else the link copied (said in the status line)
export async function share({ title, text, url }, status, copiedText) {
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    status.textContent = copiedText;
    clearTimeout(statusTimers.get(status));
    statusTimers.set(
      status,
      setTimeout(() => {
        status.textContent = "";
      }, STATUS_MS),
    );
  } catch (error) {
    // Closing the share sheet isn't a failure
    if (error?.name !== "AbortError") console.error("[photobook] quiz share failed", error);
  }
}
