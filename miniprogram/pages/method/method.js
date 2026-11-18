// pages/method/method.js —— 方法说明（数据 / AI 参与方式 / 指标口径 / 复算路径 / 局限）
//
// 页面只做渲染，正文在 utils/methodDoc.js，数字全部由 utils/snapshot.js 实时算。
// 之所以拆成「文档 + 统计」两层：文档是要给评委读的叙述，数字是会被追问的证据，
// 混在一起以后一次数据更新就得改文案，迟早改成假数字。

const i18n = require('../../utils/i18n');
const methodDoc = require('../../utils/methodDoc');
const snapshotUtil = require('../../utils/snapshot');

Page({
  data: {
    pageStyle: '',
    title: '',
    lead: '',
    sections: [],
    footnote: '',
  },

  onLoad() {
    const snap = snapshotUtil.build();
    const fields = snapshotUtil.fieldStats();
    const title = i18n.t('method.title');

    this.setData({
      title,
      lead: i18n.t('method.lead'),
      sections: methodDoc.build(snap, fields),
      footnote: i18n.tpl('method.footnote', { version: snap.version || '—' }),
    });

    wx.setNavigationBarTitle({ title });
  },

  onShow() {
    this.setData({ pageStyle: getApp().getFontStyle() });
  },
});
