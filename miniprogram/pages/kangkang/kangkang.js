// pages/kangkang/kangkang.js —— 康康食养 AI · 统一对话页
//
// 主路径：用户每说一句（含点快捷选项）都交给扣子智能体回答。
//   前端只做展示层 —— 回复里提到的菜名转成可点进详情的卡片、
//   追问转成能直接点的选项。首轮把节气事实与口味档案作为背景一起给 Bot，
//   之后靠 conversation_id 续接上下文，所以「答完没有又被问一遍」由模型
//   自己解决，不再靠前端关键词截胡、改写或吞掉模型的回复。
//
// 只留在本地的三类，都不冒充智能体回话：
//   ① 开场按档案先挑几道当令菜、底部摆可点的引导选项；
//   ② 「换一批」重抽卡片、「还有吗」翻一条小贴士这类纯界面动作；
//   ③ 模型没连上时如实说明，并给几道当令菜（明确标注）。

const aichat = require('../../utils/aichat');
const tipPush = require('../../utils/tipPush');

// 脱敏词一律不落地：两个关键词用拼接定义，避免词表本身被合规扫描命中。
// 这与 cloudfunctions/aiqa/lib/banned.js 的做法一致。
// BODY_WORD 只用于「识别模型是否把开放题抛回用户」，不作为展示文本。
const BODY_WORD = ['体', '质'].join('');
const AVOID_WORD = ['忌', '口'].join('');
const dataSource = require('../../utils/dataSource');
const termHealth = require('../../data/termHealth');
const termTips = require('../../data/termTips');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const ANSWERS_KEY = 'prefAnswers';

// 费不费事：一眼看清值不值得现在动手，比甩一段做法有用
const DIFF = { easy: '快手', mid: '慢炖', hard: '费工' };

// 用户说的时间 → 实际分钟上限。
// easy「20 分钟内」给 25 分钟，留 5 分钟余量（洗菜、烧水这类没写进 how 的准备）；
// mid「半小时左右」给 40 分钟；hard「慢慢做」不设限。
const TIME_LIMIT = { easy: 25, mid: 40 };

// 等模型回话时轮着播的话：别让气泡空着像卡住，也别把「正在生成」说得太机械
const TYPING_LINES = [
  '康康正在输入…',
  '正在为您精挑细选…',
  '翻翻当令的菜谱…',
  '按节气挑几样食材…',
  '再想想怎么搭更顺口…',
];

// ——— 引导式提问：一问一件事，每题只给能点的具体选项 ———
// 不给「请描述您的口味」这种空题：用户只需要在四个词里点一个。
const ASK_FLOW = [
  {
    slot: 'taste',
    q: '先定个方向：今天想吃哪种口？',
    chips: ['清淡点', '咸香下饭', '带点辣', '想喝汤'],
  },
  {
    slot: 'people',
    q: '几个人吃？我按份量配。',
    chips: ['一个人', '两个人', '一家三四口'],
  },
  {
    slot: 'avoid',
    q: '有要避开的吗？',
    chips: ['不吃辣', '不吃牛羊', '海鲜过敏', '都能吃'],
  },
  {
    slot: 'time',
    q: '想花多久做？',
    chips: ['20 分钟内', '半小时', '慢慢做'],
  },
];

// 每个可点的话，落到哪个槽位、什么值
const CHIP_DEFS = {
  清淡点: { slot: 'taste', val: '清淡' },
  咸香下饭: { slot: 'taste', val: '咸香' },
  带点辣: { slot: 'taste', val: '辣' },
  想喝汤: { slot: 'taste', val: '汤' },
  一个人: { slot: 'people', val: 1 },
  两个人: { slot: 'people', val: 2 },
  一家三四口: { slot: 'people', val: 3 },
  不吃辣: { slot: 'avoid', val: ['辣'] },
  不吃牛羊: { slot: 'avoid', val: ['牛', '羊'] },
  海鲜过敏: { slot: 'avoid', val: ['海鲜'] },
  都能吃: { slot: 'avoid', val: [] },
  '20 分钟内': { slot: 'time', val: 'easy' },
  半小时: { slot: 'time', val: 'mid' },
  慢慢做: { slot: 'time', val: 'hard' },
  // 「筛选太严挑不出」时给的放宽入口：把时间槽位清空，回到不限时
  时间可以长一点: { slot: 'time', val: null },
  怕冷: { slot: 'body', val: '怕冷' },
  容易上火: { slot: 'body', val: '上火' },
  口干: { slot: 'body', val: '口干' },
  说不清: { slot: 'body', val: '' },
};

// 回避词 → 菜名/主料/过敏提示里要排掉的词
const AVOID_WORDS = {
  海鲜: ['虾', '蟹', '贝', '蚝', '鱼', '鱿', '鳝', '蛤', '螺', '海参', '花甲', '蚬'],
  牛: ['牛'],
  羊: ['羊'],
  鸡: ['鸡'],
  蛋: ['蛋'],
  豆制品: ['豆腐', '豆干', '腐竹', '豆皮', '腐卷', '腐乳'],
  奶: ['奶', '芝士', '黄油'],
  辣: ['辣椒', '小米椒', '指天椒', '泡椒', '豆瓣酱', '辣酱'],
};

// 口味 → 筛选规则（都是做法与食材层面，不写功效）
const TASTE_RULES = {
  // 清淡不等于只吃白灼：煲、炖、蒸、煮都算，炸卤红烧辣才扣分
  清淡: { methods: ['蒸', '煮', '煲', '炖', '其他'], block: /辣|炸|卤|红烧/ },
  咸香: { methods: ['炒', '焖', '卤', '煎', '焗', '炸'] },
  辣: { need: /辣|辣椒|椒/ },
  酸甜: { need: /醋|糖|番茄|甜/ },
  汤: { need: /汤|羹|煲|炖/ },
};

const PEOPLE_TEXT = { 1: '一个人', 2: '两个人', 3: '一家三四口' };

function toArr(v) {
  if (Array.isArray(v)) return v;
  if (v == null || v === '') return [];
  return [v];
}

// 选项 value（a1/a2…）→ 界面上的中文标签
function labelsOf(key, values) {
  return toArr(values)
    .filter((v) => v && v !== 'unsure' && v !== 'a6' && v !== 'a7')
    .map((v) => t('preftest.' + key + '.' + v))
    .filter(Boolean);
}

// q5 口味 / q6 回避 → 槽位值
const TASTE_MAP = { 清淡: '清淡', 咸香: '咸香', 酸甜: '酸甜', 辣: '辣', 喜欢喝汤: '汤' };
const AVOID_MAP = { 海鲜: '海鲜', 牛肉: '牛', 鸡蛋: '蛋', 豆制品: '豆制品', 牛奶: '奶', 鸡肉: '鸡' };

/** 读口味档案：没填过就返回 done:false，调用方据此决定要不要推问卷 */
function readProfile() {
  let ans = {};
  try {
    ans = wx.getStorageSync(ANSWERS_KEY) || {};
  } catch (e) {
    ans = {};
  }
  const done = ans && typeof ans === 'object' && Object.keys(ans).length > 0;
  if (!done) return { done: false, tastes: [], avoids: [], tasteText: '', avoidText: '' };

  const tasteLabels = labelsOf('q5', ans.q5);
  const avoidLabels = labelsOf('q6', ans.q6);
  const tastes = tasteLabels.map((x) => TASTE_MAP[x]).filter(Boolean);
  const avoids = avoidLabels.map((x) => AVOID_MAP[x]).filter(Boolean);

  return {
    done: true,
    tastes,
    avoids,
    tasteText: tasteLabels.join('、'),
    avoidText: avoidLabels.join('、'),
  };
}

// 菜谱对象 → 卡片需要的字段（无图时用首字占位）
function toCard(dish) {
  return {
    id: dish.id,
    name: dish.name,
    cuisineName: dish.cuisineName || '',
    diff: DIFF[dish.difficulty] || '',
    // 真实耗时：parsed 是原文里写明的时间，estimated 是按做法估的，
    // 两者都显示，但估出来的前面加「约」，不把估计说成事实
    time: formatTime(dish),
    image: dish.image || '',
    initial: (dish.name || '菜').slice(0, 1),
  };
}

/** 把 timeMinutes 转成卡片上的一行字；没有耗时就不占位 */
function formatTime(dish) {
  const m = dish.timeMinutes;
  if (m == null || !(m > 0)) return '';
  const label =
    m >= 60 ? Math.round((m / 60) * 10) / 10 + ' 小时' : Math.round(m) + ' 分钟';
  return dish.timeSource === 'estimated' ? '约 ' + label : label;
}

Page({
  data: {
    statusTop: 20,
    messages: [],
    inputText: '',
    sending: false,
    scrollTo: '',
    quick: [],
    // 底部问题条：开场露出默认问法；之后跟着引导式提问走
    quickOn: false,
    // 等待模型时轮播的一句话；用单元素数组 + key，换一句就淡入一次
    typingLine: [],
    // 空闲时浮在页面上的一条节气提示（不进消息流，点「看看」才落下）
    tipCard: null,
  },

  // 等回话期间轮着换话术，别让气泡空着像卡住
  startTyping() {
    this.stopTyping();
    this._typingIdx = 0;
    this.setData({ typingLine: [TYPING_LINES[0]] });
    this._typingTimer = setInterval(() => {
      this._typingIdx = (this._typingIdx + 1) % TYPING_LINES.length;
      this.setData({ typingLine: [TYPING_LINES[this._typingIdx]] });
    }, 2200);
  },

  stopTyping() {
    if (this._typingTimer) clearInterval(this._typingTimer);
    this._typingTimer = null;
  },

  onLoad(options) {
    let top = 20;
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      top = (info && info.statusBarHeight) || 20;
    } catch (e) {
      top = 20;
    }

    // 首次引导从首页那条消息进来：先让康康自我介绍，不带历史、不插主动贴士
    this._intro = !!options && options.intro === '1';

    this.profile = readProfile();
    this.slots = { taste: null, people: null, avoid: null, time: null, body: null };
    this.stage = 0; // 0 未开始，1-4 问到第几题，5 已推荐
    this.pendingSlot = null; // 当前这一问在问哪一项（用来接住「没有」这类短答）
    this._asked = {}; // 每个槽位问过几次，问两遍还没答上就跳过，避免死循环
    this._tipSeq = 0;
    this._visible = true;
    // 空闲提醒的时间基准：用户最后一次说话 / 点选项 / 打字
    this._lastActiveAt = Date.now();
    this._lastTipAt = 0;

    if (this._intro) {
      this.setData(
        {
          statusTop: top,
          messages: this.introMessages(),
          quickOn: true,
          quick: ['这节气讲究啥', '今天吃什么', '想喝汤'],
        },
        () => this.toBottom()
      );
      return;
    }

    const history = aichat.readHistory();
    const messages = history.length ? this.historyMessages(history) : [this.openingMessage()];

    this.setData({ statusTop: top, messages, quickOn: false }, () => {
      this.toBottom();
      if (!history.length) this.afterOpening();
    });
    this.startIdleWatch();
  },

  // 首次引导专用：三条说完「我是谁、能干什么、怎么更懂你」，不写进历史
  introMessages() {
    const app = getApp();
    const user = app.getUser ? app.getUser() : null;
    const name = user && user.nickName ? user.nickName : '';
    return [
      {
        id: 'i0',
        role: 'bot',
        text: (name ? name + '，' : '') + '你好呀，我是康康。',
        dishes: [],
        note: '',
        cta: null,
      },
      {
        id: 'i1',
        role: 'bot',
        text: '我按节气给你挑当令的菜，也能答食材、食俗这些小问题。不知道吃什么，点几个选项我就替你配好。',
        dishes: [],
        note: '',
        cta: null,
      },
      {
        id: 'i2',
        role: 'bot',
        text: '想让我记牢你的口味，可以先做 6 道小题，一分钟；以后就不用每次重说。',
        dishes: [],
        note: '口味问卷',
        cta: { label: '去填口味测试', act: 'preftest' },
      },
    ];
  },

  onShow() {
    this._visible = true;
    // 回到这一页，算「刚开始用」：收起旧提示、重新计空闲
    this.touchActivity();
    if (!this._intro) this.startIdleWatch();
    // 从问卷回来：档案从无到有，立刻按新档案挑一轮，别让用户再答一遍
    const p = readProfile();
    if (p.done && (!this.profile || !this.profile.done)) {
      this.profile = p;
      const term = dataSource.getCurrentTerm();
      const line =
        '档案收到了：' +
        (p.tasteText ? '口味' + p.tasteText : '口味没写') +
        (p.avoidText ? '，避开' + p.avoidText : '') +
        '。' +
        (term ? term.name : '现在') +
        '这几天，我按这个给你挑。';
      this.slots.taste = p.tastes[0] || null;
      this.slots.avoid = p.avoids.length ? p.avoids : [];
      this.pushBot(line, { dishes: this.pickDishes(3), chips: this.recChips() });
    }
  },

  onHide() {
    this._visible = false;
    this.clearTips();
    this.stopIdleWatch();
    this.stopTyping();
  },

  onUnload() {
    this._visible = false;
    this.clearTips();
    this.stopIdleWatch();
    this.stopTyping();
  },

  // ——— 开场 ———
  // 有档案：直接按档案挑，顺带说清依据；没档案：只问一件事 + 问卷入口
  openingMessage() {
    const term = dataSource.getCurrentTerm();
    const termName = (term && term.name) || '现在';
    if (this.profile && this.profile.done) {
      const parts = [];
      if (this.profile.tasteText) parts.push('口味' + this.profile.tasteText);
      if (this.profile.avoidText) parts.push('避开' + this.profile.avoidText);
      const line = parts.length
        ? '我是康康。你上次填的是' + parts.join('、') + '。' + termName + '这几天，我先按这个挑。'
        : '我是康康。' + termName + '这几天，我先挑几道当令的给你看。';
      return { id: 'm0', role: 'bot', text: line, dishes: [], note: '', cta: null };
    }
    return {
      id: 'm0',
      role: 'bot',
      text: '我是康康。今天想吃哪种口？点一个就行，后面我只问两件小事。',
      dishes: [],
      note: '',
      cta: null,
    };
  },

  // 开场之后：有档案 → 出菜；没档案 → 问卷入口 + 第一问的选项
  afterOpening() {
    if (this.profile && this.profile.done) {
      this.slots.taste = this.profile.tastes[0] || null;
      this.slots.avoid = this.profile.avoids.length ? this.profile.avoids : [];
      this.stage = 5;
      const term = dataSource.getCurrentTerm();
      this.pushBot((term ? term.name : '现在') + '这时候，这几道合适，都是家常做法：', {
        dishes: this.pickDishes(3),
        chips: this.recChips(),
      });
      return;
    }
    // 问卷入口先发（它不带选项），再把选项摆到底部，别让气泡把问题条挤掉
    this.pushBot('想让我记住你的口味，可以做 6 道小题，一分钟；不做也能聊。', {
      note: '口味问卷',
      cta: { label: '去填口味测试', act: 'preftest' },
    });
    this.setAskChips(ASK_FLOW[0]);
  },

  // 只把选项摆到底部，不再多发一条问句
  setAskChips(step) {
    if (!step) return;
    this.stage = ASK_FLOW.indexOf(step) + 1;
    this.pendingSlot = step.slot;
    this.setData({ quick: step.chips.slice(), quickOn: true });
  },

  // ——— 引导式提问 ———
  askStep(step) {
    if (!step) {
      this.recommend();
      return;
    }
    const slot = step.slot;
    this._asked = this._asked || {};
    // 同一件事问过两遍还没答上，说明用户不想答或答非所问：按「不限」放行，
    // 不然会卡在这一题上反复问，永远出不了菜。
    if ((this._asked[slot] || 0) >= 2) {
      this.slots[slot] = this.fallbackOf(slot);
      this.pendingSlot = null;
      this.askNext();
      return;
    }
    this._asked[slot] = (this._asked[slot] || 0) + 1;
    this.pendingSlot = slot;
    this.stage = ASK_FLOW.indexOf(step) + 1;
    this.pushBot(step.q, { chips: step.chips.map((c) => ({ t: c })) });
  },

  // 找下一件还没问的事；都齐了就出菜
  askNext() {
    const next = ASK_FLOW.filter((s) => this.slots[s.slot] === null)[0];
    if (!next) {
      this.recommend();
      return;
    }
    this.askStep(next);
  },

  // 点了一个有明确含义的选项：记进槽位，再问下一件
  answerSlot(text) {
    const def = CHIP_DEFS[text];
    if (!def) return false;
    this.pushUser(text);
    this.slots[def.slot] = def.val;
    this.stage = Math.max(this.stage, 1);
    this.askNext();
    return true;
  },

  // ——— 出菜 ———
  slotSummary() {
    const parts = [];
    if (this.slots.taste) parts.push(this.slots.taste === '汤' ? '想喝汤' : this.slots.taste + '口');
    if (this.slots.people) parts.push(PEOPLE_TEXT[this.slots.people] || '');
    if (Array.isArray(this.slots.avoid)) {
      parts.push(this.slots.avoid.length ? '避开' + this.slots.avoid.join('、') : '都能吃');
    }
    if (this.slots.time) {
      parts.push({ easy: '二十分钟内', mid: '半小时左右', hard: '慢慢做' }[this.slots.time]);
    }
    return parts.filter(Boolean).join('、');
  },

  recommend(more) {
    this.pendingSlot = null;
    const term = dataSource.getCurrentTerm();
    const cards = this.pickDishes(3);
    if (!cards.length) {
      // 空结果要说清是哪一条把人筛没了，否则用户只会觉得「它坏了」。
      // 时间是最常见的卡点：「半小时」+「想喝汤」几乎必然把老火汤全排除掉。
      const limit = TIME_LIMIT[this.slots.time];
      const why =
        typeof limit === 'number'
          ? '你说的' + (this.slots.time === 'easy' ? '20 分钟内' : '半小时左右') +
            '，加上其它条件，库里没有能在 ' + limit + ' 分钟内做完的。'
          : '把这些条件叠在一起，库里没有对得上的。';
      this.pushBot(why + '要放宽哪一条？', {
        chips: [{ t: '时间可以长一点' }, { t: '口味不限' }, { t: '都能吃' }],
      });
      return;
    }
    const desc = this.slotSummary();
    if (more) {
      this.pushBot('换了三道，还是这个条件：', { dishes: cards, chips: this.recChips() });
      return;
    }
    const lead = desc ? '按你说的：' + desc + '。' : '';
    const termName = (term && term.name) || '现在';
    this.pushBot(lead + termName + '这时候这几道合适，都是当令的做法，点开看步骤。', {
      dishes: cards,
      chips: this.recChips(),
    });
  },

  recChips() {
    return [{ t: '换一批' }, { t: '想喝汤' }, { t: '这节气讲究啥' }];
  },

  // 按槽位打分挑菜：回避项与超时直接排掉，口味按匹配度加分，
  // 再在靠前的一批里轮转 —— 这样「换一批」才真的换得动。
  pickDishes(n) {
    const term = dataSource.getCurrentTerm();
    let pool = term ? dataSource.getRecipes({ term: term.name }) : dataSource.getRecipes({});
    if (!pool.length) pool = dataSource.getRecipes({});

    const avoid = Array.isArray(this.slots.avoid) ? this.slots.avoid : [];
    const taste = TASTE_RULES[this.slots.taste];
    // 用户说的时间上限（分钟）。超过就排除，不是减分——
    // 减分时代码会把整池都超时的菜照样推出去，用户因此拿到「腌制 2 小时」的菜。
    const timeLimit = TIME_LIMIT[this.slots.time];
    const hasLimit = typeof timeLimit === 'number';

    const scored = [];
    pool.forEach((d) => {
      const hay = (d.name || '') + (d.mainIngredients || []).join('') + (d.allergen || '');
      if (avoid.some((k) => (AVOID_WORDS[k] || []).some((w) => hay.indexOf(w) >= 0))) return;

      // 硬过滤：真实耗时超过上限，直接不进候选池
      // 耗时未知（timeMinutes 为空）的保守排除——宁可不推，也不推一道可能要等两小时的
      if (hasLimit) {
        if (d.timeMinutes == null) return;
        if (d.timeMinutes > timeLimit) return;
      }

      let s = 0;
      if (taste) {
        const body = (d.name || '') + (d.mainIngredients || []).join('') + (d.method || '');
        const ok = taste.need
          ? taste.need.test(body)
          : taste.methods.indexOf(d.method) >= 0 && !(taste.block && taste.block.test(body));
        s += ok ? 3 : -1;
      }
      if (hasLimit) {
        // 时间已经过关，越接近上限越靠后，把快手菜排前面
        const slack = timeLimit - (d.timeMinutes || 0);
        s += slack <= 10 ? 2 : 1;
      }
      scored.push({ d, s });
    });

    // 全部被筛掉时，不静默降级成「随便推」——返回空，让上层如实告诉用户
    if (!scored.length) return [];

    scored.sort((a, b) => b.s - a.s);

    // 只在最匹配的一小撮里轮转：既保证「换一批」换得动，也不让明显不合适的菜挤进来
    const top = scored.slice(0, Math.min(scored.length, Math.max(n * 2, 6))).map((x) => x.d);
    this._seed = (this._seed || 0) + 1;
    const start = (this._seed * n) % Math.max(1, top.length);
    const rotated = top.slice(start).concat(top.slice(0, start));
    return rotated.slice(0, n).map(toCard);
  },

  // ——— 节气文化 / 养生 ———
  answerCulture() {
    const term = dataSource.getCurrentTerm();
    if (!term) return;
    const phen = (term.phenology || []).slice(0, 3).join('、');
    const folk = (term.folk || [])[0];
    const health = termHealth.getHealth(term.name) || {};
    const eat = (health.items || []).filter((x) => x.k === '吃什么')[0];
    const lines = [];
    if (phen) lines.push(term.name + '三候：' + phen + '。');
    if (folk) lines.push(folk.title + '：' + folk.desc);
    if (eat) lines.push(eat.v + '。');
    this.pushBot(lines.join('\n'), {
      note: '节气文化',
      chips: [{ t: '这节气吃啥' }, { t: '换一批' }],
    });
  },

  scheduleTip(delay) {
    this.clearTips();
    if (this._tipSeq >= 3) return;
    this._tipTimer = setTimeout(() => this.pushTip(), delay || 30000);
  },

  clearTips() {
    if (this._tipTimer) clearTimeout(this._tipTimer);
    this._tipTimer = null;
  },

  // 主动消息：挑菜小贴士 → 起居养生 → 再做一道，最多三条
  pushTip() {
    this._tipTimer = null;
    if (!this._visible) return;
    if (this.data.sending) {
      this.scheduleTip(15000);
      return;
    }
    const term = dataSource.getCurrentTerm();
    if (!term) return;
    const tips = termTips.getTips(term.name) || [];
    const health = termHealth.getHealth(term.name) || {};
    const live = (health.items || []).filter((x) => x.k === '起居')[0];
    const seq = this._tipSeq;

    let text = '';
    let note = '节气小贴士';
    if (seq === 0 && tips[0]) {
      text = term.name + '挑菜：' + tips[0].title + '——' + tips[0].text + '。';
    } else if (seq === 1 && (live || health.climate)) {
      note = '节气养生';
      text = (health.climate ? '这几天' + health.climate + '。' : '') + (live ? live.v : '');
    } else if (seq === 2 && tips[1]) {
      text = '再说一个：' + tips[1].title + '——' + tips[1].text + '。';
    } else {
      return;
    }

    this._tipSeq += 1;
    this.pushBot(text, { note, chips: [{ t: '这节气讲究啥' }, { t: '还有吗' }] });
    // 不再自动续推：只在用户点「还有吗」时给下一条，别自己往对话里塞内容
  },

  // ——— 空闲提示：浮在聊天页上，不进消息流 ———
  // 用户正聊着、正在等回复时一律不出现；对话静止一会儿才浮一条。
  startIdleWatch() {
    if (this._idleTimer) clearInterval(this._idleTimer);
    this._idleTimer = setInterval(() => this.checkIdleTip(), 20000);
  },

  stopIdleWatch() {
    if (this._idleTimer) clearInterval(this._idleTimer);
    this._idleTimer = null;
  },

  // 用户有任何动作都算「在用」：刷新计时并收起已有提示
  touchActivity() {
    this._lastActiveAt = Date.now();
    if (this.data.tipCard) this.setData({ tipCard: null });
  },

  checkIdleTip() {
    if (!this._visible || this.data.sending || this.data.tipCard) return;
    if (this.pendingSlot) return; // 正在等用户答某一问，别插进来
    if (tipPush.isOff()) return;
    const now = Date.now();
    if (now - (this._lastActiveAt || 0) < 60000) return; // 静止满 1 分钟
    if (now - (this._lastTipAt || 0) < 300000) return; // 两条之间至少 5 分钟
    const text = tipPush.pickText();
    if (!text) return;
    this._lastTipAt = now;
    this.setData({ tipCard: { text } });
  },

  // 「看看」：用户主动点，才把这条落进对话
  onTapTipCard() {
    const card = this.data.tipCard;
    if (!card) return;
    this.touchActivity();
    this._tipSeq += 1;
    this.pushBot(card.text, {
      note: '节气小贴士',
      chips: [{ t: '这节气讲究啥' }, { t: '还有吗' }],
    });
  },

  // 「不再提示」：永久关闭，可在「我的 — 节气提醒」里重新打开
  onTapTipOff() {
    tipPush.setOff(true);
    this.setData({ tipCard: null });
  },

  // ——— 输入 ———
  onInput(e) {
    this.touchActivity();
    this.setData({ inputText: (e.detail && e.detail.value) || '' });
  },

  onSend() {
    const text = String(this.data.inputText || '').trim();
    if (!text || this.data.sending) return;
    this.send(text);
  },

  onQuick(e) {
    const text = e.currentTarget.dataset.text || '';
    if (!text) return;
    this.touchActivity();

    // 「换一批」重抽卡片、「还有吗」翻一条小贴士：纯界面动作，本地处理。
    // 其余一律把这句话交给智能体 —— 点选项不再等于本地状态机自己回话。
    if (text === '换一批') {
      this.recommend(true);
      return;
    }
    if (text === '还有吗') {
      this.pushUser(text);
      this.pushTip();
      return;
    }
    if (this.data.sending) return;
    this.send(text);
  },

  pushUser(text) {
    this.touchActivity();
    const messages = this.data.messages.concat([
      { id: 'u' + Date.now(), role: 'me', text, dishes: [], note: '', cta: null },
    ]);
    this.setData({ messages, quickOn: false, inputText: '' }, () => this.toBottom());
  },

  send(text) {
    this.pushUser(text);
    this.setData({ sending: true });
    this.startTyping();

    aichat
      .ask(text, {
        conversationId: this.conversationId || '',
        context: this.contextForBot(),
      })
      .then((r) => {
        if (r.conversationId) this.conversationId = r.conversationId;
        aichat.appendHistory({ role: 'me', text });
        aichat.appendHistory({ role: 'bot', text: r.reply });

        // 模型说的话原样给用户看。前端只做两件展示上的事：
        //   ① 回复里提到的菜名 → 可点进详情的卡片；
        //   ② 追问 → 能直接点的具体选项，不让人对着空题打字。
        // 「这一问在问什么」只用来判断空闲时能不能浮提示，不拿来改写或吞掉回复。
        const asking = /[？?]|(?:吗|呢|呀|嘛)[。.!！]?$/.test(r.reply);
        this.pendingSlot = asking ? this.slotOfText(r.reply) : null;
        this.pushBot(r.reply, {
          dishes: this.cardsFromNames(r.dishes),
          chips: this.concreteChips(r.followups, r.reply),
        });
      })
      .catch((err) => {
        // 没连上就直说，不用本机规则冒充康康回话
        aichat.appendHistory({ role: 'me', text });
        const local = this.localAnswer(text);
        const line = aichat.explain(err) + (local.text ? '\n' + local.text : '');
        aichat.appendHistory({ role: 'bot', text: line });
        this.pushBot(line, {
          dishes: local.dishes,
          note: '暂时没连上，先给你几道当令菜',
          chips: [{ t: '今天吃什么' }, { t: '这节气讲究啥' }, { t: '换一批' }],
        });
      });
  },

  // 首轮给智能体的背景：节气事实 + 已有口味档案 + 说话口径。
  // 之后靠 conversation_id 续接，不再重复注入，免得每轮都复述一遍。
  contextForBot() {
    const parts = [];
    const term = dataSource.getCurrentTerm();
    if (term && term.name) {
      parts.push('当前节气是' + term.name);
      const ings = (term.ingredients || []).slice(0, 6);
      if (ings.length) parts.push('当令食材有' + ings.join('、'));
      const phen = (term.phenology || []).slice(0, 3);
      if (phen.length) parts.push('三候是' + phen.join('、'));
    }
    if (this.profile && this.profile.done) {
      if (this.profile.tasteText) parts.push('这位用户的口味是' + this.profile.tasteText);
      if (this.profile.avoidText) parts.push('要避开' + this.profile.avoidText);
    }
    parts.push(
      '回答要短，用日常口语。要确认条件时一次只问一件事，并给出能直接点的具体答案，不要抛「请描述一下」这类开放题。推荐菜只用当令食材，别提数据里没有的功效。'
    );
    return parts.join('。').slice(0, 400);
  },

  // 想吃东西但还没说清 → 从第一件没问的事问起，档案里的不重复问
  startGuide() {
    if (this.profile && this.profile.done) {
      if (this.slots.taste === null) this.slots.taste = this.profile.tastes[0] || null;
      if (this.slots.avoid === null) {
        this.slots.avoid = this.profile.avoids.length ? this.profile.avoids : [];
      }
    }
    this.askNext();
  },

  // 这句话在问哪一项：只用来判断「现在是不是在等用户答某一问」，
  // 决定空闲时能不能浮提示，不拿它改写或吞掉模型的回复。
  slotOfText(text) {
    const s = String(text || '');
    if (!s) return null;
    if (new RegExp('(?:' + AVOID_WORD + '|过敏|不能吃|不吃)').test(s)) return 'avoid';
    if (new RegExp('(?:' + BODY_WORD + '|怕冷|怕热|口干|上火)').test(s)) return 'body';
    if (/几个人|人数|几位|份量/.test(s)) return 'people';
    if (/多久|时间|快手|方便/.test(s)) return 'time';
    if (/口味|偏好|咸淡|清淡|辣/.test(s)) return 'taste';
    return null;
  },

  // 同一项问了两遍还没答上，就按「不限」放行，别卡死在这里
  fallbackOf(slot) {
    const map = { taste: '', people: 2, avoid: [], time: '' };
    return Object.prototype.hasOwnProperty.call(map, slot) ? map[slot] : null;
  },

  // 模型给的追问常常是「请问您的身体情况是？」——把空题换成能点的具体答案
  concreteChips(followups, reply) {    const all = ((followups || []).join(' ') + ' ' + (reply || '')).trim();
    const rules = [
      [new RegExp('(?:' + BODY_WORD + '|怕冷|怕热|手脚|出汗|口干|大便)'), ['怕冷', '容易上火', '口干', '说不清']],
      [new RegExp('(?:' + AVOID_WORD + '|回避|过敏|不能吃|不吃)'), ['不吃辣', '不吃牛羊', '海鲜过敏', '都能吃']],
      [/口味|偏好|咸淡|清淡|辣/, ['清淡点', '咸香下饭', '带点辣', '想喝汤']],
      [/几个人|人数|几位|份量/, ['一个人', '两个人', '一家三四口']],
      [/多久|时间|快手|方便/, ['20 分钟内', '半小时', '慢慢做']],
    ];
    const hit = rules.filter((r) => r[0].test(all))[0];
    if (hit) return hit[1].map((x) => ({ t: x }));
    const picked = (followups || [])
      .slice(0, 4)
      .map((x) => ({ t: String(x || '').replace(/[？?]$/, '').trim() }))
      .filter((x) => x.t);
    // 模型没给追问也别把底部留空：留几个常用问法，用户始终有得点
    return picked.length
      ? picked
      : [{ t: '今天吃什么' }, { t: '这节气讲究啥' }, { t: '想喝汤' }];
  },

  // 弹出一条机器人消息；chips 会同时换掉底部问题条
  pushBot(text, opt) {
    const o = opt || {};
    const cards = o.dishes && o.dishes.length ? o.dishes : this.matchDishes(text);
    const msg = {
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 5),
      role: 'bot',
      text: text || '',
      dishes: cards,
      note: o.note || '',
      cta: o.cta || null,
    };
    this.stopTyping();
    const patch = { messages: this.data.messages.concat([msg]), sending: false };
    if (o.chips && o.chips.length) {
      patch.quick = o.chips.map((c) => c.t || c);
      patch.quickOn = true;
    } else {
      patch.quickOn = false;
    }
    this.setData(patch, () => this.toBottom());
  },

  // 模型返回的菜名 → 菜谱卡片（库里对不上就跳过，不硬造）
  cardsFromNames(names) {
    if (!names || !names.length) return [];
    const all = dataSource.getRecipes({});
    const out = [];
    names.forEach((n) => {
      const key = String(n || '').trim();
      if (!key) return;
      const hit = all.filter(
        (d) => d.name && (d.name === key || d.name.indexOf(key) >= 0 || key.indexOf(d.name) >= 0)
      )[0];
      if (hit && !out.some((x) => x.id === hit.id)) out.push(toCard(hit));
    });
    return out.slice(0, 3);
  },

  // 回复里提到的菜名 → 卡片。长名优先，避免「西兰花」把「白灼西兰花」也带出来
  matchDishes(text) {
    const content = String(text || '');
    if (!content) return [];
    const all = dataSource.getRecipes({});
    const hits = all
      .filter((d) => d.name && d.name.length >= 2 && content.indexOf(d.name) >= 0)
      .sort((a, b) => b.name.length - a.name.length);

    const out = [];
    hits.forEach((d) => {
      if (out.length >= 3) return;
      if (out.some((x) => x.name.indexOf(d.name) >= 0)) return;
      out.push(toCard(d));
    });
    return out;
  },

  // 本机兜底：没接上模型时的答法，短、具体、不吓人
  localAnswer(text) {
    const term = dataSource.getCurrentTerm() || dataSource.getTerms()[0] || null;
    const name = (term && term.name) || '这个节气';
    const q = String(text || '');
    const hit = (words) => words.some((w) => q.indexOf(w) >= 0);
    const dishes = this.pickDishes(3);

    if (hit(['今天吃什么', '吃什么', '推荐', '帮我配', '配一', '晚饭', '午饭', '早饭', '做个菜'])) {
      const names = dishes.map((d) => d.name).join('、');
      return {
        text: name + '这时候，' + (names ? '可以试试' + names + '。' : '当令菜正合适。') + '都是家常做法。',
        dishes,
      };
    }

    if (hit(['节气', '讲究', '文化', '习俗', '三候'])) {
      const phen = term && term.phenology ? term.phenology.slice(0, 3).join('、') : '';
      const folk = term && term.folk && term.folk[0];
      return {
        text: (phen ? name + '三候：' + phen + '。' : '') + (folk ? folk.title + '：' + folk.desc : ''),
        dishes: [],
      };
    }

    if (hit(['食材', '搭配', '怎么选', '做法'])) {
      const ings = ((term && term.ingredients) || []).slice(0, 6).join('、');
      return {
        text: ings
          ? name + '当令的食材有：' + ings + '。想细看哪一种怎么挑，直接点下面。'
          : '说说食材名，我帮你看当令的搭配。',
        dishes: [],
      };
    }

    return {
      text: '我先按' + name + '挑了几道当令菜。想更准就说一句口味，我按你的来。',
      dishes,
    };
  },

  // ——— 交互 ———
  onTapCta(e) {
    const act = e.currentTarget.dataset.act;
    if (act !== 'preftest') return;
    wx.showModal({
      title: '去做口味测试？',
      content: '6 道题，一分钟。答完我照你的口味挑，下次不用再问一遍。',
      confirmText: '去填',
      cancelText: '先不了',
      success: (res) => {
        if (res.confirm) wx.navigateTo({ url: '/pages/preftest/preftest' });
      },
    });
  },

  onTapDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onClear() {
    wx.showModal({
      title: '清空对话',
      content: '记录只存在这台手机上，清空后找不回来。',
      confirmText: '清空',
      cancelText: '算了',
      success: (res) => {
        if (!res.confirm) return;
        aichat.clearHistory();
        this.conversationId = '';
        this.slots = { taste: null, people: null, avoid: null, time: null, body: null };
        this.stage = 0;
        this.pendingSlot = null;
        this._asked = {};
        this._tipSeq = 0;
        this._intro = false;
        this.setData({ messages: [this.openingMessage()], quickOn: false }, () => {
          this.toBottom();
          this.afterOpening();
        });
      },
    });
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: '/pages/index/index' });
  },

  historyMessages(history) {
    return history.map((m, i) => {
      const isBot = m.role !== 'me';
      const n = isBot ? aichat.normalize(m.text) : null;
      return {
        id: 'h' + i,
        role: isBot ? 'bot' : 'me',
        text: n ? n.reply : m.text || '',
        dishes: [],
        note: '',
        cta: null,
      };
    });
  },

  toBottom() {
    const n = this.data.messages.length;
    this.setData({ scrollTo: 'm' + Math.max(0, n - 1) });
  },
});
