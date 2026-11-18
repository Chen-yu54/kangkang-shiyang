// pages/favorite/favorite.js —— 收藏页（团队分工方案 6.3 D3「本地 storage 保存」）
//
// storage 里只存菜品 id，展示时现取详情：
// 数据更新后收藏项自动跟上，不会留下过期的整条副本。

const api = require('../../utils/api');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;

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
  };
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | empty | error
    list: [],
    countText: '',
    copy: {},
  },

  onLoad() {
    this.setData({
      copy: {
        masthead: t('favorite.masthead'),
        mastheadNo: t('favorite.no'),
        empty: t('favorite.empty'),
        emptyAction: t('favorite.emptyAction'),
        remove: t('favorite.remove'),
        removeDone: t('favorite.removeDone'),
        error: t('home.error'),
        retry: t('common.retry'),
      },
    });
    track.pageView('favorite');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
    // 从详情页返回时收藏可能已变化，每次显示都重读
    this.loadList();
  },

  loadList() {
    const ids = favorite.getIds();
    if (ids.length === 0) {
      this.setData({ status: 'empty', list: [], countText: '' });
      return;
    }

    this.setData({ status: 'loading' });

    api
      .getRecipes({})
      .then((res) => {
        const byId = {};
        (res.list || []).forEach((dish) => {
          byId[dish.id] = dish;
        });

        // 按收藏顺序（最近在前）排列；数据里已不存在的条目自动略过
        const list = ids
          .map((id) => byId[id])
          .filter(Boolean)
          .map(toCard);

        this.setData({
          status: list.length > 0 ? 'ready' : 'empty',
          list,
          countText: list.length > 0 ? i18n.tpl('favorite.count', { count: list.length }) : '',
        });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  onRetry() {
    this.loadList();
  },

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'favorite');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;

    favorite.remove(id);
    track.favoriteEvent(id, 'remove', 'favorite');

    const list = this.data.list.filter((item) => item.id !== id);
    this.setData({
      list,
      status: list.length > 0 ? 'ready' : 'empty',
      countText: list.length > 0 ? i18n.tpl('favorite.count', { count: list.length }) : '',
    });
    wx.showToast({ title: this.data.copy.removeDone, icon: 'none' });
  },

  onEmptyAction() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },
});
