// pages/search/search.js —— 搜索页（团队分工方案 6.3 D3「菜名 / 食材关键词」）
//
// 三段结构：搜索框 → 未搜索时展示历史与当令词 → 搜索后展示结果 / 空态 / 错误。
// 语音搜菜名本期不做：按钮只留位置，点击明确告知未开放，不假装能识别。

const api = require('../../utils/api');
const dataSource = require('../../utils/dataSource');
const favorite = require('../../utils/favorite');
const format = require('../../utils/format');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const HISTORY_KEY = 'searchHistory';
const MAX_HISTORY = 10;

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

Page({
  data: {
    pageStyle: '',
    keyword: '',
    submitted: false,
    status: 'idle', // idle | loading | ready | empty | error
    results: [],
    countText: '',
    history: [],
    hotWords: [],
    copy: {},
  },

  onLoad() {
    this.setData({
      copy: {
        masthead: t('search.masthead'),
        mastheadNo: t('search.no'),
        placeholder: t('search.placeholder'),
        action: t('search.action'),
        history: t('search.history'),
        clearHistory: t('search.clearHistory'),
        hot: t('search.hot'),
        emptyKeyword: t('search.emptyKeyword'),
        empty: t('search.empty'),
        failed: t('search.failed'),
        retry: t('common.retry'),
        voice: t('search.voice'),
        voiceHint: t('search.voiceHint'),
      },
      history: this.readHistory(),
    });
    this.loadHotWords();
    track.pageView('search');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },

  // —— 搜索历史（本地 storage，最多 10 条）——

  readHistory() {
    const value = wx.getStorageSync(HISTORY_KEY);
    return Array.isArray(value) ? value.filter((w) => typeof w === 'string' && w) : [];
  },

  writeHistory(keyword) {
    const list = [keyword].concat(this.readHistory().filter((w) => w !== keyword)).slice(0, MAX_HISTORY);
    wx.setStorageSync(HISTORY_KEY, list);
    this.setData({ history: list });
  },

  onClearHistory() {
    wx.showModal({
      title: this.data.copy.clearHistory,
      content: '',
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;
        wx.setStorageSync(HISTORY_KEY, []);
        this.setData({ history: [] });
      },
    });
  },

  // —— 当令推荐词：全部从数据派生，不写死任何菜名或食材 ——

  loadHotWords() {
    const current = dataSource.getCurrentTerm();
    const termName = current ? current.name : '';

    api.getRecipes({ term: termName }).then((res) => {
      const words = [];
      if (current) current.ingredients.slice(0, 4).forEach((word) => words.push(word));
      (res.list || []).slice(0, 3).forEach((dish) => words.push(dish.name));

      const unique = [];
      words.forEach((word) => {
        if (word && unique.indexOf(word) < 0) unique.push(word);
      });
      this.setData({ hotWords: unique.slice(0, 6) });
    });
  },

  // —— 输入与搜索 ——

  onInput(e) {
    this.setData({ keyword: e.detail.value || '' });
  },

  onConfirm() {
    this.search();
  },

  onTapWord(e) {
    const word = e.currentTarget.dataset.word;
    if (!word) return;
    this.setData({ keyword: word });
    this.search();
  },

  onClear() {
    this.setData({ keyword: '', submitted: false, status: 'idle', results: [], countText: '' });
  },

  search() {
    const keyword = String(this.data.keyword || '').trim();
    if (!keyword) return;

    this.writeHistory(keyword);
    this.setData({ submitted: true, status: 'loading' });

    api
      .getRecipes({ keyword })
      .then((res) => {
        const list = (res.list || []).map(toCard);
        this.setData({
          status: list.length > 0 ? 'ready' : 'empty',
          results: list,
          countText: list.length > 0 ? i18n.tpl('search.resultCount', { count: list.length }) : '',
        });
      })
      .catch(() => {
        this.setData({ status: 'error' });
      });
  },

  onRetry() {
    this.search();
  },

  // —— 交互 ——

  onTapDish(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    track.dishClick(id, 'search');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onFavoriteTap(e) {
    const id = e.detail && e.detail.id;
    if (!id) return;
    const added = favorite.has(id);
    favorite.toggle(id);
    track.favoriteEvent(id, added ? 'remove' : 'add', 'search');

    const results = this.data.results.map((item) =>
      item.id === id ? Object.assign({}, item, { faved: !added }) : item
    );
    this.setData({ results });
  },

  // 语音搜菜名：本期不做，只留位置并明确告知，不假装识别
  onVoiceTap() {
    wx.showToast({ title: this.data.copy.voiceHint, icon: 'none' });
  },
});
