/*
 * Language: English or Simplified Chinese. A ?lang=en|zh link decides;
 * otherwise the phone's main language does (Chinese gives Chinese).
 * This is a classic script loaded in <head> before the stylesheet, so <html
 * lang> is set before the first paint and the page never flashes the other
 * language. Nothing is stored on the device: when the guest picks the
 * language that isn't their phone's, the address carries ?lang= instead, so a
 * reload, back and forward, a bookmark or a shared link keep it.
 *
 * Static text sits in index.html in both languages (data-lang), shown by CSS;
 * the scripts' words are in i18n.js. The 中文 / EN switch changes the language
 * in place and announces "photobook:language-change" so each feature can
 * relabel what it built.
 */

(() => {
  const HTML_LANG = { en: "en", zh: "zh-Hans" };
  const CHANGE_EVENT = "photobook:language-change";
  const isLang = (value) => value === "en" || value === "zh";
  const root = document.documentElement;

  // The phone's main language only: English phones often list Chinese further down.
  const phone = /^zh\b/i.test(navigator.languages?.[0] || navigator.language || "") ? "zh" : "en";
  const asked = new URL(location.href).searchParams.get("lang");
  let lang = isLang(asked) ? asked : phone;
  root.lang = HTML_LANG[lang];
  keepInAddress();

  // The address names the language only when it differs from the phone's
  // (an unknown value is dropped); the hash and history state are kept.
  function keepInAddress() {
    const url = new URL(location.href);
    if (lang === phone) url.searchParams.delete("lang");
    else url.searchParams.set("lang", lang);
    if (url.href !== location.href) history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }

  // Static aria-labels: data-label-zh in Chinese, the original English otherwise.
  function applyLabels() {
    for (const el of document.querySelectorAll("[data-label-zh]")) {
      if (el.dataset.labelEn === undefined) el.dataset.labelEn = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", lang === "zh" ? el.dataset.labelZh : el.dataset.labelEn);
    }
  }

  // Entries from before a switch get the language back (this runs before pages.js).
  window.addEventListener("popstate", keepInAddress);

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("[data-lang-switch]")) return;
    lang = lang === "zh" ? "en" : "zh";
    root.lang = HTML_LANG[lang];
    keepInAddress();
    applyLabels();
    document.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { lang } }));
  });

  document.addEventListener("DOMContentLoaded", () => {
    for (const button of document.querySelectorAll("[data-lang-switch]")) {
      button.hidden = false;
      // iOS Safari only applies :active (the press dip) when a touch listener exists.
      button.addEventListener("touchstart", () => {}, { passive: true });
    }
    applyLabels();
  });
})();
