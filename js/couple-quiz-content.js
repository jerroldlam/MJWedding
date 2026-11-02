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

// The score's title; every score from 0 to 10 is in exactly one band
export const BANDS = [
  { min: 0, max: 3, en: "Did we meet at the wedding?", zh: "我们是在婚礼上才认识的吗？" },
  { min: 4, max: 6, en: "Getting there", zh: "还差一点点" },
  { min: 7, max: 8, en: "You know us well", zh: "你很懂我们" },
  { min: 9, max: 10, en: "Practically family", zh: "简直是一家人" },
];
