// pages/recommend/recommend.js —— 个性化推荐页（团队分工方案 6.3 D5）
//
// 3 张菜卡 + 「推荐过程」折叠区（默认收起）+ 换一批。
//
// 一条硬规矩：推荐依据只能来自接口的 reason / recallSource，前端不编理由。
// 服务不可用时降级为「当令菜」，并在页面上明确标注这是降级结果，不冒充个性化推荐。

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const PREFS_KEY = 'prefAnswers';
const PAGE_SIZE = 3;

// 紧凑卡：图 + 菜名 + 一句特点，一屏放得下 3 张（线框稿「为你挑的」）
function toCard(dish) {
  return {
    id: dish.id,
    name: dish.name,
    subText: dish.how || '',
    cuisine: dish.cuisine,
    image: dish.image,
  };
}

// reason / recallSource 的具体结构待 B 的契约确认；
// 当前兼容「字符串数组」与「{label} 对象数组」两种形态，接口直出文案。
function toLabels(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.label || item.name || '';
      return '';
    })
    .filter(Boolean);
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | empty | error
    dishes: [],
    degraded: false,
    reason: [],
    recallSource: [],
    // 默认展开：上轮评审追问过「推荐过程是否可追溯」，
    // 藏在折叠区里等于没做，展开后才是可核验的证据
    expanded: true,
    termName: '',
    offset: 0,
    copy: {},
  },

  onLoad() {
    this.setData({
      copy: {
        title: t('recommend.title'),
        degraded: t('recommend.degraded'),
        empty: t('recommend.empty'),
        emptyAction: t('recommend.emptyAction'),
        reason: t('recommend.reason'),
        reasonTerm: t('recommend.reasonTerm'),
        reasonPrefs: t('recommend.reasonPrefs'),
        reasonRecall: t('recommend.reasonRecall'),
        reasonEmpty: t('recommend.reasonEmpty'),
        chainTerm: t('recommend.chainTerm'),
        chainPref: t('recommend.chainPref'),
        chainRecall: t('recommend.chainRecall'),
        chainFilter: t('recommend.chainFilter'),
        genRule: t('recommend.genRule'),
        genModel: t('recommend.genModel'),
        aiTag: t('common.aiGenerated'),
        refresh: t('recommend.refresh'),
        failed: t('recommend.failed'),
        retry: t('common.retry'),
      },
    });

    const current = dataSource.getCurrentTerm();
    const termName = current ? current.name : '';
    this.setData({ termName });
    track.pageView('recommend', termName ? { term: termName } : {});
    this.loadRecommend(0);
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  loadRecommend(offset) {
    this.setData({ status: 'loading' });

    const prefs = wx.getStorageSync(PREFS_KEY);
    api
      .getRecommend({
        term: this.data.termName,
        prefs: prefs && typeof prefs === 'object' ? prefs : null,
        offset,
      })
      .then((res) => {
        const list = (res.dishes || []).map(toCard);
        this.setData({
          status: list.length > 0 ? 'ready' : 'empty',
          dishes: list,
          degraded: res.degraded === true,
          reason: toLabels(res.reason),
          recallSource: toLabels(res.recallSource),
          offset,
        });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  onRefresh() {
    this.loadRecommend(this.data.offset + PAGE_SIZE);
  },

  onToggleReason() {
    this.setData({ expanded: !this.data.expanded });
  },

  onRetry() {
    this.loadRecommend(0);
  },

  onGoTerm() {
    wx.navigateTo({ url: '/pages/solarterm/solarterm?view=list' });
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'recommend');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'recommend');

    const dishes = this.data.dishes.map((item) =>
      item.id === id ? Object.assign({}, item, { faved: !added }) : item
    );
    this.setData({ dishes });
  },
});
