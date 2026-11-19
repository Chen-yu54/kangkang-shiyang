// pages/menu/menu.js —— 专属推荐（一级 Tab 页）
//
// 食养视图：壹 口味（问卷）→ 贰 推演（就地演，不另开页）→ 叁 今日食单（同页铺开）。
// 问卷交卷后 navigateBack 回到这一页，onShow 里接着把这几步演完——
// 「推演」是这一页上的一个动作，不是另一个页面。
// 三道菜由 genStore 记着：演完才落盘，之后每次进来直接铺，不再重演动画。
//
// 菜系浏览视图：顶部风味 tab → 左侧竖排节气分类（按四季分组、可滑动）→ 右侧菜品列表。
//
// 「节气变化」的体现在左侧分类：不把 24 个节气平铺，而是按春 / 夏 / 秋 / 冬分组，
// 每一季有自己的标识色，滑动时能感知季节推移，而不是看一列等价的选项。
//
// 两个 Tab 页约束：
//   1. wx.switchTab 不支持 url 参数，跨 Tab 传「想看哪个风味」走 globalData.pendingCuisine
//   2. 不能再用 navigateTo 进来（会对 tab 页报错），入口一律 switchTab

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const daypart = require('../../utils/daypart');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const genStore = require('../../utils/genStore');
const agentTrace = require('../../utils/agentTrace');
const workflowResult = require('../../utils/workflowResult');
const recipes = require('../../data/recipes.js');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');
// 节气两套内容：食养小贴士（怎么挑/配/下锅）＋ 养生提醒（气候/喝水/当令/起居）
const termTipsData = require('../../data/termTips');
const termHealth = require('../../data/termHealth');
const weatherUtil = require('../../utils/weather');
// 风味卡是构建产物（data/cuisines.js），只读
const CUISINE_CARDS = require('../../data/cuisines.js');

const nutrition = require('../../utils/nutrition');

const t = i18n.t;
// 知识库真源是粤菜三系交付包：岭南家常 0 道，不给它开选项卡
const CUISINE_KEYS = ['guangfu', 'chaoshan', 'hakka'];

const PREFS_KEY = 'prefAnswers';
// 扣子工作流二：前端只传别名，长 ID 与 token 都在服务端
const WORKFLOW_NAME = require('../../utils/config').WORKFLOW_ALIAS.recommend;

// 等模型出单时轮着播的话：转圈不空着，也不把「正在生成」说得太机械
const WAIT_LINES = [
  '康康正在输入…',
  '正在为您精挑细选…',
  '翻翻当令的菜谱…',
  '按节气挑几样食材…',
  '再想想怎么搭更顺口…',
];

// 菜系通用图：某道菜没有自己的配图时，用所属菜系的插画顶上。
// 三张分别是广府 / 潮汕 / 客家的菜系卡；岭南家常与其他没有专属卡，借广府那张。
// 图上会挂「菜系示意」小签，说明这不是这道菜的照片。
const CUISINE_IMAGE = {
  guangfu: '/images/cuisine-card-guangfu.jpg',
  chaoshan: '/images/cuisine-card-chaoshan.jpg',
  hakka: '/images/cuisine-card-hakka.jpg',
  lingnan_home: '/images/cuisine-card-guangfu.jpg',
  other: '/images/cuisine-card-guangfu.jpg',
};
// 步与步之间的停顿：太快看不清，太慢像卡住
const STEP_GAP = 560;
// 最后一步落定后转圈等出单的时长：本地算得快，但「等待」要有，否则像没生成
const MIX_GAP = 1200;

// 与 app.wxss 的 --color-spring / summer / autumn / winter 保持一致
// （JS 读不到 CSS 变量，这两处要同步改）
const SEASON_COLOR = {
  春: '#6f8f4e',
  夏: '#3f7a45',
  秋: '#a9761f',
  冬: '#44617e',
};

const SEASON_ORDER = ['春', '夏', '秋', '冬'];

function readAnswers() {
  try {
    const stored = wx.getStorageSync(PREFS_KEY);
    return stored && typeof stored === 'object' ? stored : {};
  } catch (e) {
    return {};
  }
}

function hasPref(answers) {
  const a = answers && typeof answers === 'object' ? answers : {};
  return (Array.isArray(a.q5) && a.q5.length > 0) || (Array.isArray(a.q6) && a.q6.length > 0);
}

function toCard(dish) {
  return {
    id: dish.id,
    name: dish.name,
    cuisineName: dish.cuisineName,
    cuisine: dish.cuisine,
    termText: (dish.terms || []).join(' · '),
    how: dish.how,
    difficultyText: format.difficultyLabel(dish.difficulty),
    costText: format.costLabel(dish.costLevel),
    image: dish.image,
    faved: favorite.has(dish.id),
  };
}

// 把 24 节气按四季分组；season 字段来自 solar_term_map.csv
function buildSeasons(terms) {
  const buckets = {};
  SEASON_ORDER.forEach((s) => {
    buckets[s] = [];
  });
  terms.forEach((term) => {
    const season = SEASON_ORDER.indexOf(term.season) > -1 ? term.season : '春';
    buckets[season].push({ name: term.name, order: term.termOrder || 99 });
  });
  return SEASON_ORDER.map((key) => ({
    key,
    label: key + '季',
    color: SEASON_COLOR[key],
    terms: buckets[key],
  })).filter((group) => group.terms.length > 0);
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | empty | error
    cuisines: [],
    current: 'guangfu',
    seasons: [],
    currentTerm: '',
    list: [],
    countText: '',
    emptyAction: '',
    copy: {},
    // —— 食养视图（默认 Tab 内容）
    view: 'nutrition', // nutrition | browse
    termName: '',
    // 时辰问候条（自推荐页移入）
    greeting: null,
    // 节气文化卡（自推荐页移入）：万物收藏也 / 三候 / 食俗 / 当令食材
    profile: null, // { taste: [], avoid: [], answered: bool }
    rec: { dishes: [], namesText: '' }, // 只有推演落点，没结果就是空数组
    // —— 就地推演（不另开页）
    genPhase: 'idle', // idle 未开始 | running 推演中 / 转圈中 | done 已出单
    genWait: false, // running 的后半段：步骤走完、正在出单
    genNote: '', // 出单后的一句补充（模型没接上时如实说明用本地规则出的）
    shownSteps: [],
    progressText: '',
    resultDishes: [], // 一道一道菜：图 + 菜系/难度/价格 + 做法 + 理由
    termTips: [], // 节气食养小贴士（data/termTips.js，每节气 3 条）
    weatherTip: '', // 今天天气 + 怎么吃（说不上就留空，不显示这一行）
    weatherCity: '', // 天气对应的城市名，显示在行尾
    health: null, // 节气养生提醒（data/termHealth.js，含按时间给的喝水提醒）
    elderMode: false,
    // 登录后的功能引导（跨 tab，进度存在 app.globalData.tour）
    tourVisible: false,
    tourStep: null,
    tourIndex: 0,
    tourTotal: 0,
    // 等模型出单时轮播的一句话（genWait 阶段用）
    waitWords: [],
  },

  // 等出单期间轮着换话术；推演一结束回调自己会停，不用到处补清理
  startWaitWords() {
    this.stopWaitWords();
    this._waitIdx = 0;
    this.setData({ waitWords: [WAIT_LINES[0]] });
    this._waitTimer = setInterval(() => {
      if (this.data.genPhase !== 'running') {
        this.stopWaitWords();
        return;
      }
      this._waitIdx = (this._waitIdx + 1) % WAIT_LINES.length;
      this.setData({ waitWords: [WAIT_LINES[this._waitIdx]] });
    }, 2200);
  },

  stopWaitWords() {
    if (this._waitTimer) clearInterval(this._waitTimer);
    this._waitTimer = null;
  },

  onLoad() {
    this.setData({
      cuisines: [
        { key: 'guangfu', name: t('cuisine.guangfu') },
        { key: 'chaoshan', name: t('cuisine.chaoshan') },
        { key: 'hakka', name: t('cuisine.hakka') },
      ],
      copy: {
        masthead: t('menu.masthead'),
        mastheadNo: t('menu.no'),
        all: t('common.all'),
        empty: t('cuisine.empty'),
        emptyAction: t('cuisine.emptyAction'),
        error: t('home.error'),
        retry: t('common.retry'),
        riskLabel: t('cuisine.riskLabel'),
        profileTitle: t('nutrition.profileTitle'),
        profileEmpty: t('nutrition.profileEmpty'),
        quizBig: t('nutrition.quizBig'),
        quizSub: t('nutrition.quizSub'),
        redoQuiz: t('nutrition.redoQuiz'),
        profileTaste: t('nutrition.profileTaste'),
        profileAvoid: t('nutrition.profileAvoid'),
        profileUnset: t('nutrition.profileUnset'),
        tagSeasonal: t('nutrition.tagSeasonal'),
        tagYearRound: t('nutrition.tagYearRound'),
        genTitle: t('nutrition.genTitle'),
        genDesc: t('nutrition.genDesc'),
        genAction: t('nutrition.genAction'),
        flowTitle: t('nutrition.flowTitle'),
        stepTaste: t('nutrition.stepTaste'),
        stepGen: t('nutrition.stepGen'),
        stepDish: t('nutrition.stepDish'),
        resultTitle: t('nutrition.resultTitle'),
        browseEntry: t('nutrition.browseEntry'),
        browseBack: t('nutrition.browseBack'),
        briefHow: t('nutrition.briefHow'),
        briefWhy: t('nutrition.briefWhy'),
        // 第叁段的三种待推演文案，与推荐页同一套说法
        pendingTag: t('home.pendingTag'),
        pendingNoQuiz: t('home.pendingNoQuiz'),
        pendingNoGen: t('home.pendingNoGen'),
        pendingStale: t('home.pendingStale'),
        genAgain: t('nutrition.genAgain'),
        genSummary: t('nutrition.genSummary'),
        // —— 就地推演 / 成品区
        genRunning: t('nutrition.genRunning'),
        genThinking: t('nutrition.genThinking'),
        genMixing: t('nutrition.genMixing'),
        tipsTitle: t('nutrition.tipsTitle'),
        weatherTag: t('nutrition.weatherTag'),
        healthTitle: t('nutrition.healthTitle'),
        whyLabel: t('nutrition.whyLabel'),
        dishOpen: t('nutrition.dishOpen'),
        noDetail: t('nutrition.noDetail'),
        notice: t('nutrition.notice'),
      },
    });

    this.loadTerms();
    this.loadList();
    track.pageView('menu');
  },

  onShow() {
    // 从推荐页的菜系入口切过来时，globalData 里带着想看的风味
    const app = getApp();
    const pending = app.globalData && app.globalData.pendingCuisine;
    if (pending && CUISINE_KEYS.indexOf(pending) > -1 && pending !== this.data.current) {
      app.globalData.pendingCuisine = '';
      this.setData({ current: pending, view: 'browse' });
      this.loadList();
    }
    this.setData({ pageStyle: app.getFontStyle(), elderMode: !!(app.globalData && app.globalData.elderMode) });
    // 功能引导走到本页时再亮（从首页切过来，onShow 里接着走）
    this.syncTour();
    // 时辰问候条：每次回来重算（跨时段要换装）
    this.setData({ greeting: this.buildGreeting() });
    this.startDaypartTimer();
    // 从问卷回来 / 已经推演过：重算这一步该显示什么（genStore 可能刚写好）
    this.refreshNutrition();
    this.loadWeather();

    // 问卷交卷时在 globalData 里留了一笔：回到这一页就把推演接着演完
    const auto = !!(app.globalData && app.globalData.autoRunGen);
    if (auto) app.globalData.autoRunGen = false;
    if (auto && this.data.profile && this.data.profile.answered && this.data.genPhase === 'idle') {
      this.startGen();
    }
  },

  onHide() {
    this.stopDaypartTimer();
    this.stopWaitWords();
    // 演到一半被切走：停表并回到「未开始」，回来点一下重演，不停在半截
    if (this.data.genPhase === 'running') {
      this.clearGenTimer();
      // 页面都切走了，模型再返回也不该往这个已经隐藏的页面写结果
      this._abortGen = true;
      this.setData({ genPhase: this.data.genState === 'ready' ? 'done' : 'idle', genWait: false, shownSteps: [] });
    }
  },

  onUnload() {
    this.stopDaypartTimer();
    this.stopWaitWords();
    this.clearGenTimer();
  },

  // —— 时辰问候条（自推荐页移入） ——
  // 按设备本地时间分六档（见 utils/daypart.js），问候语 + 时辰饮食场景提示 + 节气信息。
  // 每分钟看一次时辰是否变了，只在 onShow 期间跑，onHide 清掉，避免后台耗电。
  buildGreeting() {
    const part = daypart.current();
    const current = dataSource.getCurrentTerm();
    const next = dataSource.getNextTerm();

    const user = getApp().getUser();
    const nick = user && user.nickName && user.nickName !== '食养朋友' ? user.nickName : '';
    // 三段文案分开返回，不 join 成单行：窄屏自动折行，节气倒计时一定读得到
    const nextText =
      next && next.days > 0 && next.term
        ? i18n.tpl('greeting.toNext', { name: next.term.name, days: next.days })
        : '';
    return {
      greet: t(part.greetKey),
      nick,
      tip: t(part.tipKey),
      termText: current && current.name ? i18n.tpl('greeting.todayTerm', { name: current.name }) : '',
      nextText,
      icon: part.icon,
      style: part.style,
    };
  },

  startDaypartTimer() {
    this.stopDaypartTimer();
    this.daypartTimer = setInterval(() => {
      const next = this.buildGreeting();
      if (next && (!this.data.greeting || this.data.greeting.icon !== next.icon)) {
        this.setData({ greeting: next });
      }
    }, 60 * 1000);
  },

  stopDaypartTimer() {
    if (this.daypartTimer) {
      clearInterval(this.daypartTimer);
      this.daypartTimer = null;
    }
  },

  // —— 食养：按作答生成推荐 ——
  // 答案来自 preftest 写入的 prefAnswers；未作答就只留问卷入口，不铺任何菜。
  // 天气：异步拉，失败就不显示这一行，不阻塞页面也不编造
  loadWeather() {
    weatherUtil
      .fetch()
      .then((w) => {
        if (!w) {
          this.setData({ weatherTip: '', weatherCity: '' });
          return;
        }
        const tip = weatherUtil.toTip(w);
        this.setData({ weatherTip: tip, weatherCity: w.cityName || '' });
      })
      .catch(() => {
        // 拿不到就当作没有，界面少一行而已
        this.setData({ weatherTip: '', weatherCity: '' });
      });
  },

  refreshNutrition() {
    const answers = readAnswers();

    const app = getApp();
    const info = app.getTermInfo ? app.getTermInfo() : {};
    const termName = info.name || this.data.currentTerm || '';

    const taste = Array.isArray(answers.q5)
      ? answers.q5.map((k) => (nutrition.TASTE_RULES[k] || {}).label).filter(Boolean)
      : [];
    const avoid = Array.isArray(answers.q6)
      ? answers.q6.filter((k) => k !== 'a7').map((k) => (nutrition.AVOID_RULES[k] || {}).label).filter(Boolean)
      : [];

    // 这几道菜只认推演结果（genStore 里那条 lastGen），不在列表页现算：
    // 没推演过就显示待推演占位，想看菜可以去下面的「按菜系浏览」。
    const stored = genStore.itemsFor(answers); // 出单时留的整张卡
    const genIds = stored.length ? [] : genStore.idsFor(answers); // 兼容旧缓存（只有 id）
    const genDishes = genIds.map((id) => dataSource.getRecipeById(id)).filter(Boolean);
    const answered = taste.length > 0 || avoid.length > 0;
    const ready = stored.length > 0 || genDishes.length > 0;
    const genState = ready ? 'ready' : answered && genStore.read() ? 'stale' : 'none';

    const resultDishes = stored.length ? stored : genDishes.map((dish) => decorate(dish, termName));

    const patch = {
      termName,
      genState,
      profile: {
        answered,
        taste: taste.length ? taste : [],
        avoid,
        tasteText: taste.length ? taste.join('、') : t('nutrition.profileUnset'),
        avoidText: avoid.length ? avoid.join('、') : t('nutrition.profileUnset'),
      },
      rec: { dishes: resultDishes, namesText: resultDishes.map((d) => d.name).join('、') },
    };

    // 正在演的时候别被 onShow 覆盖：轨迹、转圈都归 startGen 管
    if (this.data.genPhase !== 'running') {
      patch.genPhase = ready ? 'done' : 'idle';
      patch.resultDishes = resultDishes;
    }

    this.setData(patch);

    // 已有结果：把节气两块内容也补上（每次回来按当前节气与时段重算）
    if (patch.genPhase === 'done') this.fillSeasonBlocks(termName);
  },

  // —— 贰 · 推演：就在这一页演 ——
  // 作答过才推；轨迹一条条落定 → 转圈等出单 → 下方直接铺今日食单。
  onRunGen() {
    this.startGen();
  },

  startGen() {
    this._abortGen = false;
    if (!this.data.profile || !this.data.profile.answered) {
      wx.showToast({ title: t('home.gateNeedQuiz'), icon: 'none' });
      setTimeout(() => this.onStartQuiz(), 700);
      return;
    }
    this.clearGenTimer();

    const answers = readAnswers();
    // 步骤、条数、理由全部来自 nutrition 的真实计算，这里只管「什么时候出现」
    const model = agentTrace.build(answers, {});
    this._genAnswers = answers;
    this._genDishes = model.dishes || [];

    const stepsAll = model.steps.map((step) => ({
      no: step.no,
      title: step.title,
      lines: step.lines || [],
      countText: step.count === null ? '' : i18n.tpl('agent.countChip', { n: step.count }),
    }));

    // 引擎标识来自 agentTrace：云开发/代理就绪才是扣子，否则本地规则
    this._engine = model.engine;

    this.setData({
      genPhase: 'running',
      genWait: false,
      genNote: '',
      shownSteps: [],
      progressText: '0 / ' + stepsAll.length,
      termName: model.termName || this.data.termName,
      resultDishes: [],
      termTips: [],
      health: null,
    });

    // 推演是页面内的动作，不再单记一次 page_view（页面浏览在 onLoad 里已记过）
    this.startWaitWords();
    this.playSteps(stepsAll);
  },

  // 逐步揭示：当前步在转，上一步落定为 ✓
  playSteps(steps) {
    const total = steps.length;
    let i = 0;

    const tick = () => {
      i += 1;
      const shown = steps.slice(0, i).map((step, idx) => Object.assign({}, step, {
        state: idx === i - 1 && i < total ? 'running' : 'done',
      }));

      this.setData({
        shownSteps: shown,
        progressText: i + ' / ' + total,
        genWait: i >= total,
      });

      if (i >= total) {
        // 末步也落定为完成，转圈等出单
        this.setData({ shownSteps: shown.map((s) => Object.assign({}, s, { state: 'done' })) });
        // 扣子在线就等模型出单；没接上才用本地规则（不假装模型给过答案）
        if (this._engine && this._engine.key === 'coze') {
          this.fetchWorkflow();
        } else {
          this.genTimer = setTimeout(() => this.finishGen(''), MIX_GAP);
        }
        return;
      }
      this.genTimer = setTimeout(tick, STEP_GAP);
    };

    this.genTimer = setTimeout(tick, 260);
  },

  // —— 扣子工作流：推演步骤演完，真正出单由模型给 ——
  // 走云函数 / 代理转发，前端不持 token。等待期间一直转圈，不让页面静下来。
  fetchWorkflow() {
    const params = nutrition.toWorkflowParams(this._genAnswers || {});
    this.appendPendingStep();

    api
      .runWorkflow(WORKFLOW_NAME, params)
      .then((data) => {
        if (this._abortGen) return;
        const text = api.pickWorkflowText(data);
        const parsed = workflowResult.parseRecommendation(text, { limit: 10 });
        if (!parsed.ok || !parsed.dishes.length) throw new Error('PARSE_FAILED');
        this.applyWorkflowResult(parsed);
      })
      .catch((e) => {
        if (this._abortGen) return;
        // 模型没接上：如实记一笔，再用本地规则把这顿饭出完，不让用户空等
        this.appendModelStep({ ok: false, reason: (e && (e.bizMsg || e.code)) || '' });
        this.genTimer = setTimeout(
          () => this.finishGen(t('nutrition.genFallback')),
          600
        );
      });
  },

  // 「等模型」占位步骤：一直在转，直到返回或失败
  appendPendingStep() {
    const steps = this.data.shownSteps.map((s) => Object.assign({}, s, { isLast: false }));
    steps.push({
      no: String(steps.length + 1).padStart(2, '0'),
      title: t('nutrition.modelPendingTitle'),
      lines: [t('nutrition.modelPendingLine')],
      state: 'running',
    });
    this.setData({
      shownSteps: steps,
      genWait: true,
      progressText: steps.length + ' / ' + steps.length,
    });
  },

  // 模型返回后：换成真实菜谱，步骤收尾
  applyWorkflowResult(parsed) {
    this.clearGenTimer();

    const termName = this.data.termName;
    const dishes = parsed.dishes.map((d) => {
      const hit = matchRecipe(d.name);
      return decorate(
        {
          name: d.name,
          id: hit ? hit.id : '',
          cuisine: hit ? hit.cuisine : '',
          cuisineName: hit ? hit.cuisineName || '' : '',
          how: d.how || (hit ? hit.how : ''),
          why: d.reason || '',
          isSeasonal: true,
        },
        termName
      );
    });
    this._genDishes = dishes;

    const steps = this.data.shownSteps
      .filter((s) => !s.pending)
      .map((s) => Object.assign({}, s, { isLast: false }));
    steps.push({
      no: String(steps.length + 1).padStart(2, '0'),
      title: t('nutrition.modelDoneTitle'),
      lines: [i18n.tpl('nutrition.modelDoneLine', { n: dishes.length })],
      state: 'done',
    });

    if (this._genAnswers) genStore.save(this._genAnswers, dishes);

    this.setData({
      shownSteps: steps,
      genPhase: 'done',
      genWait: false,
      genNote: '',
      genState: 'ready',
      resultDishes: dishes,
      rec: { dishes, namesText: dishes.map((d) => d.name).join('、') },
    });
    this.fillSeasonBlocks(termName);
  },

  // 模型失败时补一条步骤（界面在结果区只留一句 genNote，不把技术错误甩给用户）
  appendModelStep(result) {
    if (!result || result.ok) return;
    const steps = this.data.shownSteps.map((s) => Object.assign({}, s, { isLast: false }));
    steps.push({
      no: String(steps.length + 1).padStart(2, '0'),
      title: t('nutrition.modelFailTitle'),
      lines: [t('nutrition.modelFailLine')],
      state: 'done',
    });
    this.setData({ shownSteps: steps });
  },

  // 出单：落盘 + 铺菜 + 补节气两块内容。走到这里才算「推演过」
  // note 为空表示扣子给的；非空表示模型没接上、按本地规则出的
  finishGen(note) {
    this.clearGenTimer();

    const termName = this.data.termName;
    const resultDishes = (this._genDishes || []).map((dish) => decorate(dish, termName));
    // 存整张卡：本地库对不上的菜也能在下次进来时留住
    if (this._genAnswers) genStore.save(this._genAnswers, resultDishes);

    // 引擎没接通就如实写一句，别让人以为这是模型给的
    const engineNote = this._engine && this._engine.key === 'coze' ? '' : '这一单由本机规则挑的。';

    this.setData({
      genPhase: 'done',
      genWait: false,
      genNote: note || engineNote,
      genState: 'ready',
      resultDishes,
      rec: { dishes: resultDishes, namesText: resultDishes.map((d) => d.name).join('、') },
    });
    this.fillSeasonBlocks(termName);
  },

  // 节气两块内容：小贴士（怎么挑/配/下锅）+ 养生提醒（气候/喝水/当令/起居）
  fillSeasonBlocks(termName) {
    const name = termName || this.data.termName || '';
    const next = dataSource.getNextTerm();
    this.setData({
      termTips: termTipsData.getTips(name),
      health: termHealth.buildToday(name, {
        hour: new Date().getHours(),
        daysToNext: next && typeof next.days === 'number' ? next.days : null,
      }),
    });
  },

  clearGenTimer() {
    if (this.genTimer) {
      clearTimeout(this.genTimer);
      this.genTimer = null;
    }
  },

  // 成品区的菜卡点进详情（对不上本地库的菜不跳，标了「暂无详情」）
  onTapResultDish(e) {
    const id = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    if (!id) return;
    track.dishClick(id, 'menu');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  // —— 功能引导（跨 tab，进度在 app.globalData.tour）——
  syncTour() {
    const app = getApp();
    if (!app.tourStateOf) return;
    const st = app.tourStateOf('menu');
    this.setData({
      tourVisible: st.visible,
      tourStep: st.step,
      tourIndex: st.index,
      tourTotal: st.total,
    });
  },

  onTourNext() {
    const app = getApp();
    const st = app.nextTour ? app.nextTour() : null;
    this.setData({ tourVisible: false });
    if (!st) {
      require('../../utils/tour').finishConfirm();
      return;
    }
    if (st.step && st.step.page !== 'menu') {
      wx.switchTab({ url: require('../../utils/tour').tabUrlOf(st.step.page) });
      return;
    }
    this.setData({
      tourVisible: st.visible,
      tourStep: st.step,
      tourIndex: st.index,
      tourTotal: st.total,
    });
  },

  onTourSkip() {
    const app = getApp();
    const self = this;
    require('../../utils/tour').skipConfirm(() => {
      if (app.endTour) app.endTour();
      self.setData({ tourVisible: false });
    });
  },

  onStartQuiz() {
    wx.navigateTo({ url: '/pages/preftest/preftest' });
  },

  onSwitchBrowse() {
    this.setData({ view: 'browse' });
    if (!this.data.list.length) this.loadList();
  },

  onSwitchNutrition() {
    this.setData({ view: 'nutrition' });
  },

  onTapRecommend(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    track.dishClick(id, 'nutrition');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  loadTerms() {
    api
      .getTerms()
      .then((res) => {
        this.setData({ seasons: buildSeasons(res.list || []) });
      })
      .catch(() => {
        this.setData({ seasons: [] });
      });
  },

  loadList() {
    this.setData({ status: 'loading' });

    api
      .getRecipes({ cuisine: this.data.current, term: this.data.currentTerm })
      .then((res) => {
        const list = (res.list || []).map(toCard);
        const isEmpty = list.length === 0;
        this.setData({
          status: isEmpty ? 'empty' : 'ready',
          list,
          countText: isEmpty ? '' : i18n.tpl('cuisine.count', { count: list.length }),
          // 已选出某个节气却仍为空时，给一个回到「全部」的出口
          emptyAction: isEmpty && this.data.currentTerm ? t('cuisine.emptyAction') : '',
        });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  onCuisineChange(e) {
    const key = e.detail && e.detail.key;
    if (!key) return;
    this.setData({ current: key });
    track.cuisineFilter(key, this.data.currentTerm);
    this.loadList();
  },

  onTapTerm(e) {
    const name = e.currentTarget.dataset.name;
    if (name === undefined || name === this.data.currentTerm) return;
    this.setData({ currentTerm: name });
    track.cuisineFilter(this.data.current, name);
    this.loadList();
  },

  onEmptyAction() {
    this.setData({ currentTerm: '' });
    this.loadList();
  },

  onRetry() {
    this.loadList();
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'menu');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'menu');

    const list = this.data.list.map((item) =>
      item.id === id ? Object.assign({}, item, { faved: !added }) : item
    );
    this.setData({ list });
  },
});

// 模型返回的是菜名文本，界面要能点进详情就得对回本地菜谱记录。
// 对不上不是错误：模型用的是扣子上的知识库，本地库未必有同名菜。
// 对不上就只展示、不给跳转，图上退到菜系通用图。
function matchRecipe(name) {
  if (!name) return null;
  const raw = String(name).replace(/\s+/g, '').trim();
  // 菜系前缀不改变菜本身，去掉再比一次
  const bare = raw.replace(/^(客家|广府|潮汕|岭南)/, '');

  const exact = recipes.find((r) => r.name === raw) || recipes.find((r) => r.name === bare);
  if (exact) return exact;

  // 二级匹配只认「互相包含」，且要求长度 ≥3，避免「汤」这种单字乱配
  const keys = [bare, raw].filter((k) => k.length >= 3);
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    const hit = recipes.find(
      (r) => r.name && r.name.length >= 3 && (r.name.indexOf(k) > -1 || k.indexOf(r.name) > -1)
    );
    if (hit) return hit;
  }
  return null;
}

// 把一道菜补齐成成品卡要的字段：图 / 菜系·难度·价格 / 做法 / 推荐理由。
// 理由只用数据里真有的东西拼（当令 + 主料），不编额外说法。
// 图：这道菜自己没有配图时，退到所属菜系的通用插画，并标「菜系示意」。
function decorate(dish, termName) {
  const rec = dish.id ? dataSource.getRecipeById(dish.id) : null;
  const source = rec || dish;
  const ing = (source.mainIngredients || []).slice(0, 2).join('、');
  const isSeasonal = (source.terms || []).indexOf(termName) >= 0;
  const why = [termName ? termName + '当令' : '', ing ? '主料' + ing : '']
    .filter(Boolean)
    .join(' · ');
  const cuisine = source.cuisine || dish.cuisine || '';
  const ownImage = source.image || '';
  return {
    id: dish.id || '',
    name: dish.name || '',
    image: ownImage || CUISINE_IMAGE[cuisine] || CUISINE_IMAGE.other,
    imgNote: ownImage ? '' : '菜系示意',
    cuisine,
    isSeasonal,
    metaText: [
      source.cuisineName || dish.cuisineName || '',
      source.difficulty ? format.difficultyLabel(source.difficulty) : '',
      source.costLevel ? format.costLabel(source.costLevel) : '',
    ]
      .filter(Boolean)
      .join(' · '),
    howText: dish.how || source.how || '',
    whyText: why,
  };
}
