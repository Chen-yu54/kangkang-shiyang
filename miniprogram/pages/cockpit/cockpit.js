// pages/cockpit/cockpit.js —— 节气数据详情页
//
// 首页那张浅色预览卡点进来，这里才展开完整罗盘、概览指标与五个分区。
// 数据口径与首页完全同一份：kbStats.build（概览）+ cockpit.build（分区），
// 能从知识库算的一律现算，缺失的集中在 data/cockpit.js 的 SAMPLE 并标「示例」。
//
// 分区映射（默认 01）：
//   01 term 节气视图 / 02 cuisine 菜系对照 / 03 fit 人群偏向
//   04 graph 知识图谱 / 05 library 食材深库
// 支持 ?tab=cuisine 这样的直达参数，方便以后从别处深链进来。

const dataSource = require('../../utils/dataSource');
const kbStats = require('../../utils/kbStats');
const cockpit = require('../../data/cockpit');
const i18n = require('../../utils/i18n');

const t = i18n.t;

Page({
  data: {
    pageStyle: '',
    elderMode: false,
    copy: {},
    dataVersion: '',
    stats: null,
    ck: null,
    tabs: [],
    ckTab: 'term', // 默认展示 01 节气视图
    ckCap: '',
    dashOn: false, // 罗盘刻度进页面后依次点亮
    ckNode: 'core', // 图谱当前选中的节点，默认核心
    ckNodeInfo: {},
  },

  onLoad(options) {
    const current = dataSource.getCurrentTerm();

    // —— 概览：与首页预览卡同一份口径 ——
    const stats = kbStats.build(current);
    stats.term.posText = i18n.tpl('snapshot.termPos', {
      order: stats.term.order,
      total: stats.term.total,
    });
    stats.promises = stats.promises.map((p) => ({
      key: p.key,
      label: t(p.labelKey),
      sub: p.subParams ? i18n.tpl(p.subKey, p.subParams) : t(p.subKey),
      pct: p.pct,
      text: p.text,
    }));
    stats.easyPct = stats.promises[1] ? stats.promises[1].pct : 0;

    // —— 分区数据 ——
    const ck = cockpit.build(current);
    const wanted = options && options.tab;
    const active = ck.tabs.filter((x) => x.key === wanted)[0] || ck.tabs[0];
    const tabs = ck.tabs.map((x, i) =>
      Object.assign({}, x, { no: i + 1 < 10 ? '0' + (i + 1) : String(i + 1) })
    );

    this.setData({
      copy: {
        title: t('cockpit.title'),
        kicker: t('cockpit.kicker'),
        lead: t('cockpit.lead'),
        overview: t('cockpit.overview'),
        sections: t('cockpit.sections'),
        tip: t('cockpit.tip'),
        noteTitle: t('cockpit.noteTitle'),
        sampleTag: t('cockpit.sampleTag'),
        live: t('snapshot.live'),
        asOf: t('snapshot.asOf'),
        note: t('snapshot.note'),
        ckKpi1: t('snapshot.ckKpi1'),
        ckKpi2: t('snapshot.ckKpi2'),
        ckKpi3: t('snapshot.ckKpi3'),
      },
      dataVersion: (dataSource.getDataVersionLabel().split('·').pop() || '').trim(),
      stats,
      ck,
      tabs,
      ckTab: active.key,
      ckCap: active.cap,
      ckNode: 'core',
      ckNodeInfo: ck.graph.map.detail.core,
    });
  },

  onShow() {
    const app = getApp();
    this.setData({
      pageStyle: app.getFontStyle(),
      elderMode: app.getElderMode ? app.getElderMode() : false,
    });
  },

  onReady() {
    // 页面一打开就播刻度点亮，不再依赖滚动进视野
    setTimeout(() => this.setData({ dashOn: true }), 120);
  },

  // 点分区切数据：只换 ckTab / ckCap，五个分支由 WXML 的 wx:if 切换
  onPickTab(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.ckTab) return;
    const tab = this.data.tabs.filter((x) => x.key === key)[0];
    this.setData({ ckTab: key, ckCap: tab ? tab.cap : '' });
  },

  // 点图谱节点：只换明细条，不重排图
  onTapNode(e) {
    const id = e.currentTarget.dataset.id;
    const graph = this.data.ck && this.data.ck.graph;
    const info = graph && graph.map.detail[id];
    if (!info || id === this.data.ckNode) return;
    this.setData({ ckNode: id, ckNodeInfo: info });
  },

  onTapBack() {
    wx.navigateBack({
      delta: 1,
      fail: () => wx.switchTab({ url: '/pages/index/index' }),
    });
  },
});
