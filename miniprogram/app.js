// app.js —— 全局入口
// 承担两件事：字号缩放机制（任务书 4.3）+ 本地登录态与协议同意态。
//
// 登录口径（上线版本）：只做「本地登录」，不联网、不换 openid。
//   - 头像昵称由用户主动选择，写进 Storage，换手机即失效
//   - 登录不是浏览的前置条件：登录页有「先随便逛逛」，跳过后内容全部可看
//     （微信审核对「强制登录才能浏览」是明确不通过的）
//   - 同意态单独记版本号：将来协议改动，版本号一变会重新要求确认，不会静默沿用旧同意

const FONT_SCALE_KEY = 'fontScale';
const USER_KEY = 'userInfo';
const AGREEMENT_KEY = 'agreementAccepted';

// 节气主题：当前节气判定 + 24 节气色板 + 海报路径
const solarTheme = require('./utils/solarTheme');

// 协议版本：改动 utils/agreements.js 的条款时，这个日期必须同步改
const AGREEMENT_VERSION = '2026-11-12';

// 用户改过字号才写入，默认档不落盘，避免脏数据
const FONT_SCALE_ALLOWED = [1, 1.15, 1.3, 1.6];
// 适老版：强制 1.6 档（正文 36rpx → 约 58rpx），并隐藏次要入口
const ELDER_SCALE = 1.6;
const ELDER_KEY = 'elderMode';

// 字号基准值：必须与 app.wxss 的同名变量保持一致。
// 任务书 4.3 硬指标：正文 ≥36rpx、标题 ≥48rpx、按钮文字 ≥32rpx。
//
// 五个档位必须一起缩放：早先只缩 base/title/btn，subtitle 与 caption 停在原值，
// 长辈模式（1.6 倍）下就会出现「说明行比名字还大」的倒挂——一页里三套字号各说各的，
// 看着很乱。凡是排版用到的字号，全部由这里统一乘系数。
const BASE_FONT_RPX = {
  base: 36,
  title: 48,
  btn: 32,
  subtitle: 40,
  caption: 28,
};

App({
  globalData: {
    // 适老版：全局大字 + 精简功能，由「我的」或首页入口切换
    elderMode: false,
    fontScale: 1,
    // 跨 Tab 传参用：wx.switchTab 不支持 url 参数，
    // 推荐页点菜系入口时先把想看的风味放这里，菜单页 onShow 读取后清空
    pendingCuisine: '',
    // 本地登录态与协议同意态，启动时从 Storage 恢复
    user: null,
    agreementAccepted: false,
  },

  onLaunch() {
    // 云开发初始化：配了环境 ID 才 init，避免未开通时报错。
    // 云函数 workflow 负责持 token 转发扣子，前端包里没有任何凭证。
    //
    // ⚠ 这里不能静默失败：之前用 try/catch 吞掉异常，导致「配了环境 ID 却不调用扣子」
    //   时界面上什么提示都没有。现在把状态写进 globalData 并打日志，一眼能看出卡在哪一环。
    let cloudStatus = 'unknown';
    try {
      const cfg = require('./utils/config');
      if (!cfg.CLOUD_ENV) {
        cloudStatus = 'NO_ENV'; // 没填 CLOUD_ENV
      } else if (typeof wx.cloud === 'undefined' || !wx.cloud) {
        cloudStatus = 'NO_WX_CLOUD'; // 该基础库/该小程序未开通云开发
      } else {
        wx.cloud.init({ env: cfg.CLOUD_ENV, traceUser: false });
        this.globalData.cloudReady = true;
        cloudStatus = 'OK';
      }
    } catch (e) {
      cloudStatus = 'INIT_FAILED: ' + ((e && e.message) || e);
    }
    this.globalData.cloudStatus = cloudStatus;
    try {
      const cfg2 = require('./utils/config');
      console.log(
        '[cloud] env=' + (cfg2.CLOUD_ENV || '(空)') +
        '  wx.cloud=' + (typeof wx.cloud) +
        '  status=' + cloudStatus
      );
    } catch (e) { /* 日志失败不影响启动 */ }
    this.globalData.fontScale = this.getStoredFontScale();
    this.globalData.elderMode = !!wx.getStorageSync(ELDER_KEY);
    this.globalData.user = this.getStoredUser();
    this.globalData.agreementAccepted = this.hasAgreed();
  },

  // ———————————————————— 本地登录态 ————————————————————

  getStoredUser() {
    const raw = wx.getStorageSync(USER_KEY);
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.nickName) return null;
    return raw;
  },

  getUser() {
    return this.globalData.user || null;
  },

  isLoggedIn() {
    return !!this.getUser();
  },

  // 昵称留空也允许登录：长者打字慢，强制填昵称会直接劝退
  setUser(user) {
    const src = user || {};
    const record = {
      nickName: String(src.nickName || '').trim() || '食养朋友',
      avatarUrl: String(src.avatarUrl || ''),
      loginAt: Date.now(),
    };
    try {
      wx.setStorageSync(USER_KEY, record);
    } catch (err) {
      // 存储失败不阻断使用，只是下次进来看不到头像
    }
    this.globalData.user = record;
    return record;
  },

  clearUser() {
    try {
      wx.removeStorageSync(USER_KEY);
    } catch (err) {
      // 忽略：清理失败不影响本次会话
    }
    this.globalData.user = null;
  },

  // ———————————————————— 协议同意态 ————————————————————

  getAgreementVersion() {
    return AGREEMENT_VERSION;
  },

  // 只认同一版本号的同意：协议改版后旧的同意不再生效
  hasAgreed() {
    const saved = wx.getStorageSync(AGREEMENT_KEY);
    return !!(saved && saved.version === AGREEMENT_VERSION && saved.accepted);
  },

  setAgreed() {
    const record = { version: AGREEMENT_VERSION, accepted: true, at: Date.now() };
    try {
      wx.setStorageSync(AGREEMENT_KEY, record);
    } catch (err) {
      // 忽略：本次会话内仍按已同意处理
    }
    this.globalData.agreementAccepted = true;
    return record;
  },

  // 读取已保存的缩放档位；非法值一律回落到 1
  getStoredFontScale() {
    const stored = Number(wx.getStorageSync(FONT_SCALE_KEY));
    return FONT_SCALE_ALLOWED.indexOf(stored) > -1 ? stored : 1;
  },

  // 「我的」页切换字号档位：写 storage 并刷新 globalData，各页 onShow 会拿到新的 pageStyle
  setFontScale(scale) {
    const v = FONT_SCALE_ALLOWED.indexOf(Number(scale)) > -1 ? Number(scale) : 1;
    wx.setStorageSync(FONT_SCALE_KEY, v);
    this.globalData.fontScale = v;
    return v;
  },

  getFontScale() {
    return this.globalData.fontScale || 1;
  },

  getFontScaleOptions() {
    return FONT_SCALE_ALLOWED.slice();
  },
  // —— 适老版 ——
  // 只做两件事：把字号拉到 1.6 档 + 让页面隐藏次要入口。
  // 布局与交互一律不动（导航、卡片结构、按钮位置不变），避免用户每次都要重新找东西。
  getElderMode() {
    return !!this.globalData.elderMode;
  },

  setElderMode(on) {
    const v = !!on;
    this.globalData.elderMode = v;
    wx.setStorageSync(ELDER_KEY, v);
    if (v) {
      // 记住原档位，关掉时还原
      if (FONT_SCALE_ALLOWED.indexOf(this.getFontScale()) > -1 && this.getFontScale() !== ELDER_SCALE) {
        this._scaleBeforeElder = this.getFontScale();
      }
      this.setFontScale(ELDER_SCALE);
    } else {
      this.setFontScale(this._scaleBeforeElder || 1);
    }
    return v;
  },

  // 页面统一在 onShow 里调用：
  //   this.setData({ pageStyle: getApp().getFontStyle() });
  // 返回值直接绑定到 <page-meta page-style="{{pageStyle}}" />
  // 只产出 CSS 变量的覆盖值，不产出任何具体字号，页面里因此不需要写死字号
  //
  // 除字号缩放外，这里同时注入「节气主题」：24 节气各一组强调色板
  // （utils/solarTheme.js），覆盖 --color-green 系全局变量，
  // 让声明条 / 选中态 / 徽章 / 浅底色块跟着节气变化。每页 onShow 重算，
  // 跨节气边界（如 11/7 立冬）用户冷启动即可看到整体换色。
  getFontStyle() {
    const parts = [];
    const scale = this.globalData.fontScale || 1;
    if (scale !== 1) {
      const toRpx = (n) => `${Number((n * scale).toFixed(1))}rpx`;
      parts.push(
        `--font-base:${toRpx(BASE_FONT_RPX.base)}`,
        `--font-title:${toRpx(BASE_FONT_RPX.title)}`,
        `--font-btn:${toRpx(BASE_FONT_RPX.btn)}`,
        `--font-subtitle:${toRpx(BASE_FONT_RPX.subtitle)}`,
        `--font-caption:${toRpx(BASE_FONT_RPX.caption)}`
      );
    }
    parts.push(solarTheme.styleVarsOf(this.getTermInfo().theme));
    return parts.join(';') + ';';
  },

  // —— 登录后的功能引导（components/guide-tour）——
  // 状态放在 globalData：引导要跨三个 tab 走完，页面之间只认这里的一份进度。
  // 每页 onShow 调 tourStateOf(自己)，只有「当前这一站就在本页」时才显示遮罩。
  startTour() {
    this.globalData.tour = { active: true, index: 0 };
    return this.tourStateOf(require('./utils/tour').STEPS[0].page);
  },

  tourStateOf(page) {
    const steps = require('./utils/tour').STEPS;
    const s = this.globalData.tour || { active: false, index: 0 };
    const step = steps[s.index] || null;
    return {
      active: !!s.active,
      index: s.index,
      step,
      total: steps.length,
      visible: !!(s.active && step && step.page === page),
    };
  },

  nextTour() {
    const steps = require('./utils/tour').STEPS;
    const s = this.globalData.tour || { active: false, index: 0 };
    if (!s.active) return null;
    const next = s.index + 1;
    if (next >= steps.length) {
      this.endTour();
      return null;
    }
    this.globalData.tour = { active: true, index: next };
    return this.tourStateOf(steps[next].page);
  },

  endTour() {
    this.globalData.tour = { active: false, index: 0 };
    try {
      wx.setStorageSync('tourDone', true);
    } catch (err) {
      // 存不下只是下次登录还会再引导一遍，不影响使用
    }
  },

  hasTourRun() {
    try {
      return !!wx.getStorageSync('tourDone');
    } catch (err) {
      return false;
    }
  },

  // 当前节气信息（首页 hero / 节气页头图用；海报与主题色都从这取）
  // 优先采信知识库的节气窗口（data/terms.js 的真实起止日），保证「海报上的节气」
  // 与「当令菜列表」是同一口径；知识库缺失时才回落到 solarTheme 的日期近似表。
  getTermInfo() {
    try {
      const dataSource = require('./utils/dataSource');
      const cur = dataSource.getCurrentTerm();
      if (cur && cur.name) {
        const info = solarTheme.getThemeByName(cur.name);
        if (info) {
          const win = cur.dateWindow || [];
          const parts = (win[0] || '').split('-');
          const dateText =
            parts.length === 2 ? `${Number(parts[0])}月${Number(parts[1])}日` : '';
          return Object.assign({}, info, { dateText, isTermDay: false });
        }
      }
    } catch (err) {
      // 拿不到知识库就回落到日期表，不阻断页面
    }
    return solarTheme.getTermInfo();
  },
});
