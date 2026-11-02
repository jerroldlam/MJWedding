/*
 * Couple quiz content: the "Who is more likely to…?" questions, the couple's
 * answers and the score titles, in English and Simplified Chinese side by
 * side. The interface words (Next, Share…) are in i18n.js. The Chinese font
 * helper reads this file too, so regenerate the Chinese font after changing
 * the Chinese here.
 */

// The two choices, always shown in this order (Jerrold & May). photo is the
// manifest id of each one's Studio portrait, shown on their choice; crop
// frames it around the face (both are full-length, and May stands further
// back): how far to zoom, and the point to zoom towards.
export const PEOPLE = {
  jerrold: { en: "Jerrold", zh: "钿宇", photo: "dsc07283", crop: { zoom: 1.8, x: "50%", y: "30%" } },
  may: { en: "May", zh: "育娴", photo: "dsc07269", crop: { zoom: 2.5, x: "48%", y: "33%" } },
};

// Each follows "Who is more likely to…"; shown in a random order per attempt
export const QUESTIONS = [
  { en: "queue an hour for a viral food stall?", zh: "为了网红美食排队一小时？", answer: "may" },
  { en: "still be talking about that one argument years later?", zh: "过了好几年，还在提那一次吵架？", answer: "jerrold" },
  { en: "plan the whole itinerary?", zh: "把整趟行程都安排好？", answer: "may" },
  { en: "get you both lost?", zh: "带着两个人一起迷路？", answer: "may" },
  { en: "win an argument?", zh: "吵架吵赢？", answer: "jerrold" },
  { en: "lead the loudest yam seng?", zh: "带头喊出最响亮的「饮胜」？", answer: "jerrold" },
  { en: "steal the blanket at night?", zh: "半夜抢被子？", answer: "may" },
  { en: "want the aircon colder?", zh: "想把冷气开得更冷？", answer: "jerrold" },
  { en: "order too much food?", zh: "点一大堆吃不完的菜？", answer: "may" },
  { en: "send a meme instead of replying properly?", zh: "不好好回信息，只丢一个表情包？", answer: "jerrold" },
];

// The score's title and a line under it in the couple's voice; every score
// from 0 to 10 is in exactly one band (5 alone: one name all the way through
// always scores exactly 5)
export const BANDS = [
  {
    min: 0,
    max: 2,
    en: "Nice to meet you!",
    zh: "幸会幸会！",
    line: { en: "Come say hi, we’ll catch you up.", zh: "来打个招呼吧，我们慢慢讲给你听。" },
  },
  {
    min: 3,
    max: 4,
    en: "So many stories to tell",
    zh: "还有好多故事没讲",
    line: { en: "Sit with us a while. We’ve got plenty.", zh: "来坐坐吧，我们有说不完的故事。" },
  },
  {
    min: 5,
    max: 5,
    en: "Coin flip?",
    zh: "抛硬币吗？",
    line: { en: "Exactly half. Did you tap the same name every time?", zh: "刚好一半。你是不是每题都点同一个人？" },
  },
  {
    min: 6,
    max: 7,
    en: "Kopi kaki",
    zh: "咖啡好友",
    line: { en: "You know us over coffee. Ask us for the rest.", zh: "一起喝过咖啡，剩下的故事下次说。" },
  },
  {
    min: 8,
    max: 9,
    en: "Inner circle",
    zh: "自己人",
    line: { en: "You’ve clearly sat through our stories, more than once.", zh: "我们的故事，你显然听过不止一次。" },
  },
  {
    min: 10,
    max: 10,
    en: "Were you in our group chat?",
    zh: "你是不是在我们的群组里？",
    line: { en: "A perfect score. Either you know us too well, or someone told you.", zh: "满分！要么你太懂我们，要么有人泄题了。" },
  },
];
