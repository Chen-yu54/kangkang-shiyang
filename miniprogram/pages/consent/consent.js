// 数据分享同意页 —— 首次进入或从「我的」进入时展示。
//
// 设计前提（长者友好）：
//   ① 用大白话讲清楚「分享什么 / 不分享什么 / 给谁 / 干什么」，不用法律术语；
//   ② 「共享给谁」用两个开关自己勾，街道、食堂可以只开一个；
//   ③ 「暂不分享」按钮和「同意」一样大、一样显眼，不做暗色小字诱导；
//   ④ 不阻断主流程：拒绝后所有功能照常可用，只是数据不上报。
//
// 合规对应（checklists A6 / D5）：
//   采集前告知、可区分对象、可撤回、拒绝不影响功能、不伪造「已同步」。

const i18n = require('../../utils/i18n');
const consent = require('../../utils/consent');
const districts = require('../../data/districts');

const t = i18n.t;

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
    // 共享对象：街道 / 食堂，各自独立
    shareStreet: true,
    shareCanteen: true,
    scopeText: '',
    // 「江南中街 · 某某社区」，社区名单没补齐时只显示街道
    regionText: '',
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
        scopeTitle: t('consent.scopeTitle'),
        scopeHint: t('consent.scopeHint'),
        streetName: t('consent.streetName'),
        streetSub: t('consent.streetSub'),
        canteenName: t('consent.canteenName'),
        canteenSub: t('consent.canteenSub'),
        scopeOn: t('consent.scopeOn'),
        scopeOff: t('consent.scopeOff'),
        regionTitle: t('consent.regionTitle'),
        district: t('consent.district'),
        community: t('consent.community'),
        agree: t('consent.agree'),
        decline: t('consent.decline'),
        declineHint: t('consent.declineHint'),
        revoke: t('consent.revoke'),
        grantedAt: t('consent.grantedAt'),
        grantedScope: t('consent.grantedScope'),
        notConfigured: t('consent.notConfigured'),
        needRegion: t('consent.needRegion'),
        needCommunity: t('consent.needCommunity'),
        communityMissing: t('consent.communityMissing'),
        scopeNone: t('consent.scopeNone'),
        back: t('common.back'),
      },
    });

    const list = districts.listDistricts();
    const granted = consent.isGranted();
    this.setData({
      configured: list.length > 0,
      districtList: list,
      fromMine: !!(options && options.from === 'mine'),
      view: granted ? 'done' : 'off',
      districtId: saved.districtId,
      communityId: saved.communityId,
      shareStreet: granted ? saved.scope.indexOf('street') >= 0 : true,
      shareCanteen: granted ? saved.scope.indexOf('canteen') >= 0 : true,
    });

    if (granted) {
      const names = districts.nameOf(saved.districtId, saved.communityId);
      this.setData({
        districtName: names.districtName,
        communityName: names.communityName,
        regionText: this.buildRegionText(names.districtName, names.communityName),
        scopeText: this.buildScopeText(saved.scope),
      });
    } else if (list.length === 1) {
      // 只有一个街道时直接选中，少一步操作（长者不必多点一次）
      this.pickDistrict(list[0].id);
    }
  },

  // 「共享给 街道、食堂」——用名字拼，不写死顺序
  buildScopeText(scope) {
    const names = [];
    if (scope.indexOf('street') >= 0) names.push(this.data.copy.streetName);
    if (scope.indexOf('canteen') >= 0) names.push(this.data.copy.canteenName);
    return names.join('、');
  },

  buildRegionText(districtName, communityName) {
    if (!districtName) return '';
    return communityName ? districtName + ' · ' + communityName : districtName;
  },

  // 点一下换一个状态，不做二次确认（长者面前少弹窗）
  onToggleScope(e) {
    const key = e.currentTarget.dataset.key;
    if (key === 'street') {
      this.setData({ shareStreet: !this.data.shareStreet });
    } else if (key === 'canteen') {
      this.setData({ shareCanteen: !this.data.shareCanteen });
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
    const scope = [];
    if (this.data.shareStreet) scope.push('street');
    if (this.data.shareCanteen) scope.push('canteen');

    // 有社区名单就要求选到社区；名单还在补的街道，按街道记也能用
    if (!this.data.districtId) {
      wx.showToast({ title: this.data.copy.needRegion, icon: 'none' });
      return;
    }
    if (this.data.communityList.length && !this.data.communityId) {
      wx.showToast({ title: this.data.copy.needCommunity, icon: 'none' });
      return;
    }

    const r = consent.grant({
      districtId: this.data.districtId,
      communityId: this.data.communityId,
      scope,
    });
    if (!r.ok) {
      let msg = this.data.copy.notConfigured;
      if (r.reason === 'NEED_REGION') msg = this.data.copy.needRegion;
      if (r.reason === 'NEED_SCOPE') msg = this.data.copy.scopeNone;
      wx.showToast({ title: msg, icon: 'none' });
      return;
    }
    this.setData({
      view: 'done',
      regionText: this.buildRegionText(this.data.districtName, this.data.communityName),
      scopeText: this.buildScopeText(scope),
    });
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
        this.setData({
          view: 'off',
          districtId: '',
          communityId: '',
          communityName: '',
          regionText: '',
          scopeText: '',
          shareStreet: true,
          shareCanteen: true,
        });
        wx.showToast({ title: t('consent.revoked'), icon: 'none' });
      },
    });
  },

  onBack() {
    wx.navigateBack();
  },
});
