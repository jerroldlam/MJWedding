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
  "outdoor/forest": { en: "among the tall trees", zh: "在参天的树林间" },
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
    // The closing note at the end of the last location
    closingLine: "Thank you for being part of our story.",
    closingSign: "With love, Jerrold & May",
    // The quiz (quiz.js); its questions and results are in quiz-content.js
    quizInviteLabel: "Can’t decide?",
    quizTitle: "Which of our locations are you?",
    quizInviteCaption: "seven questions to find the one that’s most you",
    quizInviteCta: "Take the quiz",
    quizInviteSpoken: "Which of our locations are you? Take the quiz",
    quizIntro: "Seven questions, five places. Answer on instinct.",
    quizBegin: "Begin",
    quizQuestionOf: (n, total) => `Question ${n} of ${total}: `,
    quizPrevious: "Previous question",
    quizYouAre: "You’re most like",
    quizFriendIs: "A friend is most like",
    quizRetake: "Take the quiz again",
    quizTakeIt: "Which are you? Take the quiz",
    quizShare: "Share my result",
    quizCopied: "Link copied",
    quizShareText: (place) => `I got ${place}! Which of Jerrold & May’s locations are you?`,
    quizPageTitle: "Quiz",
    // The couple quiz (couple-quiz.js); its questions and score titles are in couple-quiz-content.js
    whoInviteLabel: "Think you know us?",
    whoTitle: "Who’s more likely to…?",
    whoInviteCaption: "ten guesses about the two of us",
    whoInviteSpoken: "Who’s more likely to…? Take the quiz",
    whoIntro: "Ten little truths about us. Guess who, then see if you’re right.",
    whoOr: "or",
    whoLead: "Who is more likely to…",
    whoRight: (name) => `You’re right! It’s ${name}.`,
    whoWrong: (name) => `Not quite! It’s ${name}.`,
    whoNext: "Next question",
    whoSeeScore: "See my score",
    whoYouScored: "You scored",
    whoFriendScored: "A friend scored",
    whoScoreSpoken: (n, total) => `${n} out of ${total}`,
    whoShare: "Share my score",
    whoTakeIt: "Think you can beat it? Take the quiz",
    whoShareText: (n, total) => `I scored ${n}/${total} on Jerrold & May’s “Who’s more likely to…?” Can you beat me?`,
    whoPageTitle: "Who’s more likely?",
  },
  zh: {
    photoCount: (n) => `${n} 张照片`,
    cardLabel: (place, count) => `${place}，${count}`,
    viewPhotos: (count) => `查看 ${count}`,
    // Chinese sentences use the couple's Chinese names
    photoAlt: (alt, place, index, total) => `钿宇和育娴在${place}，第 ${index} 张，共 ${total} 张`,
    photosComingSoon: "照片即将上传",
    endOf: (place) => `${place} · 完`,
    backToContents: "返回目录",
    nextLocation: "下一个地点",
    nextLocationLabel: (place) => `下一个地点：${place}`,
    viewer: "照片查看器",
    close: "关闭",
    previousPhoto: "上一张",
    nextPhoto: "下一张",
    closingLine: "谢谢你们，陪我们写下这段故事。",
    closingSign: "钿宇 & 育娴 敬上",
    quizInviteLabel: "还没决定？",
    quizTitle: "你最像我们的哪一个地点？",
    quizInviteCaption: "七个问题，找到最像你的那一个",
    quizInviteCta: "来测一测",
    quizInviteSpoken: "你最像我们的哪一个地点？来测一测",
    quizIntro: "七个问题，五个地点，凭直觉作答就好。",
    quizBegin: "开始",
    quizQuestionOf: (n, total) => `第 ${n} 题，共 ${total} 题：`,
    quizPrevious: "上一题",
    quizYouAre: "你最像",
    quizFriendIs: "你的朋友最像",
    quizRetake: "再测一次",
    quizTakeIt: "你呢？来测一测",
    quizShare: "分享我的结果",
    quizCopied: "链接已复制",
    quizShareText: (place) => `我测出的是「${place}」！你最像钿宇和育娴的哪一个地点？`,
    quizPageTitle: "小测验",
    whoInviteLabel: "你够了解我们吗？",
    whoTitle: "谁更有可能……？",
    whoInviteCaption: "十道关于我们俩的猜猜题",
    whoInviteSpoken: "谁更有可能……？来测一测",
    whoIntro: "关于我们的十个小秘密。猜猜是谁，再看看你猜对了没有。",
    whoOr: "还是",
    whoLead: "谁更有可能……",
    whoRight: (name) => `答对了！是${name}。`,
    whoWrong: (name) => `猜错啦！是${name}。`,
    whoNext: "下一题",
    whoSeeScore: "看看我的分数",
    whoYouScored: "你的得分",
    whoFriendScored: "你的朋友得了",
    whoScoreSpoken: (n, total) => `${n} 分，满分 ${total} 分`,
    whoShare: "分享我的分数",
    whoTakeIt: "你能超过这个分数吗？来测一测",
    whoShareText: (n, total) => `我在钿宇和育娴的「谁更有可能……？」拿了 ${n}/${total} 分！你能赢过我吗？`,
    whoPageTitle: "谁更有可能？",
  },
};

export function words() {
  return WORDS[lang()];
}
