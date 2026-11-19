// pages/mine/mine.js —— 我的（一级 Tab 页）
//
// 版面按「档案页」排：刊头 → 节气封面 → 档案卡（头像 + 三个数字）→ 收藏横滑 →
// 偏好逐行 → 更多。三段编号沿用首页的壹贰叁，不在这一页另起一套视觉语言。
//
// 口径：
//   · 全部数据来自本机（收藏 id、偏好答案、字号、长辈模式、分享开关），不联网
//   · 不编造没有的指标：没有「饮食记录」「偏好」「食养天数」就不摆这些数字
//   · 收藏卡与收藏页同源：storage 只存 id，展示时现取详情

const favorite = require('../../utils/favorite');
const dataSource = require('../../utils/dataSource');
const dishImages = require('../../utils/dishImages');
const nutrition = require('../../utils/nutrition');
const i18n = require('../../utils/i18n');
const consent = require('../../utils/consent');
const track = require('../../utils/track');

const t = i18n.t;

// 首页收藏横滑最多摆几道：再多就滑不到头，也没必要在这一页逛完收藏
const FAV_PREVIEW = 8;

// 清除本地数据时一并清掉的键（fontScale 是显示偏好，不属于用户数据，不在此列）
const USER_DATA_KEYS = [
  'favoriteIds',
  'prefAnswers',
  'consentFlags',
  'searchHistory',
  'trackQueue',
  'preftestSwitches',
];

function readAnswers() {
  try {
    const stored = wx.getStorageSync('prefAnswers');
    return stored && typeof stored === 'object' ? stored : {};
  } catch (err) {
    return {};
  }
}

Page({
  data: {
    shareOn: false, // 数据分享开关状态，onShow 时刷新
    pageStyle: '',
    fontScale: 1,
    fontOptions: [],
    fontLabelText: '',
    // 登录态：登录只存本机，不联网
    loggedIn: false,
    nickName: '',
    avatarUrl: '',
    // 节气封面
    termName: '',
    termNo: 0,
    termPoster: '',
    // 档案卡三个数字
    favoriteCount: 0,
    prefDone: false,
    // 收藏预览
    favList: [],
    favMoreText: '',
    // 偏好摘要
    tasteText: '',
    avoidText: '',
    // 长辈模式
    elderMode: false,
    // 登录后的功能引导
    tourVisible: false,
    tourStep: null,
    tourIndex: 0,
    tourTotal: 0,
    copy: {},
  },

  onLoad() {
    const app = getApp();
    const opts = app.getFontScaleOptions ? app.getFontScaleOptions() : [1, 1.15, 1.3];
    const labels = [t('mine.fontStandard'), t('mine.fontLarge'), t('mine.fontXLarge')];

    this.setData({
      fontOptions: opts.map((value, i) => ({ value, label: labels[i] || String(value) })),
      copy: {
        mastTitle: t('mine.mastTitle'),
        notLogin: t('mine.notLogin'),
        loginAction: t('mine.loginAction'),
        loggedInHint: t('mine.loggedInHint'),
        logout: t('mine.logout'),
        service: t('mine.agreementService'),
        privacyDoc: t('mine.agreementPrivacy'),
        agentEntry: t('mine.agentEntry'),
        agentEntryHint: t('mine.agentEntryHint'),
        consent: t('mine.consent'),
        consentOn: t('mine.consentOn'),
        consentOff: t('mine.consentOff'),
        method: t('mine.method'),
        foodSafety: t('mine.foodSafety'),
        foodSafetyHint: t('mine.foodSafetyHint'),
        favorite: t('mine.favorite'),
        pref: t('mine.pref'),
        tasteLabel: t('mine.tasteLabel'),
        avoidLabel: t('mine.avoidLabel'),
        tasteEmpty: t('mine.tasteEmpty'),
        avoidEmpty: t('mine.avoidEmpty'),
        fontScale: t('mine.fontScale'),
        elderLabel: t('mine.elderLabel'),
        elderDesc: t('mine.elderDesc'),
        favEmptyTitle: t('mine.favEmptyTitle'),
        favEmptySub: t('mine.favEmptySub'),
        prefNote: t('mine.prefNote'),
        prefEmpty: t('mine.prefEmpty'),
        prefDone: t('mine.prefDone'),
        more: t('mine.more'),
        replayTour: t('mine.replayTour'),
        about: t('mine.about'),
        clearData: t('mine.clearData'),
        clearConfirm: t('mine.clearConfirm'),
        cleared: t('mine.cleared'),
        version: t('mine.version'),
        loggedTag: t('mine.loggedTag'),
        statFavorite: t('mine.statFavorite'),
        statTaste: t('mine.statTaste'),
        statFont: t('mine.statFont'),
      },
    });
    track.pageView('mine');
  },

  onShow() {
    // 收藏、偏好、字号都可能在别处被改动，每次显示都重读
    const app = getApp();
    const answers = readAnswers();
    const taste = Array.isArray(answers.q5)
      ? answers.q5.map((k) => (nutrition.TASTE_RULES[k] || {}).label).filter(Boolean)
      : [];
    const avoid = Array.isArray(answers.q6)
      ? answers.q6
          .filter((k) => k !== 'a7')
          .map((k) => (nutrition.AVOID_RULES[k] || {}).label)
          .filter(Boolean)
      : [];
    const hasPref = taste.length > 0 || avoid.length > 0;
    const user = app.getUser();
    const info = app.getTermInfo ? app.getTermInfo() : {};
    const terms = dataSource.getTerms();
    const termNo = terms.findIndex((item) => item.name === info.name) + 1;

    this.setData({
      pageStyle: app.getFontStyle(),
      fontScale: app.getFontScale ? app.getFontScale() : 1,
      fontLabelText: this.labelOfScale(app.getFontScale ? app.getFontScale() : 1),
      shareOn: consent.isGranted(),
      loggedIn: !!user,
      nickName: user ? user.nickName : '',
      avatarUrl: user ? user.avatarUrl : '',
      elderMode: !!(app.getElderMode && app.getElderMode()),
      termName: info.name || '',
      termNo,
      termPoster: info.poster || '',
      favoriteCount: favorite.count(),
      prefDone: hasPref,
      tasteText: taste.length ? taste.join(' · ') : this.data.copy.tasteEmpty,
      avoidText: avoid.length ? avoid.join('、') : this.data.copy.avoidEmpty,
      favList: this.buildFavorites(),
      favMoreText: i18n.tpl('mine.favMore', { count: favorite.count() }),
    });

    this.syncTour();
  },

  labelOfScale(scale) {
    const found = this.data.fontOptions.filter((o) => o.value === scale)[0];
    return found ? found.label : t('mine.fontStandard');
  },

  // 收藏预览：只取最近收藏的前几道，按 storage 里的顺序排
  buildFavorites() {
    const ids = favorite.getIds().slice(0, FAV_PREVIEW);
    return ids
      .map((id) => dataSource.getRecipeById(id))
      .filter(Boolean)
      .map((dish) => ({
        id: dish.id,
        name: dish.name,
        cuisine: dish.cuisine,
        meta: [dish.cuisineName, (dish.terms || [])[0]].filter(Boolean).join(' · '),
        image: dish.image || dishImages.imageForName(dish.name),
      }));
  },

  // 未登录 → 登录；已登录 → 改头像昵称。都走同一个页面，登录页自带返回键
  onTapLogin() {
    wx.navigateTo({ url: '/pages/login/login?from=mine' });
  },

  onTapTerm() {
    const name = this.data.termName;
    if (!name) return;
    wx.navigateTo({ url: '/pages/solarterm/solarterm?term=' + encodeURIComponent(name) });
  },

  onTapService() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=service' });
  },

  // 康康食养 AI：三个入口已合成一个对话框，这里也走同一个页面
  onTapAgent() {
    wx.navigateTo({ url: '/pages/kangkang/kangkang' });
  },

  onTapConsent() {
    wx.navigateTo({ url: '/pages/consent/consent?from=mine' });
  },

  // 食品安全：省局公开的抽检与处罚数据，已进 tabBar，只能 switchTab
  onTapFoodSafety() {
    wx.switchTab({ url: '/pages/foodsafety/foodsafety' });
  },

  onTapMethod() {
    wx.navigateTo({ url: '/pages/method/method' });
  },

  onTapPrivacyDoc() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },

  // 退出登录只删本机头像昵称，收藏与偏好保留（文案已写明，避免误以为数据被清空）
  onLogout() {
    wx.showModal({
      title: this.data.copy.logout,
      content: t('mine.logoutConfirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;
        getApp().clearUser();
        this.setData({ loggedIn: false, nickName: '', avatarUrl: '' });
        wx.showToast({ title: t('mine.logoutDone'), icon: 'none' });
      },
    });
  },

  // 字号档位切换：立即写 storage 并刷新本页 pageStyle，其它页面 onShow 时自动跟上
  onTapFont(e) {
    const value = Number(e.currentTarget.dataset.value);
    const app = getApp();
    if (!app.setFontScale) return;
    const applied = app.setFontScale(value);
    this.setData({
      fontScale: applied,
      fontLabelText: this.labelOfScale(applied),
      pageStyle: app.getFontStyle(),
    });
  },

  // 长辈模式：只改字号与次要入口显隐，布局不动
  onToggleElder(e) {
    const app = getApp();
    if (!app.setElderMode) return;
    const on = !!(e.detail && e.detail.value);
    const applied = app.setElderMode(on);
    this.setData({
      elderMode: applied,
      fontScale: app.getFontScale ? app.getFontScale() : 1,
      fontLabelText: this.labelOfScale(app.getFontScale ? app.getFontScale() : 1),
      pageStyle: app.getFontStyle(),
    });
    if (applied) wx.showToast({ title: t('elder.onHint'), icon: 'none' });
  },

  onTapFavorite() {
    wx.navigateTo({ url: '/pages/favorite/favorite' });
  },

  onTapDish(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    track.dishClick(id, 'mine');
    wx.navigateTo({ url: '/pages/dish/dish?id=' + encodeURIComponent(id) });
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  // 已作答：进画像页看标签、管数据授权；未作答：直接去答题（答完自动进生成页）
  onTapPref() {
    const answers = readAnswers();
    const hasPref = Object.keys(answers).length > 0;
    wx.navigateTo({ url: hasPref ? '/pages/prefresult/prefresult' : '/pages/preftest/preftest' });
  },

  onTapAbout() {
    wx.showModal({
      title: this.data.copy.about,
      content: t('mine.aboutText'),
      showCancel: false,
      confirmText: t('common.confirm'),
    });
  },

  // 清除本地数据：二次确认，文案写清「收藏与偏好将一起清空」
  onClearData() {
    wx.showModal({
      title: this.data.copy.clearData,
      content: this.data.copy.clearConfirm,
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;
        USER_DATA_KEYS.forEach((key) => {
          try {
            wx.removeStorageSync(key);
          } catch (err) {
            // 单条失败不影响其它键，也不向用户抛错
          }
        });
        track.setConsent(false);
        this.setData({
          favoriteCount: 0,
          favList: [],
          favMoreText: '',
          prefDone: false,
          tasteText: this.data.copy.tasteEmpty,
          avoidText: this.data.copy.avoidEmpty,
        });
        wx.showToast({ title: this.data.copy.cleared, icon: 'none' });
      },
    });
  },

  // 再看一遍引导：从「我的」发起也回到第一站（首页）
  onReplayTour() {
    const app = getApp();
    if (!app.startTour) return;
    app.startTour();
    wx.switchTab({ url: '/pages/index/index' });
  },

  // —— 功能引导（跨 tab，进度在 app.globalData.tour）——
  syncTour() {
    const app = getApp();
    if (!app.tourStateOf) return;
    const st = app.tourStateOf('mine');
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
    if (st.step && st.step.page !== 'mine') {
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
});
