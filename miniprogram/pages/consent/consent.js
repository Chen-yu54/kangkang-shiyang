// 数据分享同意页 —— 首次进入或从「我的」进入时展示。
//
// 设计前提（长者友好）：
//   ① 用大白话讲清楚「分享什么 / 不分享什么 / 给谁 / 干什么」，不用法律术语；
//   ② 「暂不分享」按钮和「同意」一样大、一样显眼，不做暗色小字诱导；
//   ③ 不阻断主流程：拒绝后所有功能照常可用，只是数据不上报。
//
// 合规对应（checklists A6 / D5）：
//   采集前告知、可撤回、拒绝不影响功能、不伪造「已同步」。

const i18n = require('../../utils/i18n');
const consent = require('../../utils/consent');
const districts = require('../../data/districts');

Page({
  data: {
    copy: {},
    // 'form' 选择归属并同意 | 'done' 已同意 | 'off' 已关闭
    view: 'form',
    districtList: [],
    communityList: [],
    districtId: '',
    communityId: '',
    districtName: '',
    communityName: '',
    configured: false,
    // 从「我的」进来时不需要返回按钮
    fromMine: false,
  },

  onLoad(options) {
    const saved = consent.current();
    this.setData({
      copy: {
        title: t('consent.title'),
        lead: t('consent.lead'),
        whatTitle: t('consent.whatTitle'),
        whatBody: t('consent.whatBody'),
        notTitle: t('consent.notTitle'),
        notBody: t('consent.notBody'),
        whoTitle: t('consent.whoTitle'),
        whoBody: t('consent.whoBody'),
        purposeTitle: t('consent.purposeTitle'),
        purposeBody: t('consent.purposeBody'),
        regionTitle: t('consent.regionTitle'),
        district: t('consent.district'),
        community: t('consent.community'),
        agree: t('consent.agree'),
        decline: t('consent.decline'),
        declineHint: t('consent.declineHint'),
        revoke: t('consent.revoke'),
        grantedAt: t('consent.grantedAt'),
        notConfigured: t('consent.notConfigured'),
        needRegion: t('consent.needRegion'),
        back: t('common.back'),
      },
    });

    const list = districts.listDistricts();
    this.setData({
      configured: list.length > 0,
      districtList: list,
      fromMine: !!(options && options.from === 'mine'),
      view: consent.isGranted() ? 'done' : 'off',
      districtId: saved.districtId,
      communityId: saved.communityId,
    });

    if (consent.isGranted()) {
      const names = districts.nameOf(saved.districtId, saved.communityId);
      this.setData({ districtName: names.districtName, communityName: names.communityName });
    } else if (list.length === 1) {
      // 只有一个街道时直接选中，少一步操作（长者不必多点一次）
      this.pickDistrict(list[0].id);
    }
  },

  pickDistrict(id) {
    const list = districts.listCommunities(id);
    const d = districts.DISTRICTS.filter((x) => x.id === id)[0] || {};
    this.setData({
      view: 'form',
      districtId: id,
      districtName: d.name || '',
      communityList: list,
      communityId: list.length === 1 ? list[0].id : '',
    });
  },

  onPickDistrict(e) {
    const id = e.currentTarget.dataset.id;
    if (id) this.pickDistrict(id);
  },

  onPickCommunity(e) {
    const id = e.currentTarget.dataset.id;
    if (id) this.setData({ communityId: id });
  },

  onAgree() {
    if (!this.data.configured) {
      wx.showToast({ title: this.data.copy.notConfigured, icon: 'none' });
      return;
    }
    const r = consent.grant({
      districtId: this.data.districtId,
      communityId: this.data.communityId,
    });
    if (!r.ok) {
      wx.showToast({
        title: r.reason === 'NEED_REGION' ? this.data.copy.needRegion : this.data.copy.notConfigured,
        icon: 'none',
      });
      return;
    }
    this.setData({ view: 'done' });
    wx.showToast({ title: t('consent.agreeDone'), icon: 'success' });
  },

  // 拒绝：如实关闭，不做二次挽留弹窗（那是诱导）
  onDecline() {
    consent.revoke();
    this.setData({ view: 'off' });
    if (this.data.fromMine) wx.navigateBack();
  },

  onRevoke() {
    wx.showModal({
      title: t('consent.revokeConfirmTitle'),
      content: t('consent.revokeConfirmBody'),
      confirmText: t('consent.revoke'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return;
        consent.revoke();
        this.setData({ view: 'off', districtId: '', communityId: '', communityName: '' });
        wx.showToast({ title: t('consent.revoked'), icon: 'none' });
      },
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
