// pages/dish/dish.js —— 菜品详情页
//
// 渲染 card_meta.csv 的客观字段：主料、做法方式与做法、少食提示、难度与花费、
// 适合人群、需要留意、过敏原、来源类型、证据等级、数据来源。
//
// 两条硬规矩：
//   1. 功效字段（effect）不渲染：V3.0 要求零功效表述，页面只展示客观信息
//   2. 字段缺失 → 整块隐藏，绝不显示空标题或 undefined

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const share = require('../../utils/share');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;

// 证据等级 → 可读文案。等级口径写死在方法说明页，这里只做翻译，
// 不在这里「解释」等级高低，避免每道菜的说法不一致。
const EVIDENCE_KEYS = {
  A: 'dish.evidenceA',
  B: 'dish.evidenceB',
  C: 'dish.evidenceC',
};

function evidenceText(level) {
  const key = EVIDENCE_KEYS[level];
  return key ? t(key) : '';
}

// 出处里的「工作标记」不该露给用户：
//   （P0新建）（P1追加）（P2可追加）是内部排期编号，「存量归类」是编辑过程语。
// 这些都是给编辑看的，用户读到只会觉得莫名其妙，展示层统一剥掉。
function cleanSource(value) {
  const s = String(value || '');
  if (!s) return '';
  return s
    .replace(/（[^）]*(P[0-3]|存量|新建|追加|待补)[^）]*）/g, '')
    .replace(/\([^)]*(P[0-3]|存量|新建|追加|待补)[^)]*\)/g, '')
    .replace(/[；;]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// 节气标签：裸的「雨水」普通用户看不懂是什么意思，明确写成「适合节气：雨水」；
// 只有「全年通用」的菜没有具体节气，换成「全年都适合」
function termLabel(terms) {
  const list = (terms || []).filter(Boolean);
  if (!list.length) return '';
  if (list.every((name) => name === '全年通用')) return '全年都适合';
  return '适合节气：' + list.join(' · ');
}

function toView(recipe) {
  return {
    id: recipe.id,
    name: recipe.name,
    cuisineName: recipe.cuisineName,
    cuisine: recipe.cuisine,
    termText: termLabel(recipe.terms),
    // 括号里那句时令由头：为什么这个时节吃它（「增城菜心当造」）
    termNote: recipe.termNote || '',
    mainTerm: (recipe.terms || [])[0] || '',
    mainIngredients: recipe.mainIngredients,
    method: recipe.method,
    how: recipe.how,
    // 食用建议（caution）整块不再展示：知识库里的写法是给编辑看的，
    // 「高嘌呤」「升糖」这类描述放到 C 端容易被读成禁忌判断，先下线。
    difficultyText: format.difficultyLabel(recipe.difficulty),
    costText: format.costLabel(recipe.costLevel),
    source: cleanSource(recipe.source),
    origin: recipe.origin,
    originText: format.originLabel(recipe.origin),
    evidence: recipe.evidence,
    evidenceText: evidenceText(recipe.evidence),
    allergen: format.softenCaution(recipe.allergen),
    ageSuitable: recipe.ageSuitable,
    ageCaution: recipe.ageCaution,
    // 典籍药膳且未核验时提示：这类条目不应进入个性化推荐
    isUnverifiedClassic: recipe.origin === 'classic' && !recipe.verified,
    image: recipe.image,
  };
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | notfound | error
    dish: null,
    faved: false,
    favoriteText: '',
    favoritedText: '',
    sourceOpen: false,
    elderMode: false,
    related: [], // 同节气的其他菜：详情页给一条「还能吃这些」的路
    copy: {},
  },

  onLoad(options) {
    this.dishId = options && options.id ? decodeURIComponent(options.id) : '';

    this.setData({
      favoriteText: t('dish.favorite'),
      favoritedText: t('dish.favorited'),
      copy: {
        notFound: t('dish.notFound'),
        notFoundAction: t('dish.notFoundAction'),
        error: t('home.error'),
        retry: t('common.retry'),
        mainIngredients: t('dish.mainIngredients'),
        ingredientHint: t('dish.ingredientHint'),
        method: t('dish.method'),
        steps: t('dish.steps'),
        difficulty: t('dish.difficulty'),
        cost: t('dish.cost'),
        ageSuitable: t('dish.ageSuitable'),
        ageCaution: t('dish.ageCaution'),
        allergen: t('dish.allergen'),
        evidence: t('dish.evidence'),
        evidenceBlock: t('dish.evidenceBlock'),
        sourceShow: t('dish.sourceShow'),
        sourceHide: t('dish.sourceHide'),
        aiImage: t('dish.aiImage'),
        origin: t('dish.origin'),
        classicHint: t('dish.classicHint'),
        source: t('dish.source'),
        termWhy: t('dish.termWhy'),
        related: t('dish.related'),
      },
    });

    this.loadDish();
    track.pageView('dish');
  },

  onShow() {
    const app = getApp();
    this.setData({
      pageStyle: app.getFontStyle(),
      elderMode: app.getElderMode ? app.getElderMode() : false,
    });
  },

  loadDish() {
    if (!this.dishId) {
      this.setData({ status: 'notfound' });
      return;
    }

    this.setData({ status: 'loading' });

    api
      .getRecipeById(this.dishId)
      .then((res) => {
        if (!res.recipe) {
          this.setData({ status: 'notfound' });
          return;
        }
        const view = toView(res.recipe);
        this.setData({
          status: 'ready',
          dish: view,
          faved: favorite.has(this.dishId),
          related: relatedByTerm(view, this.dishId),
        });
        // 详情页导航标题用菜名，数据来自接口，不是写死文案
        wx.setNavigationBarTitle({ title: res.recipe.name });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  // 图片失败由 dishMedia 组件内部接管，页面不再持有 image 状态

  // 出处默认收起：详情页要保持可扫读，但必须「点得开」——
  // 上轮评审问的就是「推荐过程/资料来源是否可追溯」，可展开比直接铺一行字更有说服力
  onToggleSource() {
    this.setData({ sourceOpen: !this.data.sourceOpen });
  },
  // 同节气还有哪些菜：只在同一节气里取，跨节气的「相关」是编的，不做
  onTapRelated(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onToggleFavorite() {
    if (!this.dishId) return;
    const wasFaved = favorite.has(this.dishId);
    favorite.toggle(this.dishId);
    track.favoriteEvent(this.dishId, wasFaved ? 'remove' : 'add', 'dish');
    this.setData({ faved: !wasFaved });
    wx.showToast({
      title: wasFaved ? t('favorite.removeDone') : this.data.favoritedText,
      icon: 'none',
    });
  },

  // 主料 → 食材档案（分包页）。这里只传名称，不读任何食材数据：
  // 食材库 190 KB 在分包里，主包 require 不到，也不需要。
  onTapIngredient(e) {
    const name = (e && e.currentTarget && e.currentTarget.dataset.name) || '';
    if (!name) return;
    wx.navigateTo({
      url: '/packageIngredient/pages/detail/detail?name=' + encodeURIComponent(name),
      fail: () => {
        wx.showToast({ title: t('dish.ingredientUnavailable'), icon: 'none' });
      },
    });
  },

  onShareAppMessage() {
    track.share('dish', 'menu', this.dishId);
    return share.messageForDish(this.data.dish || { id: this.dishId, name: '' });
  },

  onRetry() {
    this.loadDish();
  },

  onBack() {
    wx.navigateBack();
  },
});

// 同节气的其他菜，最多 4 道。取不到就返回空数组，页面整块隐藏。
function relatedByTerm(view, selfId) {
  const term = (view && view.mainTerm) || '';
  if (!term) return [];
  try {
    return dataSource
      .getRecipes()
      .filter((r) => r.id !== selfId && (r.terms || []).indexOf(term) >= 0)
      .slice(0, 4)
      .map((r) => ({ id: r.id, name: r.name, cuisineName: r.cuisineName || '' }));
  } catch (err) {
    return [];
  }
}
