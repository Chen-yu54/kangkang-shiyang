// pages/solarterm/solarterm.js —— 节气页（列表 → 详情在一页内完成）
//
// 两个视图共用一页：
//   view = 'list'   → 24 节气列表，当前节气高亮
//   view = 'detail' → 节气详情：文化简介 + 当令食材 + 按早/中/晚分的当令菜品
//
// 餐次说明：知识库没有「餐次」字段，mealHints 由做法推断（煮/蒸→三餐，炒/炖/煲等→午晚），
// 属建议而非数据标注，界面必须写明「按做法建议」。等 A 补 meal_time 后改读真值。

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const share = require('../../utils/share');
const solarTheme = require('../../utils/solarTheme');
const seasonalBg = require('../../utils/seasonalBg');
const termHealth = require('../../data/termHealth');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const ALL_MEAL = '';

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
    view: 'list',
    status: 'loading', // 列表态：loading | ready | empty | error
    dishStatus: 'loading', // 详情菜品态：loading | ready | empty | error
    terms: [],
    currentName: '',
    detail: null,
    detailPoster: '',
    dishes: [], // 当前餐次筛选后的列表
    allDishes: [], // 全部当令菜品（按 id 命中餐次用）
    mealFilter: ALL_MEAL,
    mealTabs: [],
    emptyMealText: '',
    sharing: false,
    copy: {},
    // —— 节气动态背景（详情视图才有；来自节气材料包 seasonalBg，六层渲染）
    bg: null, // { style, glowStyle, overlayStyle, texture, particles, elements }
    health: null, // 养生提醒（data/termHealth.js：气候 + 今天/吃什么/起居）
  },

  onLoad(options) {
    // 首页的节气海报带 term 进来：直接进详情，省掉一次列表点击
    this.pendingTerm = (options && options.term) ? decodeURIComponent(options.term) : '';
    this.setData({
      copy: {
        empty: t('solarterm.empty'),
        detailEmpty: t('solarterm.detailEmpty'),
        ingredients: t('solarterm.ingredients'),
        dishes: t('solarterm.dishes'),
        intro: t('solarterm.intro'),
        culture: t('solarterm.culture'),
        cultureNote: t('solarterm.cultureNote'),
        phenology: t('solarterm.phenology'),
        phenologyHint: t('solarterm.phenologyHint'),
        folk: t('solarterm.folk'),
        folkConfidence: t('solarterm.folkConfidence'),
        ingredientHint: t('solarterm.ingredientHint'),
        mealHint: t('solarterm.mealHint'),
        mealEmpty: t('solarterm.mealEmpty'),
        all: t('common.all'),
        error: t('home.error'),
        retry: t('common.retry'),
        shareLongImage: t('solarterm.shareLongImage'),
        healthTitle: t('solarterm.healthTitle'),
        healthNote: t('solarterm.healthNote'),
        generating: t('share.generating'),
        saved: t('share.saved'),
        saveFailed: t('share.failed'),
      },
      mealTabs: [
        { key: ALL_MEAL, label: t('common.all') },
        { key: '早', label: t('solarterm.mealMorning') },
        { key: '午', label: t('solarterm.mealNoon') },
        { key: '晚', label: t('solarterm.mealNight') },
      ],
    });
    this.loadTerms();
    track.pageView('solarterm');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  loadTerms() {
    this.setData({ status: 'loading' });

    api
      .getTerms()
      .then((res) => {
        const terms = res.list || [];
        // 当前节气由日期窗口确定性推算，不是人工标注
        const current = dataSource.getCurrentTerm();
        this.setData({
          terms,
          currentName: current ? current.name : '',
          status: terms.length > 0 ? 'ready' : 'empty',
        });

        // 首页节气海报带 term 参数进来：直接展开该节气详情，省一次列表点击
        if (this.pendingTerm) {
          const name = this.pendingTerm;
          this.pendingTerm = '';
          if (terms.some((x) => x.name === name)) {
            this.onTapTerm({ detail: { name } });
          }
        }
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  onTapTerm(e) {
    const name = e.detail && e.detail.name;
    if (!name) return;

    const detail = this.decorateTerm(dataSource.getTerm(name));
    // 节气海报：AI 生成的水墨横板图，24 节气各一张（utils/solarTheme.js）
    const themeInfo = solarTheme.getThemeByName(detail ? detail.name : name);
    this.setData({
      view: 'detail',
      detail,
      detailPoster: themeInfo ? themeInfo.poster : '',
      dishes: [],
      allDishes: [],
      mealFilter: ALL_MEAL,
      dishStatus: 'loading',
      // 动态背景：每个节气一套天空渐变 + 纹理 + 光晕 + 漂浮元素 + 粒子
      bg: buildScene(detail ? detail.name : name),
      // 养生提醒：气候特征 + 今天怎么喝 + 当令吃什么 + 起居（已剔功效性表述）
      health: detail ? termHealth.buildToday(detail.name, {}) : null,
    });

    track.solarTermView(name);
    if (detail) this.loadDishes(name);
    else this.setData({ dishStatus: 'empty' });
  },

  // 食材价格档位：视图层按 priceLevel 渲染 1–3 颗星形图（压印五角星），
  // WXML 不做计算，这里只保证 priceLevel 是 1–3 的合法值
  decorateTerm(term) {
    if (!term) return term;
    const details = (term.ingredientDetails || []).map((x) => {
      const level = Number(x.priceLevel) || 0;
      return Object.assign({}, x, { priceLevel: Math.min(Math.max(level, 0), 3) });
    });
    // 三候：数据只给物候名，序号在视图层要显示成「一候/二候/三候」，
    // 在 JS 侧拼好，避免 WXML 里做数组下标取字面量
    const houLabels = [t('solarterm.hou1'), t('solarterm.hou2'), t('solarterm.hou3')];
    const phenology = (term.phenology || []).map((text, i) => ({
      label: houLabels[i] || '',
      text,
      no: i + 1,
    }));
    return Object.assign({}, term, { ingredientDetails: details, phenologyList: phenology });
  },

  loadDishes(termName) {
    this.setData({ dishStatus: 'loading' });

    api
      .getRecipes({ term: termName })
      .then((res) => {
        const list = (res.list || []).map(toCard);
        this.setData({
          allDishes: list,
          dishStatus: list.length > 0 ? 'ready' : 'empty',
        });
        this.applyMealFilter();
      })
      .catch(() => {
        this.setData({ dishStatus: 'error' });
      });
  },

  // 按当前餐次筛选；某餐次没有菜时如实说明，不拿别的餐次充数
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

  // 生成节气食单长图并保存到相册
  onShareLongImage() {
    if (this.data.sharing) return;
    if (!this.data.detail) return;

    this.setData({ sharing: true });
    wx.showLoading({ title: this.data.copy.generating, mask: true });

    share
      .drawTermLongImage({
        page: this,
        canvasId: 'shareCanvas',
        term: this.data.detail,
        dishes: this.data.allDishes.slice(0, 3),
      })
      .then((filePath) => share.saveImageToAlbum(filePath))
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: this.data.copy.saved, icon: 'none' });
        track.share('longimage', 'button');
      })
      .catch(() => {
        wx.hideLoading();
        wx.showToast({ title: this.data.copy.saveFailed, icon: 'none' });
      })
      .then(() => {
        this.setData({ sharing: false });
      });
  },

  onRetry() {
    if (this.data.view === 'detail' && this.data.detail) {
      this.loadDishes(this.data.detail.name);
      return;
    }
    this.loadTerms();
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'solarterm');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'solarterm');

    const patch = (item) => (item.id === id ? Object.assign({}, item, { faved: !added }) : item);
    this.setData({
      allDishes: this.data.allDishes.map(patch),
      dishes: this.data.dishes.map(patch),
    });
  },

  // 转发当前节气
  onShareAppMessage() {
    track.share(this.data.view === 'detail' ? 'term' : 'app', 'menu');
    if (this.data.detail) return share.messageForTerm(this.data.detail);
    return share.messageForApp();
  },
});

// 节气动态背景：从材料包的六层配置拼出本页需要的四组数据。
// 取不到配置（异常节气名）返回 null，页面退回默认纸底，不报错。
function buildScene(name) {
  const style = seasonalBg.getBgStyleByName(name);
  if (!style) return null;
  const bg = seasonalBg.getBgByName(name);
  return {
    style: style.style,
    overlayStyle: 'background: ' + (bg && bg.overlayGradient ? bg.overlayGradient : 'none') + ';',
    texture: seasonalBg.getTextureSVGByName(name),
    particles: seasonalBg.getParticlesByName(name),
    elements: seasonalBg.getFloatingElementsByName(name),
  };
}
