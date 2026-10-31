/*
 * Words: the text the scripts build, in English and Simplified Chinese. Static
 * text lives in index.html in both languages. The current language is <html
 * lang>, set by language.js; when the guest switches, it announces
 * "photobook:language-change" and each feature re-applies its words. The
 * English must match the site's English exactly.
 */

const CHANGE_EVENT = "photobook:language-change";

export function lang() {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function onLanguageChange(callback) {
  document.addEventListener(CHANGE_EVENT, callback);
}

// Chinese names by manifest id; an unknown location keeps its English title.
const PLACES_ZH = {
  "outdoor/beach": "海滩",
  "outdoor/flower-field": "花田",
  "outdoor/forest": "森林",
  "outdoor/open-field": "田野",
  "studio/studio": "影棚",
};

export function placeName(shootId, chapterId, title) {
  return lang() === "zh" ? PLACES_ZH[`${shootId}/${chapterId}`] ?? title : title;
}

// A short line under each location's card name, written by the couple.
const CAPTIONS = {
  "outdoor/forest": { en: "among the tall trees", zh: "在高高的树林间" },
  "outdoor/flower-field": { en: "a field in bloom", zh: "花开满田" },
  "outdoor/open-field": { en: "golden hour in the long grass", zh: "长草间的金色时光" },
  "outdoor/beach": { en: "the last of the light", zh: "最后一抹余晖" },
  "studio/studio": { en: "just the two of us", zh: "只有我们俩" },
};

export function caption(shootId, chapterId) {
  return CAPTIONS[`${shootId}/${chapterId}`]?.[lang()] ?? "";
}

// cardLabel's and viewPhotos' count is the already-formatted photoCount.
const WORDS = {
  en: {
    photoCount: (n) => `${n} ${n === 1 ? "photo" : "photos"}`,
    cardLabel: (place, count) => `${place}, ${count}`,
    viewPhotos: (count) => `View ${count}`,
    photoAlt: (alt, place, index, total) => (alt ? `${alt}, photo ${index} of ${total}` : `Photo ${index} of ${total}`),
    photosComingSoon: "Photos coming soon",
    endOf: (place) => `End of ${place}`,
    backToContents: "Back to contents",
    nextLocation: "Next location",
    nextLocationLabel: (place) => `Next location: ${place}`,
    viewer: "Photo viewer",
    close: "Close",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
  },
  zh: {
    photoCount: (n) => `${n} 张照片`,
    cardLabel: (place, count) => `${place}，${count}`,
    viewPhotos: (count) => `查看 ${count}`,
    // Chinese sentences use the couple's Chinese names
    photoAlt: (alt, place, index, total) => `育娴和钿宇在${place}，第 ${index} 张，共 ${total} 张`,
    photosComingSoon: "照片即将上传",
    endOf: (place) => `${place} · 完`,
    backToContents: "返回目录",
    nextLocation: "下一个地点",
    nextLocationLabel: (place) => `下一个地点：${place}`,
    viewer: "照片查看器",
    close: "关闭",
    previousPhoto: "上一张",
    nextPhoto: "下一张",
  },
};

export function words() {
  return WORDS[lang()];
}
