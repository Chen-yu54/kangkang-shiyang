// pages/prefresult/prefresult.js —— 口味画像与数据（原「偏好画像结果页」）
//
// 定位调整：测试交卷后回到 /pages/menu（推演与三道菜都在那一页就地铺开）。
// 本页收窄为「画像 + 数据授权 + 我的数据」，从「我的」页进入；
// 原先这里还有一份推荐列表和生成入口卡，与食养页重复，已删除。
//
// 两条红线不变：
//   1. 标签文案由接口直出，前端不维护 id 到文案的映射表，也不自行编造画像
//   2. 三个同意开关默认全部关闭；关闭后立即停止对应上报

const api = require('../../utils/api');
const track = require('../../utils/track');
const i18n = require('../../utils/i18n');

const t = i18n.t;
const ANSWERS_KEY = 'prefAnswers';
const FLAGS_KEY = 'consentFlags';
const USER_DATA_KEYS = ['prefAnswers', 'consentFlags', 'favoriteIds', 'searchHistory', 'trackQueue'];

// preference.tags 的具体结构待 B 的《接口契约 v1.0》确认；
// 当前兼容「字符串数组」与「{label, desc} 对象数组」两种形态，接口直出文案，前端不做映射。
function toTags(preference) {
  const pref = preference || {};
  if (!Array.isArray(pref.tags)) return [];
  return pref.tags
    .map((tag) => {
      if (typeof tag === 'string') return { label: tag, desc: '' };
      if (tag && typeof tag === 'object') {
        return { label: tag.label || '', desc: tag.desc || tag.description || '' };
      }
      return null;
    })
    .filter(Boolean);
}

function readFlags() {
  const value = wx.getStorageSync(FLAGS_KEY);
  const flags = value && typeof value === 'object' ? value : {};
  return {
    basic: flags.basic === true,
    canteen: flags.canteen === true,
    street: flags.street === true,
  };
}

Page({
  data: {
    pageStyle: '',
    status: 'loading', // loading | ready | unavailable | empty
    tags: [],
    flags: { basic: false, canteen: false, street: false },
    consents: [],
    dataVisible: false,
    dataSummary: [],
    copy: {},
  },

  onLoad() {
    this.setData({
      copy: {
        empty: t('prefresult.empty'),
        emptyAction: t('prefresult.emptyAction'),
        serviceOffline: t('prefresult.serviceOffline'),
        retry: t('prefresult.retry'),
        profile: t('prefresult.title'),
        consentTitle: t('prefresult.consentTitle'),
        consentHint: t('prefresult.consentHint'),
        myData: t('prefresult.myData'),
        viewData: t('prefresult.viewData'),
        deleteData: t('prefresult.deleteData'),
        deleteConfirm: t('prefresult.deleteConfirm'),
        deleted: t('prefresult.deleted'),
        disclaimer: t('preftest.disclaimer'),
      },
    });
    this.applyFlags(readFlags());
    this.loadPreference();
    track.pageView('prefresult');
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
    // 空态进来又去答完题（答完会跳到生成页），返回时这里要自己补一次画像
    if (this.data.status === 'empty') this.loadPreference();
  },

  onHide() {
    this.clearStepTimer();
  },

  onUnload() {
    this.clearStepTimer();
  },

  // 定时器清理：onHide / onUnload 都会调，必须自己定义（否则运行时报 not a function）
  clearStepTimer() {
    if (this.stepTimer) {
      clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  },

  loadPreference() {
    const answers = wx.getStorageSync(ANSWERS_KEY);
    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
      this.setData({ status: 'empty' });
      return;
    }

    this.setData({ status: 'loading' });

    api
      .getPreferences(answers)
      .then((result) => {
        this.setData({
          status: 'ready',
          tags: toTags(result.preference),
        });
      })
      .catch(() => {
        // 判定服务未接入时如实告知，不用前端规则拼一个假画像出来
        this.setData({ status: 'unavailable' });
      });
  },

  // —— 分层同意开关 ——

  applyFlags(flags) {
    this.setData({
      flags,
      consents: [
        { key: 'basic', label: t('prefresult.consentBasic'), value: flags.basic },
        { key: 'canteen', label: t('prefresult.consentCanteen'), value: flags.canteen },
        { key: 'street', label: t('prefresult.consentStreet'), value: flags.street },
      ],
    });
  },

  onConsentChange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) return;

    const flags = Object.assign({}, this.data.flags);
    flags[key] = e.detail.value === true;
    wx.setStorageSync(FLAGS_KEY, flags);

    // 基础开关直接控制埋点总闸：打开才采，关闭立即停采并清空未发出的队列
    if (key === 'basic') track.setConsent(flags.basic);

    this.applyFlags(flags);
  },

  // —— 我的数据 ——

  onViewData() {
    const answers = wx.getStorageSync(ANSWERS_KEY);
    const answerCount = answers && typeof answers === 'object' ? Object.keys(answers).length : 0;
    const favorites = wx.getStorageSync('favoriteIds');
    const history = wx.getStorageSync('searchHistory');

    const summary = [
      i18n.tpl('prefresult.dataAnswers', { count: answerCount }),
      i18n.tpl('prefresult.dataFavorites', { count: Array.isArray(favorites) ? favorites.length : 0 }),
      i18n.tpl('prefresult.dataHistory', { count: Array.isArray(history) ? history.length : 0 }),
    ];

    this.setData({ dataVisible: true, dataSummary: summary });
  },

  onDeleteData() {
    wx.showModal({
      title: this.data.copy.deleteData,
      content: this.data.copy.deleteConfirm,
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;

        USER_DATA_KEYS.forEach((key) => {
          try {
            wx.removeStorageSync(key);
          } catch (err) {
            // 单条删除失败不影响其它条目，也不向用户抛错
          }
        });
        track.setConsent(false);

        this.applyFlags({ basic: false, canteen: false, street: false });
        this.setData({ status: 'empty', tags: [], dataVisible: false, dataSummary: [] });
        wx.showToast({ title: this.data.copy.deleted, icon: 'none' });
      },
    });
  },

  onGoTest() {
    wx.navigateTo({ url: '/pages/preftest/preftest' });
  },

  onRetry() {
    this.loadPreference();
  },
});
