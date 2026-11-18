// pages/login/login.js —— 登录页（微信登录 + 本地存储）
//
// 四个刻意的取舍：
//   1. 不做「必须登录才能浏览」：底部有「先随便逛逛」，跳过后全部内容可看。
//      微信审核对「强制登录」是明确不通过的，这条同时也是产品判断——
//      长者第一次打开就想看今天吃什么，不该先被一个表单拦住。
//   2. 登录方式用微信那头像昵称能力（chooseAvatar + type="nickname"），
//      不取手机号：手机号要企业认证与额度，参赛版本用不上，也不该为了登录多要一个号。
//      头像昵称只写本机 Storage，不上传。
//   3. 页面只做登录这件事：功能页怎么用不在这一页铺文案，
//      登录成功后由全屏「亮圈」动效一处一处带着看（components/guideTour）。
//   4. 访问方式不影响判定：启动进来自动放行（已登录 / 已同意协议），
//      从「我的」进来则停在登录页可改头像昵称，返回键回到原页。

const i18n = require('../../utils/i18n');

const t = i18n.t;

Page({
  data: {
    pageStyle: '',
    safeTop: 0,
    showBack: false,
    avatarUrl: '',
    nickName: '',
    agreed: false,
    fontScale: 1,
    fontOptions: [],
    authVisible: false, // 微信登录弹层
    copy: {},
  },

  onLoad(options) {
    const app = getApp();
    this.from = options && options.from ? options.from : 'boot';

    // 启动进入：已经登录过或已同意过协议，直接放行，不停在登录页
    if (this.from === 'boot' && (app.isLoggedIn() || app.hasAgreed())) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }

    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const user = app.getUser();
    const scaleOptions = app.getFontScaleOptions ? app.getFontScaleOptions() : [1, 1.15, 1.3];
    const labels = [t('mine.fontStandard'), t('mine.fontLarge'), t('mine.fontXLarge')];

    this.setData({
      safeTop: (win.statusBarHeight || 20) + 8,
      // 从「我的」进来的才显示返回键，启动进入没有可返回的页面
      showBack: getCurrentPages().length > 1,
      avatarUrl: user ? user.avatarUrl : '',
      nickName: user ? user.nickName : '',
      fontOptions: scaleOptions.map((value, i) => ({ value, label: labels[i] || String(value) })),
      copy: {
        brand: t('login.brand'),
        slogan: t('login.slogan'),
        wxLogin: t('login.wxLogin'),
        agreeLine: t('login.agreeLine'),
        serviceName: t('login.serviceName'),
        privacyName: t('login.privacyName'),
        skip: t('login.skip'),
        fontScale: t('login.fontScale'),
        foot: t('login.foot'),
        authTitle: t('login.authTitle'),
        authSub: t('login.authSub'),
        authConfirm: t('login.authConfirm'),
        whoHint: t('login.whoHint'),
        nickLabel: t('login.nickLabel'),
        nickPlaceholder: t('login.nickPlaceholder'),
        agreePre: t('login.agreePre'),
        needAgree: t('login.needAgree'),
        note: t('login.note'),
        welcomeBack: t('login.welcomeBack'),
      },
    });
  },

  onShow() {
    const app = getApp();
    this.setData({
      pageStyle: app.getFontStyle(),
      fontScale: app.getFontScale ? app.getFontScale() : 1,
    });
  },

  onBack() {
    wx.navigateBack({ fail: () => this.leave() });
  },

  // —— 微信登录弹层 ——
  // 点主按钮先弹层，不直接写登录态：协议同意与头像昵称都得在这里交代清楚
  onWxLogin() {
    this.setData({ authVisible: true });
  },

  onCloseAuth() {
    this.setData({ authVisible: false });
  },

  // 弹层内部点击不该穿透到遮罩（遮罩是「点空白关闭」）
  noop() {},

  // 头像选择：微信同一时刻只允许一个 chooseAvatar 在跑。
  // 连点或用开发者工具快速重编译时会报「another chooseAvatar is in progress」，
  // 所以用 _avatarPicking 做闸门，处理完再放开。
  onChooseAvatar(e) {
    if (this._avatarPicking) return;
    this._avatarPicking = true;
    const url = e && e.detail ? e.detail.avatarUrl : '';
    if (url) this.setData({ avatarUrl: url });
    setTimeout(() => {
      this._avatarPicking = false;
    }, 300);
  },

  onNickInput(e) {
    this.setData({ nickName: e.detail.value });
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  onOpenService() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=service' });
  },

  onOpenPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },

  onTapFont(e) {
    const app = getApp();
    const value = Number(e.currentTarget.dataset.value);
    if (!app.setFontScale) return;
    const applied = app.setFontScale(value);
    this.setData({ fontScale: applied, pageStyle: app.getFontStyle() });
  },

  // 确认登录：落同意态与昵称头像，首次启动顺带开功能引导
  onConfirmLogin() {
    if (!this.data.agreed) {
      wx.showToast({ title: this.data.copy.needAgree, icon: 'none' });
      return;
    }

    const app = getApp();
    app.setAgreed();
    app.setUser({ nickName: this.data.nickName, avatarUrl: this.data.avatarUrl });

    // 首次启动登录成功才开全屏引导（稍暗底 + 亮圈，一页一页讲清三块是干什么的）：
    // 从「我的」进来只是改头像昵称，不是第一次来，不打断。
    if (this.from === 'boot' && app.startTour && !(app.hasTourRun && app.hasTourRun())) {
      app.startTour();
    }

    this.setData({ authVisible: false });
    wx.showToast({ title: this.data.copy.welcomeBack, icon: 'none' });
    this.leave();
  },

  // 游客：不写同意态、不写登录态，直接进首页
  onSkip() {
    this.leave();
  },

  // 有上一页就返回上一页，否则回首页（启动进入时栈里只有登录页）
  leave() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },
});
