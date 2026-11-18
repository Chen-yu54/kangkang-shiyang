// pages/foodsafety/foodsafety.js —— 食品安全（公开数据页）
//
// 这一页只做两件事：把省局公开的「抽检通告」和「处罚决定书」拆成能看懂的数字与案例。
// 三条纪律：
//   1. 数字全部来自 data/foodSafety.js（由 scripts/build-food-safety.js 从 CSV 生成），页面不做二次估算
//   2. 算不出来的不给（比如合格率），宁可少一个漂亮数，也不给一个假数
//   3. 案例只写案由、法条、处理结果，不点商家名——原文已做打码，这里不替任何人下结论

const data = require('../../data/foodSafety');

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
  basis: '/images/ingredients/season_intro_oldbook.png',
  foot: '/images/ingredients/home_today_bamboo.png',
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
    ov: [],
    topProblem: null,
    topStage: null,
    months: [],
    monthFirst: { label: '', n: 0 },
    monthLast: { label: '', n: 0 },
    lead: '',
  },

  onLoad() {
    const insp = data.inspections;
    const pen = data.penalties;

    const problems = insp.problems.map((p) => Object.assign({}, p));
    const stages = insp.stages.map((s) => Object.assign({}, s));
    const months = insp.months.map((m) => Object.assign({}, m));

    // 「微生物 + 添加剂」两类合计占比：这页最想让人记住的一个数
    const twoBig = problems
      .filter((p) => p.name === '微生物污染' || p.name.indexOf('食品添加剂') === 0)
      .reduce((sum, p) => sum + p.n, 0);
    const twoBigPct = pct(twoBig, insp.batches);

    const topProblem = problems[0] || null;
    const topStage = stages[0] || null;

    const ov = [
      {
        key: 'batches',
        num: insp.batches,
        unit: '批',
        label: '不合格批次',
        note: `${data.scope.from} 至 ${data.scope.to}`,
      },
      {
        key: 'notices',
        num: insp.notices,
        unit: '期',
        label: '抽检通告',
        note: '省局公开',
      },
      {
        key: 'twoBig',
        num: `${twoBigPct}%`,
        unit: '',
        label: '微生物 + 添加剂',
        note: '占全部不合格批次',
      },
      {
        key: 'penalty',
        num: pen.food,
        unit: '起',
        label: '食品类处罚',
        note: `罚没合计 ${pen.amountWan} 万`,
      },
    ];

    this.setData({
      insp: {
        batches: insp.batches,
        notices: insp.notices,
        problems,
        stages,
        ingredients: insp.ingredients,
        tagged: insp.tagged,
        unmatched: insp.unmatched,
        latest: insp.latest,
      },
      months,
      monthFirst: months[0] || { label: '', n: 0 },
      monthLast: months[months.length - 1] || { label: '', n: 0 },
      ov,
      topProblem,
      topStage,
      lead:
        `${insp.batches} 批次不合格里，${twoBigPct}% 是微生物与添加剂问题；` +
        `${topStage ? topStage.pct : 0}% 在${topStage ? topStage.name : '流通'}环节查出。`,
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
  },

  onShareAppMessage() {
    return {
      title: '食品安全：抽检与处罚，公开数据怎么看',
      path: '/pages/foodsafety/foodsafety',
    };
  },
});
