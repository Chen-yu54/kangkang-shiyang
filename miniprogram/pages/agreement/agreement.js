// pages/agreement/agreement.js —— 用户服务协议 / 隐私政策（同一页，type 区分）
//
// 做成独立页而不是弹层：审核需要在真机上能完整翻到条款，用户也能截图留存；
// 弹层在小屏上翻长文体验很差。

const agreements = require('../../utils/agreements');
const i18n = require('../../utils/i18n');

const t = i18n.t;

Page({
  data: {
    pageStyle: '',
    title: '',
    effectiveText: '',
    versionText: '',
    sections: [],
  },

  onLoad(options) {
    const type = options && options.type === 'privacy' ? 'privacy' : 'service';
    const doc = agreements.get(type);
    const title = t(doc.titleKey);

    this.setData({
      title,
      effectiveText: i18n.tpl('agreement.effective', { date: doc.updatedAt }),
      versionText: i18n.tpl('agreement.version', { version: doc.version }),
      sections: doc.sections,
    });

    wx.setNavigationBarTitle({ title });
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },
});
