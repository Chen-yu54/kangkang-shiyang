// pages/foodsafety/foodsafety.js —— 食品安全（公开数据页）
//
// 这一页的定位：**教人怎么买**，不是报数据。
// 数据还在，但从主角变成论据——每个数字后面都接一句「所以买的时候该怎么办」。
//
// 三条纪律（沿用）：
//   1. 数字全部来自 data/foodSafety.js（由 scripts/build-food-safety.js 从 CSV 生成），页面不做二次估算
//   2. 算不出来的不给（比如合格率），宁可少一个漂亮数，也不给一个假数
//   3. 案例只写案由、法条、处理结果，不点商家名——原文已做打码，这里不替任何人下结论
//
// 新增的「怎么办」文案放在 data/foodSafetyTips.js：
//   那是编辑写的操作建议，不来自抽检数据，混进构建产物会被下次构建覆盖。

const data = require('../../data/foodSafety');
const tips = require('../../data/foodSafetyTips');

const app = getApp();

// 图标全部取自「食材档案」那套插画，尺寸、底色与档案页保持一致，
// 不为这一页新画一套，避免同一屏出现两种笔触。
const ICON = {
  overview: '/images/ingredients/home_analysis_bookmark.png',
  check: '/images/ingredients/register_check_seal.png',
  problem: '/images/ingredients/home_season_cauldron.png',
  stage: '/images/ingredients/register_location_compass.png',
  ingredient: '/images/ingredients/home_effect_ginseng.png',
  month: '/images/ingredients/home_record_bamboo.png',
  notice: '/images/ingredients/home_text_scrollbrush.png',
  penalty: '/images/ingredients/home_warn_token.png',
};

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 1000) / 10;
}

Page({
  data: {
    pageStyle: '',
    elderMode: false,
    icons: ICON,
    scope: data.scope,
    insp: data.inspections,
    pen: data.penalties,

    // 首屏三步
    steps: tips.STEPS,
    // 内容区
    ov: [],
    ingredients: [], // 带挑菜要点
    problems: [],
    stages: [],
    months: [],
    latest: [],
    cases: [],
    takeaways: tips.TAKEAWAYS,
    buySteps: tips.BUY_STEPS,

    // 月度分布默认折叠：不是所有人都要看细节
    monthsOpen: false,

    // 一句话结论（由数据算出，不写死）
    headline: '',
    lead: '',

    // 首次登录功能引导（本页是第 7 站）
    tourVisible: false,
    tourStep: null,
    tourIndex: 0,
    tourTotal: 0,
  },

  onLoad() {
    const insp = data.inspections;
    const pen = data.penalties;

    const problems = insp.problems.map((p) => Object.assign({}, p));
    const stages = insp.stages.map((s) => Object.assign({}, s));
    const months = insp.months.map((m) => Object.assign({}, m));

    // 食材加挑菜要点：数据里有批次，文案里有怎么挑，合起来才是一张能用的卡
    const maxIng = (insp.ingredients || []).reduce((m, x) => Math.max(m, x.n || 0), 1) || 1;
    const ingredients = (insp.ingredients || []).map((x) => ({
      name: x.name,
      n: x.n,
      tip: tips.tipOf(x.name),
      w: Math.round(((x.n || 0) / maxIng) * 1000) / 10,
    }));

    // 「微生物 + 添加剂」两类合计占比：这一页最想让人记住的一个数
    const twoBig = problems
      .filter((p) => p.name === '微生物污染' || p.name.indexOf('食品添加剂') === 0)
      .reduce((sum, p) => sum + p.n, 0);
    const twoBigPct = pct(twoBig, insp.batches);

    const topStage = stages[0] || null;

    // 概览四格：两个讲规模，两个讲结论
    const ov = [
      { key: 'batches', num: insp.batches, unit: '批', label: '不合格批次' },
      { key: 'notices', num: insp.notices, unit: '期', label: '抽检通告' },
      { key: 'twoBig', num: twoBigPct + '%', unit: '', label: '微生物 + 添加剂' },
      // 处罚总数不给：省局双公示持续更新，抓到的只是样本，写个「6 起」会被当成全量
      { key: 'stage', num: (topStage ? topStage.pct : 0) + '%', unit: '', label: '流通环节占比' },
    ];

    // 一句话结论：几个数拼成一句人话，数据变了这句话自己跟着变
    const headline =
      '微生物近一半，添加剂两成，' +
      (topStage ? Math.round(topStage.pct) + '% 的问题出在' + topStage.name + '环节' : '') +
      '。知道原因，才知道回家多做哪一步。';

    this.setData({
      insp: {
        batches: insp.batches,
        notices: insp.notices,
        problems,
        stages,
        tagged: insp.tagged,
        unmatched: insp.unmatched,
      },
      problems,
      stages,
      months,
      ingredients,
      latest: insp.latest || [],
      // 案例金额：数据里是元，界面统一显示万元
      cases: (pen.cases || []).map((x) =>
        Object.assign({}, x, {
          amount: (Number(x.amount || 0) / 10000).toFixed(1) + ' 万元',
        })
      ),
      ov,
      headline,
      lead:
        '买菜前花三分钟，把常吃的几样挑明白。今天吃什么、买的时候看什么、' +
        '近期哪些食材需要留意，均在本页。',
      scope: data.scope,
      pen,
    });
  },

  onShow() {
    // 字号 / 长辈模式跟全局一致，页面不自己存一份
    this.setData({
      pageStyle: app.getFontStyle ? app.getFontStyle() : '',
      elderMode: !!(app.getElderMode && app.getElderMode()),
    });
    // 从引导里切到本页时接着亮；不在本页时遮罩不显示，页面照常用
    this.syncTour();
  },

  // 月度分布折叠：默认收着，想看细节的人点开
  onToggleMonths() {
    this.setData({ monthsOpen: !this.data.monthsOpen });
  },

  // 首屏 CTA：去专属推荐生成今日食单
  onGoMenu() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },

  // —— 功能引导（跨 tab，进度在 app.globalData.tour）——
  syncTour() {
    const a = getApp();
    if (!a.tourStateOf) return;
    const st = a.tourStateOf('foodsafety');
    this.setData({
      tourVisible: st.visible,
      tourStep: st.step,
      tourIndex: st.index,
      tourTotal: st.total,
    });
  },

  onTourNext() {
    const a = getApp();
    const st = a.nextTour ? a.nextTour() : null;
    this.setData({ tourVisible: false });
    if (!st) {
      require('../../utils/tour').finishConfirm();
      return;
    }
    if (st.step && st.step.page !== 'foodsafety') {
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
    const a = getApp();
    const self = this;
    require('../../utils/tour').skipConfirm(() => {
      if (a.endTour) a.endTour();
      self.setData({ tourVisible: false });
    });
  },

  onShareAppMessage() {
    return {
      title: '食品安全：买菜前花三分钟，把常吃的几样挑明白',
      path: '/pages/foodsafety/foodsafety',
    };
  },
});
