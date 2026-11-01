/*
 * Quiz content: the "Which of our locations are you?" questions, their answers
 * and the five results, in English and Simplified Chinese side by side. Each
 * answer and result is keyed by location ("<shoot>/<chapter>"). The interface
 * words (Begin, Share…) are in i18n.js. The Chinese font helper reads this
 * file too, so regenerate the Chinese font after changing the Chinese here.
 */

export const QUESTIONS = [
  {
    en: "A free Saturday morning. You’re…",
    zh: "难得空闲的星期六早上，你会……",
    answers: {
      "outdoor/forest": { en: "walking MacRitchie before it gets hot", zh: "趁天还没热，去麦里芝走一走" },
      "outdoor/flower-field": { en: "at a pretty café, photographing your latte", zh: "在漂亮的咖啡馆里，给拿铁拍照" },
      "outdoor/open-field": { en: "with no plans, seeing where the day goes", zh: "不做计划，走到哪儿算哪儿" },
      "outdoor/beach": { en: "cycling East Coast, with a BBQ later", zh: "去东海岸骑脚车，晚上再烧烤" },
      "studio/studio": { en: "dressed up for an 11am brunch you booked a week ago", zh: "精心打扮，赴一周前就订好的十一点早午餐" },
    },
  },
  {
    en: "Pick a drink",
    zh: "选一杯饮料",
    answers: {
      "outdoor/forest": { en: "hot teh O", zh: "热茶乌" },
      "outdoor/flower-field": { en: "bandung", zh: "玫瑰露奶" },
      "outdoor/open-field": { en: "whatever’s in the fridge", zh: "冰箱里有什么就喝什么" },
      "outdoor/beach": { en: "fresh coconut", zh: "新鲜椰子水" },
      "studio/studio": { en: "an oat flat white, ordered just so", zh: "燕麦奶馥芮白，要求一点都不能差" },
    },
  },
  {
    en: "At a wedding dinner, you’re the one who…",
    zh: "喜宴上，你通常是那个……",
    answers: {
      "outdoor/forest": { en: "has a deep talk with whoever’s beside you", zh: "跟邻座越聊越投入的人" },
      "outdoor/flower-field": { en: "tears up at the couple’s video", zh: "看新人视频看到眼眶泛红的人" },
      "outdoor/open-field": { en: "somehow ends up chatting at three other tables", zh: "不知怎么就跑到另外三桌去聊天的人" },
      "outdoor/beach": { en: "leads the loudest yam seng", zh: "带头喊出最响亮「饮胜」的人" },
      "studio/studio": { en: "arrives on time in an outfit planned weeks ago", zh: "准时到场，一身打扮几周前就想好的人" },
    },
  },
  {
    en: "Group photo time",
    zh: "要拍大合照了",
    answers: {
      "outdoor/forest": { en: "back row, happy just to be there", zh: "站在后排，能在场就很开心" },
      "outdoor/flower-field": { en: "you know your best angle and where the light is", zh: "你知道自己最好看的角度，也知道光在哪里" },
      "outdoor/open-field": { en: "your best shot is always the candid one", zh: "你最好看的照片，永远是抓拍的那张" },
      "outdoor/beach": { en: "first to suggest a jump shot", zh: "第一个提议来张跳跃照" },
      "studio/studio": { en: "you’re the one directing everyone", zh: "你就是那个指挥大家站位的人" },
    },
  },
  {
    en: "Your dream holiday",
    zh: "你理想中的假期",
    answers: {
      "outdoor/forest": { en: "a cabin in the mountains, no Wi-Fi", zh: "山中小木屋，没有网络" },
      "outdoor/flower-field": { en: "Hokkaido in lavender season", zh: "薰衣草季节的北海道" },
      "outdoor/open-field": { en: "a road trip with no itinerary", zh: "说走就走的自驾游，不排行程" },
      "outdoor/beach": { en: "Bali, sunset at a beach club", zh: "巴厘岛，在海滩俱乐部看日落" },
      "studio/studio": { en: "a city break with galleries and a beautiful hotel", zh: "城市小旅行，逛美术馆，住漂亮的酒店" },
    },
  },
  {
    en: "Friends text you when they need…",
    zh: "朋友找你，通常是因为需要……",
    answers: {
      "outdoor/forest": { en: "someone to listen", zh: "一个愿意倾听的人" },
      "outdoor/flower-field": { en: "someone who remembers every birthday", zh: "一个记得每个人生日的人" },
      "outdoor/open-field": { en: "a last-minute plus-one", zh: "一个临时能陪他们出席的伴" },
      "outdoor/beach": { en: "someone to get the gathering going", zh: "一个能让聚会热闹起来的人" },
      "studio/studio": { en: "an honest opinion on an outfit", zh: "一句关于穿搭的真心话" },
    },
  },
  {
    en: "Pick a time of day",
    zh: "选一天中的一个时刻",
    answers: {
      "outdoor/forest": { en: "early morning mist", zh: "清晨的薄雾" },
      "outdoor/flower-field": { en: "golden hour", zh: "黄昏前的金色时光" },
      "outdoor/open-field": { en: "a slow, lazy afternoon", zh: "慢悠悠的午后" },
      "outdoor/beach": { en: "dusk by the water", zh: "水边的暮色" },
      "studio/studio": { en: "late at night, lights low", zh: "夜深了，灯光微暗" },
    },
  },
];

// slug: the result's address (#/quiz/<slug>), the location's chapter id
export const RESULTS = {
  "outdoor/forest": {
    slug: "forest",
    tagline: { en: "The calm in every room.", zh: "让人安心的那个人" },
    text: {
      en: "You’re the friend people feel steady around. You’d rather have one real conversation than ten small ones, and you notice when someone has gone quiet. Like a walk under tall trees, time with you leaves people feeling a little more like themselves.",
      zh: "大家在你身边总会觉得踏实。比起十段寒暄，你更想要一次真心的谈话，也总能察觉谁突然安静了下来。和你相处，就像在参天大树下散步，让人更像自己。",
    },
  },
  "outdoor/flower-field": {
    slug: "flower-field",
    tagline: { en: "A romantic at heart.", zh: "骨子里的浪漫派" },
    text: {
      en: "You remember the little things: the song that was playing, the note in the card, the way the light fell. You keep ticket stubs and screenshots of sweet messages. You see beauty everywhere, and you make the people around you feel it’s meant for them.",
      zh: "你记得所有小细节：那天播的歌、卡片上的话、光落下的样子。你会收好每一张票根，截下每一条暖心的信息。你在哪里都能看见美，也让身边的人觉得，这份美是为他们准备的。",
    },
  },
  "outdoor/open-field": {
    slug: "open-field",
    tagline: { en: "Happy wherever the day goes.", zh: "随遇而安，走到哪儿都开心" },
    text: {
      en: "Plans are nice, but you’re happiest when the day surprises you. You’re the easiest company there is: up for anything, unbothered when things go sideways, and somehow always in the best candid photos. Time with you feels like golden hour in the long grass, warm and unhurried.",
      zh: "计划很好，但你最开心的是日子给你惊喜。你是最好相处的伴：什么都愿意试，出了岔子也不慌，抓拍的照片总是你最好看。和你在一起，就像长草间的金色时光，温暖又从容。",
    },
  },
  "outdoor/beach": {
    slug: "beach",
    tagline: { en: "The life of the party.", zh: "派对里的开心果" },
    text: {
      en: "You bring the sunshine, and the snacks. You’re the one who turns a quiet dinner into a night everyone talks about, and your yam seng can be heard three tables away. Even after the sun goes down, you’re the reason people stay a little longer.",
      zh: "你带来阳光，也带来零食。安静的晚饭，有你就能变成大家津津乐道的一夜，你的一声「饮胜」，三桌外都听得见。就算太阳下山了，大家也会因为你多留一会儿。",
    },
  },
  "studio/studio": {
    slug: "studio",
    tagline: { en: "Classic, polished, always ready.", zh: "经典优雅，永远准备就绪" },
    text: {
      en: "You have a plan, a backup plan, and an outfit for both. You believe the details matter, and they do: people trust you to make things beautiful. Calm under the lights, you’re the one everyone turns to when it really counts.",
      zh: "你有计划，有备用计划，还有搭配两者的衣服。你相信细节很重要，事实也是如此：大家都放心把事情交给你，因为你总能把它们变得美好。聚光灯下依然从容，关键时刻，大家第一个想到的就是你。",
    },
  },
};
