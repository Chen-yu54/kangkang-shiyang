// pages/termDetail/termDetail.js —— 节气详情（二级页）
//
// 首页「节气文化」卡只亮到诗文：节气名、一句标语、一首诗。
// 点「立冬的讲究」进这一页，专放诗文以下的内容：
// 三候、民间习俗、养生建议、当令食材、当令菜品。
//
// 与 pages/solarterm 的完整文化页并存：那一页保留海报、简介、标语、诗，
// 由首页节气海报 / 我的页 / 分享卡片进入，两页互不改动。

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const termHealth = require('../../data/termHealth');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');
const share = require('../../utils/share');

const t = i18n.t;
const ALL_MEAL = '';

// 参数里带 % 的不合法序列时 decodeURIComponent 会抛 URIError，
// 放在 onLoad 里裸调会让整页初始化失败，这里做两级安全解码。
function decodeTermParam(raw) {
  if (!raw) return '';
  let s = String(raw);
  for (let i = 0; i < 2; i++) {
    if (s.indexOf('%') < 0) break;
    try {
      const next = decodeURIComponent(s);
      if (next === s) break;
      s = next;
    } catch (e) {
      break;
    }
  }
  return s.trim();
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
    mealText: (dish.mealHints || []).join(' · '),
  };
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | error
    loadError: '',
    detail: null,
    health: null,
    dishes: [],
    allDishes: [],
    dishStatus: 'loading',
    mealFilter: ALL_MEAL,
    mealTabs: [],
    emptyMealText: '',
    copy: {},
  },

  onLoad(options) {
    this.pendingTerm = decodeTermParam(options && options.term);
    this.setData({
      copy: {
        headSub: t('home.cultureOpenSub'),
        phenology: t('solarterm.phenology'),
        phenologyHint: t('solarterm.phenologyHint'),
        folk: t('solarterm.folk'),
        folkConfidence: t('solarterm.folkConfidence'),
        cultureNote: t('solarterm.cultureNote'),
        healthTitle: t('solarterm.healthTitle'),
        healthNote: t('solarterm.healthNote'),
        ingredients: t('solarterm.ingredients'),
        ingredientHint: t('solarterm.ingredientHint'),
        dishes: t('solarterm.dishes'),
        mealHint: t('solarterm.mealHint'),
        mealEmpty: t('solarterm.mealEmpty'),
        detailEmpty: t('solarterm.detailEmpty'),
        empty: t('solarterm.empty'),
        error: t('home.error'),
        retry: t('common.retry'),
      },
      mealTabs: [
        { key: ALL_MEAL, label: t('common.all') },
        { key: '早', label: t('solarterm.mealMorning') },
        { key: '午', label: t('solarterm.mealNoon') },
        { key: '晚', label: t('solarterm.mealNight') },
      ],
    });
    this.loadTerm();
    track.pageView('termDetail');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  loadTerm() {
    let terms = [];
    try {
      terms = dataSource.getTerms();
    } catch (e) {
      this.setData({
        status: 'error',
        loadError: '读取节气数据失败：' + ((e && e.message) || '未知原因'),
      });
      return;
    }

    let current = null;
    try {
      current = dataSource.getCurrentTerm();
    } catch (e) {
      current = null;
    }

    // 带 term 就用它；没带、编码坏了、名字对不上，都退到当前节气
    let name = this.pendingTerm || '';
    if (!name || !terms.some((x) => x.name === name)) {
      name = (current && current.name) || (terms[0] && terms[0].name) || '';
    }
    this.pendingTerm = '';

    let detail = null;
    try {
      detail = this.decorate(dataSource.getTerm(name));
    } catch (e) {
      this.setData({
        status: 'error',
        loadError: '读取「' + name + '」出错：' + ((e && e.message) || '未知原因'),
      });
      return;
    }

    if (!detail) {
      this.setData({ status: 'error', loadError: '没找到「' + name + '」的节气内容' });
      return;
    }

    // 内容先落地，养生提醒单独补；任何装饰层失败都不影响五个板块
    try {
      this.setData({
        status: 'ready',
        loadError: '',
        detail,
        dishes: [],
        allDishes: [],
        mealFilter: ALL_MEAL,
        dishStatus: 'loading',
        health: null,
      });
    } catch (e) {
      this.setData({
        status: 'error',
        loadError: '「' + name + '」内容写入失败：' + ((e && e.message) || '未知原因'),
      });
      return;
    }

    try {
      const health = termHealth.buildToday(name, {});
      if (health) this.setData({ health });
    } catch (e) {
      console.warn('[termDetail] 养生提醒构建失败', e);
    }

    this.loadDishes(name);
  },

  // 视图层直接读 xxx.length，字段必须一定是数组
  decorate(term) {
    if (!term) return term;
    const houLabels = [t('solarterm.hou1'), t('solarterm.hou2'), t('solarterm.hou3')];
    const phenology = (term.phenology || []).map((text, i) => ({
      label: houLabels[i] || '',
      text,
      no: i + 1,
    }));
    const details = (term.ingredientDetails || []).map((x) => {
      const level = Number(x.priceLevel) || 0;
      return Object.assign({}, x, { priceLevel: Math.min(Math.max(level, 0), 3) });
    });
    return Object.assign({}, term, {
      ingredients: Array.isArray(term.ingredients) ? term.ingredients : [],
      ingredientDetails: details,
      phenologyList: phenology,
      folk: Array.isArray(term.folk) ? term.folk : [],
    });
  },

  loadDishes(termName) {
    this.setData({ dishStatus: 'loading' });
    try {
      const p = api.getRecipes({ term: termName });
      if (!p || typeof p.then !== 'function') {
        this.setData({ dishStatus: 'error' });
        return;
      }
      p.then((res) => {
        const list = (res && res.list ? res.list : []).map(toCard);
        this.setData({
          allDishes: list,
          dishStatus: list.length > 0 ? 'ready' : 'empty',
        });
        this.applyMealFilter();
      }).catch(() => {
        this.setData({ dishStatus: 'error' });
      });
    } catch (e) {
      this.setData({ dishStatus: 'error' });
    }
  },

  applyMealFilter() {
    const filter = this.data.mealFilter;
    const all = this.data.allDishes;
    if (!filter) {
      this.setData({ dishes: all, emptyMealText: '' });
      return;
    }
    const list = all.filter((d) => (d.mealText || '').indexOf(filter) > -1);
    this.setData({
      dishes: list,
      emptyMealText: list.length === 0 ? this.data.copy.mealEmpty : '',
    });
  },

  onTapMeal(e) {
    const key = e.currentTarget.dataset.key;
    if (key === undefined || key === this.data.mealFilter) return;
    this.setData({ mealFilter: key });
    this.applyMealFilter();
  },

  onRetry() {
    if (this.data.detail) {
      this.loadDishes(this.data.detail.name);
      return;
    }
    this.loadTerm();
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'termDetail');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'termDetail');

    const patch = (item) => (item.id === id ? Object.assign({}, item, { faved: !added }) : item);
    this.setData({
      allDishes: this.data.allDishes.map(patch),
      dishes: this.data.dishes.map(patch),
    });
  },

  onShareAppMessage() {
    track.share('term', 'menu');
    return this.data.detail ? share.messageForTerm(this.data.detail) : share.messageForApp();
  },
});
